-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(100) PRIMARY KEY,
    customer_id UUID, -- References auth.users or profiles (we will map it later)
    email VARCHAR(255) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, shipped, delivered, cancelled
    shipping_address JSONB NOT NULL, -- name, street, city, country, postal_code
    tracking_number VARCHAR(100),
    tracking_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES public.products(id) ON DELETE RESTRICT,
    size VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL
);

-- Create gift_cards table
CREATE TABLE IF NOT EXISTS public.gift_cards (
    code VARCHAR(100) PRIMARY KEY,
    balance DECIMAL(10, 2) NOT NULL,
    initial_value DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Seed Gift Cards (Mocks)
INSERT INTO public.gift_cards (code, balance, initial_value, is_active, expires_at) VALUES
('GHARIB-GOLD-888', 500.00, 500.00, true, '2027-12-31T23:59:59Z'),
('EID-CELEB-2026', 150.00, 200.00, true, '2026-09-30T23:59:59Z'),
('VIP-EXCL-999', 0.00, 1000.00, false, '2026-03-31T23:59:59Z')
ON CONFLICT (code) DO NOTHING;

-- Seed Orders (Mocks)
INSERT INTO public.orders (id, customer_id, email, total_price, status, shipping_address, tracking_number) VALUES
('ORD-9921', NULL, 'alex.mercer@gmail.com', 331.00, 'delivered', '{"name": "Alex Mercer", "street": "Sheikh Zayed Rd, Apt 1402", "city": "Dubai", "country": "UAE", "postal_code": "00000"}'::jsonb, 'DXB-EXP-11002'),
('ORD-9922', NULL, 'sarah.connor@yahoo.com', 217.00, 'shipped', '{"name": "Sarah Connor", "street": "100 Ocean Drive", "city": "Miami", "country": "USA", "postal_code": "33139"}'::jsonb, 'DHL-9844102'),
('ORD-9923', NULL, 'james.bond@mi6.gov.uk', 370.00, 'processing', '{"name": "James Bond", "street": "85 Albert Embankment", "city": "London", "country": "UK", "postal_code": "SE1 7TP"}'::jsonb, NULL),
('ORD-9924', NULL, 'layla.hasan@dubai.ae', 529.00, 'pending', '{"name": "Layla Hasan", "street": "Jumeirah Beach Road, Villa 45", "city": "Dubai", "country": "UAE", "postal_code": "00000"}'::jsonb, NULL)
ON CONFLICT (id) DO NOTHING;

-- Seed Order Items (Mocks)
INSERT INTO public.order_items (order_id, product_id, size, quantity, unit_price) VALUES
('ORD-9921', 1, '90ml', 1, 331.00),
('ORD-9922', 2, '30ml', 1, 98.00),
( 'ORD-9922', 102, '50ml', 1, 119.00),
('ORD-9923', 4, '75ml', 1, 370.00),
('ORD-9924', 103, '100ml', 2, 169.00),
('ORD-9924', 101, '50ml', 1, 203.00)
ON CONFLICT DO NOTHING;
