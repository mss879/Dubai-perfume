-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Migration 68: launch hardening — cancelling gives things back, costs stay private,
--               shoppers can't edit the shop's own notes about them
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Found in the pre-launch audit (2026-10-18). Nothing here touches payments: no payment
-- function, table or grant changes, and place_order is untouched.
--
--   1. admin_cancel_order(order, expected status, restock)
--      Cancelling an order only changed its status. The stock it took stayed taken (a sold-out
--      size stayed sold out), a discount code's use stayed counted (a one-use code stayed
--      "used up"), and the customer's spend kept the order. This does the cancel and gives all
--      three back in one transaction. It refuses an online order that is still paid (refund it
--      first) and one still awaiting payment (it releases itself, as before). An online order
--      released earlier is not given back twice.
--
--   2. Cost prices out of the public product rows.
--      products.cost_price was readable by anyone with the shop's public key, i.e. every
--      supplier cost. It now lives in product_costs, which only admins can read. A trigger
--      moves any cost written to products (admin_save_product still writes it there) into
--      product_costs and leaves products.cost_price empty, so no function has to change.
--
--   3. A shopper can no longer rewrite the store's private columns on their own customer
--      row: the admin's note, total_spent and orders_count. (They could read and PATCH them
--      with their own sign-in.) The store's own bookkeeping, which runs inside SECURITY
--      DEFINER functions, is unaffected.
--
--   4. Functions the shop's public key could call but never needs: the unused
--      log_concierge_message, and the admin-only functions that refuse a stranger inside but
--      were still callable. Every caller in the app is a signed-in admin, which keeps access
--      through the "authenticated" role. (is_admin(uuid) is deliberately left alone: row
--      security policies call it, and a policy created outside the migrations for the public
--      role would start failing. It only answers yes/no for an account id nobody can guess.)
--
--   5. Upload limits on the two picture buckets: images only (JPEG, PNG, WebP, AVIF), 5 MB
--      each. The admin re-encodes photos to WebP first, so real uploads are far smaller.
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
    IF to_regclass('public.payment_transactions') IS NULL THEN
        v_missing := array_append(v_missing, 'public.payment_transactions (migration 63)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_published') THEN
        v_missing := array_append(v_missing, 'public.products.is_published (migration 64)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'applies_to') THEN
        v_missing := array_append(v_missing, 'public.discounts.applies_to (migration 67)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'cost_price') THEN
        v_missing := array_append(v_missing, 'public.products.cost_price');
    END IF;
    IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
        v_missing := array_append(v_missing, 'public.is_admin(uuid)');
    END IF;
    IF array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'Migration 68 stopped before changing anything. Missing: %', array_to_string(v_missing, ', ');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. admin_cancel_order
--
--    Returns {ok: true, restocked_units, discount_returned, spend_reversed}, or
--    {ok: false, reason} with reason one of:
--      not_found, changed (the status is no longer p_expected_status, or the
--      order is already cancelled), awaiting_payment, payment_held.
--
--    What it gives back, and why exactly that:
--      cash on delivery  place_order took the stock of every tracked size,
--                        counted the code's use and added the order to the
--                        customer's spend. All three are reversed; the stock
--                        from the order's lines, for sizes that are tracked.
--      online, paid      the same, but the stock comes from the exact lines the
--                        order reserved (order_payments.reserved_lines), and the
--                        spend only if the payment counted it (state 'paid').
--      online, released  an order that expired or was cancelled unpaid has had
--                        its stock and code given back already by migration 63,
--                        so nothing is given back a second time.
--    p_restock = FALSE keeps the stock as it is (bottles that went out with the
--    courier and did not come back); the code and the spend are still returned.
--
--    Lock order: the payment row first (as every payment function does), then
--    the order, then stock rows sorted by (product_id, size) as place_order does.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_cancel_order(
    p_order_id TEXT,
    p_expected_status TEXT DEFAULT NULL,
    p_restock BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_op public.order_payments%ROWTYPE;
    v_has_payment BOOLEAN := FALSE;
    v_paid public.payment_transactions%ROWTYPE;
    v_lines JSONB := '[]'::jsonb;
    v_units INT := 0;
    v_discount_returned BOOLEAN := FALSE;
    v_spend_reversed BOOLEAN := FALSE;
    v_counted BOOLEAN;
    v_rows INT;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_op FROM public.order_payments WHERE order_id = p_order_id FOR UPDATE;
    v_has_payment := FOUND;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;
    IF v_order.status = 'cancelled'
       OR (p_expected_status IS NOT NULL AND v_order.status IS DISTINCT FROM p_expected_status) THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'changed');
    END IF;

    IF v_has_payment THEN
        IF v_op.state = 'awaiting' THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'awaiting_payment');
        END IF;
        IF v_op.paid_transaction_id IS NOT NULL THEN
            SELECT * INTO v_paid FROM public.payment_transactions WHERE id = v_op.paid_transaction_id;
            IF FOUND AND NOT v_paid.is_voided AND v_paid.refunded_fils < v_paid.amount_fils THEN
                RETURN jsonb_build_object('ok', FALSE, 'reason', 'payment_held');
            END IF;
        END IF;
    END IF;

    -- Released unpaid earlier (expired / cancelled): migration 63 already gave
    -- the stock and the code back, and the spend was never counted.
    v_counted := NOT v_has_payment OR v_op.state = 'paid';

    -- Stock.
    IF p_restock AND v_counted THEN
        IF v_has_payment THEN
            SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', product_id, 'size', size, 'qty', qty)), '[]'::jsonb)
            INTO v_lines
            FROM (
                SELECT (l->>'product_id')::INT AS product_id, COALESCE(l->>'size', '') AS size, sum((l->>'qty')::INT)::INT AS qty
                FROM jsonb_array_elements(COALESCE(v_op.reserved_lines, '[]'::jsonb)) l
                GROUP BY 1, 2
            ) r;
        ELSE
            SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', product_id, 'size', size, 'qty', qty)), '[]'::jsonb)
            INTO v_lines
            FROM (
                SELECT product_id, COALESCE(size, '') AS size, sum(quantity)::INT AS qty
                FROM public.order_items
                WHERE order_id = p_order_id AND product_id IS NOT NULL AND quantity > 0
                GROUP BY 1, 2
            ) r;
        END IF;

        PERFORM 1 FROM public.inventory i
        JOIN (SELECT (l->>'product_id')::INT AS product_id, l->>'size' AS size FROM jsonb_array_elements(v_lines) l) r
          ON r.product_id = i.product_id AND r.size = i.size
        ORDER BY i.product_id, i.size
        FOR UPDATE OF i;

        WITH back AS (
            UPDATE public.inventory i
            SET stock_level = i.stock_level + r.qty
            FROM (SELECT (l->>'product_id')::INT AS product_id, l->>'size' AS size, (l->>'qty')::INT AS qty
                  FROM jsonb_array_elements(v_lines) l) r
            WHERE i.product_id = r.product_id AND i.size = r.size
            RETURNING r.qty
        )
        SELECT COALESCE(sum(qty), 0)::INT INTO v_units FROM back;
    END IF;

    -- The code's use.
    IF v_counted THEN
        IF v_has_payment AND v_op.discount_id IS NOT NULL THEN
            UPDATE public.discounts
            SET usage_count = GREATEST(COALESCE(usage_count, 0) - 1, 0)
            WHERE id = v_op.discount_id;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_discount_returned := v_rows > 0;
        ELSIF NOT v_has_payment AND v_order.discount_code IS NOT NULL AND length(trim(v_order.discount_code)) > 0 THEN
            UPDATE public.discounts
            SET usage_count = GREATEST(COALESCE(usage_count, 0) - 1, 0)
            WHERE upper(code) = upper(trim(v_order.discount_code));
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_discount_returned := v_rows > 0;
        END IF;
    END IF;

    -- The customer's spend.
    IF v_counted AND v_order.customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET total_spent = GREATEST(COALESCE(total_spent, 0) - COALESCE(v_order.total_price, 0), 0),
            orders_count = GREATEST(COALESCE(orders_count, 0) - 1, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_order.customer_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_spend_reversed := v_rows > 0;
    END IF;

    UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'restocked_units', v_units,
        'discount_returned', v_discount_returned,
        'spend_reversed', v_spend_reversed
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_cancel_order(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_order(TEXT, TEXT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cost prices: product_costs, admin-only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_costs (
    -- No foreign key on purpose: the trigger below writes this row BEFORE a new
    -- product's own row exists. A deleted product leaves a harmless orphan.
    product_id INT PRIMARY KEY,
    cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_costs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_costs TO authenticated;

DROP POLICY IF EXISTS "Admins manage product costs" ON public.product_costs;
CREATE POLICY "Admins manage product costs"
    ON public.product_costs FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Whatever writes a cost to products (admin_save_product, an old admin page, a
-- data migration), the number lands here and the public row keeps NULL.
CREATE OR REPLACE FUNCTION public.keep_product_cost_private()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cost_price IS NOT NULL THEN
        INSERT INTO public.product_costs (product_id, cost_price, updated_at)
        VALUES (NEW.id, GREATEST(NEW.cost_price, 0), now())
        ON CONFLICT (product_id) DO UPDATE
            SET cost_price = EXCLUDED.cost_price, updated_at = now();
        NEW.cost_price := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.keep_product_cost_private() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS keep_product_cost_private ON public.products;
CREATE TRIGGER keep_product_cost_private
    BEFORE INSERT OR UPDATE OF cost_price ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.keep_product_cost_private();

-- Move the costs already there. Re-running finds nothing left to move.
UPDATE public.products SET cost_price = cost_price WHERE cost_price IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. The store's private columns on a customer's own row
--
--    SECURITY INVOKER on purpose: current_user is then the role running the
--    statement — 'authenticated' when a shopper writes through the API, the
--    function's owner when place_order or a payment function keeps the
--    totals. Only the first is held back.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pin_customer_private_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;
    IF auth.uid() IS NOT NULL THEN
        IF public.is_admin(auth.uid()) THEN
            RETURN NEW;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.note := NULL;
        NEW.total_spent := 0;
        NEW.orders_count := 0;
    ELSE
        NEW.note := OLD.note;
        NEW.total_spent := OLD.total_spent;
        NEW.orders_count := OLD.orders_count;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS pin_customer_private ON public.customers;
CREATE TRIGGER pin_customer_private
    BEFORE INSERT OR UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.pin_customer_private_columns();

-- ---------------------------------------------------------------------------
-- 4. Functions the public key doesn't need
--
--    Revoked from anon only where a signed-in admin is the caller (they keep
--    access through 'authenticated'); log_concierge_message is unused and goes
--    from both. Every overload, so a changed signature can't slip through.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS fn, p.proname
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('log_concierge_message',
                            'admin_concierge_overview', 'admin_concierge_sessions',
                            'admin_concierge_transcript', 'admin_concierge_photo_demand',
                            'admin_concierge_offer_performance',
                            'admin_site_lock_state', 'admin_site_lock_token', 'set_site_lock')
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);
        IF r.proname = 'log_concierge_message' THEN
            EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.fn);
        ELSE
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.fn);
        END IF;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Picture buckets: images only, 5 MB each (Supabase's own bucket settings)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types')
       AND EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'file_size_limit') THEN
        UPDATE storage.buckets
        SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
            file_size_limit = 5 * 1024 * 1024
        WHERE id IN ('product-images', 'collection-covers');
    END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Checking it worked (SQL editor):
--   SELECT count(*) FROM products WHERE cost_price IS NOT NULL;   -- 0
--   SELECT count(*) FROM product_costs;                            -- one per costed product
--   SELECT id, allowed_mime_types, file_size_limit FROM storage.buckets
--   WHERE id IN ('product-images', 'collection-covers');
-- ---------------------------------------------------------------------------
