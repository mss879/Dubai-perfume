-- Add cost_price to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) DEFAULT 0.00;

-- Add packing_charges to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS packing_charges DECIMAL(10, 2) DEFAULT 0.00;
