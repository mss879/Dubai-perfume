-- ============================================================================
-- 54. Concierge insights — make the transcript answer questions
--
-- Migration 53 files two rows per turn: what the shopper said, and what the
-- agent said back. That is a record of the conversation but not of the SALE.
-- It cannot answer the only questions worth asking of it:
--
--   * Which bottles does the agent put in front of people, and which of those
--     do they actually take? "Shown" was already recorded; "taken" never was —
--     add_to_cart lived and died inside one request.
--   * Where does the agent fail? A reply that named nothing, searched for
--     something the catalogue does not have, or ran out of tool steps mid
--     thought reads exactly like a good reply once it is prose in a column.
--   * When is the shop busy? In Dubai's hours, not UTC's.
--
-- So this migration widens `concierge_messages` into a record of the turn, and
-- replaces the two racing writes with one. Note that 53's two calls both did
-- INSERT .. ON CONFLICT on the SAME concierge_sessions row, so the second
-- blocked on the first's lock; folding them removes that contention and — more
-- importantly — makes the user turn and its reply reliably orderable, which
-- neither BIGSERIAL nor created_at guaranteed when they raced.
--
-- OWNERSHIP RULE, and it matters: this migration owns the shape of
-- concierge_messages and the single write path log_concierge_turn(). No later
-- migration adds a column to that table, and no later migration replaces that
-- function. Two migrations each doing CREATE OR REPLACE on one logger means the
-- last one applied silently wins and the other's fields stop being written,
-- with nothing to notice it. That is why the two photograph columns below are
-- added here, several migrations before the feature that fills them.
--
-- 53's log_concierge_message() is left in place, granted and unused. It is not
-- edited — migrations are never edited — and the route simply stops calling it.
--
-- Companion app code: src/app/lib/concierge/insights.ts,
-- src/app/api/concierge/route.ts, the "concierge" tab of the admin panel.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The turn columns
--
-- 53's `product_ids` already means "products staged with this reply", so it
-- stays as the record of what was SHOWN rather than gaining a synonym beside
-- it. Everything else is new. The shopper's own taps land on the USER row and
-- the agent's own additions on the ASSISTANT row, because that is where each
-- chronologically belongs and it keeps "who closed this" answerable later.
-- ---------------------------------------------------------------------------

ALTER TABLE public.concierge_messages
    -- How the turn ended. NULL on user rows; see the CHECK below.
    ADD COLUMN IF NOT EXISTS outcome           TEXT,
    -- Ids the AGENT added to the bag with add_to_cart (assistant rows).
    ADD COLUMN IF NOT EXISTS added_product_ids INT[],
    -- Ids the SHOPPER added by tapping ADD on a staged card (user rows).
    ADD COLUMN IF NOT EXISTS tapped_product_ids INT[],
    -- The scent-builder question staged with this reply, if any.
    ADD COLUMN IF NOT EXISTS question_id       TEXT,
    -- Tool names called this turn, in call order.
    ADD COLUMN IF NOT EXISTS tools_used        TEXT[],
    -- What the agent searched the catalogue for. The most direct read there is
    -- on demand the shop cannot currently meet.
    ADD COLUMN IF NOT EXISTS search_terms      TEXT[],
    -- Which page of the store the shopper was standing on.
    ADD COLUMN IF NOT EXISTS page              TEXT,
    ADD COLUMN IF NOT EXISTS model             TEXT,
    ADD COLUMN IF NOT EXISTS latency_ms        INT,
    ADD COLUMN IF NOT EXISTS input_tokens      INT,
    ADD COLUMN IF NOT EXISTS output_tokens     INT,
    -- The two below belong to the photograph feature (migration 58). They are
    -- added HERE on purpose — see the ownership rule in the header.
    ADD COLUMN IF NOT EXISTS has_image         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS photo_reading     TEXT;

