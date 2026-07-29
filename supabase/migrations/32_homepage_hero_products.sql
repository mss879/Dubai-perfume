-- Migration 32: Add Homepage Hero Products configuration to public.products

-- 1. Add is_hero and hero_order columns to public.products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_hero BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hero_order INT DEFAULT 0;

-- 2. Create index for fast hero product queries
CREATE INDEX IF NOT EXISTS idx_products_is_hero ON public.products(is_hero, hero_order);

-- 3. Set default hero products (Gold Memoir, Enchanted Blooms, Mystic Oud, Ocean Breeze)
UPDATE public.products SET is_hero = true, hero_order = 1 WHERE id = 101 OR name ILIKE 'Gold Memoir';
UPDATE public.products SET is_hero = true, hero_order = 2 WHERE id = 102 OR name ILIKE 'Enchanted Blooms';
UPDATE public.products SET is_hero = true, hero_order = 3 WHERE id = 103 OR name ILIKE 'Mystic Oud';
UPDATE public.products SET is_hero = true, hero_order = 4 WHERE id = 104 OR name ILIKE 'Ocean Breeze';

-- If products 101-104 don't exist yet, insert them as hero products
INSERT INTO public.products (id, brand, name, price, sizes, image_url, description, tagline, olfactory_group, is_new, is_bestseller, is_featured_large, is_hero, hero_order) VALUES
(101, 'GHARIB PRIVÉ', 'Gold Memoir', 203.00, ARRAY['50ml', '100ml'], '/gold-memoir.png', 'Elevate your everyday moments with our luxurious fragrances that transform routine into a sensory journey of pleasure and luxury.', 'Aurum Noble Edition', 'Woody & Oud', true, false, false, true, 1),
(102, 'GHARIB PRIVÉ', 'Enchanted Blooms', 119.00, ARRAY['30ml', '50ml'], '/enchanted-blooms.png', 'A floral-centric perfume inspired by a magical garden with a delicate bouquet of blooming jasmine, fresh peony, and soft vanilla highlights.', 'Aura Floral Collection', 'Floral & Sweet', false, true, false, true, 2),
(103, 'GHARIB PRIVÉ', 'Mystic Oud', 169.00, ARRAY['50ml', '100ml'], '/mystic-oud.png', 'An oriental fragrance that combines the richness of exotic spices, warm agarwood, and rare dark cardamom for a mysterious, timeless appeal.', 'Royal Spice Reserve', 'Woody & Oud', false, true, false, true, 3),
(104, 'GHARIB PRIVÉ', 'Ocean Breeze', 145.00, ARRAY['50ml', '100ml'], '/ocean-breeze.png', 'A fresh marine experience blending salty sea minerals, crushed mint leaves, amberwood, and bright Italian bergamot for clean coastal refinement.', 'Aquamarine Coast Line', 'Fresh & Aquatic', true, false, false, true, 4)
ON CONFLICT (id) DO UPDATE SET 
  is_hero = EXCLUDED.is_hero, 
  hero_order = EXCLUDED.hero_order;
