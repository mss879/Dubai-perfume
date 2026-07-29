-- Migration 28: Seed the French Avenue catalogue
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
    (1300, 'FRENCH AVENUE', 'Liquid Brun', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Liquid Brun is a warm sweet-amber eau de parfum from the French Avenue house. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'French Avenue Signature', 'Amber & Oriental', ARRAY['french-avenue', 'unisex', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1301, 'FRENCH AVENUE', 'Azure Oud', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Azure Oud is a bright oud eau de parfum from the French Avenue house. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'French Avenue Signature', 'Woody & Oud', ARRAY['french-avenue', 'unisex', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1302, 'FRENCH AVENUE', 'Cocoa Morado', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Cocoa Morado is a cocoa gourmand eau de parfum from the French Avenue house. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'French Avenue Signature', 'Floral & Sweet', ARRAY['french-avenue', 'unisex', 'floral', 'sweet'], FALSE, FALSE, FALSE),
    (1303, 'FRENCH AVENUE', 'Vulcan Feu', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Vulcan Feu is a fiery woody eau de parfum from the Vulcan line by French Avenue. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Vulcan Collection', 'Woody & Oud', ARRAY['french-avenue', 'vulcan', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1304, 'FRENCH AVENUE', 'Vulcan Beige', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Vulcan Beige is a soft amber eau de parfum from the Vulcan line by French Avenue. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Vulcan Collection', 'Amber & Oriental', ARRAY['french-avenue', 'vulcan', 'unisex', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1305, 'FRENCH AVENUE', 'Vulcan Sable', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Vulcan Sable is a sandy woody eau de parfum from the Vulcan line by French Avenue. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Vulcan Collection', 'Woody & Oud', ARRAY['french-avenue', 'vulcan', 'unisex', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1306, 'FRENCH AVENUE', 'Spectre Ghost', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Spectre Ghost is an airy woody eau de parfum from the Spectre line by French Avenue. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Spectre Collection', 'Woody & Oud', ARRAY['french-avenue', 'fa-spectre', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1307, 'FRENCH AVENUE', 'Spectre Wraith', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Spectre Wraith is a dark woody eau de parfum from the Spectre line by French Avenue. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Spectre Collection', 'Woody & Oud', ARRAY['french-avenue', 'fa-spectre', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1308, 'FRENCH AVENUE', 'Shmellow', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Shmellow is a marshmallow gourmand eau de parfum from the French Avenue house. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'French Avenue Signature', 'Floral & Sweet', ARRAY['french-avenue', 'unisex', 'floral', 'sweet'], FALSE, FALSE, FALSE),
    (1309, 'FRENCH AVENUE', 'Aether Extrait', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Aether Extrait is an ethereal amber eau de parfum from the French Avenue house. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'French Avenue Signature', 'Amber & Oriental', ARRAY['french-avenue', 'unisex', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1310, 'FRENCH AVENUE', 'Aromatix', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Aromatix is an aromatic fresh eau de parfum from the French Avenue house. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'French Avenue Signature', 'Fresh & Aquatic', ARRAY['french-avenue', 'unisex', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1311, 'FRENCH AVENUE', 'Veneno', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Veneno is an intense oriental eau de parfum from the French Avenue house. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'French Avenue Signature', 'Amber & Oriental', ARRAY['french-avenue', 'unisex', 'amber', 'oriental'], FALSE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Inventory — one stock row per product/size so the storefront can sell them
INSERT INTO public.inventory (product_id, size, stock_level, low_stock_threshold)
SELECT p.id, s, 25, 5
FROM public.products p, unnest(p.sizes) AS s
WHERE p.id BETWEEN 1300 AND 1311
ON CONFLICT (product_id, size) DO NOTHING;

-- 3. Map every product into the French Avenue brand collection
INSERT INTO public.product_collections (product_id, collection_id)
SELECT id, 'french-avenue' FROM public.products WHERE id BETWEEN 1300 AND 1311
ON CONFLICT DO NOTHING;

-- 4. Map products into their sub-line collections
INSERT INTO public.product_collections (product_id, collection_id)
SELECT p.id, l.collection_id
FROM public.products p
JOIN (VALUES
    ('fa-spectre', ARRAY[1306, 1307]),
    ('vulcan', ARRAY[1303, 1304, 1305])
) AS l(collection_id, product_ids) ON p.id = ANY(l.product_ids)
ON CONFLICT DO NOTHING;