-- The outcome vocabulary is whitelisted so a typo in the route cannot quietly
-- invent a category that then splits every chart. The SAME eight values appear
-- in exactly three other places, and all four must be changed together:
--
--   * log_concierge_turn() below, where an unknown value is coerced to NULL
--   * ConciergeOutcome in src/app/lib/concierge/insights.ts
--   * CONCIERGE_OUTCOMES in the admin panel
--
--   answered       the ordinary good turn
--   no_match       it searched, and the catalogue had nothing
--   no_tools       it answered from the prompt alone, touching nothing
--   dead_end       it stopped with neither words nor anything on the stage
--   bad_ids        it named products that do not exist
--   truncated      it ran out of output or out of tool steps mid thought
--   failed         the model call itself threw
--   no_image_match it read a photograph and found nothing close (migration 58)
ALTER TABLE public.concierge_messages
    DROP CONSTRAINT IF EXISTS concierge_messages_outcome_check;
ALTER TABLE public.concierge_messages
    ADD CONSTRAINT concierge_messages_outcome_check
    CHECK (outcome IS NULL OR outcome IN (
        'answered', 'no_match', 'no_tools', 'dead_end',
        'bad_ids', 'truncated', 'failed', 'no_image_match'
    ));

-- The struggle list and the busiest-hours histogram both scan by time, and the
-- struggle list always filters on outcome. Partial: the answered turns are the
-- overwhelming majority and never appear in that query.
CREATE INDEX IF NOT EXISTS idx_concierge_messages_time
    ON public.concierge_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_messages_struggles
    ON public.concierge_messages (created_at DESC)
    WHERE outcome IS NOT NULL AND outcome <> 'answered';

-- ---------------------------------------------------------------------------
-- 2. Bounding helpers
--
-- Every one of these exists because the route handler's clamps do not bind a
-- caller who speaks PostgREST directly — the same reasoning as migration 53.
-- ---------------------------------------------------------------------------

-- Order is data here: "the first thing it showed" is a different fact from
-- "something it showed". A plain `unnest .. LIMIT` in a subquery gives no
-- ordering guarantee at all, so the ordinality is carried explicitly.
CREATE OR REPLACE FUNCTION public.concierge_clamp_ints(p_values INT[], p_limit INT)
RETURNS INT[] AS $$
    SELECT CASE
        WHEN p_values IS NULL THEN NULL
        ELSE (
            SELECT array_agg(s.v ORDER BY s.ord)
              FROM (
                SELECT t.x AS v, t.ord
                  FROM unnest(p_values) WITH ORDINALITY AS t(x, ord)
                 ORDER BY t.ord
                 LIMIT GREATEST(COALESCE(p_limit, 12), 0)
              ) s
        )
    END;
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.concierge_clamp_labels(
    p_values TEXT[], p_limit INT, p_len INT
) RETURNS TEXT[] AS $$
    SELECT CASE
        WHEN p_values IS NULL THEN NULL
        ELSE (
            SELECT array_agg(s.v ORDER BY s.ord)
              FROM (
                SELECT left(btrim(t.x), GREATEST(COALESCE(p_len, 40), 1)) AS v, t.ord
                  FROM unnest(p_values) WITH ORDINALITY AS t(x, ord)
                 WHERE t.x IS NOT NULL AND btrim(t.x) <> ''
                 ORDER BY t.ord
                 LIMIT GREATEST(COALESCE(p_limit, 8), 0)
              ) s
        )
    END;
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

-- Shoppers type contact details into chat even when the agent has just told
-- them to use /track. This runs on the way IN, so the real values never reach
-- the table at all — which also means they can never be recovered from it, for
-- any reason. That is the deliberate trade: the store keeps what people wanted,
-- not how to reach them.
--
-- Deliberately conservative about what counts as a number: prices, sizes and
-- product ids must survive untouched, so a bare run of six digits or fewer is
-- left alone and only phone-shaped groupings or seven-plus digit runs go.
CREATE OR REPLACE FUNCTION public.concierge_redact_pii(p_text TEXT)
RETURNS TEXT AS $$
DECLARE
    v TEXT := COALESCE(p_text, '');
BEGIN
    -- Emails first, so the digits inside one are not half-eaten below.
    v := regexp_replace(v, '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[email]', 'g');
    -- Phone shapes: an optional country part, then 3 and 4 digit groups. Needs
    -- nine digits at minimum, so "AED 300 400 500" cannot match it.
    v := regexp_replace(v, '(\+?[0-9]{1,4}[ .-]?)?\(?[0-9]{2,4}\)?[ .-]?[0-9]{3}[ .-]?[0-9]{4}', '[number]', 'g');
    -- Anything else seven digits or longer run together.
    v := regexp_replace(v, '[0-9]{7,}', '[number]', 'g');
    RETURN v;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 3. log_concierge_turn() — the single write path, replacing 53's pair
