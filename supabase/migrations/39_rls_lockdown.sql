-- Migration 39: Lock down anonymous access to money- and PII-bearing tables
-- ════════════════════════════════════════════════════════════════════════════════
-- Replaces the sandbox-era policies from migrations 10, 12 and 13:
--   • abandoned_carts was world-readable and world-writable (checkout PII:
--     emails, phones, full shipping addresses).
--   • orders / order_items / order_tracking accepted anonymous INSERTs, so
--     anyone with the public anon key could forge orders at arbitrary prices.
--   • order_tracking was world-readable.
--   • product_collections accepted anonymous INSERT and DELETE (merchandising
--     was publicly mutable).
--   • customers "Users read/write own profile" was FOR ALL, letting any signed-in
--     user UPDATE their own row INCLUDING is_admin = TRUE (privilege escalation).
--
-- After this migration, checkout and abandoned-cart capture go exclusively
-- through the SECURITY DEFINER functions introduced in migration 40
-- (place_order, capture_abandoned_cart, track_guest_order), which the app
-- calls from server route handlers. DEPLOY NOTE: apply 38–40 together with the
-- app release that introduces /api/checkout — the old client-side inserts stop
-- working the moment these policies drop.

-- 1. abandoned_carts: no anonymous access at all (admin policy from 12 remains)
DROP POLICY IF EXISTS "Allow public insert on abandoned_carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Allow public update on abandoned_carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Allow public select on abandoned_carts" ON public.abandoned_carts;

-- 2. orders / order_items: drop anonymous INSERT (owner-scoped SELECT from 10
--    and admin FOR ALL policies remain; inserts happen inside place_order())
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on order_items" ON public.order_items;

-- 3. order_tracking: drop anonymous INSERT and world-readable SELECT;
--    scope SELECT to the order's owner (guests use track_guest_order())
DROP POLICY IF EXISTS "Allow public insert on order_tracking" ON public.order_tracking;
DROP POLICY IF EXISTS "Allow public select on order tracking" ON public.order_tracking;

CREATE POLICY "Owners view own order tracking"
    ON public.order_tracking FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE public.orders.id = public.order_tracking.order_id
              AND (public.orders.customer_id = auth.uid() OR public.orders.email = auth.email())
        )
    );

-- 4. product_collections: merchandising writes are admin-only
--    (public SELECT from 01 and the admin FOR ALL policy from 10 remain)
DROP POLICY IF EXISTS "Allow public insert on product_collections" ON public.product_collections;
DROP POLICY IF EXISTS "Allow public delete on product_collections" ON public.product_collections;

-- 5. customers: replace the FOR ALL self-service policy with column-safe ones.
--    WITH CHECK (is_admin = FALSE) blocks a non-admin from flipping their own
--    flag; real admins are covered by "Admin full access on customers" (10).
DROP POLICY IF EXISTS "Users read/write own profile" ON public.customers;

CREATE POLICY "Users view own profile"
    ON public.customers FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
    ON public.customers FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND is_admin = FALSE);
