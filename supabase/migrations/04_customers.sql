-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY, -- Maps directly to auth.users.id
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    note TEXT,
    total_spent DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    orders_count INT NOT NULL DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Helper function to check if requesting user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT is_admin FROM public.customers WHERE id = user_id), 
        FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name VARCHAR(255) := '';
    v_last_name VARCHAR(255) := '';
    v_phone VARCHAR(50) := '';
    v_is_admin BOOLEAN := FALSE;
BEGIN
    -- Guard against null email
    IF new.email IS NULL THEN
        RETURN new;
    END IF;

    -- Extract metadata if it exists
    IF new.raw_user_meta_data IS NOT NULL THEN
        v_first_name := COALESCE(new.raw_user_meta_data->>'first_name', '');
        v_last_name := COALESCE(new.raw_user_meta_data->>'last_name', '');
        v_phone := COALESCE(new.raw_user_meta_data->>'phone', '');
        
        -- Safely extract and check is_admin key if present
        IF new.raw_user_meta_data ? 'is_admin' THEN
            v_is_admin := COALESCE((new.raw_user_meta_data->>'is_admin')::boolean, FALSE);
        END IF;
    END IF;

    -- If creating the default admin account, always enforce admin flags
    IF new.email = 'admin@gharib.com' THEN
        v_is_admin := TRUE;
    END IF;

    -- Remove any conflicting mock customer records with the same email to avoid unique constraint errors
    DELETE FROM public.customers WHERE email = new.email;

    -- Insert new customer record linked to auth.users.id
    INSERT INTO public.customers (id, first_name, last_name, email, phone, note, total_spent, orders_count, is_admin)
    VALUES (
        new.id,
        v_first_name,
        v_last_name,
        new.email,
        v_phone,
        'Auto-registered Privé Member.',
        0.00,
        0,
        v_is_admin
    );

    -- Map existing seed orders matching this email to the new auth user id
    UPDATE public.orders SET customer_id = new.id WHERE email = new.email;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed some mock customers (Note: We use random UUIDs for mocks; in real apps, these link to auth.users)
INSERT INTO public.customers (id, first_name, last_name, email, phone, note, total_spent, orders_count, is_admin) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Admin', 'Gharib', 'admin@gharib.com', '+971 4 123 4567', 'Executive Head Administrator.', 0.00, 0, true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Alex', 'Mercer', 'alex.mercer@gmail.com', '+1 305 555 0199', 'Prefers rich spicy notes and ouds.', 331.00, 1, false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Sarah', 'Connor', 'sarah.connor@yahoo.com', '+1 212 555 0144', 'Regular floral scent buyer.', 217.00, 1, false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'James', 'Bond', 'james.bond@mi6.gov.uk', '+44 20 7946 0958', 'Prefers bespoke royal collections.', 370.00, 1, false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Layla', 'Hasan', 'layla.hasan@dubai.ae', '+971 50 987 6543', 'VIP member in Dubai region.', 529.00, 1, false)
ON CONFLICT (id) DO NOTHING;

-- Map preexisting orders to these mock customer IDs where email matches
UPDATE public.orders SET customer_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' WHERE email = 'alex.mercer@gmail.com';
UPDATE public.orders SET customer_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' WHERE email = 'sarah.connor@yahoo.com';
UPDATE public.orders SET customer_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44' WHERE email = 'james.bond@mi6.gov.uk';
UPDATE public.orders SET customer_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55' WHERE email = 'layla.hasan@dubai.ae';
