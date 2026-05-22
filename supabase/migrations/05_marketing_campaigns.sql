-- Create marketing_campaigns table
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(100) NOT NULL, -- Google, Meta, Email, Tiktok
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, active, paused, completed
    budget DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    attributed_sales DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    impressions INT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Seed Marketing Campaigns (Mocks)
INSERT INTO public.marketing_campaigns (name, channel, status, budget, attributed_sales, impressions, clicks) VALUES
('EID Luxury Collection Launch', 'Instagram/Meta', 'active', 5000.00, 18450.00, 245000, 8900),
('Gold Memoir Search Ads', 'Google Ads', 'active', 2500.00, 7120.00, 85000, 4200),
('Privé Member Newsletter #12', 'Klaviyo Email', 'completed', 300.00, 4890.00, 12000, 1500),
('Summer Scent TikTok Influencers', 'TikTok', 'paused', 4000.00, 3100.00, 420000, 16800),
('Exclusive Oud Autumn Teaser', 'Pinterest', 'draft', 1500.00, 0.00, 0, 0)
ON CONFLICT (id) DO NOTHING;
