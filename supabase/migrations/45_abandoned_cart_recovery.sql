-- ============================================================================
-- 45. Abandoned-cart recovery emails
--
-- Checkout has autosaved abandoned carts since migration 12 (and through
-- capture_abandoned_cart() since 40). Nothing has ever read them back out, so
-- every captured cart has sat in the table unrecovered. This migration adds the
-- state a recovery sequence needs and the functions the app calls.
--
-- Design notes, because they constrain how the app may use this:
--
--   * The store has NO service-role key, deliberately (see
--     docs/production-rollout.md §3) — the trusted paths are all SECURITY
--     DEFINER functions callable with the public anon key. A recovery job that
--     returns customer PII must therefore NOT be callable by anon on its own
--     word, or the anon key becomes a customer-list export. So the two job
--     functions take a shared secret and check it here, against a row in
--     app_config that nothing but a SECURITY DEFINER function can read.
--
--   * The claim and the stamp happen in ONE statement, guarded on the stage the
--     cart is moving OFF (see the note inside the function). That is what makes
--     two overlapping runs safe. Claiming BEFORE sending means a crash mid-run
--     skips a reminder rather than sending it twice, which is the right way
--     round for marketing mail.
--
--   * recovery_token is what the "return to your selection" link in the email
--     carries. It is a v4 UUID, unguessable, and per-cart — it is the only
--     credential the restore page needs, exactly like a password-reset link.
--
-- Companion app code: src/app/api/cart-recovery/*, src/app/recover/*,
-- src/app/lib/cart-recovery.ts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Server-side configuration nothing public may read
--
-- RLS is on and there is NO policy, for anyone — not even an admin. The only
-- readers are the SECURITY DEFINER functions below, which never return a value
-- from it, only compare against one. The SQL editor runs as the table owner and
-- bypasses RLS, which is how the owner sets it.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_config (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Belt and braces. RLS with no policy already denies both roles every row;
-- this removes the table grant Supabase's default privileges hand out, so the
-- table is unreachable even if a policy is ever added here by accident.
REVOKE ALL ON TABLE public.app_config FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Recovery state on the cart
-- ---------------------------------------------------------------------------

ALTER TABLE public.abandoned_carts
    -- How many reminders have gone out: 0 = none yet, 1..3 = through that stage.
    ADD COLUMN IF NOT EXISTS recovery_stage SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_recovery_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS recovery_token UUID NOT NULL DEFAULT gen_random_uuid(),
    -- Set when the shopper uses the unsubscribe link in a reminder. Distinct
    -- from the newsletter list: opting out of reminders is not opting out of
    -- the newsletter, and vice versa.
    ADD COLUMN IF NOT EXISTS recovery_opted_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_abandoned_carts_recovery_token
    ON public.abandoned_carts (recovery_token);

-- The queue query filters on these four and orders by updated_at.
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery_queue
    ON public.abandoned_carts (recovery_stage, converted, recovery_opted_out, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Everything already in the table is exempt, permanently
--
-- Without this, the first job run would mail every cart ever abandoned —
-- including the demo row seeded by migration 12 — with "you left something
-- behind" about a selection from months ago. Recovery starts from carts
-- abandoned AFTER this migration is applied.
--
-- Guarded by a marker so re-running this file does not silently opt out the
-- carts captured since. This file is safe to re-run; that only holds because
-- of this block.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.app_config WHERE name = 'cart_recovery_backfilled_at') THEN
        UPDATE public.abandoned_carts SET recovery_opted_out = TRUE;
        INSERT INTO public.app_config (name, value) VALUES ('cart_recovery_backfilled_at', now()::TEXT);
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. The job secret check
--
-- A secret that has not been set never matches, so the job endpoint is closed
-- until the owner sets one rather than open by default. The length floor stops
-- a one-character secret from being usable at all.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_job_secret(p_name TEXT, p_secret TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_expected TEXT;
BEGIN
    IF p_secret IS NULL OR length(p_secret) < 20 THEN
        RETURN FALSE;
    END IF;
    SELECT value INTO v_expected FROM public.app_config WHERE name = p_name;
    IF v_expected IS NULL OR length(v_expected) < 20 THEN
        RETURN FALSE;
    END IF;
    RETURN v_expected = p_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Not granted to anon/authenticated: only the functions below ever call it.
REVOKE ALL ON FUNCTION public.verify_job_secret(TEXT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 5. claim_abandoned_carts_for_recovery — the queue for one stage
--
-- Returns the carts due a stage-N reminder and stamps them as sent in the same
-- statement. The caller then sends the mail; anything it fails to send it hands
-- back through release_abandoned_cart_recovery() below.
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
          -- order being written when checkout completed on another device.
          AND NOT EXISTS (
              SELECT 1 FROM public.orders o
              WHERE lower(o.email) = lower(ac.email)
                AND o.created_at >= ac.updated_at - INTERVAL '1 hour'
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
          -- The stage guard is what makes the claim exclusive, and it has to
          -- be HERE rather than only in `due`. Two runs overlapping both build
          -- `due` from the same snapshot, so both would name the same rows; the
          -- second blocks on the row lock, and under READ COMMITTED re-checks
          -- this predicate against the row the first one just wrote. By then
          -- recovery_stage is already v_stage, the predicate fails, and the row
          -- drops out of the second run's RETURNING — so it is mailed once.
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
-- 6. release_abandoned_cart_recovery — hand back what did not send
--
-- A cart claimed for stage N whose mail the provider refused would otherwise
-- have burnt that reminder. This puts it back in the queue. last_recovery_at is
-- cleared rather than restored: nothing went out, so there is no send to space
-- the next one away from.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.release_abandoned_cart_recovery(
    p_secret TEXT,
    p_id UUID,
    p_stage SMALLINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_rows INT;
BEGIN
    IF NOT public.verify_job_secret('cart_recovery', p_secret) THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;
    IF p_id IS NULL OR p_stage IS NULL OR p_stage < 1 THEN
        RETURN FALSE;
    END IF;

    -- Guarded on the stage so a late release cannot rewind a cart that has
    -- since legitimately moved on to the next reminder.
    UPDATE public.abandoned_carts
    SET recovery_stage = GREATEST(p_stage - 1, 0),
        last_recovery_at = NULL
    WHERE id = p_id AND recovery_stage = p_stage;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.release_abandoned_cart_recovery(TEXT, UUID, SMALLINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_abandoned_cart_recovery(TEXT, UUID, SMALLINT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. get_recovery_cart — what the link in the email is allowed to restore
--
-- Anon-callable, because the person following the link is not signed in. The
-- token is the credential.
--
-- It returns the SELECTION and the email address, and nothing else. The row
-- also holds a phone number and a home address, and a recovery link can be
-- forwarded, sit in a shared inbox or leak through a referrer — so the address
-- is not handed back. The shopper re-enters it at checkout, as they would have
-- had to anyway.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_recovery_cart(p_token UUID)
RETURNS JSONB AS $$
DECLARE
    v_cart public.abandoned_carts%ROWTYPE;
BEGIN
    IF p_token IS NULL THEN
        RETURN jsonb_build_object('found', FALSE);
    END IF;

    SELECT * INTO v_cart FROM public.abandoned_carts WHERE recovery_token = p_token;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', FALSE);
    END IF;

    RETURN jsonb_build_object(
        'found',      TRUE,
        'converted',  v_cart.converted,
        'email',      v_cart.email,
        'first_name', v_cart.first_name,
        'cart_items', COALESCE(v_cart.cart_items, '[]'::jsonb),
        'opted_out',  v_cart.recovery_opted_out
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_recovery_cart(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recovery_cart(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. stop_cart_recovery — the unsubscribe link
--
-- Every reminder carries one. It stops reminders for that cart's email address
-- across the whole table, not just the one cart, because that is what the
-- shopper means by "stop emailing me about this".
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

    UPDATE public.abandoned_carts
    SET recovery_opted_out = TRUE
    WHERE lower(email) = lower(v_email);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.stop_cart_recovery(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stop_cart_recovery(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operations note — DO THIS, or recovery stays switched off
--
-- 1. Generate a secret and store it. Run this in the SQL editor:
--
--      INSERT INTO public.app_config (name, value)
--      VALUES ('cart_recovery', replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', ''))
--      ON CONFLICT (name) DO UPDATE
--        SET value = EXCLUDED.value, updated_at = now();
--
--      SELECT value FROM public.app_config WHERE name = 'cart_recovery';
--
-- 2. Put that value in the site's environment as CART_RECOVERY_SECRET, and
--    redeploy. The two must match exactly; until they do, POST
--    /api/cart-recovery answers 401 and nothing is sent.
--
-- 3. Point a scheduler at it, hourly:
--
--      curl -X POST https://<your-domain>/api/cart-recovery \
--           -H "Authorization: Bearer <CART_RECOVERY_SECRET>"
--
--    Any scheduler works (cron-job.org, GitHub Actions, a Netlify scheduled
--    function). The endpoint is idempotent within a stage — running it twice in
--    the same minute sends nothing the second time.
--
-- To verify without waiting an hour, abandon a checkout with an address you can
-- read, then add ?minAgeMinutes=0 to the request.
--
-- To check the queue at any time:
--
--   SELECT recovery_stage, count(*)
--   FROM public.abandoned_carts
--   WHERE converted = FALSE AND recovery_opted_out = FALSE
--   GROUP BY 1 ORDER BY 1;
-- ---------------------------------------------------------------------------
