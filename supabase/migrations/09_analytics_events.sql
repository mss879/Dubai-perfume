-- Create analytics_events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL, -- view, cart_add, checkout, purchase
    value DECIMAL(10, 2) DEFAULT 0.00,
    metadata JSONB, -- product_id, size, traffic_source, referrer
    session_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Seed Analytics Events for past 30 days (Mocks for Dashboard graph calculation)
INSERT INTO public.analytics_events (event_type, value, metadata, session_id, created_at) VALUES
('view', 0.00, '{"product_id": 101, "source": "Google"}'::jsonb, 'sess-1002', CURRENT_DATE - INTERVAL '1 day'),
('cart_add', 0.00, '{"product_id": 101, "size": "100ml"}'::jsonb, 'sess-1002', CURRENT_DATE - INTERVAL '1 day'),
('checkout', 203.00, '{"product_id": 101, "items_count": 1}'::jsonb, 'sess-1002', CURRENT_DATE - INTERVAL '1 day'),
('purchase', 203.00, '{"product_id": 101, "order_id": "ORD-9924"}'::jsonb, 'sess-1002', CURRENT_DATE - INTERVAL '1 day'),

('view', 0.00, '{"product_id": 103, "source": "Direct"}'::jsonb, 'sess-1003', CURRENT_DATE - INTERVAL '2 days'),
('view', 0.00, '{"product_id": 102, "source": "Instagram"}'::jsonb, 'sess-1004', CURRENT_DATE - INTERVAL '3 days'),
('purchase', 119.00, '{"product_id": 102, "order_id": "ORD-9922"}'::jsonb, 'sess-1004', CURRENT_DATE - INTERVAL '3 days'),

('view', 0.00, '{"product_id": 4, "source": "Google Search"}'::jsonb, 'sess-1005', CURRENT_DATE - INTERVAL '5 days'),
('purchase', 370.00, '{"product_id": 4, "order_id": "ORD-9923"}'::jsonb, 'sess-1005', CURRENT_DATE - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;
