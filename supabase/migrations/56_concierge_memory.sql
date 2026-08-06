-- ============================================================================
-- 56. The concierge remembers a returning customer
--
-- A shop assistant who knows you is worth more than one who is merely helpful:
-- they do not sell you the bottle already on your shelf, and they know what you
-- reached for last winter. The concierge cannot do any of that today, because
-- it has no idea who it is talking to — /api/concierge runs on the anon client
-- and never reads a session.
--
-- The blocking problem was not the concierge, though. It was the quiz.
-- fragrance_quiz_responses has no customer_id at all, and the finder's
-- session_id is a crypto.randomUUID() held in a useRef that is never persisted
-- and never tied to auth.uid(). So "read their saved scent profile" was, until
-- this migration, reading a table nothing could ever match a person to. The
-- first section fixes the link; the rest builds on it.
--
-- THE PRIVACY RULE THIS FILE IS BUILT AROUND: get_concierge_customer_context()
-- takes NO customer id. It reads auth.uid() itself. A function that accepted
-- "whose context would you like?" would be one forgotten check away from
-- handing any shopper another shopper's order history, and no amount of care in
-- the route would fix it. What the caller MAY pass is a session id, and only to
-- stamp it — bounded three ways below.
--
-- What reaches the language model is deliberately thin: a first name, what they
-- have bought, and their scent profile. No address, no telephone, no email, no
-- order totals. The agent needs to know you liked Khamrah, not where you live.
--
-- Companion app code: src/app/lib/concierge/customer.ts,
-- src/app/lib/concierge/name-filter.ts, src/app/api/quiz/route.ts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tie a quiz result to an account
-- ---------------------------------------------------------------------------

ALTER TABLE public.fragrance_quiz_responses
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_customer
    ON public.fragrance_quiz_responses (customer_id, updated_at DESC)
    WHERE customer_id IS NOT NULL;

-- Back-match the rows already captured, by the email the shopper typed to get
-- their results.
--
-- NOTE the HAVING count(*) = 1. customers.email is UNIQUE on the RAW value
-- (04_customers.sql), not on lower(email), so 'Sara@x.com' and 'sara@x.com' can
-- both exist as separate accounts. Where an address is ambiguous like that,
-- claiming either one would be a guess about whose taste this is — so it claims
-- neither, and that shopper simply takes the quiz again.
UPDATE public.fragrance_quiz_responses q
   SET customer_id = m.id
  FROM (
        SELECT lower(c.email) AS lemail, min(c.id::text)::uuid AS id
          FROM public.customers c
         GROUP BY lower(c.email)
        HAVING count(*) = 1
       ) m
 WHERE q.customer_id IS NULL
   AND q.email IS NOT NULL
   AND lower(q.email) = m.lemail;

-- The replacement write path. Six arguments, not five, so migration 47's
-- version keeps its own signature and is dropped explicitly below rather than
-- being silently shadowed.
CREATE OR REPLACE FUNCTION public.record_quiz_response(
    p_session_id  UUID,
    p_answers     JSONB,
    p_email       TEXT  DEFAULT NULL,
    p_recommended INT[] DEFAULT NULL,
    p_profile     JSONB DEFAULT NULL,
    p_customer_id UUID  DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_email       TEXT  := lower(trim(COALESCE(p_email, '')));
    v_answers     JSONB := COALESCE(p_answers, '{}'::jsonb);
    v_profile     JSONB := COALESCE(p_profile, '{}'::jsonb);
    v_recommended INT[] := COALESCE(p_recommended, ARRAY[]::INT[]);
    v_session     UUID  := COALESCE(p_session_id, gen_random_uuid());
    v_customer    UUID;
BEGIN
    IF jsonb_typeof(v_answers) <> 'object' THEN
        RAISE EXCEPTION 'invalid_answers';
    END IF;
    IF jsonb_typeof(v_profile) <> 'object' THEN
        v_profile := '{}'::jsonb;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(v_answers)) > 20
       OR (SELECT count(*) FROM jsonb_object_keys(v_profile)) > 20 THEN
        RAISE EXCEPTION 'invalid_answers';
    END IF;
    IF array_length(v_recommended, 1) > 12 THEN
        RAISE EXCEPTION 'invalid_recommendations';
    END IF;

    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 255 THEN
        v_email := NULL;
    END IF;

    -- The caller may only claim an id that is really an account. The route
    -- takes it from the server-verified session, never from the request body,
    -- but this function is granted to anon and must assume nothing.
    SELECT c.id INTO v_customer FROM public.customers c WHERE c.id = p_customer_id;

    INSERT INTO public.fragrance_quiz_responses
        (session_id, email, answers, recommended_product_ids, scent_profile, customer_id)
    VALUES
        (v_session, v_email, v_answers, v_recommended, v_profile, v_customer)
    -- The WHERE repeats the partial index's predicate so PostgreSQL can infer
    -- it. Migration 46 omitted it and captured nothing at all for two releases.
    ON CONFLICT (session_id) WHERE session_id IS NOT NULL DO UPDATE SET
        email = COALESCE(EXCLUDED.email, public.fragrance_quiz_responses.email),
        answers = EXCLUDED.answers,
        recommended_product_ids = EXCLUDED.recommended_product_ids,
        scent_profile = EXCLUDED.scent_profile,
        -- Same reasoning as the email: a later write that happens to be
        -- anonymous must not unlink a result already tied to an account.
        customer_id = COALESCE(EXCLUDED.customer_id, public.fragrance_quiz_responses.customer_id),
        updated_at = CURRENT_TIMESTAMP;

    IF v_email IS NOT NULL THEN
        PERFORM public.subscribe_newsletter(v_email, 'quiz');
    END IF;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.record_quiz_response(UUID, JSONB, TEXT, INT[], JSONB);

