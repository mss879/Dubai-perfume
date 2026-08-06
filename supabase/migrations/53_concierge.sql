-- ============================================================================
-- 53. Perfume concierge — stock visibility for the chat agent + transcripts
--
-- The storefront gains an AI concierge (a chat agent at /api/concierge) that
-- advises shoppers and sells. Two things it needs cannot be had with the anon
-- key today, and both follow the same doctrine as migrations 44/45/52: the
-- store has NO service-role key, deliberately, so every trusted path is a
-- SECURITY DEFINER function callable with the public anon key.
--
--   * Stock. `inventory` is admin-only under RLS (migration 10), which is
--     right — the full stock ledger is nobody's business. But the concierge
--     must answer "is this available?" truthfully, so get_product_availability()
--     opens a keyhole: stock for an explicit, bounded list of products, plus a
--     computed low-stock flag. It never returns cost, thresholds, or the
--     ledger's shape (updated_at, ids), and it cannot be used to dump the
--     table — the id list is capped inside the function.
--
--   * Transcripts. Every conversation is kept for the owner to review — what
--     shoppers ask for is merchandising signal the store gets nowhere else.
--     The tables are sealed like site_lock (RLS on, no anon path, writes only
--     through log_concierge_message()); admins read them through PostgREST
--     with the same is_admin() gate the rest of the panel uses.
--
--   * log_concierge_message() NEVER raises. A failed log must cost the log
--     entry, not the shopper's answer — the same fail-soft stance the quiz
--     capture takes. Every input is bounded here, in the function, because the
--     route handler's own clamps do not bind a caller who speaks PostgREST
--     directly.
--
-- Companion app code: src/app/api/concierge/route.ts,
-- src/app/lib/concierge/*, src/app/components/concierge/*.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_product_availability() — the concierge's only window into inventory
--
-- STABLE: it only reads. The low-stock flag is computed against the row's own
-- low_stock_threshold so the agent can say "only two left" exactly when the
-- admin panel would, without the threshold itself ever leaving the database.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_product_availability(p_product_ids INT[])
RETURNS TABLE (
    product_id INT,
    size TEXT,
    stock_level INT,
    low_stock BOOLEAN
) AS $$
    SELECT
        i.product_id,
        i.size::TEXT,
        i.stock_level,
        (i.stock_level > 0 AND i.stock_level <= i.low_stock_threshold)
    FROM public.inventory i
    -- Bounded: the 24 lowest distinct ids, so no caller can turn one call into
    -- a dump of the whole ledger. Deterministic on purpose — an arbitrary
    -- subset would make an over-long legitimate call quietly incomplete.
    JOIN (SELECT DISTINCT unnest(COALESCE(p_product_ids, '{}')) AS pid ORDER BY pid LIMIT 24) ids
      ON ids.pid = i.product_id
    ORDER BY i.product_id, i.size;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_product_availability(INT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_availability(INT[]) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The transcript tables
--
-- A session is one shopper's conversation (the browser mints the UUID and
-- keeps it in localStorage, so a conversation survives navigation). Messages
-- carry the product ids the agent showed alongside each reply, which is what
-- turns the log from prose into merchandising data: "asked for oud, was shown
-- 41 and 87, added 87".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.concierge_sessions (
    id UUID PRIMARY KEY,
    -- The rate-limit identity the route saw, kept for abuse forensics only.
    client_key TEXT,
    message_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.concierge_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.concierge_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    -- Products the agent staged with this reply, if any.
    product_ids INT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concierge_messages_session
    ON public.concierge_messages (session_id, created_at);

ALTER TABLE public.concierge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_messages ENABLE ROW LEVEL SECURITY;

-- No anon path at all; writes go through the function below. Authenticated
-- keeps SELECT so the admin panel can read transcripts through PostgREST, and
-- RLS narrows that to admins.
REVOKE ALL ON TABLE public.concierge_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.concierge_messages FROM anon, authenticated;
GRANT SELECT ON TABLE public.concierge_sessions TO authenticated;
GRANT SELECT ON TABLE public.concierge_messages TO authenticated;

DROP POLICY IF EXISTS "Admin read concierge sessions" ON public.concierge_sessions;
CREATE POLICY "Admin read concierge sessions"
    ON public.concierge_sessions FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin read concierge messages" ON public.concierge_messages;
CREATE POLICY "Admin read concierge messages"
    ON public.concierge_messages FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. log_concierge_message() — the single write path
--
-- Silently drops anything malformed rather than raising: the caller is a
-- fire-and-forget log write on the answer path, and a shopper must never see
-- an error because their conversation could not be filed. The 400-message cap
-- stops a runaway session (or a caller replaying one session id) from growing
-- a row set without limit; the route's rate limits are the real throttle, this
-- is the backstop for callers who bypass the route.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_concierge_message(
    p_session_id UUID,
    p_role TEXT,
    p_content TEXT,
    p_product_ids INT[] DEFAULT NULL,
    p_client_key TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_content TEXT := left(trim(COALESCE(p_content, '')), 8000);
    v_count INT;
BEGIN
    IF p_session_id IS NULL
       OR p_role IS NULL
       OR p_role NOT IN ('user', 'assistant')
       OR length(v_content) = 0 THEN
        RETURN;
    END IF;

    INSERT INTO public.concierge_sessions AS s (id, client_key, message_count)
    VALUES (p_session_id, NULLIF(left(COALESCE(p_client_key, ''), 64), ''), 1)
    ON CONFLICT (id) DO UPDATE
        SET last_seen_at  = now(),
            message_count = s.message_count + 1
    RETURNING s.message_count INTO v_count;

    IF v_count > 400 THEN
        RETURN;
    END IF;

    INSERT INTO public.concierge_messages (session_id, role, content, product_ids)
    VALUES (
        p_session_id,
        p_role,
        v_content,
        CASE
            WHEN p_product_ids IS NULL THEN NULL
            ELSE (SELECT array_agg(x)
                    FROM (SELECT unnest(p_product_ids) AS x LIMIT 12) t)
        END
    );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.log_concierge_message(UUID, TEXT, TEXT, INT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_concierge_message(UUID, TEXT, TEXT, INT[], TEXT) TO anon, authenticated;
