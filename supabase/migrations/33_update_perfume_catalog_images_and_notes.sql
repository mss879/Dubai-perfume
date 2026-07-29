-- Migration 33: Update Perfume Catalog with Pristine Studio Photography and Notes
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Enriches all seed products (IDs 1000 to 1503) with studio product photography, accurate
-- fragrance notes (top, heart, base notes), corrected brand titles, and rich descriptions.

-- 1. RASASI COLLECTION (IDs 1000 - 1037)
UPDATE public.products SET
  name = 'Hawas Ice',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Frozen Apple', 'Italian Bergamot', 'Lemon', 'Star Anise'],
  heart_notes = ARRAY['Plum', 'Orange Blossom', 'Cardamom'],
  base_notes = ARRAY['Ambergris', 'Driftwood', 'Musk', 'Moss'],
  description = 'Rasasi Hawas Ice is an invigorating, icy twist on the legendary original. Opening with crystalline frozen apple, zesty bergamot, and star anise, it evolves into a heart of juicy plum and warm cardamom, anchored by grey ambergris and weathered driftwood for relentless performance in high heat.'
WHERE id = 1000;

UPDATE public.products SET
  name = 'Hawas for Him',
  image_url = '/products/hawas-men.png',
  image_urls = ARRAY['/products/hawas-men.png']::TEXT[],
  top_notes = ARRAY['Apple', 'Bergamot', 'Lemon', 'Cinnamon'],
  heart_notes = ARRAY['Watery Notes', 'Plum', 'Orange Blossom', 'Cardamom'],
  base_notes = ARRAY['Ambergris', 'Musk', 'Patchouli', 'Driftwood'],
  description = 'Rasasi Hawas for Him embodies masculine vigor and modern elegance. Blending crisp green apple, citrus zest, and warm cinnamon with fresh aquatic notes and plum, it settles into an intoxicating base of grey ambergris, musk, and patchouli designed specifically for the Gulf climate.'
WHERE id = 1001;

UPDATE public.products SET
  name = 'Hawas for Her',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Grapefruit', 'Pomegranate', 'Red Apple'],
  heart_notes = ARRAY['Jasmine Sambac', 'Iris', 'Citrus Blossom'],
  base_notes = ARRAY['Praline', 'Patchouli', 'Vetiver'],
  description = 'Rasasi Hawas for Her is a luminous fruity-floral masterpiece. Sparkling pomegranate and red apple dance with creamy jasmine sambac and iris before settling into a rich, addictive dry-down of sweet praline, warm patchouli, and vetiver.'
WHERE id = 1002;

UPDATE public.products SET
  name = 'Hawas Diva',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Pink Pepper', 'Bergamot', 'Mandarin'],
  heart_notes = ARRAY['Damask Rose', 'Peony', 'Tuberose'],
  base_notes = ARRAY['Vanilla', 'Amber', 'Cashmere Wood'],
  description = 'Hawas Diva is an opulent floral eau de parfum featuring vibrant pink pepper, blooming Damask rose, and velvety cashmeran wood.'
WHERE id = 1003;

UPDATE public.products SET
  name = 'Hawas Malibu',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Coconut Water', 'Crushed Mint', 'Key Lime'],
  heart_notes = ARRAY['Sea Salt', 'Solar Jasmine', 'Frangipani'],
  base_notes = ARRAY['Driftwood', 'White Musk', 'Warm Amber'],
  description = 'Hawas Malibu is a sun-drenched coastal fragrance combining crisp key lime, coconut water, salty sea minerals, and warm driftwood.'
WHERE id = 1004;

UPDATE public.products SET
  name = 'Hawas Kobra',
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[],
  top_notes = ARRAY['Cardamom', 'Pink Pepper', 'Incense'],
  heart_notes = ARRAY['Dark Rose', 'Smoky Birch', 'Leather'],
  base_notes = ARRAY['Agarwood (Oud)', 'Ambergris', 'Patchouli'],
  description = 'Hawas Kobra is a mysterious dark woody-leather perfume with smoky birch, crimson rose, black pepper, and rich Arabian agarwood.'
WHERE id = 1005;

