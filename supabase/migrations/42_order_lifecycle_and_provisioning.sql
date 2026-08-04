-- ============================================================================
-- 42. Order lifecycle, customer provisioning and the payment seam
--
-- Follows 38–41. Fixes three defects found while hardening the release:
--
--   1. handle_new_user() used ON CONFLICT (email) DO NOTHING, so if a row
--      already held the signup email (e.g. the seeded admin@gharib.com) the new
--      auth user never received a customers row. is_admin(auth.uid()) then
--      returned FALSE forever and every owner-scoped RLS policy failed shut.
--      The account was silently orphaned — including the account the rollout
--      guide tells the owner to promote.
--
--   2. place_order() never maintained customers.total_spent / orders_count, and
--      no trigger did either, so the admin customer registry showed 0 for every
--      real order.
--
--   3. The order status vocabulary disagreed across the stack. place_order wrote
--      'processing', which the admin dropdown did not offer; the customer
--      stepper only understood 'shipped'/'delivered', so an order marked
--      'out_for_delivery' still displayed as freshly placed. The canonical list
--      now lives in src/app/lib/orders.ts and is mirrored here.
--
-- Also makes the payment seam real: place_order accepts the method and the
-- provider-declared payment status, validated here against an allowlist so a
-- client cannot claim an order is paid.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Customer provisioning that cannot orphan an account
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name VARCHAR(255) := '';
    v_last_name VARCHAR(255) := '';
    v_phone VARCHAR(50) := '';
    v_conflict_id UUID;
BEGIN
    IF new.email IS NULL THEN
        RETURN new;
    END IF;

    IF new.raw_user_meta_data IS NOT NULL THEN
        v_first_name := COALESCE(new.raw_user_meta_data->>'first_name', '');
        v_last_name  := COALESCE(new.raw_user_meta_data->>'last_name', '');
        v_phone      := COALESCE(new.raw_user_meta_data->>'phone', '');
    END IF;

    -- Already provisioned (e.g. trigger re-fired) — nothing to do.
    IF EXISTS (SELECT 1 FROM public.customers WHERE id = new.id) THEN
        RETURN new;
    END IF;

    -- Does a row already hold this email under a different id?
    SELECT id INTO v_conflict_id
    FROM public.customers
    WHERE lower(email) = lower(new.email)
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_conflict_id) THEN
            -- A live account already owns this email. auth.users.email is
            -- unique, so this should be unreachable; fail loudly rather than
            -- silently leaving the new user without a profile.
            RAISE EXCEPTION 'customer_email_conflict:%', new.email;
        END IF;

        -- Orphan/seed row (no matching auth user). Remove it so the real
        -- account can take the email. Note this deliberately does NOT carry
        -- over is_admin: inheriting a seeded admin flag by signing up with its
        -- email is exactly the hijack migration 38 closed.
        DELETE FROM public.customers WHERE id = v_conflict_id;
    END IF;

    INSERT INTO public.customers (
        id, first_name, last_name, email, phone, note,
        total_spent, orders_count, is_admin
    )
    VALUES (
        new.id, v_first_name, v_last_name, new.email, v_phone,
        'Auto-registered Privé Member.', 0.00, 0, FALSE
    )
    ON CONFLICT (id) DO NOTHING;

    -- Link historical guest orders for this email to the new account. The
    -- orders SELECT policy already grants access by email = auth.email(), so
    -- this adds no visibility the email-based policy does not already grant.
    UPDATE public.orders SET customer_id = new.id
    WHERE email = new.email AND customer_id IS NULL;

    -- Adopt the spend history those orders represent.
    UPDATE public.customers c
    SET total_spent = COALESCE(agg.spent, 0),
        orders_count = COALESCE(agg.cnt, 0)
    FROM (
        SELECT COALESCE(SUM(total_price), 0) AS spent, COUNT(*) AS cnt
        FROM public.orders
        WHERE customer_id = new.id AND status <> 'cancelled'
    ) agg
    WHERE c.id = new.id;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2. Canonical order status vocabulary
-- ---------------------------------------------------------------------------

-- Orders created by the previous place_order() used a status the admin panel
-- could not display or set. Move them onto the canonical initial status.
UPDATE public.orders SET status = 'pending' WHERE status = 'processing';

-- ---------------------------------------------------------------------------
-- 3. place_order: payment seam + customer spend rollup + canonical status
--
-- The parameter list changes, so the previous signature is dropped rather than
-- replaced (CREATE OR REPLACE cannot add parameters).
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.place_order(
    TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC
);

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
    v_free_shipping_threshold CONSTANT NUMERIC := 250;
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
        -- See the operations note at the foot of this file.
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
        id, customer_id, email, total_price, status, shipping_address,
        currency, exchange_rate, converted_total,
        payment_method, payment_status, discount_code, discount_amount, shipping_fee
    ) VALUES (
        v_order_id, v_customer_id, lower(p_email), v_total, 'pending', p_shipping,
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
-- 4. Backfill the spend rollup for orders placed before this migration
-- ---------------------------------------------------------------------------

UPDATE public.customers c
SET total_spent = COALESCE(agg.spent, 0),
    orders_count = COALESCE(agg.cnt, 0)
FROM (
    SELECT customer_id,
           SUM(total_price) AS spent,
           COUNT(*) AS cnt
    FROM public.orders
    WHERE customer_id IS NOT NULL AND status <> 'cancelled'
    GROUP BY customer_id
) agg
WHERE c.id = agg.customer_id;

-- ---------------------------------------------------------------------------
-- OPERATIONS NOTE — stock tracking
--
-- place_order only enforces stock for (product_id, size) pairs that HAVE an
-- inventory row; a product with no row is treated as not stock-tracked and
-- always sells. Most of the catalogue currently has no inventory rows, so the
-- "inventory is decremented" guarantee applies only to products you have
-- actually stocked in the admin Inventory Tracker.
--
-- This migration deliberately does NOT invent stock levels. When you know your
-- real counts, either enter them in the admin panel, or seed a baseline by
-- running the statement below with a number you choose:
--
--   INSERT INTO public.inventory (product_id, size, stock_level)
--   SELECT p.id, s.size, 0            -- <- replace 0 with your real count
--   FROM public.products p
--   CROSS JOIN LATERAL unnest(COALESCE(p.sizes, ARRAY['50ml'])) AS s(size)
--   ON CONFLICT (product_id, size) DO NOTHING;
--
-- Seeding 0 makes every seeded line refuse to sell until you raise it, which is
-- the safe default if you want hard stock control from day one.
-- ---------------------------------------------------------------------------
