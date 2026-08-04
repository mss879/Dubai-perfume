-- ============================================================================
-- 44. Launch hardening: courier phone, discount pre-check, contact write path,
--     rate limiting — plus the owner's new free-delivery threshold
--
-- Follows 39–43. Four defects found in the pre-launch audit, and one business
-- change:
--
--   1. place_order() has declared p_phone since migration 40 and has never done
--      anything with it — public.orders has no phone column at all. On a
--      cash-on-delivery store that means the courier has an address and no way
--      to reach the customer. Every order placed so far has lost the number.
--
--   2. Discount codes were only ever judged inside place_order(), at the moment
--      of submission. A wrong code failed the whole checkout instead of the
--      code field, so the shopper lost the order to a typo.
--
--   3. contact_inquiries carried "FOR INSERT TO public WITH CHECK (true)" from
--      migration 18. Anyone with the public anon key could POST straight to
--      PostgREST, so every anti-spam control on the contact page was decorative,
--      and `message` is unbounded TEXT.
--
--   4. Nothing anywhere is rate limited. An unauthenticated script can place
--      real COD orders in a loop — draining the stock seeded in 43 and firing
--      unlimited outbound mail — with no ceiling.
--
-- Business change (owner): free delivery now starts at AED 300, not 250. The
-- flat fee below it stays AED 25. src/app/lib/shipping.ts mirrors this.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Somewhere to keep the customer's phone number
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- ---------------------------------------------------------------------------
-- 2. place_order: store the phone, and move the free-delivery threshold to 300
--
-- Identical signature to migration 42, so this replaces in place. Everything
-- else — server-side re-pricing, size validation, the inventory lock, discount
-- redemption under FOR UPDATE, the payment allowlist, the spend rollup — is
-- carried over unchanged.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.place_order(
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT,
    p_shipping JSONB,
    p_items JSONB,
    p_discount_code TEXT DEFAULT NULL,
    p_abandoned_cart_id UUID DEFAULT NULL,
    p_currency TEXT DEFAULT 'AED',
    p_exchange_rate NUMERIC DEFAULT 1,
    p_payment_method TEXT DEFAULT 'cod',
    p_payment_status TEXT DEFAULT 'pending_collection'
) RETURNS JSONB AS $$
DECLARE
    v_order_id TEXT;
    v_item JSONB;
    v_product public.products%ROWTYPE;
    v_qty INT;
    v_size TEXT;
    v_stock INT;
    v_subtotal NUMERIC(10,2) := 0;
    v_shipping_fee NUMERIC(10,2) := 0;
    v_discount public.discounts%ROWTYPE;
    v_discount_amount NUMERIC(10,2) := 0;
    v_total NUMERIC(10,2);
    v_free_shipping_threshold CONSTANT NUMERIC := 300;
    v_flat_shipping_fee CONSTANT NUMERIC := 25;
    v_line_count INT;
    v_customer_id UUID := auth.uid();
