-- Migration 17: Enrich Orders and Abandoned Carts with Geolocation Currency Columns
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Alter public.orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'AED';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 5) DEFAULT 1.00000;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS converted_total VARCHAR(100);

-- 2. Alter public.abandoned_carts table
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'AED';
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 5) DEFAULT 1.00000;
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS converted_total VARCHAR(100);
