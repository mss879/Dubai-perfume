-- ============================================================================
-- 46. Fragrance finder quiz — response capture
--
-- The quiz itself needs no schema: it scores the products already in
-- public.products against four answers, entirely in the app. This migration
-- exists for what the quiz is worth commercially — the answers and the email.
--
--   * The answers are merchandising intelligence the store has no other source
--     for: which family people reach for, who they are buying for, what
--     occasion. Buy against that, not against guesswork.
--   * The email is the capture. It is written to newsletter_subscribers with
--     source 'quiz' by the same function, so there is one subscriber list and
--     the owner can tell where each address came from.
--
-- Giving an email is optional. A response with no email still records the
-- answers, because the answers are useful on their own and gating the results
-- on an address is what makes people abandon a quiz.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fragrance_quiz_responses (
    id BIGSERIAL PRIMARY KEY,
    -- One id per completed quiz, minted in the browser. The answers are
    -- recorded the moment the results appear; the email, if it is given at all,
    -- arrives seconds later. Both writes carry this id, so one shopper is one
    -- row rather than an anonymous row plus a duplicate with an address on it.
    session_id UUID,
    email VARCHAR(255),
    -- { "recipient": "...", "family": "...", "occasion": "...", "presence": "..." }
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- What the quiz actually showed them, so a recommendation that never
    -- converts can be told apart from one that was never shown.
    recommended_product_ids INT[] NOT NULL DEFAULT ARRAY[]::INT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_responses_session
    ON public.fragrance_quiz_responses (session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_responses_created_at
    ON public.fragrance_quiz_responses (created_at DESC);

ALTER TABLE public.fragrance_quiz_responses ENABLE ROW LEVEL SECURITY;

-- Admins read and manage; the public writes only through the function below.
DROP POLICY IF EXISTS "Admin access on fragrance_quiz_responses" ON public.fragrance_quiz_responses;
CREATE POLICY "Admin access on fragrance_quiz_responses"
    ON public.fragrance_quiz_responses FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- record_quiz_response
--
-- Bounds live here because this function is the only way in. An invalid email
-- is not an error: it means "no email given", and the answers are still worth
-- keeping. Nothing about the quiz should ever fail loudly at the shopper.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_quiz_response(
    p_session_id UUID,
    p_answers JSONB,
    p_email TEXT DEFAULT NULL,
    p_recommended INT[] DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_answers JSONB := COALESCE(p_answers, '{}'::jsonb);
    v_recommended INT[] := COALESCE(p_recommended, ARRAY[]::INT[]);
BEGIN
    IF jsonb_typeof(v_answers) <> 'object' THEN
        RAISE EXCEPTION 'invalid_answers';
    END IF;
    -- Four questions; the ceiling is a guard against a caller stuffing the
    -- column, not a limit the quiz will ever approach.
    IF (SELECT count(*) FROM jsonb_object_keys(v_answers)) > 20 THEN
        RAISE EXCEPTION 'invalid_answers';
    END IF;
    IF array_length(v_recommended, 1) > 12 THEN
        RAISE EXCEPTION 'invalid_recommendations';
    END IF;

    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 255 THEN
        v_email := NULL;
    END IF;

    INSERT INTO public.fragrance_quiz_responses
        (session_id, email, answers, recommended_product_ids)
    VALUES
        (COALESCE(p_session_id, gen_random_uuid()), v_email, v_answers, v_recommended)
    ON CONFLICT (session_id) DO UPDATE SET
        -- The second write carries the email; it must never blank the first.
        email = COALESCE(EXCLUDED.email, public.fragrance_quiz_responses.email),
        answers = EXCLUDED.answers,
        recommended_product_ids = EXCLUDED.recommended_product_ids,
        updated_at = CURRENT_TIMESTAMP;

    -- One subscriber list, tagged by where the address came from.
    IF v_email IS NOT NULL THEN
        PERFORM public.subscribe_newsletter(v_email, 'quiz');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.record_quiz_response(UUID, JSONB, TEXT, INT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_quiz_response(UUID, JSONB, TEXT, INT[]) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operations note:
--
-- What the quiz is telling you, once it has been live a week:
--
--   SELECT answers->>'family' AS family, count(*)
--   FROM public.fragrance_quiz_responses
--   GROUP BY 1 ORDER BY 2 DESC;
--
--   SELECT count(*) FILTER (WHERE email IS NOT NULL) AS with_email,
--          count(*) AS total
--   FROM public.fragrance_quiz_responses;
--
-- The second is the capture rate. If it is low, the ask at the end of the quiz
-- is worded wrong — not the quiz.
-- ---------------------------------------------------------------------------
