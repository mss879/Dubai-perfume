-- ============================================================================
-- 57. "Where is my order?" — answered in the conversation
--
-- It is the most inevitable question a shop assistant gets, and today the agent
-- can only point at /track. That works, but it ends the conversation: the
-- shopper leaves the window, and whatever they were about to buy goes with them.
--
-- The design constraint that shaped this file: the order number and the email
-- must never reach the language model, and must never be filed in
-- concierge_messages. So the agent does NOT ask for them. It stages a form, and
-- the BROWSER posts what is typed there to a dedicated endpoint that this
-- function serves. The agent knows only that it offered to look, never what was
-- typed. There is nothing to redact because nothing was ever said.
--
-- WHY THE THROTTLE IS HERE AND NOT IN THE ROUTE. This is an oracle: give it an
-- order reference and an address, and it tells you whether they go together.
-- Order references are SEQUENTIAL (order_number_seq, migration 40, starting at
-- 10001), so guessing one is trivial — the address is the only real secret, and
-- an unthrottled endpoint would let anyone spray a mailing list at ORD-10007.
-- The function is granted to anon and the anon key is in the browser bundle, so
-- a limit in the Next route binds only polite callers. It goes inside.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO: touch track_guest_order(). That
-- function has the same exposure, but it is called during a SERVER RENDER by
-- /order/[id], where a throttle would turn an ordinary page refresh into a 404
-- — and a second copy of it lives in scripts/apply-migrations-38-43.sql, which
-- would silently revert any change made here. It needs its own migration and
-- its own decision about the server-render path.
--
-- Companion app code: src/app/api/concierge/order/route.ts,
-- src/app/components/concierge/StageOrderLookup.tsx.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The audit trail
--
-- Sealed exactly like migration 53's tables: RLS on, no anon path of any kind,
-- written only by the definer function below. It records the email DOMAIN and
-- never the address — enough to see "someone is walking a list through this",
-- not enough to be a second copy of the customer list.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.concierge_order_lookups (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID,
    client_key TEXT,
    order_ref TEXT,
    email_domain TEXT,
    found BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concierge_order_lookups_time
    ON public.concierge_order_lookups (created_at DESC);

ALTER TABLE public.concierge_order_lookups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.concierge_order_lookups FROM anon, authenticated;
GRANT SELECT ON TABLE public.concierge_order_lookups TO authenticated;

DROP POLICY IF EXISTS "Admin read concierge order lookups" ON public.concierge_order_lookups;
CREATE POLICY "Admin read concierge order lookups"
    ON public.concierge_order_lookups FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. lookup_order_for_concierge()
--
-- Narrower than track_guest_order on purpose. It returns the item names, so the
-- agent can say something useful about what is on its way, and it returns NO
-- money at all: the shopper can see their total on /track or in the confirmation
-- email, and a chat window is not where anyone needs it repeated.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lookup_order_for_concierge(
    p_order_id   TEXT,
    p_email      TEXT,
    p_session_id UUID DEFAULT NULL,
    p_client_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_ref    TEXT := left(btrim(COALESCE(p_order_id, '')), 64);
    v_mail   TEXT := lower(btrim(COALESCE(p_email, '')));
    v_order  public.orders%ROWTYPE;
    v_found  BOOLEAN;
    v_items  JSONB;
    v_events JSONB;
BEGIN
    IF v_ref = '' OR v_mail = '' THEN
        RETURN NULL;
    END IF;

    -- Two buckets, because there are two attacks. The per-reference bucket
    -- stops one order being tried against many addresses; the per-address
    -- bucket stops one address being tried against many orders. The address is
    -- hashed so the limiter's own table never holds a customer email.
    IF NOT public.check_rate_limit('order_lookup:ref:' || v_ref, 8, 900)
       OR NOT public.check_rate_limit('order_lookup:mail:' || md5(v_mail), 8, 900) THEN
        RETURN jsonb_build_object('throttled', TRUE);
    END IF;

    SELECT * INTO v_order
      FROM public.orders
     WHERE id = v_ref AND lower(email) = v_mail;
    -- Captured immediately: the audit block below runs its own statements and
    -- would reset FOUND before it could be read.
    v_found := FOUND;

    -- A miss costs double. Someone guessing burns their allowance twice as fast
    -- as the shopper who simply mistyped their own reference once.
    IF NOT v_found THEN
        PERFORM public.check_rate_limit('order_lookup:ref:' || v_ref, 8, 900);
    END IF;

    BEGIN
        DELETE FROM public.concierge_order_lookups
         WHERE created_at < now() - interval '30 days';
        INSERT INTO public.concierge_order_lookups
            (session_id, client_key, order_ref, email_domain, found)
        VALUES (
            p_session_id,
            NULLIF(left(COALESCE(p_client_key, ''), 64), ''),
            v_ref,
            NULLIF(left(split_part(v_mail, '@', 2), 80), ''),
            v_found
        );
    EXCEPTION WHEN OTHERS THEN
        -- Forensics must never cost a shopper their answer.
        NULL;
    END;

    IF NOT v_found THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'productId', oi.product_id,
               'name',      COALESCE(p.name, 'Item'),
               'size',      oi.size,
               'quantity',  oi.quantity
           ) ORDER BY oi.id), '[]'::jsonb)
      INTO v_items
      FROM public.order_items oi
      LEFT JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = v_order.id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'status',      t.status,
               'location',    t.location,
               'description', t.description,
               'updatedAt',   t.updated_at
           ) ORDER BY t.updated_at), '[]'::jsonb)
      INTO v_events
      FROM public.order_tracking t
     WHERE t.order_id = v_order.id;

    RETURN jsonb_build_object(
        'orderId',        v_order.id,
        'status',         v_order.status,
        'placedAt',       v_order.created_at,
        'trackingNumber', v_order.tracking_number,
        'trackingUrl',    v_order.tracking_url,
        'items',          v_items,
        'events',         v_events
    );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.lookup_order_for_concierge(TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_order_for_concierge(TEXT, TEXT, UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operations note.
--
-- Confirm the oracle is actually shut, with a real order reference:
--
--   SELECT public.lookup_order_for_concierge('ORD-10001', 'wrong@example.com');
--   -- NULL, and it costs two of the eight tries
--
-- Run that five times and the ninth call returns {"throttled": true} rather
-- than NULL — the difference matters, because a throttled caller learns nothing
-- about whether the pair was right.
--
-- To see whether anyone is walking a list through it:
--
--   SELECT client_key, email_domain, count(*) AS tries,
--          count(*) FILTER (WHERE NOT found) AS misses
--   FROM public.concierge_order_lookups
--   WHERE created_at > now() - interval '1 hour'
--   GROUP BY 1, 2 HAVING count(*) FILTER (WHERE NOT found) > 10
--   ORDER BY misses DESC;
-- ---------------------------------------------------------------------------
