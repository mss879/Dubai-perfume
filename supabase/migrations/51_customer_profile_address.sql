-- ============================================================================
-- 51. Customer profile: saved delivery address, and a fixed email address
--
-- Follows 50. Adds what the account Settings page needs:
--
--   1. A saved delivery address on `customers`, so a returning shopper does not
--      retype it at every checkout. The column names deliberately match the
--      keys the checkout form already sends in `orders.shipping_address`
--      (street / city / country / postal_code) so the prefill is a straight
--      copy with no mapping layer to drift.
--
--   2. A guard pinning `email` and `is_admin` on self-service updates.
--      Migration 39 replaced the old FOR ALL self-service policy with an UPDATE
--      policy whose WITH CHECK blocks a shopper raising their own is_admin —
--      but RLS in Postgres is row-level, not column-level, so nothing stopped a
--      signed-in shopper PATCHing `customers.email` with the public anon key.
--      That does not change their login (auth.users.email is the credential),
--      it just desynchronises the admin customer registry from the real
--      account. The Settings page shows the address read-only for the same
--      reason; this makes it true at the database rather than in the markup.
--
-- NOTE ON SCOPE: the guard deliberately does NOT pin total_spent /
-- orders_count. place_order() is SECURITY DEFINER but auth.uid() inside it is
-- still the *shopper*, so pinning those columns would silently break the spend
-- rollup that migration 42 introduced.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Saved delivery address
-- ---------------------------------------------------------------------------

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS country VARCHAR(255);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(50);

-- ---------------------------------------------------------------------------
-- 2. Keep the login address, and the admin flag, out of the shopper's reach
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pin_customer_identity_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Migrations, and anything running without a request JWT, are unaffected.
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Admins manage other people's rows through the admin panel and must keep
    -- being able to correct an address or grant a colleague access.
    IF public.is_admin(auth.uid()) THEN
        RETURN NEW;
    END IF;

    -- Everyone else: these two columns are whatever they already were.
    NEW.email := OLD.email;
    NEW.is_admin := OLD.is_admin;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS pin_customer_identity ON public.customers;

CREATE TRIGGER pin_customer_identity
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.pin_customer_identity_columns();

-- ---------------------------------------------------------------------------
-- VERIFYING THIS MIGRATION
--
-- As a signed-in NON-admin shopper (anon key + their access token):
--
--   update customers set first_name = 'Layla', phone = '+971 50 000 0000'
--   where id = auth.uid();          -- succeeds, both columns change
--
--   update customers set email = 'someone.else@example.com'
--   where id = auth.uid();          -- "succeeds" but email is unchanged
--
-- The second statement reports success rather than erroring: the trigger
-- rewrites the row instead of rejecting it, so a shopper editing their profile
-- never sees a failure for a field the form does not offer them anyway.
-- Re-select the row to confirm the address is still the original.
-- ---------------------------------------------------------------------------
