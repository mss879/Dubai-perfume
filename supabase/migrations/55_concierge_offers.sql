-- ============================================================================
-- 55. Offers the concierge may speak about
--
-- "Any offers on?" is one of the first things a shopper asks, and today the
-- agent cannot answer it at all: HARD_RULES forbids it from inventing a
-- discount, validate_discount only checks a code the shopper already knows, and
-- nothing in the catalogue digest mentions promotions. So it either says
-- nothing useful or — worse — guesses.
--
-- Two things here fix that:
--
--   * list_live_offers() lets it read the codes that are actually live, using
--     the same conditions place_order applies at redemption, so the agent can
--     never name a code that will be refused at checkout.
--
--   * discounts.concierge_only marks a code as the chat's own. The agent may
--     OFFER those; ordinary public codes it may only explain when asked. That
--     is what makes the question "how much trade does the conversation close?"
--     answerable at all — orders.discount_code already records which code paid.
--
-- WHY THE GATE IS IN SQL AND NOT IN THE ROUTE. There is no service-role key, so
-- every function here is granted to anon — and anyone can read the public anon
-- key straight out of the browser bundle. A limit enforced in the Next route
-- binds only callers who go through the Next route. Worse, migration 53 grants
-- log_concierge_message() to anon and it CREATES the session row itself, so a
-- scraper can forge a plausible-looking conversation with two RPC calls before
-- asking for the exclusive list. The gate therefore lives inside the function,
-- where nothing can route around it, and leans on check_rate_limit (44) rather
-- than trusting the session row alone.
--
-- Companion app code: src/app/lib/concierge/offers.ts, offer-insights.ts,
-- src/app/lib/offer-code.ts, the discounts tab of the admin panel.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The exclusive flag
-- ---------------------------------------------------------------------------

ALTER TABLE public.discounts
    ADD COLUMN IF NOT EXISTS concierge_only BOOLEAN NOT NULL DEFAULT FALSE;

-- The real control on a code an AI hands out is its cap, so require one rather
-- than asking the owner to remember. An exclusive with no ceiling is a way to
-- discover in a month that the chat gave away the quarter.
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS discounts_concierge_only_needs_cap;
ALTER TABLE public.discounts
    ADD CONSTRAINT discounts_concierge_only_needs_cap
    CHECK (NOT concierge_only OR usage_limit IS NOT NULL);

-- Attribution joins orders back to discounts on the code, case-insensitively —
-- place_order stores whatever the shopper typed.
CREATE INDEX IF NOT EXISTS idx_orders_discount_code_upper
    ON public.orders (upper(discount_code)) WHERE discount_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. list_live_offers() — what the agent is allowed to know
--
-- VOLATILE, not STABLE: it charges a rate limit, which writes.
--
-- Returns only what a shopper may safely be told. usage_count, usage_limit,
-- is_active and the row id never leave — how close a code is to exhaustion is
-- the maison's business, and an agent that knows would eventually say so.
-- Rows with a NULL code are automatic discounts, not something anyone types,
-- so they are excluded entirely.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_live_offers(p_session_id UUID DEFAULT NULL)
RETURNS TABLE (
    code            TEXT,
    title           TEXT,
    kind            TEXT,
    value           NUMERIC,
    min_requirement NUMERIC,
    ends_at         TIMESTAMP WITH TIME ZONE,
    exclusive       BOOLEAN
) AS $$
DECLARE
    v_exclusive BOOLEAN := FALSE;
