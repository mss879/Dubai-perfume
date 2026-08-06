-- ============================================================================
-- 59. Two corrections to the concierge's memory of a customer
--
-- Migration 56 is applied, so it is not edited — this replaces the one function
-- that needs changing, in full.
--
-- WHAT WAS WRONG.
--
--   1. A CANCELLED order counted as owned. The `recent` CTE filtered on the
--      customer and nothing else, so a bottle from an order that was cancelled
--      or refunded was handed to the agent under "already in their collection",
--      and the prompt tells it never to stage those. The shopper never received
--      that perfume — quite possibly it was cancelled because they still want
--      it — and the agent was being instructed not to sell it to them. Exactly
--      backwards, and invisible: it looks like the agent simply never suggests
--      that bottle.
--
--   2. The LIMIT ran before the filter could matter. Five cancelled orders in a
--      row would fill the whole window and leave the agent believing a customer
--      with a real purchase history owns nothing. Filtering inside the CTE, ahead
--      of the LIMIT, is what makes "their last five orders" mean their last five
--      REAL orders.
--
-- Everything else about the function is unchanged, including the rule that
-- matters most: it takes no customer id and reads auth.uid() itself.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_concierge_customer_context(
    p_session_id UUID DEFAULT NULL,
    p_client_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_uid     UUID := auth.uid();
    v_first   TEXT;
    v_orders  JSONB;
    v_profile JSONB;
BEGIN
    IF v_uid IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT c.first_name INTO v_first FROM public.customers c WHERE c.id = v_uid;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF p_session_id IS NOT NULL THEN
        UPDATE public.concierge_sessions s
           SET customer_id = v_uid
         WHERE s.id = p_session_id
           AND s.customer_id IS NULL
           AND s.last_seen_at > now() - interval '24 hours'
           AND (s.client_key IS NULL
                OR s.client_key IS NOT DISTINCT FROM NULLIF(left(COALESCE(p_client_key, ''), 64), ''));
    END IF;

    WITH recent AS (
        SELECT o.id, o.status, o.created_at
          FROM public.orders o
         WHERE (o.customer_id = v_uid
                OR lower(o.email) = (SELECT lower(c.email) FROM public.customers c WHERE c.id = v_uid))
           -- Owned means received, or on its way. A cancelled order is the one
           -- case where "do not recommend this" is precisely wrong. Filtered
           -- HERE so the LIMIT below counts five real orders, not five rows.
           AND lower(COALESCE(o.status, '')) NOT IN ('cancelled', 'canceled', 'refunded')
         ORDER BY o.created_at DESC
         LIMIT 5
    ),
    lines AS (
        SELECT r.id, r.status, r.created_at,
               oi.product_id, oi.size, oi.quantity,
               COALESCE(p.name, '')  AS product_name,
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
GRANT EXECUTE ON FUNCTION public.get_concierge_customer_context(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Operations note.
--
-- Signed in as a customer who has a cancelled order, confirm the bottle from it
-- is no longer listed as owned:
--
--   SELECT jsonb_pretty(public.get_concierge_customer_context(NULL, NULL));
--
-- Nothing in `owns` should carry a cancelled status, and a customer whose only
-- orders were cancelled should come back with an empty `owns` array rather than
-- an inventory of things they never received.
-- ---------------------------------------------------------------------------
