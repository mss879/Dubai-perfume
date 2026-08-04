-- Migration 40: Server-authoritative ordering (COD), sequence-backed order IDs,
--               inventory decrement, discount redemption, guarded cart capture
-- ════════════════════════════════════════════════════════════════════════════════
-- The storefront previously computed order IDs (4-digit random on a PK) and all
-- prices client-side, decremented no stock, and never redeemed discounts. This
-- migration moves the trusted path into SECURITY DEFINER functions that the app
-- calls from server route handlers (see /api/checkout, /api/abandoned-cart,
-- /api/track). Payment is cash-on-delivery only for now (owner decision); the
-- payment_* columns exist so a gateway can be added later without reshaping data.

-- 1. Payment / discount columns on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'cod';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'pending_collection';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(255);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code VARCHAR(100);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(10, 2) DEFAULT 0.00;

-- 2. Human-readable sequential order numbers (replaces ORD-<4-digit-random>)
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 10001;

-- 3. place_order: the only write path for storefront orders.
--    Re-prices every line from public.products, validates and decrements stock,
--    applies a discount code atomically, and writes orders + order_items +
--    order_tracking in one transaction. Returns the totals the server computed.
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
    p_exchange_rate NUMERIC DEFAULT 1
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

    -- Price and stock-check every line from the catalogue (never trust the client)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_qty := COALESCE((v_item->>'quantity')::INT, 0);
        v_size := COALESCE(v_item->>'size', '');
        IF v_qty < 1 OR v_qty > 20 THEN
            RAISE EXCEPTION 'invalid_quantity';
        END IF;

        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::INT;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'unknown_product:%', v_item->>'product_id';
        END IF;
        IF v_product.sizes IS NOT NULL AND array_length(v_product.sizes, 1) > 0
           AND NOT (v_size = ANY(v_product.sizes)) THEN
            RAISE EXCEPTION 'invalid_size:%', v_product.name;
        END IF;

        -- Lock the inventory row; missing rows are treated as not stock-tracked
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
        v_order_id, auth.uid(), lower(p_email), v_total, 'processing', p_shipping,
        p_currency, p_exchange_rate, round(v_total * p_exchange_rate, 2)::TEXT || ' ' || p_currency,
        'cod', 'pending_collection',
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
        'currency', p_currency
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. capture_abandoned_cart: PII-safe upsert used by the checkout autosave.
--    Existing rows can only be updated by a caller supplying the same email,
--    and the table itself is no longer readable anonymously (migration 39).
CREATE OR REPLACE FUNCTION public.capture_abandoned_cart(
    p_id UUID,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT,
    p_shipping JSONB,
    p_cart_items JSONB,
    p_total NUMERIC,
    p_currency TEXT DEFAULT 'AED',
    p_exchange_rate NUMERIC DEFAULT 1
) RETURNS UUID AS $$
BEGIN
    IF p_id IS NULL OR p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 255 THEN
        RAISE EXCEPTION 'invalid_input';
    END IF;
    IF p_cart_items IS NOT NULL AND (jsonb_typeof(p_cart_items) <> 'array' OR jsonb_array_length(p_cart_items) > 50) THEN
        RAISE EXCEPTION 'invalid_input';
    END IF;

    INSERT INTO public.abandoned_carts (
        id, email, first_name, last_name, phone, shipping_address, cart_items,
        total_price, currency, exchange_rate, converted
    ) VALUES (
        p_id, lower(p_email), left(p_first_name, 255), left(p_last_name, 255), left(p_phone, 50),
        p_shipping, p_cart_items, COALESCE(p_total, 0), p_currency, p_exchange_rate, FALSE
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        shipping_address = EXCLUDED.shipping_address,
        cart_items = EXCLUDED.cart_items,
        total_price = EXCLUDED.total_price,
        currency = EXCLUDED.currency,
        exchange_rate = EXCLUDED.exchange_rate,
        updated_at = CURRENT_TIMESTAMP
    WHERE lower(public.abandoned_carts.email) = lower(EXCLUDED.email)
      AND public.abandoned_carts.converted = FALSE;

    RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. track_guest_order: order status + tracking timeline for guests, gated on
--    knowing both the order number and the order email (order_tracking is no
--    longer world-readable after migration 39).
CREATE OR REPLACE FUNCTION public.track_guest_order(
    p_order_id TEXT,
    p_email TEXT
) RETURNS JSONB AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_tracking JSONB;
BEGIN
    SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id AND lower(email) = lower(COALESCE(p_email, ''));
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'status', t.status,
        'location', t.location,
        'description', t.description,
        'updated_at', t.updated_at
    ) ORDER BY t.updated_at), '[]'::jsonb)
    INTO v_tracking
    FROM public.order_tracking t WHERE t.order_id = v_order.id;

    RETURN jsonb_build_object(
        'order_id', v_order.id,
        'status', v_order.status,
        'total_price', v_order.total_price,
        'created_at', v_order.created_at,
        'tracking_number', v_order.tracking_number,
        'tracking_url', v_order.tracking_url,
        'tracking', v_tracking
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. Execution grants: these functions are the public API surface
REVOKE ALL ON FUNCTION public.place_order(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_abandoned_cart(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, NUMERIC, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_guest_order(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_abandoned_cart(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, NUMERIC, TEXT, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_guest_order(TEXT, TEXT) TO anon, authenticated;
