-- Migration 49: make "stop emailing me" stick, and bound third-party enrolment
-- ════════════════════════════════════════════════════════════════════════════════
-- Two related defects in the abandoned-cart recovery introduced by migration 45.
--
-- 1. THE UNSUBSCRIBE DID NOT LAST.
--    stop_cart_recovery() set abandoned_carts.recovery_opted_out = TRUE on the
--    rows that matched the address AT THAT MOMENT. The opt-out lived on the
--    cart rows, not on the person. capture_abandoned_cart() mints a new row per
--    cart UUID and recovery_opted_out defaults FALSE, so the shopper's next
--    visit to checkout silently re-enrolled them in the whole three-stage
--    sequence. An unsubscribe that undoes itself is worse than none: the
--    shopper believes they have stopped it, and it starts again.
--
-- 2. ANYONE COULD ENROL ANYONE.
--    /api/abandoned-cart is necessarily unauthenticated (guest checkout saves
--    before there is any session), so a script can post someone else's address
--    with a fabricated cart UUID and put them in the sequence. This cannot be
--    fully closed without proof of address ownership, which guest checkout by
--    definition does not have. What it CAN be is bounded and reversible, which
--    is what this migration does:
--      · the claim function already sends DISTINCT ON (lower(email)) per stage,
--        so a victim receives at most one message per stage — three in total,
--        however many rows are forged;
--      · after this migration one click stops those three permanently;
--      · and a single address can no longer be used to flood the table.
--
-- The claim function is deliberately NOT modified. It already filters on
-- `recovery_opted_out = FALSE`; once suppression is applied at capture time,
-- that one predicate covers both the old rows and every future one.

-- ---------------------------------------------------------------------------
-- 1. The suppression list — the opt-out, keyed on the person not the cart
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_suppressions (
    email      TEXT PRIMARY KEY,          -- always stored lowercased
    reason     VARCHAR(50) NOT NULL DEFAULT 'cart_recovery',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

-- No policies are created on purpose. Every legitimate reader and writer is a
-- SECURITY DEFINER function below, which bypasses RLS; with RLS on and no
-- policy, anon and authenticated get nothing. A suppression list is a list of
-- people who asked to be left alone, so it must not be queryable with the
-- public key — that would make it an email harvest.

-- ---------------------------------------------------------------------------
-- 2. stop_cart_recovery: record the person, not just their current carts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stop_cart_recovery(p_token UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_email TEXT;
BEGIN
    IF p_token IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT email INTO v_email FROM public.abandoned_carts WHERE recovery_token = p_token;
    IF v_email IS NULL THEN
        RETURN FALSE;
    END IF;

    -- The durable half: this is what survives the next checkout session.
    INSERT INTO public.email_suppressions (email, reason)
    VALUES (lower(v_email), 'cart_recovery')
    ON CONFLICT (email) DO NOTHING;

    -- The immediate half: stop the carts that already exist.
    UPDATE public.abandoned_carts
    SET recovery_opted_out = TRUE
    WHERE lower(email) = lower(v_email);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.stop_cart_recovery(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stop_cart_recovery(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. capture_abandoned_cart: honour the suppression list, and cap one address
--
-- Replaces the version from migration 40. Unchanged except for the two guards
-- marked NEW; the upsert body and its ON CONFLICT predicate are as they were.
-- ---------------------------------------------------------------------------

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
DECLARE
    v_suppressed BOOLEAN;
    v_open_carts INT;
BEGIN
    IF p_id IS NULL OR p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 255 THEN
        RAISE EXCEPTION 'invalid_input';
    END IF;
    IF p_cart_items IS NOT NULL AND (jsonb_typeof(p_cart_items) <> 'array' OR jsonb_array_length(p_cart_items) > 50) THEN
        RAISE EXCEPTION 'invalid_input';
    END IF;

    -- NEW: has this person asked us to stop? The row is still captured (it is
    -- the shopper's own cart and the admin's abandoned-cart view is a genuine
    -- operational screen), but it is born opted out, so the recovery job never
    -- selects it. A previously suppressed address that checks out normally is
    -- unaffected: order confirmations are transactional and go by another path.
    SELECT EXISTS (
        SELECT 1 FROM public.email_suppressions WHERE email = lower(p_email)
    ) INTO v_suppressed;

    -- NEW: bound how much one address can be written into the table. Only
    -- checked when the id is new, so a shopper's own two-second autosave — which
    -- reuses one UUID for the whole session — never pays for it. 25 open carts
    -- for one address is far past any real shopper and far short of useful spam.
    IF NOT EXISTS (SELECT 1 FROM public.abandoned_carts WHERE id = p_id) THEN
        SELECT count(*) INTO v_open_carts
        FROM public.abandoned_carts
        WHERE lower(email) = lower(p_email) AND converted = FALSE;

        IF v_open_carts >= 25 THEN
            RAISE EXCEPTION 'too_many_carts';
        END IF;
    END IF;

    INSERT INTO public.abandoned_carts (
        id, email, first_name, last_name, phone, shipping_address, cart_items,
        total_price, currency, exchange_rate, converted, recovery_opted_out
    ) VALUES (
        p_id, lower(p_email), left(p_first_name, 255), left(p_last_name, 255), left(p_phone, 50),
        p_shipping, p_cart_items, COALESCE(p_total, 0), p_currency, p_exchange_rate, FALSE,
        COALESCE(v_suppressed, FALSE)
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
        -- recovery_opted_out is deliberately absent: an existing row keeps the
        -- opt-out it already carries. Re-asserting EXCLUDED here would let a
        -- later autosave clear a flag stop_cart_recovery had just set.
    WHERE lower(public.abandoned_carts.email) = lower(EXCLUDED.email)
      AND public.abandoned_carts.converted = FALSE;

    RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.capture_abandoned_cart(
    UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, NUMERIC, TEXT, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_abandoned_cart(
    UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, NUMERIC, TEXT, NUMERIC
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Backfill: everyone who already pressed unsubscribe stays unsubscribed
--
-- ⚠️  THIS BACKFILL IS WRONG AND IS UNDONE BY MIGRATION 50. It is left here
--     verbatim because it has already been applied and migrations are never
--     edited after the fact — 50 is the correction. Do not "fix" it here.
--     In short: recovery_opted_out is NOT proof of an unsubscribe. Its
--     population comes from migration 45 §3, a blanket WHERE-less UPDATE used
--     as one-time grandfathering, so this promotes "do not mail the backlog"
--     into "never mail this person, ever". See 50 for the full reasoning.
--
-- Without this, an address that opted out before this migration would be
-- re-enrolled by its next cart — exactly the bug being fixed, for the very
-- people who already asked us to stop.
-- ---------------------------------------------------------------------------

INSERT INTO public.email_suppressions (email, reason)
SELECT DISTINCT lower(email), 'cart_recovery'
FROM public.abandoned_carts
WHERE recovery_opted_out = TRUE
  AND email IS NOT NULL
  AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
ON CONFLICT (email) DO NOTHING;