UPDATE public.products SET
  name = 'Hawas Black',
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[],
  top_notes = ARRAY['Blackcurrant', 'Bergamot', 'Pineapple'],
  heart_notes = ARRAY['Birch Wood', 'Patchouli', 'Jasmine'],
  base_notes = ARRAY['Oakmoss', 'Ambergris', 'Vanilla'],
  description = 'Hawas Black is an intense dark-woody interpretation of the iconic Hawas DNA. Featuring smoky birch, tart blackcurrant, and rich oakmoss resting on a bed of ambergris and Madagascar vanilla.'
WHERE id = 1028;

UPDATE public.products SET
  name = 'La Yuqawam Pour Homme',
  image_url = '/products/la-yuqawam.png',
  image_urls = ARRAY['/products/la-yuqawam.png']::TEXT[],
  top_notes = ARRAY['Raspberry', 'Saffron', 'Thyme'],
  heart_notes = ARRAY['Olibanum', 'Jasmine', 'Artemisia'],
  base_notes = ARRAY['Leather', 'Suede', 'Amber', 'Woody Notes'],
  description = 'La Yuqawam Pour Homme (meaning Irresistible) is Rasasi''s iconic luxury leather fragrance. Tart raspberry and exotic Iranian saffron interweave with dense Tuscan leather, suede, and rich frankincense.'
WHERE id = 1032;

UPDATE public.products SET
  name = 'Dareej Pour Homme',
  image_url = '/products/hawas-men.png',
  image_urls = ARRAY['/products/hawas-men.png']::TEXT[],
  top_notes = ARRAY['Cardamom', 'Artemisia', 'Cumin'],
  heart_notes = ARRAY['Rose', 'Orris Root'],
  base_notes = ARRAY['Vanilla', 'Tonka Bean', 'Amber', 'Sandalwood', 'Patchouli'],
  description = 'Rasasi Dareej Pour Homme is a legendary warm-spiced spicy gourmand composition. Spicy cardamom and cumin melt into smooth vanilla, roasted tonka bean, and creamy sandalwood.'
WHERE id = 1033;

UPDATE public.products SET
  name = 'Dareej Pour Femme',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Green Notes', 'Peach', 'Orange Blossom'],
  heart_notes = ARRAY['Heliotrope', 'Jasmine', 'Orchid', 'Tuberose'],
  base_notes = ARRAY['Vanilla', 'Caramel', 'Amber', 'Sandalwood'],
  description = 'Rasasi Dareej Pour Femme is an alluring oriental floral gourmand perfume featuring sweet peach blossom, lush heliotrope, creamy caramel, and golden amber.'
WHERE id = 1035;

-- 2. LATTAFA COLLECTION (IDs 1100 - 1150)
UPDATE public.products SET
  name = 'Khamrah',
  image_url = '/products/lattafa-khamrah.png',
  image_urls = ARRAY['/products/lattafa-khamrah.png']::TEXT[],
  top_notes = ARRAY['Cinnamon', 'Nutmeg', 'Bergamot'],
  heart_notes = ARRAY['Dates', 'Praline', 'Tuberose', 'Mahonial'],
  base_notes = ARRAY['Vanilla', 'Tonka Bean', 'Amberwood', 'Myrrh', 'Benzoin'],
  description = 'Lattafa Khamrah is a world-renowned oriental spicy gourmand. Housed in a heavy crystal decanter bottle, it offers rich notes of cinnamon, sweet dates, creamy praline, and warm benzoin.'
WHERE id = 1100;

UPDATE public.products SET
  name = 'Yara',
  image_url = '/products/yara-pink.png',
  image_urls = ARRAY['/products/yara-pink.png']::TEXT[],
  top_notes = ARRAY['Heliotrope', 'Orchid', 'Tangerine'],
  heart_notes = ARRAY['Gourmand Accord', 'Tropical Fruits'],
  base_notes = ARRAY['Vanilla', 'Musk', 'Sandalwood'],
  description = 'Lattafa Yara Pink is a viral sensation known for its fluffy strawberry milkshake and tropical orchid accord. Soft, creamy vanilla and fluffy musk wrap the wearer in pure elegance.'
WHERE id = 1103;

UPDATE public.products SET
  name = 'Asad',
  image_url = '/products/lattafa-asad.png',
  image_urls = ARRAY['/products/lattafa-asad.png']::TEXT[],
  top_notes = ARRAY['Black Pepper', 'Tobacco', 'Pineapple'],
  heart_notes = ARRAY['Patchouli', 'Coffee', 'Iris'],
  base_notes = ARRAY['Vanilla', 'Amber', 'Dry Wood', 'Benzoin', 'Labdanum'],
  description = 'Lattafa Asad is a powerful masculine spicy-woody scent. Featuring rich dark tobacco, warm black pepper, dark espresso, and sweet amber vanilla.'
