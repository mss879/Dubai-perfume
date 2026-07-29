-- Migration 30: Seed the Al Haramain catalogue
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Products seed at the placeholder price of AED 199.00 with the shared placeholder bottle
-- image (/placeholder-bottle.png); real prices and photography are set from the admin panel.
--
-- Re-running this file is safe: every statement is ON CONFLICT DO NOTHING, so uploaded
-- images, edited prices and adjusted stock levels are never overwritten.

-- 1. Products
INSERT INTO public.products
    (id, brand, name, price, sizes, image_url, image_urls, description, tagline,
     olfactory_group, tags, is_new, is_bestseller, is_featured_large)
VALUES
    (1500, 'AL HARAMAIN', 'Amber Oud Gold Edition', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Amber Oud Gold Edition is a golden amber-oud eau de parfum from the Amber Oud line by Al Haramain. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Amber Oud Collection', 'Amber & Oriental', ARRAY['al-haramain', 'amber-oud', 'unisex', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1501, 'AL HARAMAIN', 'Amber Oud Aqua Dubai', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Amber Oud Aqua Dubai is an aquatic amber eau de parfum from the Amber Oud line by Al Haramain. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Amber Oud Collection', 'Fresh & Aquatic', ARRAY['al-haramain', 'amber-oud', 'unisex', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1502, 'AL HARAMAIN', 'Amber Oud Dubai Night', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Amber Oud Dubai Night is a nocturnal amber eau de parfum from the Amber Oud line by Al Haramain. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Amber Oud Collection', 'Amber & Oriental', ARRAY['al-haramain', 'amber-oud', 'unisex', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1503, 'AL HARAMAIN', 'Amber Oud Ruby Edition', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Amber Oud Ruby Edition is a ruby-red amber eau de parfum from the Amber Oud line by Al Haramain. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Amber Oud Collection', 'Amber & Oriental', ARRAY['al-haramain', 'amber-oud', 'unisex', 'amber', 'oriental'], FALSE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Inventory — one stock row per product/size so the storefront can sell them
INSERT INTO public.inventory (product_id, size, stock_level, low_stock_threshold)
SELECT p.id, s, 25, 5
FROM public.products p, unnest(p.sizes) AS s
WHERE p.id BETWEEN 1500 AND 1503
ON CONFLICT (product_id, size) DO NOTHING;

-- 3. Map every product into the Al Haramain brand collection
INSERT INTO public.product_collections (product_id, collection_id)
SELECT id, 'al-haramain' FROM public.products WHERE id BETWEEN 1500 AND 1503
ON CONFLICT DO NOTHING;

-- 4. Map products into their sub-line collections
INSERT INTO public.product_collections (product_id, collection_id)
SELECT p.id, l.collection_id
FROM public.products p
JOIN (VALUES
    ('amber-oud', ARRAY[1500, 1501, 1502, 1503])
) AS l(collection_id, product_ids) ON p.id = ANY(l.product_ids)
ON CONFLICT DO NOTHING;
