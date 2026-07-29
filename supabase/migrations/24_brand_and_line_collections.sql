-- Migration 24: Brand & line collections (dedicated collection pages)
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Adds the metadata the storefront needs to render one page per brand:
--   kind        'brand' | 'line' | 'curated'  — brands get their own /collection/<id> page
--   parent_id   line collections point at their brand collection
--   sort_order  display order in the navigation
--   brand       links a brand collection to public.products.brand

ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'curated';
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS parent_id VARCHAR(100) REFERENCES public.collections(id) ON DELETE SET NULL;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS brand VARCHAR(255);

-- Existing hand-curated collections keep behaving exactly as before
UPDATE public.collections SET kind = 'curated' WHERE kind IS NULL;

CREATE INDEX IF NOT EXISTS idx_collections_kind ON public.collections (kind, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products (brand);
CREATE INDEX IF NOT EXISTS idx_product_collections_collection ON public.product_collections (collection_id);

-- 1. Brand collections — one page each
INSERT INTO public.collections (id, title, description, cover_image, type, kind, brand, sort_order) VALUES
    ('rasasi', 'Rasasi', 'The full Rasasi house — the Hawas signature line, Blue, Dareej and La Yuqawam.', '/campaign-gold.png', 'manual', 'brand', 'RASASI', 10),
    ('lattafa', 'Lattafa', 'Lattafa in full: Khamrah, Yara, Asad, Bade''e Al Oud, Fakhar, Hayaati and more.', '/campaign-purple.png', 'manual', 'brand', 'LATTAFA', 20),
    ('armaf', 'Armaf', 'Armaf''s Club de Nuit, Odyssey and Precioux lines in one place.', '/campaign-silver.png', 'manual', 'brand', 'ARMAF', 30),
    ('french-avenue', 'French Avenue', 'French Avenue — Liquid Brun, Azure Oud, Vulcan, Spectre and the extrait range.', '/campaign-red-black.png', 'manual', 'brand', 'FRENCH AVENUE', 40),
    ('afnan', 'Afnan', 'Afnan''s 9PM and Supremacy families.', '/campaign-blue.png', 'manual', 'brand', 'AFNAN', 50),
    ('al-haramain', 'Al Haramain', 'Al Haramain''s Amber Oud editions.', '/campaign-gold.png', 'manual', 'brand', 'AL HARAMAIN', 60)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    kind = EXCLUDED.kind,
    brand = EXCLUDED.brand,
    sort_order = EXCLUDED.sort_order;

-- 2. Line collections — nested inside their brand page
INSERT INTO public.collections (id, title, description, cover_image, type, kind, parent_id, sort_order) VALUES
    ('hawas', 'Hawas', 'The Rasasi Hawas signature line in every expression.', NULL, 'manual', 'line', 'rasasi', 11),
    ('rasasi-blue', 'Rasasi Blue', 'The Blue duo for him and for her.', NULL, 'manual', 'line', 'rasasi', 12),
    ('dareej', 'Dareej', 'The Rasasi Dareej family.', NULL, 'manual', 'line', 'rasasi', 13),
    ('khamrah', 'Khamrah', 'Khamrah and its Qahwa and Dukhan flankers.', NULL, 'manual', 'line', 'lattafa', 24),
    ('yara', 'Yara', 'The Yara family of creamy floral gourmands.', NULL, 'manual', 'line', 'lattafa', 25),
    ('asad', 'Asad', 'Asad and its Bourbon and Zanzibar flankers.', NULL, 'manual', 'line', 'lattafa', 26),
    ('badee-al-oud', 'Bade''e Al Oud', 'The full Bade''e Al Oud colour range.', NULL, 'manual', 'line', 'lattafa', 27),
    ('fakhar', 'Fakhar', 'Fakhar Lattafa for men, women and the gold editions.', NULL, 'manual', 'line', 'lattafa', 28),
    ('ameerat-al-arab', 'Ameerat Al Arab', 'The Ameerat Al Arab editions.', NULL, 'manual', 'line', 'lattafa', 29),
    ('ana-abiyedh', 'Ana Abiyedh', 'The Ana Abiyedh musk range.', NULL, 'manual', 'line', 'lattafa', 30),
    ('mayar', 'Mayar', 'The Mayar range.', NULL, 'manual', 'line', 'lattafa', 31),
    ('eclaire', 'Eclaire', 'Eclaire and its dessert-led flankers.', NULL, 'manual', 'line', 'lattafa', 32),
    ('noble', 'Noble', 'Noble Ameer and Noble Wazeer.', NULL, 'manual', 'line', 'lattafa', 33),
    ('mahir', 'Mahir', 'The Mahir range.', NULL, 'manual', 'line', 'lattafa', 34),
    ('confession', 'Confession', 'His Confession and Her Confession.', NULL, 'manual', 'line', 'lattafa', 35),
    ('teriaq', 'Teriaq', 'Teriaq and Teriaq Intense.', NULL, 'manual', 'line', 'lattafa', 36),
    ('musammam', 'Musammam', 'Musammam White and Black Intense.', NULL, 'manual', 'line', 'lattafa', 37),
    ('hayaati', 'Hayaati', 'The Hayaati family.', NULL, 'manual', 'line', 'lattafa', 38),
    ('rave-now', 'Rave Now', 'Rave Now for him and for her.', NULL, 'manual', 'line', 'lattafa', 39),
    ('club-de-nuit', 'Club de Nuit', 'Armaf''s flagship Club de Nuit line.', NULL, 'manual', 'line', 'armaf', 50),
    ('precioux', 'Precioux', 'The Precioux series.', NULL, 'manual', 'line', 'armaf', 51),
    ('odyssey', 'Odyssey', 'The Armaf Odyssey series.', NULL, 'manual', 'line', 'armaf', 52),
    ('vulcan', 'Vulcan', 'The Vulcan trio.', NULL, 'manual', 'line', 'french-avenue', 63),
    ('fa-spectre', 'Spectre', 'Spectre Ghost and Spectre Wraith.', NULL, 'manual', 'line', 'french-avenue', 64),
    ('9pm', '9PM', 'The Afnan 9PM family.', NULL, 'manual', 'line', 'afnan', 75),
    ('supremacy', 'Supremacy', 'The Afnan Supremacy family.', NULL, 'manual', 'line', 'afnan', 76),
    ('amber-oud', 'Amber Oud', 'Al Haramain''s Amber Oud editions.', NULL, 'manual', 'line', 'al-haramain', 87)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    kind = EXCLUDED.kind,
    parent_id = EXCLUDED.parent_id;

-- 3. The existing house collections are curated, not brands
UPDATE public.collections SET kind = 'curated'
WHERE id IN ('new', 'bestsellers', 'favorites', 'trending', 'smart-ouds');

-- 4. Back-fill a brand collection for the products that were already in the store
INSERT INTO public.collections (id, title, description, cover_image, type, kind, brand, sort_order) VALUES
    ('gharib', 'Gharib', 'The house''s own signature compositions.', '/gold-memoir.png', 'manual', 'brand', 'GHARIB', 5)
ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, brand = EXCLUDED.brand;

INSERT INTO public.product_collections (product_id, collection_id)
SELECT id, 'gharib' FROM public.products WHERE brand = 'GHARIB'
ON CONFLICT DO NOTHING;

-- 5. The seed catalogue uses explicit ids (1000+). Push the SERIAL sequence past them so
--    products added from the admin panel can never collide with a seeded id.
SELECT setval(
    pg_get_serial_sequence('public.products', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.products), 2000),
    true
);
