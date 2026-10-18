-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Migration 67: discount codes that cover part of an order
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Until now every code took its saving off the whole order. A code can now cover:
--
--   'order'        the whole order (every existing code; nothing about them changes)
--   'products'     only the perfumes chosen in discounts.product_ids
--   'collections'  only perfumes in the collections in discounts.collection_ids. That means
--                  linked perfumes plus, for a brand page, every perfume of that brand, exactly
--                  as the shop's collection page shows them.
--   'delivery'     the delivery fee. 100% off is "free delivery". It only applies when the order
--                  actually pays for delivery (under the free-delivery amount).
--
-- One calculation, discount_quote(), prices a code for place_order(), for check_discount()
-- (the checkout preview and the agent), and for validate_discount() (kept, same signature,
-- now a thin wrapper), so the preview and the real order can never disagree.
--
-- place_order() below is migration 63's, line for line, except its discount lines:
--   * the saving comes from discount_quote() instead of being computed inline,
--   * a delivery saving comes off the delivery fee, never the goods,
--   * a code that covers nothing in the bag is refused ('discount_not_applicable').
-- Nothing about payments changes: Paymob is asked for the order total, as before.
--
-- list_live_offers() (migration 55) is recreated with two more columns (what a code covers),
-- so the shop's agent can describe a code truthfully. Its rules are unchanged.
--
-- Safe to run more than once. Run it after 63 (and after 64-66 if you run those too).
-- ══════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
    v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF to_regclass('public.payment_settings') IS NULL THEN v_missing := array_append(v_missing, 'public.payment_settings (migration 63)'); END IF;
    IF to_regclass('public.order_payments') IS NULL THEN v_missing := array_append(v_missing, 'public.order_payments (migration 63)'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'concierge_only') THEN
        v_missing := array_append(v_missing, 'public.discounts.concierge_only (migration 55)');
    END IF;
    IF to_regprocedure('public.check_rate_limit(text, integer, integer)') IS NULL THEN
        v_missing := array_append(v_missing, 'public.check_rate_limit (migration 44)');
    END IF;
    IF to_regclass('public.product_collections') IS NULL OR to_regclass('public.collections') IS NULL THEN
        v_missing := array_append(v_missing, 'public.collections / product_collections');
    END IF;
    IF array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'Migration 67 stopped before changing anything. Missing: %', array_to_string(v_missing, ', ');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. What a code covers. Existing codes become 'order', which is what they did.
-- ---------------------------------------------------------------------------
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'order';
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS product_ids INT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS collection_ids TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_applies_to_check;
ALTER TABLE public.discounts ADD CONSTRAINT discounts_applies_to_check
    CHECK (applies_to IN ('order', 'products', 'collections', 'delivery'));

ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_target_items_check;
ALTER TABLE public.discounts ADD CONSTRAINT discounts_target_items_check
    CHECK ((applies_to <> 'products' OR cardinality(product_ids) BETWEEN 1 AND 500)
       AND (applies_to <> 'collections' OR cardinality(collection_ids) BETWEEN 1 AND 100));

