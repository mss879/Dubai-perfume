-- Migration 23: Add Fragrance Notes Columns (Top, Heart, Base Notes)
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- 1. Add array columns to public.products table for detailed scent notes
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS top_notes TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS heart_notes TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_notes TEXT[] DEFAULT '{}';

-- 2. Seed existing default curations with realistic olfactory notes for top-tier representation
UPDATE public.products 
SET 
  top_notes = ARRAY['Saffron', 'Cinnamon', 'Bergamot'],
  heart_notes = ARRAY['Rose', 'Jasmine', 'Clove'],
  base_notes = ARRAY['Amber', 'Agarwood (Oud)', 'Sandalwood', 'Vanilla']
WHERE id = 101; -- Gold Memoir

UPDATE public.products 
SET 
  top_notes = ARRAY['Pear', 'Red Berries', 'Jasmine'],
  heart_notes = ARRAY['Peony', 'Freesia', 'Orange Blossom'],
  base_notes = ARRAY['Vanilla', 'White Musk', 'Patchouli']
WHERE id = 102; -- Enchanted Blooms

UPDATE public.products 
SET 
  top_notes = ARRAY['Saffron', 'Nutmeg', 'Cardamom'],
  heart_notes = ARRAY['Oud', 'Incense', 'Myrrh'],
  base_notes = ARRAY['Leather', 'Amber', 'Patchouli', 'Cedarwood']
WHERE id = 103; -- Mystic Oud

UPDATE public.products 
SET 
  top_notes = ARRAY['Italian Bergamot', 'Mint Leaves', 'Lemon'],
  heart_notes = ARRAY['Sea Salt', 'Lavender', 'Geranium'],
  base_notes = ARRAY['Amberwood', 'Vetiver', 'White Musk']
WHERE id = 104; -- Ocean Breeze

UPDATE public.products 
SET 
  top_notes = ARRAY['Saffron', 'Nutmeg', 'Lavender'],
  heart_notes = ARRAY['Oud (Agarwood)'],
  base_notes = ARRAY['Patchouli', 'Musk']
WHERE id = 1; -- Oud for greatness

UPDATE public.products 
SET 
  top_notes = ARRAY['Red Berries', 'Jasmine Sambac'],
  heart_notes = ARRAY['Centifolia Rose', 'White Blossoms'],
  base_notes = ARRAY['Sweet Woods', 'Amber', 'Musk']
WHERE id = 2; -- Juliette

UPDATE public.products 
SET 
  top_notes = ARRAY['Lavender', 'Lemon Peel'],
  heart_notes = ARRAY['Patchouli', 'Creamy Apple', 'Smoke'],
  base_notes = ARRAY['Vanilla', 'Vetiver']
WHERE id = 3; -- Phantom

UPDATE public.products 
SET 
  top_notes = ARRAY['White Tea', 'Osmanthus'],
  heart_notes = ARRAY['Orange Blossom', 'Sandalwood'],
  base_notes = ARRAY['Cashmere Wood', 'Vanilla', 'Dry Amber']
WHERE id = 4; -- Devil''s intrigue

UPDATE public.products 
SET 
  top_notes = ARRAY['Black Cherry', 'Bitter Almond', 'Cherry Liqueur'],
  heart_notes = ARRAY['Griotte Syrup', 'Turkish Rose', 'Jasmine Sambac'],
  base_notes = ARRAY['Tonka Bean', 'Roasted Cocoa', 'Sandalwood', 'Vetiver', 'Cedarwood']
WHERE id = 5; -- Lost Cherry

UPDATE public.products 
SET 
  top_notes = ARRAY['Pink Pepper', 'Pear', 'Indonesian Nutmeg'],
  heart_notes = ARRAY['Rose', 'Flax Flowers', 'Magnolia'],
  base_notes = ARRAY['Haitian Vetiver', 'Sandalwood', 'Cashmeran', 'Amber']
WHERE id = 6; -- Toy Boy

UPDATE public.products 
SET 
  top_notes = ARRAY['Volcanic Silt', 'Italian Bergamot'],
  heart_notes = ARRAY['Deep Sea Minerals', 'Warm Earth', 'Rust'],
  base_notes = ARRAY['Driftwood', 'Dry Cedarwood']
WHERE id = 7; -- Epicentro

UPDATE public.products 
SET 
  top_notes = ARRAY['Clerics Cassock', 'Incense Smoke'],
  heart_notes = ARRAY['Organic Dark Leather', 'Petrichor'],
  base_notes = ARRAY['Gothic Resin', 'Myrrh', 'Warm Amber']
WHERE id = 8; -- Eio_non_ho_mani_che_mi_accarezzino_il_volto

UPDATE public.products 
SET 
  top_notes = ARRAY['Mandarin Orange', 'Saffron'],
  heart_notes = ARRAY['Violet Leaves', 'Immortelle Flower'],
  base_notes = ARRAY['Suede Leather', 'Akigalawood']
WHERE id = 9; -- Ganymede Extrait