--
-- Same fail-soft doctrine as log_concierge_message(): it never raises, because
-- a shopper must never see an error caused by bookkeeping. That silence is also
-- its one danger — a column typo here is invisible in the browser AND in the
-- server log — so the smoke test at the foot of this file is not optional.
--
-- The parameter list is FROZEN. Migrations 55-58 read these columns and never
-- replace this function; anything new goes in a new function with a new name.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_concierge_turn(
    p_session_id         UUID,
    p_user_content       TEXT,
    p_assistant_content  TEXT    DEFAULT '',
    p_outcome            TEXT    DEFAULT NULL,
    p_shown_product_ids  INT[]   DEFAULT NULL,
    p_added_product_ids  INT[]   DEFAULT NULL,
    p_tapped_product_ids INT[]   DEFAULT NULL,
    p_question_id        TEXT    DEFAULT NULL,
    p_tools_used         TEXT[]  DEFAULT NULL,
    p_search_terms       TEXT[]  DEFAULT NULL,
    p_page               TEXT    DEFAULT NULL,
    p_model              TEXT    DEFAULT NULL,
    p_latency_ms         INT     DEFAULT NULL,
    p_input_tokens       INT     DEFAULT NULL,
    p_output_tokens      INT     DEFAULT NULL,
    p_has_image          BOOLEAN DEFAULT FALSE,
    p_photo_reading      TEXT    DEFAULT NULL,
    p_client_key         TEXT    DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_user      TEXT := left(btrim(COALESCE(p_user_content, '')), 8000);
    v_assistant TEXT := left(btrim(COALESCE(p_assistant_content, '')), 8000);
    v_outcome   TEXT;
    v_reading   TEXT;
    v_page      TEXT := NULLIF(left(btrim(COALESCE(p_page, '')), 120), '');
    v_count     INT;
BEGIN
    IF p_session_id IS NULL OR (length(v_user) = 0 AND length(v_assistant) = 0) THEN
        RETURN;
    END IF;

    -- An unrecognised outcome becomes NULL rather than tripping the CHECK. A
    -- rejected row would lose the whole turn to protect one column.
    v_outcome := CASE
        WHEN p_outcome IN ('answered', 'no_match', 'no_tools', 'dead_end',
                           'bad_ids', 'truncated', 'failed', 'no_image_match')
        THEN p_outcome
        ELSE NULL
    END;

    -- Model-authored text derived from an untrusted photograph. Brackets and
    -- newlines are stripped because the transcript's own memory notes are
    -- bracketed, and this must not be able to forge one.
    v_reading := NULLIF(
        left(btrim(regexp_replace(COALESCE(p_photo_reading, ''), '[\n\r\[\]]', ' ', 'g')), 200),
        ''
    );

    -- One row per message still, so +2 for a complete turn — the same arithmetic
    -- 53 produced with two calls. Anything reading message_count as a number of
    -- turns must halve it.
    INSERT INTO public.concierge_sessions AS s (id, client_key, message_count)
    VALUES (
        p_session_id,
        NULLIF(left(COALESCE(p_client_key, ''), 64), ''),
        (CASE WHEN length(v_user) > 0 THEN 1 ELSE 0 END)
          + (CASE WHEN length(v_assistant) > 0 THEN 1 ELSE 0 END)
    )
    ON CONFLICT (id) DO UPDATE
        SET last_seen_at  = now(),
            message_count = s.message_count
              + (CASE WHEN length(v_user) > 0 THEN 1 ELSE 0 END)
              + (CASE WHEN length(v_assistant) > 0 THEN 1 ELSE 0 END)
    RETURNING s.message_count INTO v_count;

    IF v_count > 400 THEN
        RETURN;
    END IF;

    IF length(v_user) > 0 THEN
        INSERT INTO public.concierge_messages (
            session_id, role, content, tapped_product_ids, page, has_image
        ) VALUES (
            p_session_id,
            'user',
            public.concierge_redact_pii(v_user),
            public.concierge_clamp_ints(p_tapped_product_ids, 12),
            v_page,
            COALESCE(p_has_image, FALSE)
        );
    END IF;

    IF length(v_assistant) > 0 THEN
        INSERT INTO public.concierge_messages (
            session_id, role, content, product_ids, added_product_ids,
            question_id, tools_used, search_terms, outcome, page,
            model, latency_ms, input_tokens, output_tokens, photo_reading
        ) VALUES (
            p_session_id,
            'assistant',
            public.concierge_redact_pii(v_assistant),
            public.concierge_clamp_ints(p_shown_product_ids, 12),
            public.concierge_clamp_ints(p_added_product_ids, 12),
            NULLIF(left(btrim(COALESCE(p_question_id, '')), 32), ''),
            public.concierge_clamp_labels(p_tools_used, 12, 40),
            -- 80 matches search_products' own `query` limit, so a term is never
            -- stored shorter than the agent was allowed to search for.
            public.concierge_clamp_labels(p_search_terms, 8, 80),
            v_outcome,
            v_page,
            NULLIF(left(btrim(COALESCE(p_model, '')), 60), ''),
            GREATEST(LEAST(COALESCE(p_latency_ms, 0), 600000), 0),
            GREATEST(LEAST(COALESCE(p_input_tokens, 0), 10000000), 0),
            GREATEST(LEAST(COALESCE(p_output_tokens, 0), 10000000), 0),
            v_reading
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Bookkeeping never costs an answer.
    RETURN;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.log_concierge_turn(
    UUID, TEXT, TEXT, TEXT, INT[], INT[], INT[], TEXT, TEXT[], TEXT[],
    TEXT, TEXT, INT, INT, INT, BOOLEAN, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_concierge_turn(
    UUID, TEXT, TEXT, TEXT, INT[], INT[], INT[], TEXT, TEXT[], TEXT[],
    TEXT, TEXT, INT, INT, INT, BOOLEAN, TEXT, TEXT
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The admin reads
--
-- These aggregate a table that grows with every message, so they are functions
-- rather than a nineteenth select("*") in the panel's seed effect. Each checks
-- is_admin() in its own body: RLS alone would let a signed-in shopper call the
-- function and get an empty answer, which is safe but wastes a query plan on
-- the way to nothing.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_concierge_overview(p_days INT DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
    v_days   INT := GREATEST(LEAST(COALESCE(p_days, 30), 365), 1);
    v_since  TIMESTAMP WITH TIME ZONE := now() - make_interval(days => v_days);
    v_result JSONB;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not authorised';
    END IF;

    WITH turns AS (
        SELECT * FROM public.concierge_messages WHERE created_at >= v_since
    ),
    replies AS (
        SELECT * FROM turns WHERE role = 'assistant'
    ),
    totals AS (
        SELECT jsonb_build_object(
            'sessions',    (SELECT count(DISTINCT session_id) FROM turns),
            'turns',       (SELECT count(*) FROM replies),
            'photo_turns', (SELECT count(*) FROM turns WHERE has_image),
            'adds',        (SELECT COALESCE(sum(
                                cardinality(COALESCE(added_product_ids, '{}'::INT[]))
                            ), 0) FROM replies)
                          + (SELECT COALESCE(sum(
                                cardinality(COALESCE(tapped_product_ids, '{}'::INT[]))
                            ), 0) FROM turns),
            'struggles',   (SELECT count(*) FROM replies
                             WHERE outcome IS NOT NULL AND outcome <> 'answered'),
            'median_latency_ms', (SELECT COALESCE(
                                    percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms), 0
                                 )::INT FROM replies WHERE latency_ms > 0)
        ) AS j
    ),
    outcomes AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('outcome', o, 'turns', n)
                                  ORDER BY n DESC), '[]'::jsonb) AS j
          FROM (SELECT COALESCE(outcome, 'answered') AS o, count(*) AS n
                  FROM replies GROUP BY 1) t
    ),
    -- Dubai's clock, not the server's. "Busiest hour" in UTC is a fact about
    -- nothing: the shop's evening is the database's afternoon.
    hours AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h, 'turns', n)
                                  ORDER BY h), '[]'::jsonb) AS j
          FROM (SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Dubai')::INT AS h,
                       count(*) AS n
                  FROM replies GROUP BY 1) t
    ),
    daily AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d, 'turns', n)
                                  ORDER BY d), '[]'::jsonb) AS j
          FROM (SELECT (created_at AT TIME ZONE 'Asia/Dubai')::DATE AS d, count(*) AS n
                  FROM replies GROUP BY 1) t
    ),
    -- Every expansion below goes through a lateral join rather than unnest() in
    -- the select list: a set-returning function there is projected AFTER
    -- grouping, so pairing one with count(*) is rejected outright.
    terms AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('term', term, 'times', n)
                                  ORDER BY n DESC, term), '[]'::jsonb) AS j
          FROM (SELECT lower(u.term) AS term, count(*) AS n
                  FROM replies r, unnest(r.search_terms) AS u(term)
                 GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 25) t
    ),
    tools AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('tool', tool, 'times', n)
                                  ORDER BY n DESC), '[]'::jsonb) AS j
          FROM (SELECT u.tool AS tool, count(*) AS n
                  FROM replies r, unnest(r.tools_used) AS u(tool)
                 GROUP BY 1 ORDER BY 2 DESC LIMIT 20) t
    ),
    questions AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('question', question_id, 'times', n)
                                  ORDER BY n DESC), '[]'::jsonb) AS j
          FROM (SELECT question_id, count(*) AS n
                  FROM replies WHERE question_id IS NOT NULL
                 GROUP BY 1 ORDER BY 2 DESC LIMIT 20) t
    ),
    -- The heart of it: how often a bottle was put in front of someone, against
    -- how often it left with them. Shown and taken are counted from different
    -- rows, so they are gathered separately and joined on the product.
    shown AS (
        SELECT u.pid, count(*) AS n
          FROM replies r, unnest(r.product_ids) AS u(pid)
         GROUP BY 1
    ),
    taken AS (
        SELECT pid, sum(n) AS n FROM (
            SELECT u.pid, count(*) AS n
              FROM replies r, unnest(r.added_product_ids) AS u(pid)
             GROUP BY 1
            UNION ALL
            SELECT u.pid, count(*) AS n
              FROM turns t2, unnest(t2.tapped_product_ids) AS u(pid)
             GROUP BY 1
        ) u GROUP BY 1
    ),
    demand AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'product_id', pid, 'name', name, 'brand', brand,
                   'shown', shown_n, 'taken', taken_n
               ) ORDER BY shown_n DESC, taken_n DESC), '[]'::jsonb) AS j
          FROM (
            SELECT s.pid,
                   COALESCE(p.name, '#' || s.pid) AS name,
                   COALESCE(p.brand, '') AS brand,
                   s.n AS shown_n,
                   COALESCE(t.n, 0) AS taken_n
              FROM shown s
              LEFT JOIN taken t ON t.pid = s.pid
              LEFT JOIN public.products p ON p.id = s.pid
             ORDER BY s.n DESC LIMIT 30
          ) x
    )
    SELECT jsonb_build_object(
        'days',      v_days,
        'totals',    (SELECT j FROM totals),
        'outcomes',  (SELECT j FROM outcomes),
        'hours',     (SELECT j FROM hours),
        'daily',     (SELECT j FROM daily),
        'terms',     (SELECT j FROM terms),
        'tools',     (SELECT j FROM tools),
        'questions', (SELECT j FROM questions),
        'demand',    (SELECT j FROM demand)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_concierge_overview(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_concierge_overview(INT) TO authenticated;

-- One row per conversation, newest first, for the list the owner scrolls.
CREATE OR REPLACE FUNCTION public.admin_concierge_sessions(
    p_days           INT     DEFAULT 30,
    p_struggles_only BOOLEAN DEFAULT FALSE,
    p_limit          INT     DEFAULT 25,
    p_offset         INT     DEFAULT 0
) RETURNS TABLE (
    session_id   UUID,
    started_at   TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    turns        BIGINT,
    struggles    BIGINT,
    photos       BIGINT,
    adds         BIGINT,
    opening      TEXT,
    total_count  BIGINT
) AS $$
DECLARE
    v_days   INT := GREATEST(LEAST(COALESCE(p_days, 30), 365), 1);
    v_since  TIMESTAMP WITH TIME ZONE := now() - make_interval(days => v_days);
    v_limit  INT := GREATEST(LEAST(COALESCE(p_limit, 25), 100), 1);
    v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not authorised';
    END IF;

    RETURN QUERY
    WITH rolled AS (
        SELECT m.session_id AS sid,
               min(m.created_at) AS started,
               max(m.created_at) AS seen,
               count(*) FILTER (WHERE m.role = 'assistant') AS n_turns,
               count(*) FILTER (WHERE m.outcome IS NOT NULL
                                  AND m.outcome <> 'answered')  AS n_struggles,
               count(*) FILTER (WHERE m.has_image)              AS n_photos,
               COALESCE(sum(cardinality(COALESCE(m.added_product_ids, '{}'::INT[]))), 0)
                 + COALESCE(sum(cardinality(COALESCE(m.tapped_product_ids, '{}'::INT[]))), 0)
                                                                AS n_adds,
               -- The first thing the shopper actually said, which is the only
               -- useful label a conversation has.
               (array_agg(m.content ORDER BY m.id)
                  FILTER (WHERE m.role = 'user'))[1]            AS first_said
          FROM public.concierge_messages m
         WHERE m.created_at >= v_since
         GROUP BY m.session_id
    ),
    filtered AS (
        SELECT * FROM rolled
         WHERE NOT COALESCE(p_struggles_only, FALSE) OR n_struggles > 0
    )
    SELECT f.sid, f.started, f.seen, f.n_turns, f.n_struggles, f.n_photos,
           f.n_adds, left(COALESCE(f.first_said, ''), 140),
           (SELECT count(*) FROM filtered)
      FROM filtered f
     ORDER BY f.seen DESC
     LIMIT v_limit OFFSET v_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_concierge_sessions(INT, BOOLEAN, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_concierge_sessions(INT, BOOLEAN, INT, INT) TO authenticated;

-- One conversation, in order, for the replay drawer. Fetched per session rather
-- than bulk-loaded: a transcript table is the one thing in the panel that grows
-- without bound.
CREATE OR REPLACE FUNCTION public.admin_concierge_transcript(p_session_id UUID)
RETURNS TABLE (
    id            BIGINT,
    role          TEXT,
    content       TEXT,
    product_ids   INT[],
    added_ids     INT[],
    tapped_ids    INT[],
    outcome       TEXT,
    question_id   TEXT,
    tools_used    TEXT[],
    search_terms  TEXT[],
    page          TEXT,
    has_image     BOOLEAN,
    photo_reading TEXT,
    latency_ms    INT,
    created_at    TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not authorised';
    END IF;

    RETURN QUERY
    SELECT m.id, m.role, m.content, m.product_ids, m.added_product_ids,
           m.tapped_product_ids, m.outcome, m.question_id, m.tools_used,
           m.search_terms, m.page, m.has_image, m.photo_reading,
           m.latency_ms, m.created_at
      FROM public.concierge_messages m
     WHERE m.session_id = p_session_id
     ORDER BY m.id
     LIMIT 400;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_concierge_transcript(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_concierge_transcript(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Operations note — DO THIS, it is not optional.
--
-- log_concierge_turn() swallows every error by design, so a mistake in it is
-- invisible: the chat keeps working, the panel keeps showing zero, and nothing
-- appears in any log. A green deploy proves nothing about this file.
--
-- After applying, send ONE message through the concierge, then:
--
--   SELECT role, outcome, product_ids, tapped_product_ids, has_image,
--          tools_used, latency_ms, model
--   FROM public.concierge_messages ORDER BY id DESC LIMIT 4;
--
-- Two rows, a user turn and its reply, the reply carrying an outcome and a
-- tool list. If it is empty, the function is failing silently — call it by hand
-- with the same arguments and remove the EXCEPTION block temporarily to see why.
--
-- And confirm the redaction, which cannot be undone once it is wrong:
--
--   SELECT public.concierge_redact_pii(
--     'ring me on 050 123 4567 or fatima@example.com, and is AED 300 right for 100 ml?'
--   );
--   -- expected: ring me on [number] or [email], and is AED 300 right for 100 ml?
-- ---------------------------------------------------------------------------