-- ---------------------------------------------------------------------------
-- 2. discount_quote(): the one calculation. Internal: only the functions below call it.
--    Returns {goods, delivery, priced}. With p_items NULL (only a subtotal known), a
--    perfume or collection code cannot be priced yet: priced = false, goods = null.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discount_quote(
    p_discount public.discounts,
    p_items JSONB,
    p_subtotal NUMERIC,
    p_shipping_fee NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_target TEXT := COALESCE(p_discount.applies_to, 'order');
    v_base NUMERIC := 0;
BEGIN
    IF v_target = 'delivery' THEN
        v_base := GREATEST(COALESCE(p_shipping_fee, 0), 0);
        RETURN jsonb_build_object(
            'goods', 0,
            'delivery', CASE WHEN p_discount.type = 'percentage'
                             THEN round(v_base * LEAST(p_discount.value, 100) / 100, 2)
                             ELSE LEAST(p_discount.value, v_base) END,
            'priced', TRUE);
    END IF;

    IF v_target = 'order' THEN
        v_base := GREATEST(COALESCE(p_subtotal, 0), 0);
    ELSIF p_items IS NULL THEN
        RETURN jsonb_build_object('goods', NULL, 'delivery', 0, 'priced', FALSE);
    ELSE
        SELECT COALESCE(sum(p.price * (item->>'quantity')::INT), 0) INTO v_base
        FROM jsonb_array_elements(p_items) AS item
        JOIN public.products p ON p.id = (item->>'product_id')::INT
        WHERE (v_target = 'products' AND p.id = ANY(p_discount.product_ids))
           OR (v_target = 'collections' AND (
                   EXISTS (SELECT 1 FROM public.product_collections pc
                           WHERE pc.product_id = p.id AND pc.collection_id = ANY(p_discount.collection_ids))
                OR EXISTS (SELECT 1 FROM public.collections c
                           WHERE c.id = ANY(p_discount.collection_ids)
                             AND NULLIF(btrim(c.brand), '') IS NOT NULL
                             AND upper(btrim(c.brand)) = upper(btrim(p.brand)))));
    END IF;

    -- Exactly the old whole-order arithmetic, applied to what the code covers.
    RETURN jsonb_build_object(
        'goods', CASE WHEN p_discount.type = 'percentage'
                      THEN round(v_base * p_discount.value / 100, 2)
                      ELSE LEAST(p_discount.value, v_base) END,
        'delivery', 0,
        'priced', TRUE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.discount_quote(public.discounts, JSONB, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. discount_target_label(): a few words on what a code covers, for the agent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discount_target_label(p_discount public.discounts)
RETURNS TEXT AS $$
DECLARE
    v_names TEXT;
    v_count INT;
BEGIN
    CASE COALESCE(p_discount.applies_to, 'order')
    WHEN 'delivery' THEN
        RETURN 'delivery';
    WHEN 'products' THEN
        SELECT string_agg(x.label, ', '), max(x.total) INTO v_names, v_count FROM (
            SELECT initcap(lower(p.brand)) || ' ' || replace(p.name, '_', ' ') AS label, count(*) OVER () AS total
            FROM public.products p WHERE p.id = ANY(p_discount.product_ids)
            ORDER BY p.brand, p.name LIMIT 3) x;
        IF v_names IS NULL THEN RETURN 'selected perfumes'; END IF;
        v_count := cardinality(p_discount.product_ids);
        RETURN v_names || CASE WHEN v_count > 3 THEN ' and ' || (v_count - 3) || ' more' ELSE '' END;
    WHEN 'collections' THEN
        SELECT string_agg(c.title, ', ' ORDER BY c.title) INTO v_names
        FROM public.collections c WHERE c.id = ANY(p_discount.collection_ids);
        RETURN COALESCE(v_names, 'selected collections') || ' collection' || CASE WHEN cardinality(p_discount.collection_ids) > 1 THEN 's' ELSE '' END;
    ELSE
        RETURN 'the whole order';
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.discount_target_label(public.discounts) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. check_discount(): the checkout preview and the agent.
--    p_items: the bag as [{product_id, quantity}], priced from the catalogue, never from
--    the caller. Without it, p_subtotal is used and perfume/collection codes come back
--    valid but unpriced (discount_amount null).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_discount(
    p_code TEXT,
    p_items JSONB DEFAULT NULL,
    p_subtotal NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_discount public.discounts%ROWTYPE;
    v_items JSONB := NULL;
    v_subtotal NUMERIC;
    v_shipping NUMERIC;
    v_minimum NUMERIC;
    v_quote JSONB;
    v_goods NUMERIC;
    v_delivery NUMERIC;
    v_target TEXT;
BEGIN
    IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'invalid', 'minimum', NULL);
    END IF;

    IF p_items IS NOT NULL THEN
        IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 50 THEN
            RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'invalid', 'minimum', NULL);
        END IF;
        -- Only well-formed lines count; prices come from the catalogue.
        SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', (e->>'product_id')::INT,
                                                     'quantity', (e->>'quantity')::INT)), '[]'::jsonb)
        INTO v_items
        FROM jsonb_array_elements(p_items) e
        WHERE jsonb_typeof(e) = 'object'
          AND COALESCE(e->>'product_id', '') ~ '^[0-9]{1,9}$'
          AND COALESCE(e->>'quantity', '') ~ '^[0-9]{1,2}$'
          AND (e->>'quantity')::INT BETWEEN 1 AND 20;
        SELECT COALESCE(sum(p.price * (i->>'quantity')::INT), 0) INTO v_subtotal
        FROM jsonb_array_elements(v_items) i
        JOIN public.products p ON p.id = (i->>'product_id')::INT;
    ELSE
        v_subtotal := GREATEST(COALESCE(p_subtotal, 0), 0);
    END IF;

    -- The same rule as place_order (and lib/shipping.ts): free from AED 300, else AED 25.
    v_shipping := CASE WHEN v_subtotal < 300 THEN 25 ELSE 0 END;

    SELECT * INTO v_discount FROM public.discounts
    WHERE upper(code) = upper(trim(p_code));

    IF NOT FOUND OR v_discount.is_active IS NOT TRUE
       OR (v_discount.starts_at IS NOT NULL AND v_discount.starts_at > CURRENT_TIMESTAMP) THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'invalid', 'minimum', NULL);
    END IF;
    IF v_discount.ends_at IS NOT NULL AND v_discount.ends_at < CURRENT_TIMESTAMP THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'expired', 'minimum', NULL);
    END IF;
    IF v_discount.usage_limit IS NOT NULL AND v_discount.usage_count >= v_discount.usage_limit THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'exhausted', 'minimum', NULL);
    END IF;

    v_minimum := COALESCE(v_discount.min_requirement, 0);
    IF v_subtotal < v_minimum THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'minimum_not_met', 'minimum', v_minimum);
    END IF;

    v_target := COALESCE(v_discount.applies_to, 'order');
    v_quote := public.discount_quote(v_discount, v_items, v_subtotal, v_shipping);

    IF NOT (v_quote->>'priced')::BOOLEAN THEN
        RETURN jsonb_build_object('valid', TRUE, 'discount_amount', NULL, 'reason', NULL,
                                  'applies_to', v_target, 'applies_label', public.discount_target_label(v_discount),
                                  'priced', FALSE);
    END IF;

    v_goods := COALESCE((v_quote->>'goods')::NUMERIC, 0);
    v_delivery := COALESCE((v_quote->>'delivery')::NUMERIC, 0);

    IF v_target <> 'order' AND v_goods + v_delivery <= 0 THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0,
                                  'reason', CASE WHEN v_target = 'delivery' THEN 'delivery_already_free' ELSE 'not_applicable' END,
                                  'minimum', NULL, 'applies_to', v_target,
                                  'applies_label', public.discount_target_label(v_discount));
    END IF;

    RETURN jsonb_build_object('valid', TRUE, 'discount_amount', v_goods + v_delivery, 'reason', NULL,
                              'goods', v_goods, 'delivery', v_delivery,
                              'applies_to', v_target, 'applies_label', public.discount_target_label(v_discount),
                              'priced', TRUE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.check_discount(TEXT, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_discount(TEXT, JSONB, NUMERIC) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. validate_discount(): same signature and grants as migration 44, now the
--    subtotal-only form of check_discount(). For a whole-order code the answer
--    is exactly what it was.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_discount(
    p_code TEXT,
    p_subtotal NUMERIC
) RETURNS JSONB AS $$
    SELECT public.check_discount(p_code, NULL::JSONB, p_subtotal);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.validate_discount(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_discount(TEXT, NUMERIC) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. place_order(): migration 63's, with only the discount lines changed (see the header).
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
    v_discount_id INT;
    v_discount_amount NUMERIC(10,2) := 0;
    -- Migration 67: a delivery code takes its saving off the delivery fee.
    v_ship_discount NUMERIC(10,2) := 0;
    v_quote JSONB;
    v_total NUMERIC(10,2);
    v_free_shipping_threshold CONSTANT NUMERIC := 300;
    v_flat_shipping_fee CONSTANT NUMERIC := 25;
    v_line_count INT;
    v_customer_id UUID := auth.uid();
    v_mode TEXT;
    v_online BOOLEAN;
    v_reserved JSONB := '[]'::jsonb;
    v_token TEXT;
    v_cart_id UUID;
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

    -- Payment seam. The pairing of method to initial status is fixed HERE, and
    -- the owner's switch decides which pair is open. 'paid' is only ever
    -- reached through payment_apply_transaction(), which needs the secret.
    v_mode := COALESCE((SELECT mode FROM public.payment_settings WHERE id), 'cod');
    IF p_payment_method = 'cod' AND p_payment_status = 'pending_collection' AND v_mode = 'cod' THEN
        v_online := FALSE;
    ELSIF p_payment_method = 'paymob' AND p_payment_status = 'awaiting_payment' AND v_mode = 'online'
          AND EXISTS (SELECT 1 FROM public.app_config WHERE name = 'payments' AND length(value) >= 20) THEN
        IF length(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g')) < 7 THEN
            RAISE EXCEPTION 'phone_required';
        END IF;
        v_online := TRUE;
    ELSE
        RAISE EXCEPTION 'unsupported_payment_method';
    END IF;

    -- Sorted, so concurrent orders (and releases) lock inventory rows in one
    -- global order and cannot deadlock each other.
    FOR v_item IN
        SELECT value FROM jsonb_array_elements(p_items)
        ORDER BY (value->>'product_id')::INT, COALESCE(value->>'size', '')
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
            v_reserved := v_reserved || jsonb_build_object(
                'product_id', v_product.id, 'size', v_size, 'qty', v_qty
            );
        END IF;

        v_subtotal := v_subtotal + (v_product.price * v_qty);
    END LOOP;

    IF v_subtotal < v_free_shipping_threshold THEN
        v_shipping_fee := v_flat_shipping_fee;
    END IF;

    -- Discount redemption (atomic: row locked, usage counted here only). For
    -- an online order the use is given back if it is never paid.
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
        -- Migration 67: what the code covers (the whole order, chosen perfumes,
        -- collections, or delivery), priced by the one calculation that
        -- check_discount() also uses, so the preview and the order agree.
        v_quote := public.discount_quote(v_discount, p_items, v_subtotal, v_shipping_fee);
        v_discount_amount := COALESCE((v_quote->>'goods')::NUMERIC, 0);
        v_ship_discount := COALESCE((v_quote->>'delivery')::NUMERIC, 0);
        IF COALESCE(v_discount.applies_to, 'order') <> 'order' AND v_discount_amount + v_ship_discount <= 0 THEN
            RAISE EXCEPTION 'discount_not_applicable';
        END IF;
        UPDATE public.discounts SET usage_count = usage_count + 1 WHERE id = v_discount.id;
        v_discount_id := v_discount.id;
    END IF;

    v_total := GREATEST(v_subtotal - v_discount_amount, 0) + GREATEST(v_shipping_fee - v_ship_discount, 0);

    IF v_online AND v_total <= 0 THEN
        RAISE EXCEPTION 'online_payment_not_needed';
    END IF;

    v_order_id := 'ORD-' || nextval('public.order_number_seq')::TEXT;

    INSERT INTO public.orders (
        id, customer_id, email, phone, total_price, status, shipping_address,
        currency, exchange_rate, converted_total,
        payment_method, payment_status, discount_code, discount_amount, shipping_fee
    ) VALUES (
        v_order_id, v_customer_id, lower(p_email), left(p_phone, 50), v_total, 'pending', p_shipping,
        p_currency, p_exchange_rate, round(v_total * p_exchange_rate, 2)::TEXT || ' ' || p_currency,
        p_payment_method, p_payment_status,
        CASE WHEN v_discount_amount + v_ship_discount > 0 THEN upper(trim(p_discount_code)) END,
        v_discount_amount + v_ship_discount, v_shipping_fee
    );

    INSERT INTO public.order_items (order_id, product_id, size, quantity, unit_price)
    SELECT v_order_id,
           (item->>'product_id')::INT,
           item->>'size',
           (item->>'quantity')::INT,
           p.price
    FROM jsonb_array_elements(p_items) AS item
    JOIN public.products p ON p.id = (item->>'product_id')::INT;

    IF v_online THEN
        INSERT INTO public.order_tracking (order_id, status, location, description)
        VALUES (v_order_id, 'Order Placed', 'Dubai Headquarters',
                'We have received your order and are awaiting confirmation of your payment.');

        -- 2 × UUIDv4 = 244 random bits, hex-encoded. Only the hash is kept.
        v_token := replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', '');

        IF p_abandoned_cart_id IS NOT NULL THEN
            SELECT id INTO v_cart_id FROM public.abandoned_carts
            WHERE id = p_abandoned_cart_id AND lower(email) = lower(p_email);
        END IF;

        INSERT INTO public.order_payments (
            order_id, view_token_hash, amount_fils, due_at,
            payer_first_name, payer_last_name, pending_cart_id, reserved_lines, discount_id
        ) VALUES (
            v_order_id,
            encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
            (v_total * 100)::INTEGER,
            -- Paymob's one-hour intention, plus ten minutes' grace.
            now() + interval '70 minutes',
            left(trim(COALESCE(p_first_name, '')), 50),
            left(trim(COALESCE(p_last_name, '')), 50),
            v_cart_id,
            v_reserved,
            v_discount_id
        );
    ELSE
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
    END IF;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'subtotal', v_subtotal,
        'shipping_fee', v_shipping_fee,
        'discount_amount', v_discount_amount + v_ship_discount,
        'total', v_total,
        'currency', p_currency,
        'payment_method', p_payment_method,
        'payment_status', p_payment_status,
        'payment_token', v_token
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
-- 7. list_live_offers(): migration 55's rules unchanged; two more columns. The return
--    type changes, so it is dropped and created again (with its grants).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_live_offers(UUID);
CREATE OR REPLACE FUNCTION public.list_live_offers(p_session_id UUID DEFAULT NULL)
RETURNS TABLE (
    code            TEXT,
    title           TEXT,
    kind            TEXT,
    value           NUMERIC,
    min_requirement NUMERIC,
    ends_at         TIMESTAMP WITH TIME ZONE,
    exclusive       BOOLEAN,
    -- New in 67: what the code covers, and a few words describing it.
    applies_to      TEXT,
    applies_label   TEXT
) AS $$
DECLARE
    v_exclusive BOOLEAN := FALSE;
BEGIN
    -- The exclusive slice is earned, not requested. A real shopper has had a
    -- conversation; a scraper wants the codes on the first call.
    IF p_session_id IS NOT NULL THEN
        SELECT TRUE INTO v_exclusive
          FROM public.concierge_sessions s
         WHERE s.id = p_session_id
           -- log_concierge_turn files 2 rows per turn, so 4 is two complete
           -- exchanges. NOT four turns.
           AND s.message_count >= 4
           -- A session created moments ago is a script, not a conversation.
           AND s.created_at   <  now() - interval '60 seconds'
           AND s.last_seen_at >  now() - interval '24 hours';

        v_exclusive := COALESCE(v_exclusive, FALSE)
            -- Even a genuine session may ask only so often, and the whole store
            -- only so much: the global bucket is the backstop for someone
            -- farming many forged sessions in parallel.
            AND public.check_rate_limit('offers:sess:' || p_session_id::TEXT, 6, 3600)
            AND public.check_rate_limit('offers:global', 400, 3600);
    END IF;

    RETURN QUERY
    SELECT d.code::TEXT,
           d.title::TEXT,
           d.type::TEXT,
           d.value,
           COALESCE(d.min_requirement, 0),
           d.ends_at,
           d.concierge_only,
           COALESCE(d.applies_to, 'order'),
           public.discount_target_label(d)
      FROM public.discounts d
     WHERE d.code IS NOT NULL
       AND d.is_active IS TRUE
       AND (d.starts_at IS NULL OR d.starts_at <= now())
       -- place_order uses >= CURRENT_TIMESTAMP, and raises discount_exhausted
       -- separately rather than filtering on the cap. Equivalent at the shop
       -- floor: a code this returns is one that will actually be honoured.
       AND (d.ends_at IS NULL OR d.ends_at >= now())
       AND (d.usage_limit IS NULL OR d.usage_count < d.usage_limit)
       AND (NOT d.concierge_only OR v_exclusive)
     ORDER BY d.concierge_only DESC, COALESCE(d.min_requirement, 0), d.code
     LIMIT 8;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.list_live_offers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_live_offers(UUID) TO anon, authenticated;

COMMIT;
