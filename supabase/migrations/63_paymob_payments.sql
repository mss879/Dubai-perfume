-- ============================================================================
-- 63. Online payment through Paymob (Unified Checkout)
--
-- The store has been cash-on-delivery only. This adds Paymob's hosted
-- checkout: the shopper places an order, is sent to Paymob's payment page, and
-- the order is marked paid ONLY when Paymob tells the server so — through its
-- HMAC-signed webhook, or through Paymob's authenticated transaction-inquiry
-- API. Nothing the browser says can mark an order paid.
--
-- Design notes, because they constrain how the app may use this:
--
--   * There is still no service-role key (docs/production-rollout.md §3). Every
--     write below is a SECURITY DEFINER function called with the public anon
--     key, so each payment function demands a shared secret and checks it here
--     against app_config row 'payments' (the cart-recovery pattern, migration
--     45). The secret lives in the server's PAYMENTS_RPC_SECRET and nowhere
--     else in the app.
--
--   * The truth about a payment lives in sealed tables, not on public.orders.
--     Shoppers read their orders with `select("*")` under RLS, and admins may
--     write orders directly from the panel, so orders.payment_status is only a
--     display copy, kept in step by payment_refresh(). Every decision reads
--     order_payments.state, which nothing but these functions can write.
--
--   * Correlation is by Paymob's order id (one per payment attempt), which is
--     covered by Paymob's HMAC. The Paymob transaction id is the primary key of
--     payment_transactions, so a webhook that arrives twice is recorded once.
--     awaiting -> paid is a compare-and-set under a row lock, so its side
--     effects (spend rollup, cart conversion, timeline, confirmation emails)
--     happen exactly once even when the webhook, the shopper's return page and
--     the reconcile job race each other.
--
--   * Fields Paymob's HMAC does not cover (refunded amount, parent transaction,
--     refund/void kind, gateway message) are never taken from a webhook — a
--     shopper holds a valid HMAC for their own transaction (it is in the
--     redirect URL) and could replay it with those fields altered. They are
--     only read from Paymob's authenticated API.
--
--   * Stock and the discount use are still reserved when the order is placed,
--     but an online order has a payment window. What was reserved is recorded
--     (reserved_lines, discount_id) so that an order that is never paid can be
--     released exactly — once, by payment_expire() or the shopper's own
--     cancel. Expiry needs an inquiry made after the deadline that found no
--     payment (24h hard backstop), so a paid order is never cancelled because
--     a webhook was late. Inventory rows are always locked in
--     (product_id, size) order, in place_order and in the release alike, so the
--     two cannot deadlock.
--
--   * payment_settings.mode is the owner's single switch: 'cod' (the default —
--     nothing changes until it is flipped) or 'online'. In online mode
--     place_order refuses cash on delivery even when called directly through
--     PostgREST, and online orders are refused in cod mode.
--
-- Replaces place_order (signature as 44), track_guest_order (as 40) and
-- claim_abandoned_carts_for_recovery (as 45). WARNING: scripts/
-- apply-migrations-38-43.sql contains older copies of place_order and
-- track_guest_order; re-running that bundle after this migration would
-- silently revert them. Do not re-run it.
--
-- Companion app code: src/app/lib/payments/**, src/app/api/payments/**,
-- src/app/api/admin/payments/**, src/app/checkout/payment/**.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Prerequisites, checked before anything changes
--
-- This migration REPLACES functions from earlier ones. CREATE OR REPLACE with
-- a signature the database does not have adds a second copy instead of
-- replacing the first, and an older place_order left callable would go on
-- taking cash on delivery after the switch to online payment. So unless every
-- function and column below is exactly as migrations 38, 40, 44 and 45 left
-- them, stop here. This is the first statement, so stopping changes nothing.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_missing TEXT[] := '{}';
    v_item TEXT;
BEGIN
    FOREACH v_item IN ARRAY ARRAY[
        'public.place_order(text,text,text,text,jsonb,jsonb,text,uuid,text,numeric,text,text)',
        'public.track_guest_order(text,text)',
        'public.claim_abandoned_carts_for_recovery(text,smallint,integer,integer,integer,integer)',
        'public.verify_job_secret(text,text)',
        'public.is_admin(uuid)'
    ] LOOP
        IF to_regprocedure(v_item) IS NULL THEN
            v_missing := v_missing || v_item;
        END IF;
    END LOOP;

    IF (SELECT count(*) FROM pg_proc
        WHERE proname = 'place_order' AND pronamespace = 'public'::regnamespace) > 1 THEN
        v_missing := v_missing || 'a single public.place_order (there is more than one)'::TEXT;
    END IF;

    IF to_regclass('public.app_config') IS NULL THEN
        v_missing := v_missing || 'table public.app_config'::TEXT;
    END IF;

    FOREACH v_item IN ARRAY ARRAY[
        'payment_method', 'payment_status', 'payment_ref', 'total_price', 'shipping_fee',
        'discount_amount', 'discount_code', 'converted_total', 'currency', 'exchange_rate',
        'phone', 'email', 'shipping_address', 'customer_id', 'status', 'updated_at'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = v_item
        ) THEN
            v_missing := v_missing || ('public.orders.' || v_item);
        END IF;
    END LOOP;

    IF cardinality(v_missing) > 0 THEN
        RAISE EXCEPTION 'Migration 63 stopped before changing anything. Missing: %',
            array_to_string(v_missing, '; ')
            USING HINT = 'Apply the earlier migrations it builds on first (38, 40, 44, 45), then run 63 again.';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 0. Close the secret oracle
--
-- verify_job_secret was revoked from PUBLIC only (45). Supabase's default
-- privileges grant EXECUTE to anon and authenticated directly, so it stayed
-- callable by anyone — a yes/no oracle on every job secret, now including the
-- payment secret. Only SECURITY DEFINER functions call it, and they run as the
-- owner, so revoking it from the API roles breaks nothing.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.verify_job_secret(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. The owner's switch (single row)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    mode TEXT NOT NULL DEFAULT 'cod' CHECK (mode IN ('cod', 'online')),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID
);

INSERT INTO public.payment_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. One row per online order — the sealed truth about its payment
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_payments (
    order_id VARCHAR(100) PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'paymob' CHECK (provider IN ('paymob')),
    state TEXT NOT NULL DEFAULT 'awaiting' CHECK (state IN ('awaiting', 'paid', 'expired', 'cancelled')),
    -- SHA-256 (hex) of the one-time payment token. The token itself is handed
    -- to the shopper once, by place_order, and never stored.
    view_token_hash TEXT NOT NULL UNIQUE CHECK (view_token_hash ~ '^[0-9a-f]{64}$'),
    amount_fils INTEGER NOT NULL CHECK (amount_fils > 0),
    currency CHAR(3) NOT NULL DEFAULT 'AED' CHECK (currency = 'AED'),
    -- After this the order may be released. Paymob's intention lifetime plus
    -- a grace period; never earlier than any intention we issued could close.
    due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Paymob requires a payer name; place_order has always accepted these and
    -- discarded them.
    payer_first_name TEXT NOT NULL DEFAULT '' CHECK (length(payer_first_name) <= 50),
    payer_last_name TEXT NOT NULL DEFAULT '' CHECK (length(payer_last_name) <= 50),
    -- Converted only once the order is paid; an unpaid order is not a sale.
    pending_cart_id UUID,
    -- Exactly what place_order took, so a release gives exactly that back:
    -- [{product_id, size, qty}] for stock-tracked lines only, and the discount
    -- whose use was counted (even when it came to nothing).
    reserved_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    discount_id INT,
    paid_transaction_id BIGINT UNIQUE,
    paid_at TIMESTAMP WITH TIME ZONE,
    refunded_fils INTEGER NOT NULL DEFAULT 0 CHECK (refunded_fils >= 0),
    -- Recomputed by payment_refresh() after every change; never set by hand.
    attention TEXT[] NOT NULL DEFAULT '{}',
    -- Which attention kinds the owner has already been told about.
    alerts_sent TEXT[] NOT NULL DEFAULT '{}',
    sync_claimed_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_error_code TEXT CHECK (sync_error_code ~ '^[a-z0-9_]{1,40}$'),
    email_claimed_at TIMESTAMP WITH TIME ZONE,
    customer_emailed_at TIMESTAMP WITH TIME ZONE,
    owner_emailed_at TIMESTAMP WITH TIME ZONE,
    email_attempts SMALLINT NOT NULL DEFAULT 0,
    email_error_code TEXT CHECK (email_error_code ~ '^[a-z0-9_]{1,40}$'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_state_due ON public.order_payments (state, due_at);

-- ---------------------------------------------------------------------------
-- 3. One row per Paymob intention (a payment attempt)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(100) NOT NULL REFERENCES public.order_payments(order_id) ON DELETE CASCADE,
    attempt_no SMALLINT NOT NULL CHECK (attempt_no BETWEEN 1 AND 5),
    -- Sent to Paymob as special_reference; it echoes back as merchant_order_id.
    -- A random suffix keeps it unique at Paymob even if order numbers repeat
    -- (a reset database, a test account reused for live).
    special_reference TEXT NOT NULL UNIQUE,
    intention_id TEXT UNIQUE,
    paymob_order_id BIGINT UNIQUE CHECK (paymob_order_id > 0),
    key_mode TEXT CHECK (key_mode IN ('test', 'live')),
    amount_fils INTEGER NOT NULL CHECK (amount_fils > 0),
    status TEXT NOT NULL DEFAULT 'opening' CHECK (status IN (
        'opening', 'open', 'paid', 'declined', 'superseded', 'expired', 'error'
    )),
    error_code TEXT CHECK (error_code ~ '^[a-z0-9_]{1,40}$'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    opened_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (order_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON public.payment_attempts (order_id);

-- ---------------------------------------------------------------------------
-- 4. Every Paymob transaction we have heard about
--
-- Only whitelisted, non-sensitive fields: no card number beyond its last four,
-- no billing data, no raw payload.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id BIGINT PRIMARY KEY CHECK (id > 0),
    order_id VARCHAR(100) NOT NULL REFERENCES public.order_payments(order_id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES public.payment_attempts(id) ON DELETE SET NULL,
    paymob_order_id BIGINT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('payment', 'refund', 'void', 'capture', 'other')),
    success BOOLEAN NOT NULL,
    pending BOOLEAN NOT NULL,
    amount_fils INTEGER NOT NULL CHECK (amount_fils >= 0),
    currency CHAR(3) NOT NULL,
    is_refunded BOOLEAN NOT NULL DEFAULT FALSE,
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    is_auth BOOLEAN NOT NULL DEFAULT FALSE,
    is_capture BOOLEAN NOT NULL DEFAULT FALSE,
    is_3d_secure BOOLEAN NOT NULL DEFAULT FALSE,
    has_parent BOOLEAN NOT NULL DEFAULT FALSE,
    parent_transaction_id BIGINT,
    integration_id BIGINT NOT NULL,
    integration_known BOOLEAN NOT NULL DEFAULT FALSE,
    source_type TEXT CHECK (length(source_type) <= 32),
    source_sub_type TEXT CHECK (length(source_sub_type) <= 32),
    pan_last4 TEXT CHECK (pan_last4 ~ '^[0-9]{4}$'),
    gateway_message TEXT CHECK (length(gateway_message) <= 120),
    refunded_fils INTEGER NOT NULL DEFAULT 0 CHECK (refunded_fils >= 0),
    first_via TEXT NOT NULL CHECK (first_via IN ('webhook', 'inquiry')),
    last_via TEXT NOT NULL CHECK (last_via IN ('webhook', 'inquiry')),
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON public.payment_transactions (order_id);

-- ---------------------------------------------------------------------------
-- 5. Refunds and voids requested from the admin panel
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Generated by the admin UI when the dialog opens, so a double-click or a
    -- retried request can never refund twice.
    idempotency_key UUID NOT NULL UNIQUE,
    order_id VARCHAR(100) NOT NULL REFERENCES public.order_payments(order_id) ON DELETE CASCADE,
    transaction_id BIGINT NOT NULL REFERENCES public.payment_transactions(id),
    kind TEXT NOT NULL CHECK (kind IN ('refund', 'void')),
    amount_fils INTEGER NOT NULL CHECK (amount_fils > 0),
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'succeeded', 'failed', 'unknown')),
    -- What Paymob had recorded as refunded on the transaction when this was
    -- asked for: an 'unknown' outcome is resolved by comparing against it.
    refunded_fils_before INTEGER NOT NULL DEFAULT 0,
    refund_transaction_id BIGINT,
    error_code TEXT CHECK (error_code ~ '^[a-z0-9_]{1,40}$'),
    reason TEXT CHECK (length(reason) <= 200),
    requested_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order ON public.payment_refunds (order_id);

-- ---------------------------------------------------------------------------
-- 6. Row-level security: admins may read, nobody may write directly
--
-- REVOKE removes the table grants Supabase's default privileges hand out;
-- SELECT is then given back to `authenticated` only, and the policy narrows
-- that to admins. Every write goes through the functions below.
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_settings, public.order_payments, public.payment_attempts,
    public.payment_transactions, public.payment_refunds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payment_settings, public.order_payments, public.payment_attempts,
    public.payment_transactions, public.payment_refunds TO authenticated;

DROP POLICY IF EXISTS "Admins read payment settings" ON public.payment_settings;
CREATE POLICY "Admins read payment settings" ON public.payment_settings
    FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read order payments" ON public.order_payments;
CREATE POLICY "Admins read order payments" ON public.order_payments
    FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read payment attempts" ON public.payment_attempts;
CREATE POLICY "Admins read payment attempts" ON public.payment_attempts
    FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read payment transactions" ON public.payment_transactions;
CREATE POLICY "Admins read payment transactions" ON public.payment_transactions
    FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read payment refunds" ON public.payment_refunds;
CREATE POLICY "Admins read payment refunds" ON public.payment_refunds
    FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Strict readers for the transaction payload
--
-- The app hands transactions over as JSON it has already validated; these
-- re-check every field's JSON type, so a malformed or type-confused value is
-- refused here too rather than coerced.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_json_int(p JSONB, k TEXT, p_min BIGINT DEFAULT 0)
RETURNS BIGINT AS $$
DECLARE
    v NUMERIC;
BEGIN
    IF p IS NULL OR jsonb_typeof(p -> k) IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'invalid_transaction:%', k;
    END IF;
    v := (p ->> k)::NUMERIC;
    IF v <> trunc(v) OR v < p_min OR v > 9007199254740991 THEN
        RAISE EXCEPTION 'invalid_transaction:%', k;
    END IF;
    RETURN v::BIGINT;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.payment_json_bool(p JSONB, k TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF p IS NULL OR jsonb_typeof(p -> k) IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'invalid_transaction:%', k;
    END IF;
    RETURN (p ->> k)::BOOLEAN;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- NULL when absent or JSON null; otherwise must be a string no longer than p_max.
CREATE OR REPLACE FUNCTION public.payment_json_text(p JSONB, k TEXT, p_max INT)
RETURNS TEXT AS $$
BEGIN
    IF p IS NULL OR NOT (p ? k) OR jsonb_typeof(p -> k) = 'null' THEN
        RETURN NULL;
    END IF;
    IF jsonb_typeof(p -> k) <> 'string' OR length(p ->> k) > p_max THEN
        RAISE EXCEPTION 'invalid_transaction:%', k;
    END IF;
    RETURN p ->> k;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- An error code as stored: lower-case snake, at most 40 characters.
CREATE OR REPLACE FUNCTION public.payment_error_code(p TEXT)
RETURNS TEXT AS $$
    SELECT NULLIF(left(regexp_replace(lower(COALESCE(p, '')), '[^a-z0-9_]', '_', 'g'), 40), '');
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 8. Internals (granted to no one): the secret gate, the email payload, the
--    display refresh and the release
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_require_secret(p_secret TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT public.verify_job_secret('payments', p_secret) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- What an order email needs, read with the definer's rights: the webhook has
-- no shopper session, and orders/order_items are closed to anon. Lines are
-- priced from order_items (what was charged), not today's catalogue.
CREATE OR REPLACE FUNCTION public.payment_email_payload(p_order_id TEXT)
RETURNS JSONB AS $$
    SELECT jsonb_build_object(
        'order_id', o.id,
        'email', o.email,
        'phone', o.phone,
        'shipping', o.shipping_address,
        'first_name', op.payer_first_name,
        'last_name', op.payer_last_name,
        'subtotal', o.total_price - COALESCE(o.shipping_fee, 0) + COALESCE(o.discount_amount, 0),
        'shipping_fee', COALESCE(o.shipping_fee, 0),
        'discount_amount', COALESCE(o.discount_amount, 0),
        'total', o.total_price,
        'payment_status', o.payment_status,
        'paid_transaction_id', op.paid_transaction_id,
        'card_brand', t.source_sub_type,
        'card_last4', t.pan_last4,
        'refunded_fils', op.refunded_fils,
        'attention', to_jsonb(op.attention),
        'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'brand', p.brand,
                'name', p.name,
                'size', oi.size,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price
            ) ORDER BY oi.id)
            FROM public.order_items oi
            LEFT JOIN public.products p ON p.id = oi.product_id
            WHERE oi.order_id = o.id
        ), '[]'::jsonb)
    )
    FROM public.orders o
    JOIN public.order_payments op ON op.order_id = o.id
    LEFT JOIN public.payment_transactions t ON t.id = op.paid_transaction_id
    WHERE o.id = p_order_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Recompute the attention flags and mirror the payment status onto orders.
-- Called (under the payment-row lock) at the end of every change.
CREATE OR REPLACE FUNCTION public.payment_refresh(p_order_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_op public.order_payments%ROWTYPE;
    v_paid public.payment_transactions%ROWTYPE;
    v_attention TEXT[] := '{}';
    v_display TEXT;
BEGIN
    SELECT * INTO v_op FROM public.order_payments WHERE order_id = p_order_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    IF v_op.paid_transaction_id IS NOT NULL THEN
        SELECT * INTO v_paid FROM public.payment_transactions WHERE id = v_op.paid_transaction_id;
    END IF;

    -- More than one live (not fully returned) successful payment.
    IF (SELECT count(*) FROM public.payment_transactions t
        WHERE t.order_id = p_order_id AND t.kind = 'payment' AND t.success AND NOT t.pending
          AND NOT t.is_voided AND t.refunded_fils < t.amount_fils
          AND t.amount_fils > 0) > 1 THEN
        v_attention := v_attention || 'duplicate_payment'::TEXT;
    END IF;
    -- Money kept on an order that had already been released.
    IF v_op.state IN ('expired', 'cancelled') AND v_op.paid_transaction_id IS NOT NULL
       AND NOT v_paid.is_voided AND v_paid.refunded_fils < v_paid.amount_fils THEN
        v_attention := v_attention || 'paid_after_close'::TEXT;
    END IF;
    -- A successful payment we did not ask for: wrong amount or currency.
    IF EXISTS (SELECT 1 FROM public.payment_transactions t
               JOIN public.payment_attempts a ON a.id = t.attempt_id
               WHERE t.order_id = p_order_id AND t.kind = 'payment' AND t.success AND NOT t.pending
                 AND NOT t.is_voided AND t.refunded_fils < t.amount_fils
                 AND (t.amount_fils <> a.amount_fils OR t.currency <> 'AED')) THEN
        v_attention := v_attention || 'amount_mismatch'::TEXT;
    END IF;
    -- Through an integration the server is not configured for.
    IF EXISTS (SELECT 1 FROM public.payment_transactions t
               WHERE t.order_id = p_order_id AND t.kind = 'payment' AND t.success AND NOT t.pending
                 AND NOT t.is_voided AND t.refunded_fils < t.amount_fils AND NOT t.integration_known) THEN
        v_attention := v_attention || 'unknown_integration'::TEXT;
    END IF;
    -- Authorised but never captured (an auth/capture integration was used).
    IF EXISTS (SELECT 1 FROM public.payment_transactions t
               WHERE t.order_id = p_order_id AND t.kind = 'payment' AND t.success AND NOT t.pending
                 AND t.is_auth AND NOT t.is_capture AND NOT t.is_voided) THEN
        v_attention := v_attention || 'authorized_not_captured'::TEXT;
    END IF;

    v_display := CASE
        WHEN v_op.paid_transaction_id IS NOT NULL THEN CASE
            WHEN v_paid.is_voided THEN 'voided'
            WHEN v_paid.refunded_fils >= v_paid.amount_fils THEN 'refunded'
            WHEN v_paid.refunded_fils > 0 THEN 'partially_refunded'
            ELSE 'paid'
        END
        WHEN v_op.state = 'awaiting' THEN 'awaiting_payment'
        ELSE v_op.state
    END;

    UPDATE public.order_payments
    SET attention = v_attention,
        refunded_fils = CASE WHEN v_op.paid_transaction_id IS NOT NULL
                             THEN LEAST(v_paid.refunded_fils, v_op.amount_fils) ELSE refunded_fils END,
        updated_at = now()
    WHERE order_id = p_order_id;

    UPDATE public.orders
    SET payment_status = v_display,
        payment_ref = CASE WHEN v_op.paid_transaction_id IS NOT NULL
                           THEN v_op.paid_transaction_id::TEXT ELSE payment_ref END,
        updated_at = now()
    WHERE id = p_order_id
      AND (payment_status IS DISTINCT FROM v_display
           OR (v_op.paid_transaction_id IS NOT NULL AND payment_ref IS DISTINCT FROM v_op.paid_transaction_id::TEXT));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Release an unpaid online order: cancel it, put back exactly the stock it
-- took (locking inventory in (product_id, size) order, as place_order does),
-- give the discount use back. The compare-and-set on state makes it happen at
-- most once. The caller holds the payment-row lock.
CREATE OR REPLACE FUNCTION public.payment_release_order(p_order_id TEXT, p_state TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_op public.order_payments%ROWTYPE;
BEGIN
    IF p_state NOT IN ('expired', 'cancelled') THEN
        RAISE EXCEPTION 'invalid_release_state';
    END IF;

    UPDATE public.order_payments
    SET state = p_state, updated_at = now()
    WHERE order_id = p_order_id AND state = 'awaiting'
    RETURNING * INTO v_op;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    PERFORM 1 FROM public.inventory i
    JOIN (SELECT (l->>'product_id')::INT AS product_id, l->>'size' AS size
          FROM jsonb_array_elements(v_op.reserved_lines) l) r
      ON r.product_id = i.product_id AND r.size = i.size
    ORDER BY i.product_id, i.size
    FOR UPDATE OF i;

    UPDATE public.inventory i
    SET stock_level = i.stock_level + r.qty
    FROM (
        SELECT (l->>'product_id')::INT AS product_id, l->>'size' AS size, sum((l->>'qty')::INT)::INT AS qty
        FROM jsonb_array_elements(v_op.reserved_lines) l
        GROUP BY 1, 2
    ) r
    WHERE i.product_id = r.product_id AND i.size = r.size;

    IF v_op.discount_id IS NOT NULL THEN
        UPDATE public.discounts
        SET usage_count = GREATEST(COALESCE(usage_count, 0) - 1, 0)
        WHERE id = v_op.discount_id;
    END IF;

    UPDATE public.payment_attempts
    SET status = 'expired', closed_at = now()
    WHERE order_id = p_order_id AND status IN ('opening', 'open', 'declined');

    UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;

    INSERT INTO public.order_tracking (order_id, status, location, description)
    VALUES (
        p_order_id, 'Cancelled', 'Dubai Headquarters',
        CASE p_state
            WHEN 'expired' THEN 'The payment window closed before payment was received, so this order was released. Nothing was charged.'
            ELSE 'This order was cancelled before payment. Nothing was charged.'
        END
    );

    PERFORM public.payment_refresh(p_order_id);
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 9. place_order — online orders, and the switch that closes COD
--
-- Same signature as migration 44, so this replaces it in place. Unchanged for
-- cash on delivery, except that it is refused in online mode. Lines are now
-- processed in (product_id, size) order so inventory locks are always taken in
-- the same order as payment_release_order() takes them.
-- For ('paymob', 'awaiting_payment'), only in online mode:
--   * refused unless the payment secret is configured, a phone number is given
--     (Paymob requires one) and the total is above zero;
--   * creates the order_payments row, records exactly what was reserved, and
--     a one-time payment token returned ONCE as payment_token (only its hash
--     is stored);
--   * defers the spend rollup and the abandoned-cart conversion until payment.
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
        IF v_discount.type = 'percentage' THEN
            v_discount_amount := round(v_subtotal * v_discount.value / 100, 2);
        ELSE
            v_discount_amount := LEAST(v_discount.value, v_subtotal);
        END IF;
        UPDATE public.discounts SET usage_count = usage_count + 1 WHERE id = v_discount.id;
        v_discount_id := v_discount.id;
    END IF;

    v_total := GREATEST(v_subtotal - v_discount_amount, 0) + v_shipping_fee;

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
        'discount_amount', v_discount_amount,
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
-- 10. The switch: read it (anyone), probe readiness (server), flip it (admin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_payment_mode()
RETURNS TEXT AS $$
    SELECT COALESCE((SELECT mode FROM public.payment_settings WHERE id), 'cod');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Lets checkout refuse to create an online order the server could not then
-- take payment for. Never raises: a wrong secret is simply "not ready".
CREATE OR REPLACE FUNCTION public.payment_ready(p_secret TEXT)
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'ok', public.verify_job_secret('payments', p_secret),
        'mode', public.get_payment_mode()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.admin_set_payment_mode(p_mode TEXT)
RETURNS TEXT AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
    IF p_mode NOT IN ('cod', 'online') THEN
        RAISE EXCEPTION 'invalid_payment_mode';
    END IF;
    IF p_mode = 'online' AND NOT EXISTS (
        SELECT 1 FROM public.app_config WHERE name = 'payments' AND length(value) >= 20
    ) THEN
        RAISE EXCEPTION 'payments_not_configured';
    END IF;
    UPDATE public.payment_settings
    SET mode = p_mode, updated_at = now(), updated_by = auth.uid()
    WHERE id;
    RETURN p_mode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 11. Open a payment attempt (one Paymob intention)
--
-- Authorised by the shopper's payment token. Returns what the app needs to
-- create the intention: the amount comes from the order row, never the
-- browser. A fresh attempt extends the window (capped at six hours from the
-- order), and no intention may outlive the window.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_open_attempt(p_secret TEXT, p_token_hash TEXT)
RETURNS JSONB AS $$
DECLARE
    v_op public.order_payments%ROWTYPE;
    v_order public.orders%ROWTYPE;
    v_count INT;
    v_due TIMESTAMP WITH TIME ZONE;
    v_expires INT;
    v_attempt_id UUID;
    v_reference TEXT;
BEGIN
    PERFORM public.payment_require_secret(p_secret);

    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;

    SELECT * INTO v_op FROM public.order_payments WHERE view_token_hash = p_token_hash FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;
    IF v_op.state <> 'awaiting' THEN
        RETURN jsonb_build_object(
            'ok', FALSE,
            'reason', CASE WHEN v_op.paid_transaction_id IS NOT NULL THEN 'already_paid' ELSE 'closed' END
        );
    END IF;

    -- A second click while the first intention is still being created.
    IF EXISTS (SELECT 1 FROM public.payment_attempts
               WHERE order_id = v_op.order_id AND status = 'opening'
                 AND created_at > now() - interval '30 seconds') THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'busy');
    END IF;

    -- An attempt that never got its intention recorded is dead.
    UPDATE public.payment_attempts
    SET status = 'error', error_code = COALESCE(error_code, 'abandoned'), closed_at = now()
    WHERE order_id = v_op.order_id AND status = 'opening';

    SELECT count(*) INTO v_count FROM public.payment_attempts WHERE order_id = v_op.order_id;
    IF v_count >= 5 THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'too_many_attempts');
    END IF;

    v_due := LEAST(GREATEST(v_op.due_at, now() + interval '70 minutes'), v_op.created_at + interval '6 hours');
    v_expires := LEAST(3600, floor(extract(epoch FROM (v_due - now())))::INT - 600);
    IF v_expires < 300 THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'window_closed');
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = v_op.order_id;

    -- Older intentions stay payable at Paymob until they expire; a payment on
    -- one is still accepted (it is still this order). They are only marked.
    UPDATE public.payment_attempts
    SET status = 'superseded', closed_at = now()
    WHERE order_id = v_op.order_id AND status = 'open';

    UPDATE public.order_payments SET due_at = v_due, updated_at = now() WHERE order_id = v_op.order_id;

    v_reference := v_op.order_id || '-' || (v_count + 1)::TEXT || '-'
                   || substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 6);
    INSERT INTO public.payment_attempts (order_id, attempt_no, special_reference, amount_fils)
    VALUES (v_op.order_id, v_count + 1, v_reference, v_op.amount_fils)
    RETURNING id INTO v_attempt_id;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'attempt_id', v_attempt_id,
        'order_id', v_op.order_id,
        'special_reference', v_reference,
        'amount_fils', v_op.amount_fils,
        'currency', v_op.currency,
        'expires_in', v_expires,
        'item_count', (SELECT COALESCE(sum(quantity), 0) FROM public.order_items WHERE order_id = v_op.order_id),
        'billing', jsonb_build_object(
            'first_name', v_op.payer_first_name,
            'last_name', v_op.payer_last_name,
            'full_name', COALESCE(v_order.shipping_address->>'name', ''),
            'email', v_order.email,
            'phone', COALESCE(v_order.phone, ''),
            'street', COALESCE(v_order.shipping_address->>'street', ''),
            'city', COALESCE(v_order.shipping_address->>'city', ''),
            'postal_code', COALESCE(v_order.shipping_address->>'postal_code', '')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 12. Record what happened when the app asked Paymob for the intention
--
-- The app only hands the shopper a checkout URL after this has recorded the
-- Paymob order id, so no payment can land on an intention we do not track.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_record_attempt(
    p_secret TEXT,
    p_attempt_id UUID,
    p_ok BOOLEAN,
    p_intention_id TEXT,
    p_paymob_order_id BIGINT,
    p_error_code TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    PERFORM public.payment_require_secret(p_secret);

    IF p_ok THEN
        IF p_intention_id IS NULL OR p_intention_id !~ '^[A-Za-z0-9_-]{4,100}$'
           OR p_paymob_order_id IS NULL OR p_paymob_order_id <= 0 THEN
            RAISE EXCEPTION 'invalid_intention';
        END IF;
        UPDATE public.payment_attempts
        SET status = 'open', intention_id = p_intention_id, paymob_order_id = p_paymob_order_id,
            key_mode = CASE WHEN p_intention_id LIKE 'pi\_test\_%' THEN 'test'
                            WHEN p_intention_id LIKE 'pi\_live\_%' THEN 'live' END,
            opened_at = now()
        WHERE id = p_attempt_id AND status = 'opening';
    ELSE
        UPDATE public.payment_attempts
        SET status = 'error',
            error_code = COALESCE(public.payment_error_code(p_error_code), 'unknown'),
            closed_at = now()
        WHERE id = p_attempt_id AND status = 'opening';
    END IF;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 13. Apply a Paymob transaction — the heart of it
--
-- Called with a transaction the app has either verified by HMAC (webhook) or
-- fetched from Paymob's authenticated inquiry API. Everything is decided under
-- a lock on the order's payment row, so concurrent callers serialise.
--
-- Outcomes:
--   paid_now          the order just became paid; the caller sends the emails
--                     (the payload is returned, and the outbox lease taken)
--   paid_after_close  money arrived for an order already released — recorded,
--                     flagged for the owner, never auto-reinstated
--   duplicate         we already recorded exactly this
--   duplicate_payment a second successful payment on an already-paid order
--   needs_attention   wrong amount/currency, unknown integration, or an
--                     authorisation never captured — recorded, not paid
--   post_payment      a refund/void/capture event: the caller re-reads the paid
--                     transaction from Paymob and applies its refund state
--   declined | pending | unknown_order | conflict
-- Every outcome that leaves an alert the owner has not yet seen returns
-- `alerts` (the kinds) and `alert` (the payload).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_apply_transaction(
    p_secret TEXT,
    p_txn JSONB,
    p_via TEXT
) RETURNS JSONB AS $$
DECLARE
    v_id BIGINT;
    v_paymob_order_id BIGINT;
    v_amount INTEGER;
    v_currency TEXT;
    v_success BOOLEAN;
    v_pending BOOLEAN;
    v_is_auth BOOLEAN;
    v_is_capture BOOLEAN;
    v_is_voided BOOLEAN;
    v_is_refunded BOOLEAN;
    v_is_3ds BOOLEAN;
    v_has_parent BOOLEAN;
    v_parent BIGINT;
    v_integration BIGINT;
    v_integration_known BOOLEAN;
    v_source_type TEXT;
    v_source_sub_type TEXT;
    v_last4 TEXT;
    v_message TEXT;
    v_kind_hint TEXT;
    v_kind TEXT;
    v_attempt public.payment_attempts%ROWTYPE;
    v_op public.order_payments%ROWTYPE;
    v_order public.orders%ROWTYPE;
    v_m_success BOOLEAN;
    v_m_pending BOOLEAN;
    v_m_refunded BOOLEAN;
    v_m_voided BOOLEAN;
    v_m_known BOOLEAN;
    v_refresh BOOLEAN;
    v_outcome TEXT;
    v_new_alerts TEXT[];
    v_result JSONB;
BEGIN
    PERFORM public.payment_require_secret(p_secret);

    IF p_via NOT IN ('webhook', 'inquiry') THEN
        RAISE EXCEPTION 'invalid_transaction:via';
    END IF;
    IF p_txn IS NULL OR jsonb_typeof(p_txn) <> 'object' THEN
        RAISE EXCEPTION 'invalid_transaction';
    END IF;

    v_id := public.payment_json_int(p_txn, 'id', 1);
    v_paymob_order_id := public.payment_json_int(p_txn, 'paymob_order_id', 1);
    v_amount := public.payment_json_int(p_txn, 'amount_fils', 0);
    v_currency := public.payment_json_text(p_txn, 'currency', 3);
    v_success := public.payment_json_bool(p_txn, 'success');
    v_pending := public.payment_json_bool(p_txn, 'pending');
    v_is_auth := public.payment_json_bool(p_txn, 'is_auth');
    v_is_capture := public.payment_json_bool(p_txn, 'is_capture');
    v_is_voided := public.payment_json_bool(p_txn, 'is_voided');
    v_is_refunded := public.payment_json_bool(p_txn, 'is_refunded');
    v_is_3ds := public.payment_json_bool(p_txn, 'is_3d_secure');
    v_has_parent := public.payment_json_bool(p_txn, 'has_parent');
    v_integration := public.payment_json_int(p_txn, 'integration_id', 1);
    v_integration_known := public.payment_json_bool(p_txn, 'integration_known');
    v_source_type := public.payment_json_text(p_txn, 'source_type', 32);
    v_source_sub_type := public.payment_json_text(p_txn, 'source_sub_type', 32);
    v_last4 := public.payment_json_text(p_txn, 'pan_last4', 4);

    IF v_currency IS NULL OR v_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'invalid_transaction:currency';
    END IF;
    IF v_last4 IS NOT NULL AND v_last4 !~ '^[0-9]{4}$' THEN
        v_last4 := NULL;
    END IF;

    -- Not covered by Paymob's HMAC: only trusted from the authenticated API.
    IF p_via = 'inquiry' THEN
        v_message := public.payment_json_text(p_txn, 'gateway_message', 120);
        v_kind_hint := public.payment_json_text(p_txn, 'kind_hint', 16);
        IF p_txn ? 'parent_transaction_id' AND jsonb_typeof(p_txn -> 'parent_transaction_id') <> 'null' THEN
            v_parent := public.payment_json_int(p_txn, 'parent_transaction_id', 1);
        END IF;
    END IF;

    v_kind := CASE
        WHEN NOT v_has_parent THEN 'payment'
        WHEN v_kind_hint IN ('refund', 'void', 'capture') THEN v_kind_hint
        ELSE 'other'
    END;

    SELECT * INTO v_attempt FROM public.payment_attempts WHERE paymob_order_id = v_paymob_order_id;
    IF NOT FOUND THEN
        -- Not one of ours (a payment link, another channel): acknowledged, ignored.
        RETURN jsonb_build_object('outcome', 'unknown_order');
    END IF;

    SELECT * INTO v_op FROM public.order_payments WHERE order_id = v_attempt.order_id FOR UPDATE;
    SELECT * INTO v_order FROM public.orders WHERE id = v_attempt.order_id;

    INSERT INTO public.payment_transactions AS t (
        id, order_id, attempt_id, paymob_order_id, kind, success, pending, amount_fils, currency,
        is_refunded, is_voided, is_auth, is_capture, is_3d_secure, has_parent, parent_transaction_id,
        integration_id, integration_known, source_type, source_sub_type, pan_last4, gateway_message,
        first_via, last_via
    ) VALUES (
        v_id, v_attempt.order_id, v_attempt.id, v_paymob_order_id, v_kind, v_success, v_pending,
        v_amount, v_currency, v_is_refunded, v_is_voided, v_is_auth, v_is_capture, v_is_3ds,
        v_has_parent, v_parent, v_integration, v_integration_known, v_source_type,
        v_source_sub_type, v_last4, v_message, p_via, p_via
    )
    ON CONFLICT (id) DO UPDATE SET
        -- Monotonic merge: a settled transaction never becomes pending again,
        -- and success / refund / void / capture flags only ever switch on.
        success = t.success OR EXCLUDED.success,
        pending = t.pending AND EXCLUDED.pending,
        is_refunded = t.is_refunded OR EXCLUDED.is_refunded,
        is_voided = t.is_voided OR EXCLUDED.is_voided,
        is_capture = t.is_capture OR EXCLUDED.is_capture,
        integration_known = t.integration_known OR EXCLUDED.integration_known,
        kind = CASE WHEN t.kind = 'other' THEN EXCLUDED.kind ELSE t.kind END,
        parent_transaction_id = COALESCE(t.parent_transaction_id, EXCLUDED.parent_transaction_id),
        gateway_message = COALESCE(EXCLUDED.gateway_message, t.gateway_message),
        last_via = EXCLUDED.last_via,
        updated_at = now()
    WHERE t.paymob_order_id = EXCLUDED.paymob_order_id AND t.amount_fils = EXCLUDED.amount_fils
    RETURNING t.success, t.pending, t.is_refunded, t.is_voided, t.integration_known
    INTO v_m_success, v_m_pending, v_m_refunded, v_m_voided, v_m_known;

    IF NOT FOUND THEN
        -- Same transaction id, different order or amount: refuse to merge.
        RETURN jsonb_build_object('outcome', 'conflict', 'order_id', v_attempt.order_id);
    END IF;

    -- Deliberately NOT a "sync": one inquiry answering does not mean every
    -- attempt on the order was checked. Only payment_note_sync(ok) — called
    -- after ALL of an order's inquiries succeeded — lets an order expire.

    v_refresh := v_has_parent OR v_m_refunded OR v_m_voided;

    IF NOT v_has_parent AND v_m_success AND NOT v_m_pending THEN
        -- A successful payment. Only the payment we asked for settles the order.
        IF (v_is_auth AND NOT v_is_capture)
           OR v_amount <> v_attempt.amount_fils OR v_currency <> 'AED' OR NOT v_m_known THEN
            v_outcome := 'needs_attention';
        ELSIF v_op.paid_transaction_id IS NULL THEN
            UPDATE public.order_payments
            SET paid_transaction_id = v_id, paid_at = now(),
                state = CASE WHEN state = 'awaiting' THEN 'paid' ELSE state END,
                updated_at = now()
            WHERE order_id = v_op.order_id;
            UPDATE public.payment_attempts SET status = 'paid', closed_at = now() WHERE id = v_attempt.id;
            UPDATE public.payment_attempts
            SET status = 'superseded', closed_at = now()
            WHERE order_id = v_op.order_id AND id <> v_attempt.id AND status IN ('opening', 'open', 'declined');

            IF v_op.state = 'awaiting' THEN
                -- The deferred effects of a sale, exactly once.
                IF v_order.customer_id IS NOT NULL THEN
                    UPDATE public.customers
                    SET total_spent = COALESCE(total_spent, 0) + v_order.total_price,
                        orders_count = COALESCE(orders_count, 0) + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = v_order.customer_id;
                END IF;
                IF v_op.pending_cart_id IS NOT NULL THEN
                    UPDATE public.abandoned_carts
                    SET converted = TRUE, converted_order_id = v_op.order_id, updated_at = CURRENT_TIMESTAMP
                    WHERE id = v_op.pending_cart_id AND converted = FALSE;
                END IF;
                INSERT INTO public.order_tracking (order_id, status, location, description)
                VALUES (v_op.order_id, 'Payment Received', 'Dubai Headquarters',
                        'Your payment has been received. We will now prepare your order.');

                IF v_refresh THEN
                    -- First news of this payment arrived already refunded or
                    -- voided: record it, but send no confirmation.
                    UPDATE public.order_payments
                    SET customer_emailed_at = now(), owner_emailed_at = now()
                    WHERE order_id = v_op.order_id;
                    v_outcome := 'post_payment';
                ELSE
                    UPDATE public.order_payments SET email_claimed_at = now(), email_attempts = email_attempts + 1
                    WHERE order_id = v_op.order_id;
                    v_outcome := 'paid_now';
                END IF;
            ELSE
                -- Released before the money arrived. Stock and the discount
                -- were already given back; the owner decides.
                UPDATE public.order_payments
                SET customer_emailed_at = now(), owner_emailed_at = now()
                WHERE order_id = v_op.order_id;
                INSERT INTO public.order_tracking (order_id, status, location, description)
                VALUES (v_op.order_id, 'Payment Received', 'Dubai Headquarters',
                        'Your payment arrived after this order had closed. Our team will contact you.');
                v_outcome := 'paid_after_close';
            END IF;
        ELSIF v_op.paid_transaction_id = v_id THEN
            v_outcome := CASE WHEN v_refresh THEN 'post_payment' ELSE 'duplicate' END;
        ELSE
            v_outcome := 'duplicate_payment';
        END IF;
    ELSIF v_has_parent THEN
        v_outcome := 'post_payment';
    ELSIF NOT v_m_success AND NOT v_m_pending THEN
        UPDATE public.payment_attempts
        SET status = 'declined', closed_at = now()
        WHERE id = v_attempt.id AND status = 'open';
        v_outcome := 'declined';
    ELSE
        v_outcome := 'pending';
    END IF;

    PERFORM public.payment_refresh(v_op.order_id);
    SELECT * INTO v_op FROM public.order_payments WHERE order_id = v_op.order_id;

    v_result := jsonb_build_object(
        'outcome', v_outcome,
        'order_id', v_op.order_id,
        'refresh_transaction_id', CASE WHEN v_refresh OR v_outcome = 'post_payment'
                                       THEN v_op.paid_transaction_id END
    );
    IF v_outcome = 'paid_now' THEN
        v_result := v_result || jsonb_build_object('email', public.payment_email_payload(v_op.order_id));
    END IF;

    SELECT COALESCE(array_agg(a), '{}') INTO v_new_alerts
    FROM unnest(v_op.attention) a WHERE NOT (a = ANY (v_op.alerts_sent));
    IF cardinality(v_new_alerts) > 0 THEN
        v_result := v_result || jsonb_build_object(
            'alerts', to_jsonb(v_new_alerts),
            'alert', public.payment_email_payload(v_op.order_id)
        );
    END IF;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 14. Refund / void state, from Paymob's own record of a payment transaction
--
-- The amount refunded is NOT covered by the webhook's HMAC, so it is only ever
-- taken from the authenticated API, and it only ever grows. Also resolves any
-- refund request whose outcome was still open.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_apply_refund_state(
    p_secret TEXT,
    p_transaction_id BIGINT,
    p_refunded_fils INTEGER,
    p_is_voided BOOLEAN
) RETURNS JSONB AS $$
DECLARE
    v_order_id TEXT;
    v_txn public.payment_transactions%ROWTYPE;
    v_op public.order_payments%ROWTYPE;
    v_refunded INTEGER;
    v_voided BOOLEAN;
    v_delta INTEGER;
    v_voided_now BOOLEAN;
    v_primary BOOLEAN;
    v_result JSONB;
    v_new_alerts TEXT[];
BEGIN
    PERFORM public.payment_require_secret(p_secret);

    IF p_transaction_id IS NULL OR p_refunded_fils IS NULL OR p_refunded_fils < 0 OR p_is_voided IS NULL THEN
        RAISE EXCEPTION 'invalid_refund_state';
    END IF;

    SELECT order_id INTO v_order_id FROM public.payment_transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('changed', FALSE, 'reason', 'unknown_transaction');
    END IF;

    SELECT * INTO v_op FROM public.order_payments WHERE order_id = v_order_id FOR UPDATE;
    SELECT * INTO v_txn FROM public.payment_transactions WHERE id = p_transaction_id;
    IF v_txn.kind <> 'payment' THEN
        RETURN jsonb_build_object('changed', FALSE, 'reason', 'not_a_payment');
    END IF;

    v_refunded := GREATEST(v_txn.refunded_fils, LEAST(p_refunded_fils, v_txn.amount_fils));
    v_voided := v_txn.is_voided OR p_is_voided;
    v_delta := v_refunded - v_txn.refunded_fils;
    v_voided_now := v_voided AND NOT v_txn.is_voided;
    v_primary := v_op.paid_transaction_id IS NOT DISTINCT FROM p_transaction_id;

    UPDATE public.payment_transactions
    SET refunded_fils = v_refunded,
        is_voided = v_voided,
        is_refunded = is_refunded OR v_refunded > 0,
        updated_at = now()
    WHERE id = p_transaction_id;

    -- Resolve open refund requests against what Paymob now records.
    UPDATE public.payment_refunds r
    SET status = 'succeeded', finished_at = COALESCE(r.finished_at, now())
    WHERE r.transaction_id = p_transaction_id
      AND r.status IN ('requested', 'unknown')
      AND ((r.kind = 'void' AND v_voided)
           OR (r.kind = 'refund' AND v_refunded >= r.refunded_fils_before + r.amount_fils));

    IF v_primary AND v_voided_now THEN
        INSERT INTO public.order_tracking (order_id, status, location, description)
        VALUES (v_order_id, 'Payment Cancelled', 'Dubai Headquarters',
                'Your payment was cancelled before it settled. You have not been charged.');
    ELSIF v_primary AND v_delta > 0 THEN
        INSERT INTO public.order_tracking (order_id, status, location, description)
        VALUES (v_order_id, 'Refund Issued', 'Dubai Headquarters',
                'A refund of AED ' || to_char(v_delta / 100.0, 'FM999999990.00')
                || ' has been issued to your original payment method.');
    END IF;

    PERFORM public.payment_refresh(v_order_id);
    SELECT * INTO v_op FROM public.order_payments WHERE order_id = v_order_id;

    v_result := jsonb_build_object(
        'changed', v_delta > 0 OR v_voided_now,
        'primary', v_primary,
        'order_id', v_order_id,
        'delta_fils', v_delta,
        'voided_now', v_voided_now,
        'refunded_fils', v_refunded
    );
    IF v_delta > 0 OR v_voided_now THEN
        v_result := v_result || jsonb_build_object('email', public.payment_email_payload(v_order_id));
    END IF;
    SELECT COALESCE(array_agg(a), '{}') INTO v_new_alerts
    FROM unnest(v_op.attention) a WHERE NOT (a = ANY (v_op.alerts_sent));
    IF cardinality(v_new_alerts) > 0 THEN
        v_result := v_result || jsonb_build_object(
            'alerts', to_jsonb(v_new_alerts),
            'alert', public.payment_email_payload(v_order_id)
        );
    END IF;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 15. The shopper's payment page
--
-- Authorised by the payment token alone. Deliberately minimal: no address,
-- email or phone. Items come back in the browser cart's own shape so "restore
-- my bag" can rebuild it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_view(p_secret TEXT, p_token_hash TEXT)
RETURNS JSONB AS $$
DECLARE
    v_op public.order_payments%ROWTYPE;
    v_order public.orders%ROWTYPE;
    v_attempts INT;
    v_last_status TEXT;
    v_opening BOOLEAN;
BEGIN
    PERFORM public.payment_require_secret(p_secret);

    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN NULL;
    END IF;
    SELECT * INTO v_op FROM public.order_payments WHERE view_token_hash = p_token_hash;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    SELECT * INTO v_order FROM public.orders WHERE id = v_op.order_id;

    SELECT count(*) INTO v_attempts FROM public.payment_attempts WHERE order_id = v_op.order_id;
    SELECT status INTO v_last_status FROM public.payment_attempts
    WHERE order_id = v_op.order_id ORDER BY attempt_no DESC LIMIT 1;

    RETURN jsonb_build_object(
        'order_id', v_order.id,
        'created_at', v_order.created_at,
        'state', v_op.state,
        'payment_status', v_order.payment_status,
        'total', v_order.total_price,
        'refunded_fils', v_op.refunded_fils,
        'due_at', v_op.due_at,
        'server_time', now(),
        'attempts_used', v_attempts,
        'attempts_max', 5,
        'last_attempt_status', v_last_status,
        'paid_after_close', v_op.state IN ('expired', 'cancelled') AND v_op.paid_transaction_id IS NOT NULL,
        'can_pay', v_op.state = 'awaiting' AND v_attempts < 5
            AND LEAST(GREATEST(v_op.due_at, now() + interval '70 minutes'), v_op.created_at + interval '6 hours')
                - now() > interval '15 minutes',
        'can_cancel', v_op.state = 'awaiting',
        'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'product', jsonb_build_object(
                    'id', p.id, 'brand', p.brand, 'name', p.name,
                    'price', p.price, 'image_url', p.image_url
                ),
                'selectedSize', oi.size,
                'quantity', oi.quantity
            ) ORDER BY oi.id)
            FROM public.order_items oi
            JOIN public.products p ON p.id = oi.product_id
            WHERE oi.order_id = v_order.id
        ), '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 16. The shopper cancels before paying ("change my order")
--
-- The app asks Paymob first that nothing was paid.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_cancel(p_secret TEXT, p_token_hash TEXT)
RETURNS JSONB AS $$
DECLARE
    v_op public.order_payments%ROWTYPE;
BEGIN
    PERFORM public.payment_require_secret(p_secret);

    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;
    SELECT * INTO v_op FROM public.order_payments WHERE view_token_hash = p_token_hash FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;
    -- A transaction still in flight may yet succeed: do not release under it.
    IF EXISTS (SELECT 1 FROM public.payment_transactions
               WHERE order_id = v_op.order_id AND pending AND received_at > now() - interval '2 hours') THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'payment_pending', 'order_id', v_op.order_id);
    END IF;
    IF NOT public.payment_release_order(v_op.order_id, 'cancelled') THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_cancellable', 'order_id', v_op.order_id);
    END IF;
    RETURN jsonb_build_object('ok', TRUE, 'order_id', v_op.order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 17. Inquiry bookkeeping
--
-- payment_claim_sync is the throttle: at most one inquiry per order per
-- interval, however many tabs poll or webhooks retry. It returns what to ask
-- Paymob about. payment_note_sync records the result — a successful inquiry
-- that found nothing new is what lets an overdue order expire.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_claim_sync(
    p_secret TEXT,
    p_order_id TEXT,
    p_min_interval_seconds INT
) RETURNS JSONB AS $$
DECLARE
    v_op public.order_payments%ROWTYPE;
BEGIN
    PERFORM public.payment_require_secret(p_secret);

    UPDATE public.order_payments
    SET sync_claimed_at = now()
    WHERE order_id = p_order_id
      AND (sync_claimed_at IS NULL
           OR sync_claimed_at < now() - make_interval(secs => GREATEST(COALESCE(p_min_interval_seconds, 0), 5)))
    RETURNING * INTO v_op;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('claimed', FALSE);
    END IF;

    RETURN jsonb_build_object(
        'claimed', TRUE,
        'state', v_op.state,
        'paymob_order_ids', COALESCE((
            SELECT jsonb_agg(paymob_order_id ORDER BY attempt_no DESC)
            FROM public.payment_attempts
            WHERE order_id = p_order_id AND paymob_order_id IS NOT NULL
        ), '[]'::jsonb),
        -- Successful payments whose refund state is worth re-reading.
        'payment_transaction_ids', COALESCE((
            SELECT jsonb_agg(id ORDER BY id)
            FROM public.payment_transactions
            WHERE order_id = p_order_id AND kind = 'payment' AND success AND NOT pending
        ), '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.payment_note_sync(
    p_secret TEXT,
    p_order_id TEXT,
    p_ok BOOLEAN,
    p_error_code TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    PERFORM public.payment_require_secret(p_secret);
    IF p_ok THEN
        UPDATE public.order_payments SET last_synced_at = now(), sync_error_code = NULL
        WHERE order_id = p_order_id;
    ELSE
        UPDATE public.order_payments
        SET sync_error_code = COALESCE(public.payment_error_code(p_error_code), 'unknown')
        WHERE order_id = p_order_id;
    END IF;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Paymob order id -> our order, for a webhook whose signature did not verify:
-- the app may then ask Paymob directly (state still only changes from
-- Paymob's authenticated answer).
CREATE OR REPLACE FUNCTION public.payment_order_for_paymob_order(p_secret TEXT, p_paymob_order_id BIGINT)
RETURNS TEXT AS $$
DECLARE
    v_order_id TEXT;
BEGIN
    PERFORM public.payment_require_secret(p_secret);
    SELECT order_id INTO v_order_id FROM public.payment_attempts WHERE paymob_order_id = p_paymob_order_id;
    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 18. The reconcile job's queue, and expiry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_sync_queue(p_secret TEXT, p_limit INT)
RETURNS JSONB AS $$
BEGIN
    PERFORM public.payment_require_secret(p_secret);
    RETURN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('order_id', q.order_id, 'overdue', q.overdue) ORDER BY q.sort_at)
        FROM (
            -- Unpaid orders: overdue ones first, then any not checked lately.
            SELECT op.order_id, op.due_at < now() AS overdue, op.due_at AS sort_at
            FROM public.order_payments op
            WHERE op.state = 'awaiting'
              AND (op.due_at < now()
                   OR (op.created_at < now() - interval '3 minutes'
                       AND (op.last_synced_at IS NULL OR op.last_synced_at < now() - interval '10 minutes')))
            UNION ALL
            -- Paid orders with a refund whose outcome is still open.
            SELECT DISTINCT r.order_id, FALSE, r.created_at
            FROM public.payment_refunds r
            WHERE r.status IN ('requested', 'unknown') AND r.created_at < now() - interval '1 minute'
            ORDER BY 3
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 0), 1), 50)
        ) q
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Expires an unpaid order whose window has closed. Refuses unless Paymob was
-- asked AFTER the deadline and found nothing (or no intention was ever
-- issued), and never while a transaction is still pending — so a late
-- webhook cannot be the only thing between a paid order and its cancellation.
-- A 24-hour backstop stops a broken inquiry from holding stock forever.
CREATE OR REPLACE FUNCTION public.payment_expire(p_secret TEXT, p_order_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_op public.order_payments%ROWTYPE;
    v_issued BOOLEAN;
BEGIN
    PERFORM public.payment_require_secret(p_secret);

    SELECT * INTO v_op FROM public.order_payments WHERE order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('expired', FALSE, 'reason', 'not_found');
    END IF;
    IF v_op.state <> 'awaiting' THEN
        RETURN jsonb_build_object('expired', FALSE, 'reason', 'not_awaiting');
    END IF;
    IF now() < v_op.due_at THEN
        RETURN jsonb_build_object('expired', FALSE, 'reason', 'not_due');
    END IF;
    IF EXISTS (SELECT 1 FROM public.payment_transactions
               WHERE order_id = p_order_id AND pending AND received_at > now() - interval '2 hours') THEN
        RETURN jsonb_build_object('expired', FALSE, 'reason', 'payment_pending');
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.payment_attempts
                   WHERE order_id = p_order_id AND paymob_order_id IS NOT NULL) INTO v_issued;
    IF v_issued
       AND NOT (v_op.last_synced_at IS NOT NULL AND v_op.last_synced_at >= v_op.due_at)
       AND now() < v_op.due_at + interval '24 hours' THEN
        RETURN jsonb_build_object('expired', FALSE, 'reason', 'needs_sync');
    END IF;

    RETURN jsonb_build_object('expired', public.payment_release_order(p_order_id, 'expired'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 19. The email outbox
--
-- The caller that wins paid_now sends the confirmations straight away (the
-- apply took the lease). Anything still unsent once the ten-minute lease runs
-- out — confirmations, or owner alerts not yet sent — is claimed here (claim
-- before send, like cart recovery), eight tries at most. The app also passes a
-- Resend idempotency key per message, so a send whose "done" was lost is not
-- delivered twice.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_outbox_claim(p_secret TEXT, p_order_id TEXT, p_limit INT)
RETURNS JSONB AS $$
DECLARE
    v_ids TEXT[];
BEGIN
    PERFORM public.payment_require_secret(p_secret);

    WITH due AS (
        SELECT op.order_id
        FROM public.order_payments op
        WHERE (p_order_id IS NULL OR op.order_id = p_order_id)
          AND op.email_attempts < 8
          AND (op.email_claimed_at IS NULL OR op.email_claimed_at < now() - interval '10 minutes')
          AND (
              (op.state = 'paid' AND (op.customer_emailed_at IS NULL OR op.owner_emailed_at IS NULL))
              OR EXISTS (SELECT 1 FROM unnest(op.attention) a WHERE NOT (a = ANY (op.alerts_sent)))
          )
        ORDER BY op.updated_at
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 0), 1), 20)
        FOR UPDATE OF op SKIP LOCKED
    ), claimed AS (
        UPDATE public.order_payments op
        SET email_claimed_at = now(), email_attempts = op.email_attempts + 1
        FROM due
        WHERE op.order_id = due.order_id
        RETURNING op.order_id
    )
    SELECT array_agg(order_id) INTO v_ids FROM claimed;

    RETURN COALESCE((
        SELECT jsonb_agg(public.payment_email_payload(op.order_id) || jsonb_build_object(
            'needs_customer', op.state = 'paid' AND op.customer_emailed_at IS NULL,
            'needs_owner', op.state = 'paid' AND op.owner_emailed_at IS NULL,
            'alerts', COALESCE((SELECT to_jsonb(array_agg(a)) FROM unnest(op.attention) a
                                WHERE NOT (a = ANY (op.alerts_sent))), '[]'::jsonb)
        ))
        FROM public.order_payments op
        WHERE op.order_id = ANY (COALESCE(v_ids, ARRAY[]::TEXT[]))
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.payment_outbox_done(
    p_secret TEXT,
    p_order_id TEXT,
    p_customer_sent BOOLEAN,
    p_owner_sent BOOLEAN,
    p_alerts_sent TEXT[],
    p_error_code TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    PERFORM public.payment_require_secret(p_secret);
    UPDATE public.order_payments
    SET customer_emailed_at = CASE WHEN p_customer_sent THEN COALESCE(customer_emailed_at, now()) ELSE customer_emailed_at END,
        owner_emailed_at = CASE WHEN p_owner_sent THEN COALESCE(owner_emailed_at, now()) ELSE owner_emailed_at END,
        alerts_sent = ARRAY(SELECT DISTINCT unnest(alerts_sent || COALESCE(p_alerts_sent, '{}'))),
        email_error_code = public.payment_error_code(p_error_code),
        -- Release the lease only when everything went: a failure keeps it, so
        -- the next try waits out the ten minutes rather than hammering.
        email_claimed_at = CASE WHEN p_error_code IS NULL THEN NULL ELSE email_claimed_at END
    WHERE order_id = p_order_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 20. Admin: refunds and voids
--
-- Admin-gated by the caller's own session (is_admin), like set_site_lock. One
-- open request per order at a time, under the payment-row lock, so two admins
-- — or one double-clicking — cannot refund twice; the idempotency key makes a
-- replayed request return the first one. Paymob itself is the final guard: it
-- rejects a refund above what remains.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_payment_refund_begin(
    p_order_id TEXT,
    p_transaction_id BIGINT,
    p_kind TEXT,
    p_amount_fils INTEGER,
    p_reason TEXT,
    p_idempotency_key UUID
) RETURNS JSONB AS $$
DECLARE
    v_existing public.payment_refunds%ROWTYPE;
    v_txn public.payment_transactions%ROWTYPE;
    v_refunded INTEGER;
    v_amount INTEGER;
    v_id UUID;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
    IF p_kind NOT IN ('refund', 'void') OR p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'invalid_refund_request';
    END IF;

    SELECT * INTO v_existing FROM public.payment_refunds WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'ok', TRUE, 'replay', TRUE, 'refund_id', v_existing.id, 'status', v_existing.status,
            'transaction_id', v_existing.transaction_id, 'kind', v_existing.kind,
            'amount_fils', v_existing.amount_fils
        );
    END IF;

    PERFORM 1 FROM public.order_payments WHERE order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;

    IF EXISTS (SELECT 1 FROM public.payment_refunds
               WHERE order_id = p_order_id AND status IN ('requested', 'unknown')
                 AND created_at > now() - interval '30 minutes') THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'refund_in_progress');
    END IF;

    SELECT * INTO v_txn FROM public.payment_transactions
    WHERE id = p_transaction_id AND order_id = p_order_id
      AND kind = 'payment' AND success AND NOT pending;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_refundable');
    END IF;
    IF v_txn.is_voided THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'already_voided');
    END IF;

    v_refunded := GREATEST(v_txn.refunded_fils, COALESCE((
        SELECT sum(amount_fils) FROM public.payment_refunds
        WHERE transaction_id = p_transaction_id AND kind = 'refund' AND status = 'succeeded'
    ), 0));

    IF p_kind = 'void' THEN
        IF v_refunded > 0 THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'void_not_allowed');
        END IF;
        v_amount := v_txn.amount_fils;
    ELSE
        IF p_amount_fils IS NULL OR p_amount_fils <= 0 THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'invalid_amount');
        END IF;
        IF p_amount_fils > v_txn.amount_fils - v_refunded THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'amount_too_high',
                'refundable_fils', GREATEST(v_txn.amount_fils - v_refunded, 0));
        END IF;
        v_amount := p_amount_fils;
    END IF;

    INSERT INTO public.payment_refunds (
        idempotency_key, order_id, transaction_id, kind, amount_fils, refunded_fils_before,
        reason, requested_by
    ) VALUES (
        p_idempotency_key, p_order_id, p_transaction_id, p_kind, v_amount, v_txn.refunded_fils,
        NULLIF(left(trim(COALESCE(p_reason, '')), 200), ''), auth.uid()
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'ok', TRUE, 'replay', FALSE, 'refund_id', v_id, 'status', 'requested',
        'transaction_id', p_transaction_id, 'kind', p_kind, 'amount_fils', v_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.admin_payment_refund_finish(
    p_refund_id UUID,
    p_status TEXT,
    p_refund_transaction_id BIGINT,
    p_error_code TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
    IF p_status NOT IN ('succeeded', 'failed', 'unknown') THEN
        RAISE EXCEPTION 'invalid_refund_status';
    END IF;
    UPDATE public.payment_refunds
    SET status = p_status,
        refund_transaction_id = CASE WHEN p_refund_transaction_id > 0 THEN p_refund_transaction_id END,
        error_code = public.payment_error_code(p_error_code),
        finished_at = now()
    WHERE id = p_refund_id AND status = 'requested';
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 21. track_guest_order — now says how the order is paid
--
-- Same signature and gate as migration 40 (order id AND email); adds the
-- payment method, its status and any amount refunded.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 22. Abandoned-cart recovery: a failed online checkout is still a lapsed cart
--
-- Identical to migration 45 except the "has since ordered" test, which now
-- ignores online orders that were released unpaid (expired or cancelled). Those
-- shoppers did not buy, and their cart is deliberately left unconverted until
-- payment — so without this they would never be reminded.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_abandoned_carts_for_recovery(
    p_secret TEXT,
    p_stage SMALLINT,
    p_min_age_minutes INT,
    p_min_gap_minutes INT,
    p_max_age_hours INT,
    p_limit INT
) RETURNS JSONB AS $$
DECLARE
    v_stage SMALLINT := p_stage;
    v_min_age INTERVAL;
    v_min_gap INTERVAL;
    v_max_age INTERVAL;
    v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200);
    v_result JSONB;
BEGIN
    IF NOT public.verify_job_secret('cart_recovery', p_secret) THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;
    IF v_stage IS NULL OR v_stage < 1 OR v_stage > 9 THEN
        RAISE EXCEPTION 'invalid_stage';
    END IF;

    v_min_age := make_interval(mins => LEAST(GREATEST(COALESCE(p_min_age_minutes, 60), 0), 43200));
    v_min_gap := make_interval(mins => LEAST(GREATEST(COALESCE(p_min_gap_minutes, 60), 0), 43200));
    v_max_age := make_interval(hours => LEAST(GREATEST(COALESCE(p_max_age_hours, 336), 1), 8760));

    WITH due AS (
        -- DISTINCT ON (email): a shopper who abandoned three times in a week
        -- gets ONE reminder, about their most recent selection.
        SELECT DISTINCT ON (lower(ac.email)) ac.id
        FROM public.abandoned_carts ac
        WHERE ac.converted = FALSE
          AND ac.recovery_opted_out = FALSE
          AND ac.recovery_stage = v_stage - 1
          AND ac.updated_at <= now() - v_min_age
          AND ac.updated_at >= now() - v_max_age
          AND (ac.last_recovery_at IS NULL OR ac.last_recovery_at <= now() - v_min_gap)
          AND ac.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
          AND ac.total_price > 0
          AND jsonb_typeof(ac.cart_items) = 'array'
          AND jsonb_array_length(ac.cart_items) > 0
          -- Someone who has since ordered is a customer, not a lapsed cart.
          -- The hour of slack covers the gap between the last autosave and the
          -- order being written when checkout completed on another device. An
          -- online order released unpaid is not an order.
          AND NOT EXISTS (
              SELECT 1 FROM public.orders o
              WHERE lower(o.email) = lower(ac.email)
                AND o.created_at >= ac.updated_at - INTERVAL '1 hour'
                AND NOT (o.payment_method = 'paymob' AND o.payment_status IN ('expired', 'cancelled'))
          )
        ORDER BY lower(ac.email), ac.updated_at DESC
        LIMIT v_limit
    ),
    claimed AS (
        UPDATE public.abandoned_carts ac
        -- updated_at is deliberately NOT touched: it records when the shopper
        -- last worked on the cart, which is what every age window measures.
        SET recovery_stage = v_stage,
            last_recovery_at = now()
        WHERE ac.id IN (SELECT id FROM due)
          -- The stage guard is what makes the claim exclusive (see 45).
          AND ac.recovery_stage = v_stage - 1
        RETURNING ac.id, ac.email, ac.first_name, ac.last_name, ac.recovery_token,
                  ac.cart_items, ac.total_price, ac.currency, ac.updated_at
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',           c.id,
        'email',        c.email,
        'first_name',   c.first_name,
        'last_name',    c.last_name,
        'token',        c.recovery_token,
        'cart_items',   c.cart_items,
        'total_price',  c.total_price,
        'currency',     c.currency,
        'abandoned_at', c.updated_at
    )), '[]'::jsonb) INTO v_result
    FROM claimed c;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.claim_abandoned_carts_for_recovery(TEXT, SMALLINT, INT, INT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_abandoned_carts_for_recovery(TEXT, SMALLINT, INT, INT, INT, INT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 23. Execution grants
--
-- Revoked from all three roles first (Supabase's default privileges grant the
-- API roles directly, so revoking PUBLIC alone is not enough), then granted
-- exactly where intended. The secret-gated functions go to anon only, because
-- the app calls them with the stateless anon client (there is no service-role
-- key); the secret is the gate. Internals go to no one.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.payment_json_int(JSONB, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_json_bool(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_json_text(JSONB, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_error_code(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_require_secret(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_email_payload(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_refresh(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_release_order(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_payment_mode() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_ready(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_payment_mode(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_open_attempt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_record_attempt(TEXT, UUID, BOOLEAN, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_apply_transaction(TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_apply_refund_state(TEXT, BIGINT, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_view(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_cancel(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_claim_sync(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_note_sync(TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_order_for_paymob_order(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_sync_queue(TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_expire(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_outbox_claim(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_outbox_done(TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_payment_refund_begin(TEXT, BIGINT, TEXT, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_payment_refund_finish(UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_payment_mode() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_ready(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_open_attempt(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_record_attempt(TEXT, UUID, BOOLEAN, TEXT, BIGINT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_apply_transaction(TEXT, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_apply_refund_state(TEXT, BIGINT, INTEGER, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_view(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_cancel(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_claim_sync(TEXT, TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_note_sync(TEXT, TEXT, BOOLEAN, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_order_for_paymob_order(TEXT, BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_sync_queue(TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_expire(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_outbox_claim(TEXT, TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.payment_outbox_done(TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT[], TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_mode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_payment_refund_begin(TEXT, BIGINT, TEXT, INTEGER, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_payment_refund_finish(UUID, TEXT, BIGINT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- OPERATIONS (run by the owner, NOT part of this migration) — the full order
-- of steps is in docs/payments-paymob.md:
--
--   1. Create the payment secret, then copy it into PAYMENTS_RPC_SECRET:
--        INSERT INTO public.app_config (name, value)
--        VALUES ('payments', replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', ''))
--        ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
--        SELECT value FROM public.app_config WHERE name = 'payments';
--
--   2. Once the site is redeployed with the Paymob variables, switch the store
--      to online payment from the admin panel (Orders → Payments), or:
--        UPDATE public.payment_settings SET mode = 'online', updated_at = now();
--      This also closes cash on delivery.
-- ---------------------------------------------------------------------------