BEGIN
    -- The exclusive slice is earned, not requested. A real shopper has had a
    -- conversation; a scraper wants the codes on the first call.
    IF p_session_id IS NOT NULL THEN
        SELECT TRUE INTO v_exclusive
          FROM public.concierge_sessions s
         WHERE s.id = p_session_id
           -- log_concierge_turn files 2 rows per turn, so 4 is two complete
           -- exchanges. NOT four turns.
           AND s.message_count >= 4
           -- A session created moments ago is a script, not a conversation.
           AND s.created_at   <  now() - interval '60 seconds'
           AND s.last_seen_at >  now() - interval '24 hours';

        v_exclusive := COALESCE(v_exclusive, FALSE)
            -- Even a genuine session may ask only so often, and the whole store
            -- only so much: the global bucket is the backstop for someone
            -- farming many forged sessions in parallel.
            AND public.check_rate_limit('offers:sess:' || p_session_id::TEXT, 6, 3600)
            AND public.check_rate_limit('offers:global', 400, 3600);
    END IF;

    RETURN QUERY
    SELECT d.code::TEXT,
           d.title::TEXT,
           d.type::TEXT,
           d.value,
           COALESCE(d.min_requirement, 0),
           d.ends_at,
           d.concierge_only
      FROM public.discounts d
     WHERE d.code IS NOT NULL
       AND d.is_active IS TRUE
       AND (d.starts_at IS NULL OR d.starts_at <= now())
       -- place_order uses >= CURRENT_TIMESTAMP, and raises discount_exhausted
       -- separately rather than filtering on the cap. Equivalent at the shop
       -- floor: a code this returns is one that will actually be honoured.
       AND (d.ends_at IS NULL OR d.ends_at >= now())
       AND (d.usage_limit IS NULL OR d.usage_count < d.usage_limit)
       AND (NOT d.concierge_only OR v_exclusive)
     ORDER BY d.concierge_only DESC, COALESCE(d.min_requirement, 0), d.code
     LIMIT 8;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.list_live_offers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_live_offers(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. What the conversation closed
--
-- Cancelled orders are still counted — the code was still used, and hiding the
-- cancellation would flatter the number — but they contribute no money.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_concierge_offer_performance(
    p_since          TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_until          TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_concierge_only BOOLEAN DEFAULT NULL
) RETURNS TABLE (
    code            TEXT,
    title           TEXT,
    exclusive       BOOLEAN,
    orders_count    BIGINT,
    cancelled_count BIGINT,
    revenue         NUMERIC,
    discount_given  NUMERIC
) AS $$
DECLARE
    v_since TIMESTAMP WITH TIME ZONE := COALESCE(p_since, now() - interval '90 days');
    v_until TIMESTAMP WITH TIME ZONE := COALESCE(p_until, now());
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not authorised';
    END IF;

    RETURN QUERY
    SELECT d.code::TEXT,
           d.title::TEXT,
           d.concierge_only,
           count(o.id),
           count(o.id) FILTER (WHERE lower(o.status) IN ('cancelled', 'canceled', 'refunded')),
           COALESCE(sum(o.total_price) FILTER (
               WHERE lower(o.status) NOT IN ('cancelled', 'canceled', 'refunded')), 0),
           COALESCE(sum(o.discount_amount) FILTER (
               WHERE lower(o.status) NOT IN ('cancelled', 'canceled', 'refunded')), 0)
      FROM public.discounts d
      LEFT JOIN public.orders o
             ON upper(o.discount_code) = upper(d.code)
            AND o.created_at >= v_since
            AND o.created_at <= v_until
     WHERE d.code IS NOT NULL
       AND (p_concierge_only IS NULL OR d.concierge_only = p_concierge_only)
     GROUP BY d.code, d.title, d.concierge_only
     ORDER BY 6 DESC, 4 DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_concierge_offer_performance(
    TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_concierge_offer_performance(
    TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, BOOLEAN
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Operations note.
--
-- To create the chat's own code, in the admin panel: Discount Codes → Generate,
-- tick CONCIERGE EXCLUSIVE, and give it a redemption cap (the CHECK above will
-- refuse it otherwise). Then confirm the agent cannot see it before earning it:
--
--   SELECT code, exclusive FROM public.list_live_offers(NULL);
--   -- public codes only; the exclusive must NOT appear
--
--   SELECT code, exclusive FROM public.list_live_offers(
--     '<a session id with >= 4 messages, older than a minute>');
--   -- now it appears
--
-- And the attribution, once orders exist:
--
--   SELECT * FROM public.admin_concierge_offer_performance(NULL, NULL, TRUE);
-- ---------------------------------------------------------------------------
