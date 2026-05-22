-- Create discounts table
CREATE TABLE IF NOT EXISTS public.discounts (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE, -- If NULL, it is an automatic discount
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'percentage', -- percentage, fixed_amount
    value DECIMAL(10, 2) NOT NULL,
    min_requirement DECIMAL(10, 2) DEFAULT 0.00,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP WITH TIME ZONE,
    usage_limit INT,
    usage_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- Seed Discounts (Mocks)
INSERT INTO public.discounts (code, title, type, value, min_requirement, usage_limit, usage_count, is_active) VALUES
('GOLDMEMOIR15', 'Gold Memoir Promo', 'percentage', 15.00, 0.00, 500, 142, true),
('EID2026', 'Eid Mubarak Scent Gift', 'fixed_amount', 50.00, 300.00, 1000, 389, true),
('WELCOMETOTHECLUB', 'New Member Welcome Discount', 'percentage', 10.00, 0.00, NULL, 658, true),
('VALENTINE2026', 'Valentine''s Duo Scent', 'percentage', 20.00, 150.00, 200, 200, false)
ON CONFLICT (code) DO NOTHING;
