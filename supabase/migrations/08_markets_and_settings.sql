-- Create markets table
CREATE TABLE IF NOT EXISTS public.markets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    currency_symbol VARCHAR(10) NOT NULL,
    price_adjustment_coefficient DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    is_active BOOLEAN DEFAULT TRUE,
    regions TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

-- Seed Markets (Mocks)
INSERT INTO public.markets (name, currency_code, currency_symbol, price_adjustment_coefficient, is_active, regions) VALUES
('Domestic Gulf Market (HQ)', 'AED', 'د.إ', 3.67, true, ARRAY['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Bahrain', 'Kuwait']),
('United States Market', 'USD', '$', 1.00, true, ARRAY['United States', 'Canada']),
('European Union Market', 'EUR', '€', 0.92, true, ARRAY['Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium']),
('United Kingdom Market', 'GBP', '£', 0.79, true, ARRAY['United Kingdom', 'Ireland'])
ON CONFLICT (name) DO NOTHING;
