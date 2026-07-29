-- Migration 29: Seed the Afnan catalogue
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
    (1400, 'AFNAN', '9PM', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], '9PM is a sweet amber-vanilla eau de parfum from the 9PM line by Afnan. An extended-wear composition built for the Gulf climate, presented in 100ml.', '9PM Collection', 'Amber & Oriental', ARRAY['afnan', '9pm', 'men', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1401, 'AFNAN', '9PM Rebel', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], '9PM Rebel is a rebellious spiced-amber eau de parfum from the 9PM line by Afnan. An extended-wear composition built for the Gulf climate, presented in 100ml.', '9PM Collection', 'Amber & Oriental', ARRAY['afnan', '9pm', 'men', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1402, 'AFNAN', '9PM Elixir', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], '9PM Elixir is a concentrated amber eau de parfum from the 9PM line by Afnan. An extended-wear composition built for the Gulf climate, presented in 100ml.', '9PM Collection', 'Amber & Oriental', ARRAY['afnan', '9pm', 'men', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1403, 'AFNAN', '9PM Night Out', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], '9PM Night Out is an after-dark amber eau de parfum from the 9PM line by Afnan. An extended-wear composition built for the Gulf climate, presented in 100ml.', '9PM Collection', 'Amber & Oriental', ARRAY['afnan', '9pm', 'men', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1404, 'AFNAN', '9AM Dive', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], '9AM Dive is a fresh aquatic eau de parfum from the Afnan house. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Afnan Signature', 'Fresh & Aquatic', ARRAY['afnan', 'men', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1405, 'AFNAN', 'Supremacy Collector''s Edition', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Supremacy Collector''s Edition is a collector woody eau de parfum from the Supremacy line by Afnan. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Supremacy Collection', 'Woody & Oud', ARRAY['afnan', 'supremacy', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1406, 'AFNAN', 'Supremacy Not Only Intense', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Supremacy Not Only Intense is an intense woody-fruity eau de parfum from the Supremacy line by Afnan. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Supremacy Collection', 'Woody & Oud', ARRAY['afnan', 'supremacy', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1407, 'AFNAN', 'Supremacy Silver', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Supremacy Silver is a silvery fresh eau de parfum from the Supremacy line by Afnan. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Supremacy Collection', 'Fresh & Aquatic', ARRAY['afnan', 'supremacy', 'men', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1408, 'AFNAN', 'Supremacy Oud', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Supremacy Oud is a rich oud eau de parfum from the Supremacy line by Afnan. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Supremacy Collection', 'Woody & Oud', ARRAY['afnan', 'supremacy', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Inventory — one stock row per product/size so the storefront can sell them
INSERT INTO public.inventory (product_id, size, stock_level, low_stock_threshold)
SELECT p.id, s, 25, 5
FROM public.products p, unnest(p.sizes) AS s
WHERE p.id BETWEEN 1400 AND 1408
ON CONFLICT (product_id, size) DO NOTHING;

-- 3. Map every product into the Afnan brand collection
INSERT INTO public.product_collections (product_id, collection_id)
SELECT id, 'afnan' FROM public.products WHERE id BETWEEN 1400 AND 1408
ON CONFLICT DO NOTHING;

-- 4. Map products into their sub-line collections
INSERT INTO public.product_collections (product_id, collection_id)
SELECT p.id, l.collection_id
FROM public.products p
JOIN (VALUES
    ('9pm', ARRAY[1400, 1401, 1402, 1403]),
    ('supremacy', ARRAY[1405, 1406, 1407, 1408])
) AS l(collection_id, product_ids) ON p.id = ANY(l.product_ids)
ON CONFLICT DO NOTHING;
