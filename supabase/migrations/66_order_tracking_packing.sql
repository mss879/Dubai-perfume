-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Migration 66: guest order tracking shows the packing charge
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- For a cash-on-delivery order the admin adds a packing charge when the order is packed
-- (orders.packing_charges), and the courier collects the order total PLUS that charge.
-- track_guest_order() never returned it, so the order page (/order/<id>) and the tracking
-- page (/track) told a guest a smaller amount than the courier asks for.
--
-- This is migration 63's track_guest_order(), unchanged in every line, with one more field:
-- 'packing_charges'. Same signature, same gate (order id AND email), same grants. Nothing
-- about payments changes. The app reads the new field when it is there and treats it as 0
-- when it is not, so the order of deploying and running this does not matter.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
    v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF to_regclass('public.order_payments') IS NULL THEN
        v_missing := array_append(v_missing, 'public.order_payments (migration 63)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'packing_charges') THEN
        v_missing := array_append(v_missing, 'public.orders.packing_charges');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tracking_url') THEN
        v_missing := array_append(v_missing, 'public.orders.tracking_url');
    END IF;
    IF array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'Migration 66 stopped before changing anything. Missing: %', array_to_string(v_missing, ', ');
    END IF;
END $$;

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
        -- New in 66: collected with a cash-on-delivery order, on top of the total.
        'packing_charges', COALESCE(v_order.packing_charges, 0),
        'created_at', v_order.created_at,
        'tracking_number', v_order.tracking_number,
        'tracking_url', v_order.tracking_url,
        'payment_method', v_order.payment_method,
        'payment_status', v_order.payment_status,
        'refunded_total', COALESCE((SELECT refunded_fils FROM public.order_payments
                                    WHERE order_id = v_order.id), 0) / 100.0,
        'tracking', v_tracking
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.track_guest_order(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_guest_order(TEXT, TEXT) TO anon, authenticated;

COMMIT;
