-- Migration 12: Add Abandoned Carts Table and RLS checkout insertion permissions
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Create the abandoned_carts table
CREATE TABLE IF NOT EXISTS public.abandoned_carts (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    shipping_address JSONB, -- street, city, country, postal_code
    cart_items JSONB, -- array of items in the cart (brand, name, size, quantity, unit_price)
    total_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    converted BOOLEAN NOT NULL DEFAULT FALSE,
    converted_order_id VARCHAR(100) REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on abandoned_carts
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS Policies for abandoned_carts table
CREATE POLICY "Allow public insert on abandoned_carts" 
    ON public.abandoned_carts FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow public update on abandoned_carts" 
    ON public.abandoned_carts FOR UPDATE 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public select on abandoned_carts" 
    ON public.abandoned_carts FOR SELECT 
    USING (true);

CREATE POLICY "Admin full access on abandoned_carts" 
    ON public.abandoned_carts FOR ALL 
    TO authenticated 
    USING (public.is_admin(auth.uid()));

-- 3. Create missing INSERT policies for public.orders, public.order_items, and public.order_tracking
-- This allows guest/customer checkouts to write directly to these tables without authentication roadblocks
CREATE POLICY "Allow public insert on orders" 
    ON public.orders FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow public insert on order_items" 
    ON public.order_items FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow public insert on order_tracking" 
    ON public.order_tracking FOR INSERT 
    WITH CHECK (true);

-- Seed an example abandoned cart for demonstration and visual testing
INSERT INTO public.abandoned_carts (id, email, first_name, last_name, phone, shipping_address, cart_items, total_price, converted, converted_order_id, created_at, updated_at)
VALUES (
    'e0aebc99-9c0b-4ef8-bb6d-6bb9bd380a99',
    'guest.perfumer@hotmail.com',
    'Julian',
    'Vance',
    '+971 52 333 4444',
    '{"street": "Marina Heights, Apt 22", "city": "Dubai", "country": "United Arab Emirates", "postal_code": "00000"}'::jsonb,
    '[{"brand": "GHARIB PRIVÉ", "name": "Gold Memoir", "size": "100ml", "quantity": 1, "unit_price": 203.00}, {"brand": "INITIO PARFUMS PRIVES", "name": "Oud for greatness", "size": "90ml", "quantity": 1, "unit_price": 331.00}]'::jsonb,
    534.00,
    false,
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 hours'
)
ON CONFLICT (id) DO NOTHING;