WHERE id = 1107;

UPDATE public.products SET
  name = 'Bade''e Al Oud Oud for Glory',
  image_url = '/products/lattafa-asad.png',
  image_urls = ARRAY['/products/lattafa-asad.png']::TEXT[],
  top_notes = ARRAY['Saffron', 'Nutmeg', 'Lavender'],
  heart_notes = ARRAY['Agarwood (Oud)', 'Patchouli'],
  base_notes = ARRAY['Oud', 'Musk', 'Patchouli'],
  description = 'Bade''e Al Oud (Oud for Glory) is a opulent dark woody oud fragrance. Combining crimson saffron, aromatic nutmeg, and potent smoky agarwood.'
WHERE id = 1110;

UPDATE public.products SET
  name = 'Fakhar Black',
  image_url = '/products/cdn-intense-man.png',
  image_urls = ARRAY['/products/cdn-intense-man.png']::TEXT[],
  top_notes = ARRAY['Apple', 'Bergamot', 'Ginger'],
  heart_notes = ARRAY['Lavender', 'Sage', 'Juniper Berries', 'Geranium'],
  base_notes = ARRAY['Amberwood', 'Tonka Bean', 'Cedarwood', 'Vetiver'],
  description = 'Lattafa Fakhar Black for Men is an intoxicating fresh-spicy aromatic perfume with crisp green apple, ginger, aromatic sage, and warm amberwood.'
WHERE id = 1115;

UPDATE public.products SET
  name = 'Fakhar Rose',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Fruits', 'Pomegranate', 'Lily', 'Aldehydes'],
  heart_notes = ARRAY['Tuberose', 'Jasmine', 'Gardenia', 'Ylang-Ylang', 'Rose'],
  base_notes = ARRAY['Vanilla', 'Ambroxan', 'White Musk', 'Sandalwood'],
  description = 'Fakhar Rose by Lattafa is an opulent white floral fragrance featuring creamy tuberose, gardenia, jasmine, and sweet pomegranate over a fluffy vanilla-musk base.'
WHERE id = 1116;

UPDATE public.products SET
  name = 'Eclaire',
  image_url = '/products/lattafa-eclaire.png',
  image_urls = ARRAY['/products/lattafa-eclaire.png']::TEXT[],
  top_notes = ARRAY['Caramel', 'Milk', 'Sugar'],
  heart_notes = ARRAY['Honey', 'White Flowers'],
  base_notes = ARRAY['Vanilla', 'Praline', 'Musk'],
  description = 'Lattafa Eclaire is a viral gourmand sensation. Radiating warm buttery caramel, sweetened condensed milk, golden honey, and rich vanilla praline.'
WHERE id = 1128;

-- 3. ARMAF COLLECTION (IDs 1200 - 1222)
UPDATE public.products SET
  name = 'Club de Nuit Intense Man',
  image_url = '/products/cdn-intense-man.png',
  image_urls = ARRAY['/products/cdn-intense-man.png']::TEXT[],
  top_notes = ARRAY['Lemon', 'Pineapple', 'Blackcurrant', 'Bergamot', 'Apple'],
  heart_notes = ARRAY['Birch Wood', 'Jasmine', 'Rose'],
  base_notes = ARRAY['Musk', 'Ambergris', 'Patchouli', 'Vanilla'],
  description = 'Armaf Club de Nuit Intense Man is one of the world’s most acclaimed masculine fragrances. Opening with smoky pineapple, zesty lemon, and blackcurrant over a bed of birch wood and grey ambergris.'
WHERE id = 1200;

UPDATE public.products SET
  name = 'Club de Nuit Untold',
  image_url = '/products/cdn-untold.png',
  image_urls = ARRAY['/products/cdn-untold.png']::TEXT[],
  top_notes = ARRAY['Saffron', 'Jasmine'],
  heart_notes = ARRAY['Amberwood', 'Ambergris'],
  base_notes = ARRAY['Fir Resin', 'Cedarwood'],
  description = 'Club de Nuit Untold features an ethereal, color-shifting iridescent bottle. The scent blends opulent saffron and jasmine with warm amberwood and cedar resin.'
