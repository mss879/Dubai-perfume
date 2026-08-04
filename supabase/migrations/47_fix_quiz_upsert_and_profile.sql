-- ============================================================================
-- 47. Fix record_quiz_response, and record the finder's reading of the shopper
--
-- Two things.
--
-- 1. A BUG in migration 46, caught by probing the live database rather than by
--    reading the file. record_quiz_response() says:
--
--        ON CONFLICT (session_id) DO UPDATE ...
--
--    but the unique index it is meant to infer is PARTIAL:
--
--        CREATE UNIQUE INDEX ... (session_id) WHERE session_id IS NOT NULL
--
--    PostgreSQL will not infer a partial index from a bare column list — the
--    inference has to repeat the index predicate. Without it every call fails
--    with 42P10, "there is no unique or exclusion constraint matching the ON
--    CONFLICT specification", so migration 46 as applied captures NOTHING.
--    The fix is the WHERE clause on the ON CONFLICT, below.
--
--    The index from 46 is correct and stays; only the function is replaced.
--
-- 2. The finder now computes a scent profile for the shopper (six olfactory
--    axes plus a position on the fragrance wheel) and it is worth keeping. It
--    is the difference between knowing someone chose "wood & oud" and knowing
--    what the finder actually read them as — which is what tells you whether
--    the matching is any good.
-- ============================================================================

ALTER TABLE public.fragrance_quiz_responses
    -- { "fresh": 2.1, "floral": 0.4, "sweet": 1.2, "amber": 6.8,
    --   "woody": 7.4, "spice": 5.1, "intensity": 8.0, "wheel": 6 }
    ADD COLUMN IF NOT EXISTS scent_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.record_quiz_response(
    p_session_id UUID,
    p_answers JSONB,
    p_email TEXT DEFAULT NULL,
    p_recommended INT[] DEFAULT NULL,
    p_profile JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_answers JSONB := COALESCE(p_answers, '{}'::jsonb);
    v_profile JSONB := COALESCE(p_profile, '{}'::jsonb);
    v_recommended INT[] := COALESCE(p_recommended, ARRAY[]::INT[]);
    v_session UUID := COALESCE(p_session_id, gen_random_uuid());
BEGIN
    IF jsonb_typeof(v_answers) <> 'object' THEN
        RAISE EXCEPTION 'invalid_answers';
    END IF;
    IF jsonb_typeof(v_profile) <> 'object' THEN
        v_profile := '{}'::jsonb;
    END IF;
    -- Six questions and an eight-key profile; the ceilings are guards against a
    -- caller stuffing the columns, not limits the finder will ever approach.
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

    INSERT INTO public.fragrance_quiz_responses
        (session_id, email, answers, recommended_product_ids, scent_profile)
    VALUES
        (v_session, v_email, v_answers, v_recommended, v_profile)
    -- The WHERE is what migration 46 was missing. It repeats the predicate of
    -- the partial unique index so PostgreSQL can infer it.
    ON CONFLICT (session_id) WHERE session_id IS NOT NULL DO UPDATE SET
        -- The second write carries the email; it must never blank the first.
        email = COALESCE(EXCLUDED.email, public.fragrance_quiz_responses.email),
        answers = EXCLUDED.answers,
        recommended_product_ids = EXCLUDED.recommended_product_ids,
        scent_profile = EXCLUDED.scent_profile,
        updated_at = CURRENT_TIMESTAMP;

    -- One subscriber list, tagged by where the address came from.
    IF v_email IS NOT NULL THEN
        PERFORM public.subscribe_newsletter(v_email, 'quiz');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- The 4-argument version from migration 46 is a different signature, so it
-- still exists and would still be broken. Drop it; the app calls the new one.
DROP FUNCTION IF EXISTS public.record_quiz_response(UUID, JSONB, TEXT, INT[]);

REVOKE ALL ON FUNCTION public.record_quiz_response(UUID, JSONB, TEXT, INT[], JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_quiz_response(UUID, JSONB, TEXT, INT[], JSONB) TO anon, authenticated;

-- Nothing was ever captured, so there are no rows to migrate.

-- ---------------------------------------------------------------------------
-- Operations note:
--
-- Confirm the fix took, from the SQL editor or with the anon key:
--
--   SELECT public.record_quiz_response(
--       gen_random_uuid(), '{"family":"probe"}'::jsonb, NULL, ARRAY[]::INT[], '{}'::jsonb);
--
-- It must return without error. Before this migration the same call fails with
-- SQLSTATE 42P10. Then clear the probe row:
--
--   DELETE FROM public.fragrance_quiz_responses WHERE answers->>'family' = 'probe';
--
-- What the finder is telling you, once it has been live a week:
--
--   SELECT answers->>'character' AS wanted,
--          round(avg((scent_profile->>'woody')::numeric), 1)  AS avg_woody,
--          round(avg((scent_profile->>'sweet')::numeric), 1)  AS avg_sweet,
--          count(*)
--   FROM public.fragrance_quiz_responses
--   GROUP BY 1 ORDER BY 4 DESC;
--
--   SELECT count(*) FILTER (WHERE email IS NOT NULL) AS with_email, count(*) AS total
--   FROM public.fragrance_quiz_responses;
-- ---------------------------------------------------------------------------
