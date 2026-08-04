-- Migration 38: Close admin-privilege escalation paths in signup handling
-- ════════════════════════════════════════════════════════════════════════════════
-- Fixes three vulnerabilities in the original 04_customers.sql definitions:
--   1. handle_new_user() copied client-supplied raw_user_meta_data->>'is_admin'
--      into customers.is_admin, so a self-service signup could mint a real admin.
--   2. handle_new_user() special-cased email 'admin@gharib.com' to force admin,
--      and DELETEd any existing customers row with the same email first — signing
--      up with that address hijacked the seeded admin account.
--   3. is_admin() ran SECURITY DEFINER without a pinned search_path.
--
-- OPERATIONS NOTE (run once, manually, as the database owner / via the Supabase
-- SQL editor — NOT part of this migration): promote the real store-owner account
-- after they have signed up normally:
--   UPDATE public.customers SET is_admin = TRUE WHERE email = '<owner-email>';

-- 1. Pin search_path on the admin check
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT is_admin FROM public.customers WHERE id = user_id),
        FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Rebuild the signup trigger: never trust client metadata for privileges,
--    never delete existing rows, no hardcoded admin email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name VARCHAR(255) := '';
    v_last_name VARCHAR(255) := '';
    v_phone VARCHAR(50) := '';
BEGIN
    IF new.email IS NULL THEN
        RETURN new;
    END IF;

    IF new.raw_user_meta_data IS NOT NULL THEN
        v_first_name := COALESCE(new.raw_user_meta_data->>'first_name', '');
        v_last_name  := COALESCE(new.raw_user_meta_data->>'last_name', '');
        v_phone      := COALESCE(new.raw_user_meta_data->>'phone', '');
    END IF;

    -- New signups are never admins; promotion happens only via direct SQL
    -- by the database owner (see operations note above).
    INSERT INTO public.customers (id, first_name, last_name, email, phone, note, total_spent, orders_count, is_admin)
    VALUES (new.id, v_first_name, v_last_name, new.email, v_phone, 'Auto-registered Privé Member.', 0.00, 0, FALSE)
    ON CONFLICT (email) DO NOTHING;

    -- Link historical guest orders for this email to the new account. The orders
    -- SELECT policy already grants access by email = auth.email(), so this adds
    -- no visibility that the email-based policy does not already grant.
    UPDATE public.orders SET customer_id = new.id WHERE email = new.email AND customer_id IS NULL;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
