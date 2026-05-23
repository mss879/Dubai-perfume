-- Migration: Convert baseline database values to UAE Dirhams (AED)
-- Baseline currency: UAE Dirham (AED) - د.إ

-- 1. Update Base Product Pricing in Products table
UPDATE public.products SET price = 745.00 WHERE id = 101; -- Gold Memoir
UPDATE public.products SET price = 437.00 WHERE id = 102; -- Enchanted Blooms
UPDATE public.products SET price = 620.00 WHERE id = 103; -- Mystic Oud
UPDATE public.products SET price = 532.00 WHERE id = 104; -- Ocean Breeze
UPDATE public.products SET price = 1215.00 WHERE id = 1;  -- Oud for greatness
UPDATE public.products SET price = 360.00 WHERE id = 2;   -- Juliette
UPDATE public.products SET price = 440.00 WHERE id = 3;   -- Phantom
UPDATE public.products SET price = 1358.00 WHERE id = 4;  -- Devil's intrigue
UPDATE public.products SET price = 1196.00 WHERE id = 5;  -- Lost Cherry
UPDATE public.products SET price = 158.00 WHERE id = 6;   -- Toy Boy
UPDATE public.products SET price = 1196.00 WHERE id = 7;  -- Epicentro
UPDATE public.products SET price = 862.00 WHERE id = 8;   -- Eio non ho mani...
UPDATE public.products SET price = 1170.00 WHERE id = 9;  -- Ganymede Extrait

-- 2. Update Seed Order Totals in Orders table
UPDATE public.orders SET total_price = 1215.00 WHERE id = 'ORD-9921';
UPDATE public.orders SET total_price = 796.00 WHERE id = 'ORD-9922';
UPDATE public.orders SET total_price = 1358.00 WHERE id = 'ORD-9923';
UPDATE public.orders SET total_price = 1941.00 WHERE id = 'ORD-9924';

-- 3. Update Seed Order Items Unit Prices in Order Items table
UPDATE public.order_items SET unit_price = 1215.00 WHERE order_id = 'ORD-9921' AND product_id = 1;
UPDATE public.order_items SET unit_price = 360.00 WHERE order_id = 'ORD-9922' AND product_id = 2;
UPDATE public.order_items SET unit_price = 437.00 WHERE order_id = 'ORD-9922' AND product_id = 102;
UPDATE public.order_items SET unit_price = 1358.00 WHERE order_id = 'ORD-9923' AND product_id = 4;
UPDATE public.order_items SET unit_price = 620.00 WHERE order_id = 'ORD-9924' AND product_id = 103;
UPDATE public.order_items SET unit_price = 745.00 WHERE order_id = 'ORD-9924' AND product_id = 101;