REVOKE ALL ON FUNCTION public.record_quiz_response(UUID, JSONB, TEXT, INT[], JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_quiz_response(UUID, JSONB, TEXT, INT[], JSONB, UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tie a conversation to an account
--
-- Worth saying plainly: this puts a name to a transcript the owner can read.
-- That is the honest consequence of an agent that greets people by name, and it
-- is why forget_concierge_customer() exists below.
-- ---------------------------------------------------------------------------

ALTER TABLE public.concierge_sessions
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_concierge_sessions_customer
    ON public.concierge_sessions (customer_id, last_seen_at DESC)
    WHERE customer_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. get_concierge_customer_context() — what the agent may know about you
--
-- Scoped to auth.uid() internally. There is no parameter for whose data to
-- return, because there must never be one.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_concierge_customer_context(
    p_session_id UUID DEFAULT NULL,
    p_client_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_uid      UUID := auth.uid();
    v_first    TEXT;
    v_orders   JSONB;
    v_profile  JSONB;
BEGIN
    IF v_uid IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT c.first_name INTO v_first FROM public.customers c WHERE c.id = v_uid;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Stamp the conversation with who is having it, so the insights tab can tell
    -- a returning customer's conversation from a stranger's.
    --
    -- The session id IS caller-supplied, so it is bounded three ways: the row
    -- must not already be claimed, it must be recent, and its client_key must
    -- match the one the rate limiter recorded. An attacker would have to guess
    -- a live session UUID *and* be behind the same IP — at which point they are
    -- the person whose session it is.
    IF p_session_id IS NOT NULL THEN
        UPDATE public.concierge_sessions s
           SET customer_id = v_uid
         WHERE s.id = p_session_id
           AND s.customer_id IS NULL
           AND s.last_seen_at > now() - interval '24 hours'
           AND (s.client_key IS NULL
                OR s.client_key IS NOT DISTINCT FROM NULLIF(left(COALESCE(p_client_key, ''), 64), ''));
    END IF;

    -- Their last five orders and what was in them.
    --
    -- No total, no address, no telephone, no email — the agent needs to know
    -- they own Khamrah, not what they paid or where it went. The join to
    -- order_items is INNER, so an order whose lines were deleted drops out
    -- entirely: fewer than five can come back for reasons unrelated to the cap.
    WITH recent AS (
        SELECT o.id, o.status, o.created_at
          FROM public.orders o
         WHERE o.customer_id = v_uid
            OR lower(o.email) = (SELECT lower(c.email) FROM public.customers c WHERE c.id = v_uid)
         ORDER BY o.created_at DESC
         LIMIT 5
    ),
    lines AS (
        SELECT r.id, r.status, r.created_at,
               oi.product_id, oi.size, oi.quantity,
               COALESCE(p.name, '') AS product_name,
               COALESCE(p.brand, '') AS product_brand
          FROM recent r
          JOIN public.order_items oi ON oi.order_id = r.id
          LEFT JOIN public.products p ON p.id = oi.product_id
    )
    SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
               'productId', l.product_id,
               'name',      l.product_name,
               'brand',     l.product_brand,
               'size',      l.size,
               'boughtOn',  to_char(l.created_at AT TIME ZONE 'Asia/Dubai', 'FMMonth YYYY'),
               'status',    l.status
           )), '[]'::jsonb)
      INTO v_orders
      FROM lines l;

    -- The newest scent profile they have on record, if any.
    SELECT q.scent_profile INTO v_profile
      FROM public.fragrance_quiz_responses q
     WHERE q.customer_id = v_uid
       AND q.scent_profile <> '{}'::jsonb
     ORDER BY q.updated_at DESC
     LIMIT 1;

    RETURN jsonb_build_object(
        'firstName',    NULLIF(btrim(COALESCE(v_first, '')), ''),
        'owns',         COALESCE(v_orders, '[]'::jsonb),
        'scentProfile', COALESCE(v_profile, '{}'::jsonb)
    );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_concierge_customer_context(UUID, TEXT) FROM PUBLIC;
-- authenticated only. An anon caller has no auth.uid() and would get NULL, but
-- there is no reason to let them ask.
GRANT EXECUTE ON FUNCTION public.get_concierge_customer_context(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. forget_concierge_customer() — make the deletion claim true
--
-- ON DELETE SET NULL unlinks a session from a deleted account, which sounds
-- like forgetting but is not: the agent greeted them by first name, and that
-- name is sitting in concierge_messages.content as prose. Only removing the
-- sessions removes the messages, which the CASCADE from migration 53 does.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.forget_concierge_customer(p_customer_id UUID)
RETURNS INT AS $$
DECLARE
    v_removed INT;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not authorised';
    END IF;
    IF p_customer_id IS NULL THEN
        RETURN 0;
    END IF;

    DELETE FROM public.concierge_sessions WHERE customer_id = p_customer_id;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RETURN v_removed;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.forget_concierge_customer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forget_concierge_customer(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Operations note.
--
-- How many old quiz results found an owner:
--
--   SELECT count(*) FILTER (WHERE customer_id IS NOT NULL) AS linked,
--          count(*) AS total
--   FROM public.fragrance_quiz_responses;
--
-- A low number is not necessarily wrong. Most finder sessions never ask for the
-- email, and handle_new_user() (04_customers.sql) DELETEs any customers row
-- sharing a new signup's address — so a later signup can null a link this
-- backfill just made.
--
-- The check that actually matters, run as a signed-in NON-admin shopper:
--
--   SELECT public.get_concierge_customer_context(NULL, NULL);
--
-- It must return that shopper's own orders and nobody else's, and it must
-- contain no email address, telephone number, street or order total anywhere.
-- ---------------------------------------------------------------------------
