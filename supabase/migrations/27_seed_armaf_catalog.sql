-- Migration 27: Seed the Armaf catalogue
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
    (1200, 'ARMAF', 'Club de Nuit Intense Man', 199.00, ARRAY['150ml', '200ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Intense Man is a fruity-smoky signature eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 150ml and 200ml.', 'Club de Nuit Collection', 'Fresh & Aquatic', ARRAY['armaf', 'club-de-nuit', 'men', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1201, 'ARMAF', 'Club de Nuit Intense Women', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Intense Women is a fruity chypre eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Floral & Sweet', ARRAY['armaf', 'club-de-nuit', 'women', 'floral', 'sweet'], FALSE, FALSE, FALSE),
    (1202, 'ARMAF', 'Club de Nuit Woman', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Woman is an elegant floral eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Floral & Sweet', ARRAY['armaf', 'club-de-nuit', 'women', 'floral', 'sweet'], FALSE, FALSE, FALSE),
    (1203, 'ARMAF', 'Club de Nuit Untold', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Untold is a sweet floral-fruity eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Floral & Sweet', ARRAY['armaf', 'club-de-nuit', 'women', 'floral', 'sweet'], FALSE, FALSE, FALSE),
    (1204, 'ARMAF', 'Club de Nuit Iconic', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Iconic is a bright fresh-spicy eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Fresh & Aquatic', ARRAY['armaf', 'club-de-nuit', 'men', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1205, 'ARMAF', 'Club de Nuit Sillage', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Sillage is a long-trailing fresh eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Fresh & Aquatic', ARRAY['armaf', 'club-de-nuit', 'men', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1206, 'ARMAF', 'Club de Nuit Maleka', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Maleka is a regal floral-oriental eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Floral & Sweet', ARRAY['armaf', 'club-de-nuit', 'women', 'floral', 'sweet'], FALSE, FALSE, FALSE),
    (1207, 'ARMAF', 'Club de Nuit Urban Man', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Urban Man is an urban woody eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Woody & Oud', ARRAY['armaf', 'club-de-nuit', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1208, 'ARMAF', 'Club de Nuit Urban Man Elixir', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Urban Man Elixir is an intensified woody eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Woody & Oud', ARRAY['armaf', 'club-de-nuit', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1209, 'ARMAF', 'Club de Nuit Limited Edition', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Limited Edition is a collector fresh-fruity eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Fresh & Aquatic', ARRAY['armaf', 'club-de-nuit', 'men', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1210, 'ARMAF', 'Club de Nuit Oud', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Club de Nuit Oud is a smoky oud eau de parfum from the Club de Nuit line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Club de Nuit Collection', 'Woody & Oud', ARRAY['armaf', 'club-de-nuit', 'unisex', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1211, 'ARMAF', 'Precioux I', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Precioux I is a precious amber eau de parfum from the Precioux line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Precioux Collection', 'Amber & Oriental', ARRAY['armaf', 'precioux', 'unisex', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1212, 'ARMAF', 'Precioux IV', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Precioux IV is a layered oriental eau de parfum from the Precioux line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Precioux Collection', 'Amber & Oriental', ARRAY['armaf', 'precioux', 'unisex', 'amber', 'oriental'], FALSE, FALSE, FALSE),
    (1213, 'ARMAF', 'Odyssey Mandarine Sky', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Mandarine Sky is a bright mandarin eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Fresh & Aquatic', ARRAY['armaf', 'odyssey', 'unisex', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1214, 'ARMAF', 'Odyssey Homme', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Homme is an aromatic woody eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Woody & Oud', ARRAY['armaf', 'odyssey', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1215, 'ARMAF', 'Odyssey Homme White', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Homme White is a clean fresh-woody eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Fresh & Aquatic', ARRAY['armaf', 'odyssey', 'men', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1216, 'ARMAF', 'Odyssey Mega', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Mega is a bold woody-amber eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Woody & Oud', ARRAY['armaf', 'odyssey', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE),
    (1217, 'ARMAF', 'Odyssey Mandarine Sky Elixir', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Mandarine Sky Elixir is a concentrated citrus eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Fresh & Aquatic', ARRAY['armaf', 'odyssey', 'unisex', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1218, 'ARMAF', 'Odyssey Dubai Chocolate', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Dubai Chocolate is a chocolate gourmand eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Floral & Sweet', ARRAY['armaf', 'odyssey', 'unisex', 'floral', 'sweet'], FALSE, FALSE, FALSE),
    (1219, 'ARMAF', 'Odyssey Coffee Toffee', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Coffee Toffee is a coffee-toffee gourmand eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Floral & Sweet', ARRAY['armaf', 'odyssey', 'unisex', 'floral', 'sweet'], FALSE, FALSE, FALSE),
    (1220, 'ARMAF', 'Odyssey Go Mango', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Go Mango is a juicy mango eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Fresh & Aquatic', ARRAY['armaf', 'odyssey', 'unisex', 'fresh', 'aquatic'], FALSE, FALSE, FALSE),
    (1221, 'ARMAF', 'Odyssey Black Currant', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Black Currant is a blackcurrant fruity eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Floral & Sweet', ARRAY['armaf', 'odyssey', 'unisex', 'floral', 'sweet'], FALSE, FALSE, FALSE),
    (1222, 'ARMAF', 'Odyssey Spectre', 199.00, ARRAY['100ml'], '/placeholder-bottle.png', ARRAY['/placeholder-bottle.png']::TEXT[], 'Odyssey Spectre is a shadowy woody eau de parfum from the Odyssey line by Armaf. An extended-wear composition built for the Gulf climate, presented in 100ml.', 'Odyssey Collection', 'Woody & Oud', ARRAY['armaf', 'odyssey', 'men', 'wood', 'oud'], FALSE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Inventory — one stock row per product/size so the storefront can sell them
INSERT INTO public.inventory (product_id, size, stock_level, low_stock_threshold)
SELECT p.id, s, 25, 5
FROM public.products p, unnest(p.sizes) AS s
WHERE p.id BETWEEN 1200 AND 1222
ON CONFLICT (product_id, size) DO NOTHING;

-- 3. Map every product into the Armaf brand collection
INSERT INTO public.product_collections (product_id, collection_id)
SELECT id, 'armaf' FROM public.products WHERE id BETWEEN 1200 AND 1222
ON CONFLICT DO NOTHING;

-- 4. Map products into their sub-line collections
INSERT INTO public.product_collections (product_id, collection_id)
SELECT p.id, l.collection_id
FROM public.products p
JOIN (VALUES
    ('club-de-nuit', ARRAY[1200, 1201, 1202, 1203, 1204, 1205, 1206, 1207, 1208, 1209, 1210]),
    ('odyssey', ARRAY[1213, 1214, 1215, 1216, 1217, 1218, 1219, 1220, 1221, 1222]),
    ('precioux', ARRAY[1211, 1212])
) AS l(collection_id, product_ids) ON p.id = ANY(l.product_ids)
ON CONFLICT DO NOTHING;