BEGIN
    -- Input validation
    IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 255 THEN
        RAISE EXCEPTION 'invalid_email';
    END IF;
    IF p_shipping IS NULL OR jsonb_typeof(p_shipping) <> 'object' THEN
        RAISE EXCEPTION 'invalid_shipping_address';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'invalid_items';
    END IF;
    v_line_count := jsonb_array_length(p_items);
    IF v_line_count < 1 OR v_line_count > 50 THEN
        RAISE EXCEPTION 'invalid_items';
    END IF;
    IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'invalid_currency';
    END IF;
    IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 OR p_exchange_rate > 1000 THEN
        RAISE EXCEPTION 'invalid_exchange_rate';
    END IF;

    -- Payment seam. The client names a method; the pairing of method to an
    -- initial payment status is fixed HERE so a caller cannot declare an order
    -- paid. A future gateway adds its own allowed pair alongside this one.
    IF NOT (p_payment_method = 'cod' AND p_payment_status = 'pending_collection') THEN
        RAISE EXCEPTION 'unsupported_payment_method';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INT, 0);
        v_size := COALESCE(v_item->>'size', '');
        IF v_qty < 1 OR v_qty > 20 THEN
            RAISE EXCEPTION 'invalid_quantity';
        END IF;

        SELECT * INTO v_product FROM public.products
        WHERE id = (v_item->>'product_id')::INT;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'unknown_product:%', v_item->>'product_id';
        END IF;
        IF v_product.sizes IS NOT NULL AND array_length(v_product.sizes, 1) > 0
           AND NOT (v_size = ANY(v_product.sizes)) THEN
            RAISE EXCEPTION 'invalid_size:%', v_product.name;
        END IF;

        -- Lock the inventory row; missing rows are treated as not stock-tracked.
        -- See the operations note at the foot of migration 42.
        SELECT stock_level INTO v_stock FROM public.inventory
        WHERE product_id = v_product.id AND size = v_size
        FOR UPDATE;
        IF FOUND THEN
            IF v_stock < v_qty THEN
                RAISE EXCEPTION 'out_of_stock:%', v_product.name;
            END IF;
            UPDATE public.inventory SET stock_level = stock_level - v_qty
            WHERE product_id = v_product.id AND size = v_size;
        END IF;

        v_subtotal := v_subtotal + (v_product.price * v_qty);
    END LOOP;

    IF v_subtotal < v_free_shipping_threshold THEN
        v_shipping_fee := v_flat_shipping_fee;
    END IF;

    -- Discount redemption (atomic: row locked, usage counted here only)
    IF p_discount_code IS NOT NULL AND length(trim(p_discount_code)) > 0 THEN
        SELECT * INTO v_discount FROM public.discounts
        WHERE upper(code) = upper(trim(p_discount_code))
          AND is_active = TRUE
          AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
          AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'invalid_discount_code';
        END IF;
        IF v_discount.usage_limit IS NOT NULL AND v_discount.usage_count >= v_discount.usage_limit THEN
            RAISE EXCEPTION 'discount_exhausted';
        END IF;
        IF v_subtotal < COALESCE(v_discount.min_requirement, 0) THEN
            RAISE EXCEPTION 'discount_minimum_not_met:%', v_discount.min_requirement;
        END IF;
        IF v_discount.type = 'percentage' THEN
            v_discount_amount := round(v_subtotal * v_discount.value / 100, 2);
        ELSE
            v_discount_amount := LEAST(v_discount.value, v_subtotal);
        END IF;
        UPDATE public.discounts SET usage_count = usage_count + 1 WHERE id = v_discount.id;
    END IF;

    v_total := GREATEST(v_subtotal - v_discount_amount, 0) + v_shipping_fee;
    v_order_id := 'ORD-' || nextval('public.order_number_seq')::TEXT;

    INSERT INTO public.orders (
        id, customer_id, email, phone, total_price, status, shipping_address,
        currency, exchange_rate, converted_total,
        payment_method, payment_status, discount_code, discount_amount, shipping_fee
    ) VALUES (
        v_order_id, v_customer_id, lower(p_email), left(p_phone, 50), v_total, 'pending', p_shipping,
        p_currency, p_exchange_rate, round(v_total * p_exchange_rate, 2)::TEXT || ' ' || p_currency,
        p_payment_method, p_payment_status,
        CASE WHEN v_discount_amount > 0 THEN upper(trim(p_discount_code)) END,
        v_discount_amount, v_shipping_fee
    );

    INSERT INTO public.order_items (order_id, product_id, size, quantity, unit_price)
    SELECT v_order_id,
           (item->>'product_id')::INT,
           item->>'size',
           (item->>'quantity')::INT,
           p.price
    FROM jsonb_array_elements(p_items) AS item
    JOIN public.products p ON p.id = (item->>'product_id')::INT;

    INSERT INTO public.order_tracking (order_id, status, location, description)
    VALUES (v_order_id, 'Order Placed', 'Dubai Headquarters',
            'We have received your order. Payment is collected on delivery.');

    -- Keep the customer registry truthful (previously never maintained).
    IF v_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET total_spent = COALESCE(total_spent, 0) + v_total,
            orders_count = COALESCE(orders_count, 0) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_customer_id;
    END IF;

    -- Convert the shopper's abandoned cart (email-guarded)
    IF p_abandoned_cart_id IS NOT NULL THEN
        UPDATE public.abandoned_carts
        SET converted = TRUE, converted_order_id = v_order_id, updated_at = CURRENT_TIMESTAMP
        WHERE id = p_abandoned_cart_id AND lower(email) = lower(p_email);
    END IF;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'subtotal', v_subtotal,
        'shipping_fee', v_shipping_fee,
        'discount_amount', v_discount_amount,
        'total', v_total,
        'currency', p_currency,
        'payment_method', p_payment_method,
        'payment_status', p_payment_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.place_order(
    TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(
    TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC, TEXT, TEXT
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. validate_discount: judge a code before the shopper commits the order
--
-- Read-only by design. It answers the same questions place_order asks and gives
-- the cart something to display, but it never touches usage_count — only a
-- redeemed order consumes a use, and only place_order redeems.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_discount(
    p_code TEXT,
    p_subtotal NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_discount public.discounts%ROWTYPE;
    v_subtotal NUMERIC := GREATEST(COALESCE(p_subtotal, 0), 0);
    v_minimum NUMERIC;
    v_amount NUMERIC := 0;
BEGIN
    IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0,
                                  'reason', 'invalid', 'minimum', NULL);
    END IF;

    SELECT * INTO v_discount FROM public.discounts
    WHERE upper(code) = upper(trim(p_code));

    -- A code that is switched off or not yet live reads as "invalid" rather than
    -- "expired" — telling a shopper a future code has expired is just wrong.
    IF NOT FOUND OR v_discount.is_active IS NOT TRUE
       OR (v_discount.starts_at IS NOT NULL AND v_discount.starts_at > CURRENT_TIMESTAMP) THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0,
                                  'reason', 'invalid', 'minimum', NULL);
    END IF;

    IF v_discount.ends_at IS NOT NULL AND v_discount.ends_at < CURRENT_TIMESTAMP THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0,
                                  'reason', 'expired', 'minimum', NULL);
    END IF;

    IF v_discount.usage_limit IS NOT NULL AND v_discount.usage_count >= v_discount.usage_limit THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0,
                                  'reason', 'exhausted', 'minimum', NULL);
    END IF;

    v_minimum := COALESCE(v_discount.min_requirement, 0);
    IF v_subtotal < v_minimum THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0,
                                  'reason', 'minimum_not_met', 'minimum', v_minimum);
    END IF;

    IF v_discount.type = 'percentage' THEN
        v_amount := round(v_subtotal * v_discount.value / 100, 2);
    ELSE
        v_amount := LEAST(v_discount.value, v_subtotal);
    END IF;

    RETURN jsonb_build_object('valid', TRUE, 'discount_amount', v_amount, 'reason', NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.validate_discount(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_discount(TEXT, NUMERIC) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Contact form: one write path, validated on the server
--
-- The bounds live here because this function becomes the only way in — the
-- open INSERT policy from migration 18 is dropped below, so `message` being
-- unbounded TEXT no longer means an unbounded message.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_contact_inquiry(
    p_name TEXT,
    p_email TEXT,
    p_subject TEXT,
    p_message TEXT
) RETURNS VOID AS $$
DECLARE
    v_name TEXT := trim(COALESCE(p_name, ''));
    v_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_subject TEXT := trim(COALESCE(p_subject, ''));
    v_message TEXT := trim(COALESCE(p_message, ''));
BEGIN
    IF length(v_name) < 1 OR length(v_name) > 255 THEN
        RAISE EXCEPTION 'invalid_name';
    END IF;
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 255 THEN
        RAISE EXCEPTION 'invalid_email';
    END IF;
    IF length(v_subject) < 1 OR length(v_subject) > 255 THEN
        RAISE EXCEPTION 'invalid_subject';
    END IF;
    IF length(v_message) < 15 OR length(v_message) > 2000 THEN
        RAISE EXCEPTION 'invalid_message';
    END IF;

    INSERT INTO public.contact_inquiries (name, email, subject, message)
    VALUES (v_name, v_email, v_subject, v_message);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.submit_contact_inquiry(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_contact_inquiry(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Close the direct anonymous insert. Admins keep the read/delete policies from
-- migration 18 untouched, and gain the insert path they never had.
DROP POLICY IF EXISTS "Allow public insert contact inquiries" ON public.contact_inquiries;
DROP POLICY IF EXISTS "Admin insert contact inquiries" ON public.contact_inquiries;

CREATE POLICY "Admin insert contact inquiries"
    ON public.contact_inquiries FOR INSERT TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Rate limiting
--
-- A hit log rather than a counter, so the window slides instead of resetting on
-- a boundary. The table is written only through check_rate_limit() — RLS is on
-- and no policy grants anon anything, which is deliberate.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
    id BIGSERIAL PRIMARY KEY,
    bucket TEXT NOT NULL,
    hit_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_bucket_time
    ON public.rate_limit_hits (bucket, hit_at DESC);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_bucket TEXT,
    p_max INT,
    p_window_seconds INT
) RETURNS BOOLEAN AS $$
DECLARE
    v_bucket TEXT;
    v_cutoff TIMESTAMP WITH TIME ZONE;
    v_hits INT;
BEGIN
    -- A caller that asks nonsense must not be able to lock the store shut.
    IF p_bucket IS NULL OR length(trim(p_bucket)) = 0
       OR p_max IS NULL OR p_max < 1
       OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
        RETURN TRUE;
    END IF;

    -- Truncated so a caller cannot bloat the table with a giant bucket key.
    v_bucket := left(trim(p_bucket), 200);
    v_cutoff := now() - make_interval(secs => p_window_seconds);

    -- Expired hits are cleared on the way past, which keeps the table small
    -- without a scheduled job.
    DELETE FROM public.rate_limit_hits
    WHERE bucket = v_bucket AND hit_at < v_cutoff;

    SELECT count(*) INTO v_hits FROM public.rate_limit_hits
    WHERE bucket = v_bucket AND hit_at >= v_cutoff;

    IF v_hits >= p_max THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.rate_limit_hits (bucket) VALUES (v_bucket);
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operations note:
--
-- Place one test order under AED 300 and one at AED 300 or over, then run:
--
--   SELECT id, phone, shipping_fee, total_price
--   FROM public.orders ORDER BY created_at DESC LIMIT 2;
--
-- phone must hold the number typed at checkout — it was discarded before this
-- migration, so every earlier order shows NULL and cannot be backfilled.
-- shipping_fee must be 25 on the under-300 order and 0 on the other; that is the
-- threshold moving from 250 to 300, and src/app/lib/shipping.ts must agree.
--
-- Also confirm the contact page still delivers: it now writes only through
-- public.submit_contact_inquiry(), and a direct anonymous INSERT into
-- public.contact_inquiries is expected to be refused.
-- ---------------------------------------------------------------------------
