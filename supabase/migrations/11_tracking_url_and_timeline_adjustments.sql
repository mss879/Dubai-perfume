-- Migration 11: Add Carrier Tracking URL and Update Seed Order Statuses
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Add optional tracking_url column to the orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- 2. Update existing seed orders tracking logs to match the new 5 timeline stages
DELETE FROM public.order_tracking WHERE order_id IN ('ORD-9922', 'ORD-9923');

-- Re-insert aligned Shopify-style seed logs for ORD-9922
INSERT INTO public.order_tracking (order_id, status, location, description) VALUES
('ORD-9922', 'Order Placed', 'Dubai Headquarters', 'We have received your exclusive order selection.'),
('ORD-9922', 'Accepted', 'Dubai Headquarters', 'Order has been reviewed and accepted by the administrative team.'),
('ORD-9922', 'Fulfilled', 'Dubai Distribution Port', 'Your fragrance package has been carefully blended, packaged, and fulfilled by our scent curators.'),
('ORD-9922', 'Out for Delivery', 'Local Carrier Hub', 'Your shipment is out for delivery with our express carrier.')
ON CONFLICT (id) DO NOTHING;

-- Re-insert aligned Shopify-style seed logs for ORD-9923
INSERT INTO public.order_tracking (order_id, status, location, description) VALUES
('ORD-9923', 'Order Placed', 'Dubai Headquarters', 'We have received your exclusive order selection.'),
('ORD-9923', 'Accepted', 'Dubai Headquarters', 'Order has been reviewed and accepted by the administrative team.'),
('ORD-9923', 'Fulfilled', 'Dubai Distribution Port', 'Your fragrance package has been carefully blended, packaged, and fulfilled by our scent curators.')
ON CONFLICT (id) DO NOTHING;
