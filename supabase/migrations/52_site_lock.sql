-- ============================================================================
-- 52. Site lock — a "Launching soon" holding page with a PIN bypass
--
-- The domain is connected but the maison is not open yet. This gives the owner
-- a switch in the admin panel that puts the whole public storefront behind a
-- holding page, plus a PIN that lets the owner (and anyone they give it to)
-- walk past it to preview the real site.
--
-- Design notes, because they constrain how the app may use this:
--
--   * The store has NO service-role key, deliberately (see migration 45 and
--     docs/production-rollout.md §3). Every trusted path is a SECURITY DEFINER
--     function callable with the public anon key. So the table itself is sealed
--     the same way app_config is — RLS on, no policy for anyone, grants revoked
--     — and the four functions below are the only way in.
--
--   * get_site_lock() is called by the proxy on essentially every public
--     request, so it must never return anything secret. It returns the PIN's
--     existence but never the PIN or its hash, and it returns a SHA-256
--     *fingerprint* of the bypass token rather than the token. That is what
--     lets the proxy validate a visitor's bypass cookie by hashing it and
--     comparing — no second database round-trip, and nothing an attacker can
--     reverse (the token is a v4 UUID: 122 bits, no preimage to find).
--
--   * The countdown is authoritative HERE, not in the browser. set_site_lock()
--     takes the timer as a number of HOURS and resolves it against the
--     database clock, and get_site_lock() returns server_now alongside
--     launch_at so the holding page can render a countdown that is correct even
--     on a visitor whose device clock is wrong.
--
--   * auto_unlock makes the timer mean "locked UNTIL then" rather than merely
--     "counting down to then". The effective lock state is COMPUTED in
--     get_site_lock() from launch_at and now(), so the site opens itself the
--     moment the countdown reaches zero. There is no cron job to miss, and the
--     stored `locked` flag stays true so the admin panel can still show what
--     the owner set.
--
-- Companion app code: src/app/lib/site-lock.ts, src/proxy.ts,
-- src/app/launching-soon/*, src/app/api/site-lock/unlock/route.ts,
-- src/app/api/admin/site-lock/route.ts, src/app/admin/SiteLockPanel.tsx.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. pgcrypto, for bcrypt (the PIN) and SHA-256 (the token fingerprint)
--
-- Supabase ships pgcrypto pre-installed in the `extensions` schema, but which
-- schema holds it varies by project age, so nothing below schema-qualifies
-- crypt()/digest(). Instead every function pins
--     search_path = public, extensions, pg_temp
-- which resolves it either way (a schema listed in search_path that does not
-- exist is ignored rather than an error).
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    END IF;
END $$;

-- Fail loudly HERE rather than at the first unlock attempt months from now.
-- Looked up in the catalogue rather than through to_regprocedure(), so the
-- check tests where the functions actually live instead of what this session's
-- search_path happens to be.
DO $$
BEGIN
    IF (
        SELECT count(DISTINCT p.proname)
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.proname IN ('crypt', 'digest', 'gen_salt')
           AND n.nspname IN ('public', 'extensions')
    ) < 3 THEN
        RAISE EXCEPTION
            'pgcrypto is not reachable — crypt()/digest()/gen_salt() are not in public or extensions. Enable the pgcrypto extension for this project, then re-run this migration.';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. The state, in exactly one row
--
-- `id BOOLEAN PRIMARY KEY CHECK (id)` is the single-row idiom: TRUE is the only
-- value that satisfies both the check and the uniqueness of the key, so a
-- second row is rejected by the database rather than by convention.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_lock (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),

    -- What the owner set. The EFFECTIVE state also depends on the timer, and
    -- is computed in get_site_lock() rather than stored.
    locked BOOLEAN NOT NULL DEFAULT FALSE,

    -- bcrypt. NULL until the owner sets a PIN; the site cannot be locked while
    -- it is NULL (see set_site_lock) so there is always a way back in.
    pin_hash TEXT,

    -- The bypass credential handed to a visitor who enters the right PIN. It is
    -- rotated whenever the PIN changes, which is what makes "change the PIN"
    -- also mean "revoke everyone I gave the old one to".
    unlock_token UUID NOT NULL DEFAULT gen_random_uuid(),

    headline TEXT NOT NULL DEFAULT 'Launching soon',
    message TEXT NOT NULL DEFAULT 'Our maison is preparing to open its doors. Leave us a moment longer.',

    -- The countdown target. NULL means "locked, with no date announced".
    launch_at TIMESTAMP WITH TIME ZONE,

    -- TRUE: the lock lifts by itself when launch_at passes.
    -- FALSE: the countdown is shown to visitors but the site stays locked until
    -- the owner opens it by hand.
    auto_unlock BOOLEAN NOT NULL DEFAULT TRUE,

    -- Brute-force throttle for the PIN. A 4-6 digit PIN is small enough to
    -- exhaust, so failures are counted here and the check is refused outright
    -- for a cooling-off period once the count is reached.
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_out_until TIMESTAMP WITH TIME ZONE,

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID
);

-- The row must exist before any function can read it.
INSERT INTO public.site_lock (id) VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_lock ENABLE ROW LEVEL SECURITY;

-- No policy is created, for any role — not even for admins. RLS with no policy
-- already denies every row; revoking the grant as well means the table stays
-- unreachable through PostgREST even if a policy is ever added here by mistake.
-- The SECURITY DEFINER functions below run as the owner and bypass both.
REVOKE ALL ON TABLE public.site_lock FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_site_lock() — everything the holding page and the proxy may know
--
-- Called on public requests, so it is deliberately free of secrets: no PIN, no
-- hash, no bypass token. `unlock_fingerprint` is SHA-256 of the token, which
-- the proxy compares against SHA-256 of the visitor's cookie.
--
-- STABLE, not VOLATILE: it only reads. That also lets Postgres call it once per
-- statement.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_site_lock()
RETURNS TABLE (
    locked BOOLEAN,
    headline TEXT,
    message TEXT,
    launch_at TIMESTAMP WITH TIME ZONE,
    auto_unlock BOOLEAN,
    has_pin BOOLEAN,
    unlock_fingerprint TEXT,
    server_now TIMESTAMP WITH TIME ZONE
) AS $$
    SELECT
        -- The timer, applied. Locked stays TRUE in the table; it simply stops
        -- taking effect once an auto-unlocking countdown has run out.
        s.locked
            AND NOT (
                s.auto_unlock
                AND s.launch_at IS NOT NULL
                AND now() >= s.launch_at
            ),
        s.headline,
        s.message,
        s.launch_at,
        s.auto_unlock,
        s.pin_hash IS NOT NULL,
        encode(digest(s.unlock_token::TEXT, 'sha256'), 'hex'),
        now()
    FROM public.site_lock s
    WHERE s.id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.get_site_lock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_lock() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. verify_site_lock_pin() — the only place a PIN is ever checked
--
-- Returns the bypass token on success and NULL on every failure, so a caller
-- can learn nothing from the shape of the answer. Callable by anon, because the
-- whole point is that a signed-out visitor with the PIN can get in — which is
-- exactly why the throttle below lives inside the function rather than only in
-- the route handler.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_site_lock_pin(p_pin TEXT)
RETURNS TEXT AS $$
DECLARE
    v_row public.site_lock%ROWTYPE;
BEGIN
    SELECT * INTO v_row FROM public.site_lock WHERE id;

    IF v_row.pin_hash IS NULL THEN
        RETURN NULL;
    END IF;

    -- Cooling off after too many misses. Checked before the comparison so a
    -- locked-out caller cannot even use the timing of it as an oracle.
    IF v_row.locked_out_until IS NOT NULL AND now() < v_row.locked_out_until THEN
        RETURN NULL;
    END IF;

    IF p_pin IS NULL OR length(trim(p_pin)) = 0 THEN
        RETURN NULL;
    END IF;

    IF crypt(trim(p_pin), v_row.pin_hash) = v_row.pin_hash THEN
        UPDATE public.site_lock
           SET failed_attempts = 0,
               locked_out_until = NULL
         WHERE id;
        RETURN v_row.unlock_token::TEXT;
    END IF;

    -- Miss. Ten in a row buys a fifteen-minute pause, and the counter resets so
    -- the next ten cost another pause rather than locking out permanently.
    UPDATE public.site_lock
       SET failed_attempts = CASE WHEN failed_attempts + 1 >= 10 THEN 0 ELSE failed_attempts + 1 END,
           locked_out_until = CASE WHEN failed_attempts + 1 >= 10 THEN now() + INTERVAL '15 minutes' ELSE locked_out_until END
     WHERE id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.verify_site_lock_pin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_site_lock_pin(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_site_lock_state() — what the admin panel shows
--
-- Differs from get_site_lock() in two ways that matter to the owner: it reports
-- the STORED `locked` flag (what they set) rather than the computed one (what
-- visitors currently get), and it reports whether a PIN exists. It still never
-- returns the PIN — see the note on set_site_lock below.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_site_lock_state()
RETURNS TABLE (
    locked BOOLEAN,
    effective_locked BOOLEAN,
    headline TEXT,
    message TEXT,
    launch_at TIMESTAMP WITH TIME ZONE,
    auto_unlock BOOLEAN,
    has_pin BOOLEAN,
    updated_at TIMESTAMP WITH TIME ZONE,
    server_now TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Not authorised.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        s.locked,
        s.locked
            AND NOT (
                s.auto_unlock
                AND s.launch_at IS NOT NULL
                AND now() >= s.launch_at
            ),
        s.headline,
        s.message,
        s.launch_at,
        s.auto_unlock,
        s.pin_hash IS NOT NULL,
        s.updated_at,
        now()
    FROM public.site_lock s
    WHERE s.id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_site_lock_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_site_lock_state() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4b. admin_site_lock_token() — the owner should never type their own PIN
--
-- The admin panel calls this after saving and drops the token straight into the
-- operator's bypass cookie, so locking the site does not lock the person who
-- locked it out of previewing it. Admin-only, and it hands back nothing an
-- admin could not obtain anyway by setting a PIN and entering it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_site_lock_token()
RETURNS TEXT AS $$
DECLARE
    v_token UUID;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Not authorised.' USING ERRCODE = '42501';
    END IF;

    SELECT s.unlock_token INTO v_token FROM public.site_lock s WHERE s.id;
    RETURN v_token::TEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_site_lock_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_site_lock_token() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. set_site_lock() — the single write path
--
-- Every argument is optional and NULL means "leave this alone", so the panel
-- can flip the switch without resending the copy, or retime the countdown
-- without touching the PIN.
--
-- The timer is given in HOURS and resolved against now() here. Letting the
-- browser send an absolute timestamp instead would anchor the countdown to
-- whatever the operator's laptop believes the time is.
--
-- On the PIN: it is stored as a bcrypt hash and there is deliberately no way to
-- read it back, here or anywhere else. The owner who forgets it sets a new one
-- — which is a five-second fix, and cheaper than keeping a recoverable
-- credential in the database.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_site_lock(
    p_locked BOOLEAN DEFAULT NULL,
    p_pin TEXT DEFAULT NULL,
    p_headline TEXT DEFAULT NULL,
    p_message TEXT DEFAULT NULL,
    p_launch_in_hours NUMERIC DEFAULT NULL,
    p_clear_launch BOOLEAN DEFAULT FALSE,
    p_auto_unlock BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    locked BOOLEAN,
    effective_locked BOOLEAN,
    headline TEXT,
    message TEXT,
    launch_at TIMESTAMP WITH TIME ZONE,
    auto_unlock BOOLEAN,
    has_pin BOOLEAN,
    updated_at TIMESTAMP WITH TIME ZONE,
    server_now TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_pin TEXT;
    v_will_have_pin BOOLEAN;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Not authorised.' USING ERRCODE = '42501';
    END IF;

    v_pin := NULLIF(trim(COALESCE(p_pin, '')), '');

    IF v_pin IS NOT NULL AND v_pin !~ '^[0-9]{4,12}$' THEN
        RAISE EXCEPTION 'The PIN must be 4 to 12 digits.' USING ERRCODE = '22023';
    END IF;

    -- Locking with no PIN anywhere would leave the holding page with no way
    -- past it for anyone who is not already signed in as an admin.
    SELECT (s.pin_hash IS NOT NULL) OR (v_pin IS NOT NULL)
      INTO v_will_have_pin
      FROM public.site_lock s WHERE s.id;

    IF COALESCE(p_locked, FALSE) AND NOT v_will_have_pin THEN
        RAISE EXCEPTION 'Set a PIN before locking the website.' USING ERRCODE = '22023';
    END IF;

    -- Fractions are allowed (0.5 = thirty minutes); zero and negatives are not,
    -- since a countdown that has already finished is just an unlocked site.
    IF p_launch_in_hours IS NOT NULL AND (p_launch_in_hours <= 0 OR p_launch_in_hours > 8760) THEN
        RAISE EXCEPTION 'The countdown must be between 0 and 8760 hours (one year).' USING ERRCODE = '22023';
    END IF;

    UPDATE public.site_lock s
       SET locked      = COALESCE(p_locked, s.locked),
           headline    = COALESCE(NULLIF(trim(COALESCE(p_headline, '')), ''), s.headline),
           message     = COALESCE(NULLIF(trim(COALESCE(p_message, '')), ''), s.message),
           auto_unlock = COALESCE(p_auto_unlock, s.auto_unlock),

           launch_at = CASE
               WHEN p_clear_launch THEN NULL
               WHEN p_launch_in_hours IS NOT NULL
                   THEN now() + make_interval(secs => (p_launch_in_hours * 3600)::DOUBLE PRECISION)
               -- A countdown left over from a previous lock has already expired,
               -- and with auto_unlock on it would cancel this one the instant it
               -- was set. Locking again with no new timer means "locked until I
               -- say otherwise", so the spent countdown is dropped.
               WHEN COALESCE(p_locked, s.locked)
                    AND s.launch_at IS NOT NULL
                    AND s.launch_at <= now()
                   THEN NULL
               ELSE s.launch_at
           END,

           pin_hash = CASE
               WHEN v_pin IS NOT NULL THEN crypt(v_pin, gen_salt('bf', 10))
               ELSE s.pin_hash
           END,

           -- A new PIN invalidates every bypass cookie already issued.
           unlock_token = CASE
               WHEN v_pin IS NOT NULL THEN gen_random_uuid()
               ELSE s.unlock_token
           END,

           -- Any deliberate change clears a brute-force cooling-off period, so
           -- the owner is never locked out of their own preview by someone
           -- else's failed guesses.
           failed_attempts  = 0,
           locked_out_until = NULL,

           updated_at = now(),
           updated_by = auth.uid()
     WHERE s.id;

    RETURN QUERY
    SELECT
        s.locked,
        s.locked
            AND NOT (
                s.auto_unlock
                AND s.launch_at IS NOT NULL
                AND now() >= s.launch_at
            ),
        s.headline,
        s.message,
        s.launch_at,
        s.auto_unlock,
        s.pin_hash IS NOT NULL,
        s.updated_at,
        now()
    FROM public.site_lock s
    WHERE s.id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.set_site_lock(BOOLEAN, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_site_lock(BOOLEAN, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, BOOLEAN) TO authenticated;