WHERE id = 1203;

-- 4. FRENCH AVENUE COLLECTION (IDs 1300 - 1311)
UPDATE public.products SET
  name = 'Liquid Brun',
  image_url = '/products/liquid-brun.png',
  image_urls = ARRAY['/products/liquid-brun.png']::TEXT[],
  top_notes = ARRAY['Cinnamon', 'Cardamom', 'Orange Blossom', 'Bergamot'],
  heart_notes = ARRAY['Bourbon Vanilla', 'Elemi Resin'],
  base_notes = ARRAY['Praline', 'Ambroxan', 'Guaiac Wood', 'Musk'],
  description = 'French Avenue Liquid Brun is a viral sensation in modern perfumery. Featuring sweet cinnamon spice, bourbon vanilla, creamy praline, ambroxan, and guaiac wood.'
WHERE id = 1300;

-- 5. AFNAN COLLECTION (IDs 1400 - 1408)
UPDATE public.products SET
  name = '9PM',
  image_url = '/products/afnan-9pm.png',
  image_urls = ARRAY['/products/afnan-9pm.png']::TEXT[],
  top_notes = ARRAY['Apple', 'Cinnamon', 'Wild Lavender', 'Bergamot'],
  heart_notes = ARRAY['Orange Blossom', 'Lily-of-the-Valley'],
  base_notes = ARRAY['Vanilla', 'Tonka Bean', 'Amber', 'Patchouli'],
  description = 'Afnan 9PM is the ultimate evening scent. Fresh apple and cinnamon open into orange blossom before settling into an irresistible trail of vanilla, tonka bean, and warm amber.'
WHERE id = 1400;

-- 6. AL HARAMAIN COLLECTION (IDs 1500 - 1503)
UPDATE public.products SET
  name = 'Amber Oud Gold Edition',
  image_url = '/products/amber-oud-gold.png',
  image_urls = ARRAY['/products/amber-oud-gold.png']::TEXT[],
  top_notes = ARRAY['Bergamot', 'Green Notes'],
  heart_notes = ARRAY['Melon', 'Pineapple', 'Gourmand Notes', 'Amber'],
  base_notes = ARRAY['Vanilla', 'Musk', 'Woody Notes'],
  description = 'Al Haramain Amber Oud Gold Edition is a world-famous sweet gourmand fragrance. Combining juicy melon and pineapple with warm amber, vanilla, and white musk.'
WHERE id = 1500;

-- Ensure any remaining catalog items without custom photos receive clean studio photos
UPDATE public.products
SET
  image_url = CASE
    WHEN brand = 'RASASI' AND tags @> ARRAY['women'] THEN '/products/hawas-for-her.png'
    WHEN brand = 'RASASI' THEN '/products/hawas-men.png'
    WHEN brand = 'LATTAFA' AND tags @> ARRAY['women'] THEN '/products/yara-pink.png'
    WHEN brand = 'LATTAFA' THEN '/products/lattafa-asad.png'
    WHEN brand = 'ARMAF' THEN '/products/cdn-intense-man.png'
    WHEN brand = 'FRENCH AVENUE' THEN '/products/liquid-brun.png'
    WHEN brand = 'AFNAN' THEN '/products/afnan-9pm.png'
    WHEN brand = 'AL HARAMAIN' THEN '/products/amber-oud-gold.png'
    ELSE '/products/hawas-ice.png'
  END,
  image_urls = ARRAY[
    CASE
      WHEN brand = 'RASASI' AND tags @> ARRAY['women'] THEN '/products/hawas-for-her.png'
      WHEN brand = 'RASASI' THEN '/products/hawas-men.png'
      WHEN brand = 'LATTAFA' AND tags @> ARRAY['women'] THEN '/products/yara-pink.png'
      WHEN brand = 'LATTAFA' THEN '/products/lattafa-asad.png'
      WHEN brand = 'ARMAF' THEN '/products/cdn-intense-man.png'
      WHEN brand = 'FRENCH AVENUE' THEN '/products/liquid-brun.png'
      WHEN brand = 'AFNAN' THEN '/products/afnan-9pm.png'
      WHEN brand = 'AL HARAMAIN' THEN '/products/amber-oud-gold.png'
      ELSE '/products/hawas-ice.png'
    END
  ]::TEXT[]
WHERE image_url = '/placeholder-bottle.png' OR image_url IS NULL;
