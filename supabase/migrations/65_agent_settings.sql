-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Migration 65: the Agent's switches
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- The shop's chat assistant (the "concierge", called the Agent in the admin) gains a
-- settings row the owner controls from Admin → Agent:
--
--   enabled             the whole assistant, on or off (off: the chat button disappears from
--                       the shop and the chat answers nothing)
--   greeting            its first words when a shopper opens it (NULL: the house default)
--   photos_enabled      whether it reads photographs shoppers send
--   offers_enabled      whether it discusses and offers discount codes
--   order_help_enabled  whether it helps shoppers find an existing order
--   nudges_enabled      whether the chat button raises its small pop-up hints
--
-- Built like the site lock (migration 52): one row, RLS on with no policy and grants revoked,
-- reached only through two SECURITY DEFINER functions. get_agent_settings() holds no secrets
-- and is public because the shop must know whether to show the chat. admin_set_agent_settings()
-- is the only writer and checks is_admin() itself.
--
-- Safe to run more than once. Nothing else in the database changes. Until it is applied, the
-- app treats every switch as on, which is how the assistant behaves today.
--
-- Rollback (if ever needed):
--   DROP FUNCTION IF EXISTS public.admin_set_agent_settings(JSONB);
--   DROP FUNCTION IF EXISTS public.get_agent_settings();
--   DROP TABLE IF EXISTS public.agent_settings;
-- ══════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
    IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Migration 65 stopped before changing anything. Missing: public.is_admin(uuid)';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. The single settings row. id is TRUE and must stay TRUE, so a second row
--    is impossible rather than merely discouraged.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    greeting TEXT CHECK (greeting IS NULL OR char_length(greeting) BETWEEN 1 AND 400),
    photos_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    offers_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    order_help_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    nudges_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID
);

INSERT INTO public.agent_settings (id) VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_settings FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_agent_settings(): what the shop and the chat need to know. No secrets.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agent_settings()
RETURNS TABLE (
    enabled BOOLEAN,
    greeting TEXT,
    photos_enabled BOOLEAN,
    offers_enabled BOOLEAN,
    order_help_enabled BOOLEAN,
    nudges_enabled BOOLEAN,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
    SELECT s.enabled, s.greeting, s.photos_enabled, s.offers_enabled,
           s.order_help_enabled, s.nudges_enabled, s.updated_at
    FROM public.agent_settings s
    WHERE s.id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_agent_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_settings() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_set_agent_settings(p): change any of the switches, admins only.
--    Keys left out of p keep their value. "greeting": null or "" restores the
--    house default. Anything malformed is refused with SQLSTATE 22023.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_agent_settings(p JSONB)
RETURNS TABLE (
    enabled BOOLEAN,
    greeting TEXT,
    photos_enabled BOOLEAN,
    offers_enabled BOOLEAN,
    order_help_enabled BOOLEAN,
    nudges_enabled BOOLEAN,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_key TEXT;
    v_greeting TEXT;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
    IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
        RAISE EXCEPTION 'invalid_settings' USING ERRCODE = '22023';
    END IF;

    FOR v_key IN SELECT jsonb_object_keys(p) LOOP
        IF v_key NOT IN ('enabled', 'greeting', 'photos_enabled', 'offers_enabled', 'order_help_enabled', 'nudges_enabled') THEN
            RAISE EXCEPTION 'unknown_setting' USING ERRCODE = '22023';
        END IF;
        IF v_key <> 'greeting' AND jsonb_typeof(p -> v_key) <> 'boolean' THEN
            RAISE EXCEPTION 'invalid_switch' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    IF p ? 'greeting' THEN
        IF jsonb_typeof(p -> 'greeting') = 'null' THEN
            v_greeting := NULL;
        ELSIF jsonb_typeof(p -> 'greeting') = 'string' THEN
            v_greeting := NULLIF(btrim(p ->> 'greeting'), '');
            IF char_length(v_greeting) > 400 THEN
                RAISE EXCEPTION 'greeting_too_long' USING ERRCODE = '22023';
            END IF;
        ELSE
            RAISE EXCEPTION 'invalid_greeting' USING ERRCODE = '22023';
        END IF;
    END IF;

    UPDATE public.agent_settings s SET
        enabled            = COALESCE((p ->> 'enabled')::BOOLEAN, s.enabled),
        photos_enabled     = COALESCE((p ->> 'photos_enabled')::BOOLEAN, s.photos_enabled),
        offers_enabled     = COALESCE((p ->> 'offers_enabled')::BOOLEAN, s.offers_enabled),
        order_help_enabled = COALESCE((p ->> 'order_help_enabled')::BOOLEAN, s.order_help_enabled),
        nudges_enabled     = COALESCE((p ->> 'nudges_enabled')::BOOLEAN, s.nudges_enabled),
        greeting           = CASE WHEN p ? 'greeting' THEN v_greeting ELSE s.greeting END,
        updated_at         = now(),
        updated_by         = auth.uid()
    WHERE s.id;

    RETURN QUERY SELECT * FROM public.get_agent_settings();
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_set_agent_settings(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_agent_settings(JSONB) TO authenticated;

COMMIT;
