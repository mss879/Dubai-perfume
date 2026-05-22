-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    sizes TEXT[] NOT NULL,
    image_url VARCHAR(512) NOT NULL,
    description TEXT,
    tagline VARCHAR(255),
    olfactory_group VARCHAR(255) NOT NULL,
    is_new BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    is_featured_large BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create collections table
CREATE TABLE IF NOT EXISTS public.collections (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create product_collections join table
CREATE TABLE IF NOT EXISTS public.product_collections (
    product_id INT REFERENCES public.products(id) ON DELETE CASCADE,
    collection_id VARCHAR(100) REFERENCES public.collections(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, collection_id)
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

-- Create public read policies
CREATE POLICY "Allow public read on products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read on collections" ON public.collections FOR SELECT USING (true);
CREATE POLICY "Allow public read on product_collections" ON public.product_collections FOR SELECT USING (true);

-- Seed Collections
INSERT INTO public.collections (id, title, description, cover_image) VALUES
('new', 'New Arrivals', 'Freshly decanted summer releases', '/campaign-gold.png'),
('bestsellers', 'Bestsellers', 'Our most coveted scent signatures', '/campaign-purple.png'),
('favorites', 'Exclusive Offers', 'Hand-selected custom vaults', '/campaign-red-black.png'),
('trending', 'Trending Now', 'Most wanted scent creations', '/campaign-silver.png')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, cover_image = EXCLUDED.cover_image;

-- Seed Products (Hero & Catalog)
INSERT INTO public.products (id, brand, name, price, sizes, image_url, description, tagline, olfactory_group, is_new, is_bestseller, is_featured_large) VALUES
-- Hero Perfumes
(101, 'GHARIB PRIVÉ', 'Gold Memoir', 203.00, ARRAY['50ml', '100ml'], '/gold-memoir.png', 'Elevate your everyday moments with our luxurious fragrances that transform routine into a sensory journey of pleasure and luxury.', 'Aurum Noble Edition', 'Woody & Oud', true, false, false),
(102, 'GHARIB PRIVÉ', 'Enchanted Blooms', 119.00, ARRAY['30ml', '50ml'], '/enchanted-blooms.png', 'A floral-centric perfume inspired by a magical garden with a delicate bouquet of blooming jasmine, fresh peony, and soft vanilla highlights.', 'Aura Floral Collection', 'Floral & Sweet', false, true, false),
(103, 'GHARIB PRIVÉ', 'Mystic Oud', 169.00, ARRAY['50ml', '100ml'], '/mystic-oud.png', 'An oriental fragrance that combines the richness of exotic spices, warm agarwood, and rare dark cardamom for a mysterious, timeless appeal.', 'Royal Spice Reserve', 'Woody & Oud', false, true, false),
(104, 'GHARIB PRIVÉ', 'Ocean Breeze', 145.00, ARRAY['50ml', '100ml'], '/ocean-breeze.png', 'A fresh marine experience blending salty sea minerals, crushed mint leaves, amberwood, and bright Italian bergamot for clean coastal refinement.', 'Aquamarine Coast Line', 'Fresh & Aquatic', true, false, false),

-- Catalog Perfumes
(1, 'INITIO PARFUMS PRIVES', 'Oud for greatness', 331.00, ARRAY['50ml', '90ml'], '/catalog_initio_oud.png', 'A highly concentrated woody fragrance with saffron, lavender, and nutmeg, dry down to heavy dark agarwood oud.', 'Sacred Geometry', 'Woody & Oud', true, false, false),
(2, 'JULIETTE HAS A GUN', 'Juliette', 98.00, ARRAY['30ml', '50ml'], '/catalog_juliette_gun.png', 'A beautiful floral-sensual blend that balances elegant red berries, white blossoms, and sweet woods.', 'Femme Fatale Signature', 'Floral & Sweet', false, true, false),
(3, 'RABANNE', 'Phantom', 120.00, ARRAY['50ml', '100ml'], '/catalog_rabanne_phantom.png', 'A fresh, futuristic composition featuring notes of lavender, creamy patchouli, vanilla, and sparkling vetiver.', 'Metallic Modern Scent', 'Fresh & Aquatic', true, false, false),
(4, 'HFC', 'Devil''s intrigue', 370.00, ARRAY['75ml'], '/catalog_hfc_devils.png', 'Deep, dramatic amber oriental profile combining warm vanilla, fine sandalwood, and exotic floral touches.', 'Hypnotic Indulgence', 'Amber & Oriental', false, true, false),
(5, 'TOM FORD', 'Lost Cherry eau de parfum', 326.00, ARRAY['30ml', '50ml', '100ml'], '/catalog_tom_ford_cherry.png', 'A full-bodied journey into the once-forbidden; a contrasting scent that reveals a tempting dichotomy of playful, candy-like gleam on the outside and luscious flesh on the inside.', 'Gourmand Masterpiece', 'Floral & Sweet', false, true, false),
(6, 'MOSCHINO', 'Toy Boy', 43.12, ARRAY['30ml', '50ml', '100ml'], '/catalog_moschino_teddy.png', 'A unique, masculine fragrance blending dark woods, pink pepper, rose notes, and resinous amber highlights.', 'Playful Sophistication', 'Woody & Oud', true, false, false),
(7, 'FILIPPO SORCINELLI', 'Epicentro', 326.00, ARRAY['50ml', '100ml'], '/catalog_sorcinelli_epicentro.png', 'Epicentro is an artistic perfume that represents a deep volcanic impact. Topped with a heavy raw silver metal crumpled sculpture that serves as both the cap and a piece of tactile art, reflecting the dramatic nature of Filippo Sorcinelli''s olfactory expressions.', 'Artistic Volcanic Shudder', 'Fresh & Aquatic', false, true, true),
(8, 'FILIPPO SORCINELLI', 'Eio_non_ho_mani_che_mi_accarezzino_il_volto', 235.00, ARRAY['100ml'], '/catalog_sorcinelli_leather.png', 'An avante-garde olfactory masterpiece encased in a bottle wrapped dramatically in draped, textured organic matte black leather folds. The scent is a heavy gothic mixture of warm incense, cedarwood, and resinous leather accord.', 'Gothic Draped Incense', 'Amber & Oriental', true, false, true),
(9, 'MARC-ANTOINE BARROIS', 'Ganymede Extrait', 319.00, ARRAY['30ml', '50ml'], '/catalog_marc_barrois.png', 'Deeply woody and metallic masterpiece with leather, saffron, mandarin, and heavy warm immortelle.', 'Cosmic Leather Harmony', 'Woody & Oud', true, false, false)
ON CONFLICT (id) DO UPDATE SET brand = EXCLUDED.brand, name = EXCLUDED.name, price = EXCLUDED.price, sizes = EXCLUDED.sizes, image_url = EXCLUDED.image_url, description = EXCLUDED.description, tagline = EXCLUDED.tagline, olfactory_group = EXCLUDED.olfactory_group, is_new = EXCLUDED.is_new, is_bestseller = EXCLUDED.is_bestseller, is_featured_large = EXCLUDED.is_featured_large;

-- Seed Product Collections mapping
INSERT INTO public.product_collections (product_id, collection_id) VALUES
-- News
(101, 'new'),
(104, 'new'),
(1, 'new'),
(3, 'new'),
(6, 'new'),
(8, 'new'),
(9, 'new'),
-- Bestsellers
(102, 'bestsellers'),
(103, 'bestsellers'),
(2, 'bestsellers'),
(4, 'bestsellers'),
(5, 'bestsellers'),
(7, 'bestsellers'),
-- Favorites (Exclusive Offers)
(2, 'favorites'),
(4, 'favorites'),
(5, 'favorites'),
(9, 'favorites'),
-- Trending
(101, 'trending'),
(1, 'trending'),
(4, 'trending'),
(7, 'trending')
ON CONFLICT DO NOTHING;
