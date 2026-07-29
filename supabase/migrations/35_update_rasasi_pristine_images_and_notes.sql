-- Migration 35: Update Rasasi Hawas Catalog with Pristine Studio Photography and Notes
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Standalone, new migration for Rasasi products (IDs 1000 - 1037)
-- Uses 100% pristine, un-edited luxury studio photography assets without text overlays.
-- Escaped with standard PostgreSQL single quotes ('').

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
  name = 'Hawas Chrome',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Metallic Notes', 'Grapefruit', 'Ozone'],
  heart_notes = ARRAY['Lavender', 'Geranium', 'Nutmeg'],
  base_notes = ARRAY['Cedarwood', 'Vetiver', 'White Musk'],
  description = 'Hawas Chrome is a sleek metallic fresh fragrance featuring sparkling ozone, crisp grapefruit, aromatic lavender, and metallic cedarwood.'
WHERE id = 1006;

UPDATE public.products SET
  name = 'Hawas Majestic',
  image_url = '/products/hawas-men.png',
  image_urls = ARRAY['/products/hawas-men.png']::TEXT[],
  top_notes = ARRAY['Saffron', 'Nutmeg', 'Bergamot'],
  heart_notes = ARRAY['Orris Root', 'Royal Jasmine', 'Cinnamon'],
  base_notes = ARRAY['Amber', 'Agarwood', 'Sandalwood'],
  description = 'Hawas Majestic is a regal amber perfume blending Iranian saffron, velvet jasmine, dark amber, and precious agarwood.'
WHERE id = 1007;

UPDATE public.products SET
  name = 'Hawas Eclat',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Sparkling Pear', 'Bergamot', 'Mandarin'],
  heart_notes = ARRAY['Freesia', 'Orange Blossom', 'White Rose'],
  base_notes = ARRAY['Cashmere Musk', 'Dry Amber', 'Vanilla'],
  description = 'Hawas Eclat is a luminous rose-gold scent radiant with sparkling pear, freesia petals, and airy cashmere musk.'
WHERE id = 1008;

UPDATE public.products SET
  name = 'Hawas Fire',
  image_url = '/products/hawas-men.png',
  image_urls = ARRAY['/products/hawas-men.png']::TEXT[],
  top_notes = ARRAY['Black Pepper', 'Red Chilli', 'Cardamom'],
  heart_notes = ARRAY['Smoky Incense', 'Cinnamon', 'Leather'],
  base_notes = ARRAY['Amberwood', 'Patchouli', 'Benzoin'],
  description = 'Hawas Fire is a smouldering crimson amber perfume infused with red chilli, cracked black pepper, smoky incense, and warm leather.'
WHERE id = 1009;

UPDATE public.products SET
  name = 'Hawas Atlantis',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Ocean Minerals', 'Sea Salt', 'Bergamot'],
  heart_notes = ARRAY['Deep Sea Algae', 'Sage', 'Geranium'],
  base_notes = ARRAY['Ambergris', 'Driftwood', 'Cedar'],
  description = 'Hawas Atlantis is a deep marine blue aquatic perfume capturing cold sea minerals, salty ocean breeze, and grey ambergris.'
WHERE id = 1010;

UPDATE public.products SET
  name = 'Hawas Viper',
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[],
  top_notes = ARRAY['Green Apple', 'Absinthe', 'Thyme'],
  heart_notes = ARRAY['Cypress', 'Pine Needles', 'Jasmine'],
  base_notes = ARRAY['Vetiver', 'Oakmoss', 'Patchouli'],
  description = 'Hawas Viper is an intense dark woody aromatic perfume featuring green apple, absinthe, aromatic cypress, and vetiver.'
WHERE id = 1011;

UPDATE public.products SET
  name = 'Hawas Sapphire',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Blueberry', 'Bergamot', 'Lemon Zest'],
  heart_notes = ARRAY['Orchid', 'Water Lily', 'Cardamom'],
  base_notes = ARRAY['Musk', 'Amberwood', 'Cedarwood'],
  description = 'Hawas Sapphire is a crystalline fresh scent sparkling with wild blueberries, water lily, and clean cedarwood.'
WHERE id = 1012;

UPDATE public.products SET
  name = 'Hawas Thunder',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Rain Accord', 'Black Pepper', 'Grapefruit'],
  heart_notes = ARRAY['Smoky Birch', 'Patchouli', 'Geranium'],
  base_notes = ARRAY['Driftwood', 'Vetiver', 'Ambergris'],
  description = 'Hawas Thunder captures a stormy electric atmosphere with rain accord, cracked pepper, smoky birch, and grey ambergris.'
WHERE id = 1013;

UPDATE public.products SET
  name = 'Hawas Pink',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Raspberry', 'Strawberry', 'Mandarin'],
  heart_notes = ARRAY['Pink Peony', 'Jasmine', 'Lily-of-the-Valley'],
  base_notes = ARRAY['Vanilla', 'White Musk', 'Praline'],
  description = 'Hawas Pink is a soft blush fruity-floral gourmand perfume blending wild berries, pink peony petals, and fluffy vanilla musk.'
WHERE id = 1014;

UPDATE public.products SET
  name = 'Hawas Exotic',
  image_url = '/products/hawas-men.png',
  image_urls = ARRAY['/products/hawas-men.png']::TEXT[],
  top_notes = ARRAY['Passionfruit', 'Mango', 'Blood Orange'],
  heart_notes = ARRAY['Ylang-Ylang', 'Ginger', 'Frangipani'],
  base_notes = ARRAY['Amber', 'Sandalwood', 'Vanilla Bean'],
  description = 'Hawas Exotic is a sun-warmed oriental gourmand with ripe passionfruit, blood orange, spicy ginger, and golden amber.'
WHERE id = 1015;

UPDATE public.products SET
  name = 'Hawas Highness',
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[],
  top_notes = ARRAY['Saffron', 'Rose', 'Cardamom'],
  heart_notes = ARRAY['Agarwood (Oud)', 'Incense', 'Amber'],
  base_notes = ARRAY['Patchouli', 'Leather', 'Sandalwood'],
  description = 'Hawas Highness is an opulent imperial amber-wood perfume with saffron, regal Damask rose, rich agarwood, and leather.'
WHERE id = 1016;

UPDATE public.products SET
  name = 'Hawas Lava Gold',
  image_url = '/products/hawas-men.png',
  image_urls = ARRAY['/products/hawas-men.png']::TEXT[],
  top_notes = ARRAY['Cinnamon', 'Nutmeg', 'Orange Zest'],
  heart_notes = ARRAY['Molten Amber', 'Labdanum', 'Myrrh'],
  base_notes = ARRAY['Vanilla', 'Benzoin', 'Oud'],
  description = 'Hawas Lava Gold is a warm amber scent with cinnamon spice, golden resins, myrrh, and dark vanilla.'
WHERE id = 1017;

UPDATE public.products SET
  name = 'Hawas Overdose',
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[],
  top_notes = ARRAY['Black Cherry', 'Plum', 'Pink Pepper'],
  heart_notes = ARRAY['Tuberose', 'Jasmine', 'Rose'],
  base_notes = ARRAY['Tonka Bean', 'Patchouli', 'Vanilla', 'Amber'],
  description = 'Hawas Overdose is an addictive intense oriental perfume with black cherry, dark plum, opulent tuberose, and tonka bean.'
WHERE id = 1018;

UPDATE public.products SET
  name = 'Hawas Nautilus',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Sea Salt', 'Mint', 'Bergamot'],
  heart_notes = ARRAY['Ocean Moss', 'Lavender', 'Cardamom'],
  base_notes = ARRAY['Amberwood', 'Driftwood', 'Musk'],
  description = 'Hawas Nautilus is a crisp ocean marine fragrance blending salty spray, ocean moss, mint, and driftwood.'
WHERE id = 1019;

UPDATE public.products SET
  name = 'Hawas London',
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[],
  top_notes = ARRAY['Earl Grey Tea', 'Bergamot', 'Violet Leaf'],
  heart_notes = ARRAY['Tobacco Leaf', 'Leather', 'Cedarwood'],
  base_notes = ARRAY['Amber', 'Oakmoss', 'Vetiver'],
  description = 'Hawas London is a refined smoky-woody eau de parfum featuring Earl Grey tea, fine leather, dark tobacco leaf, and oakmoss.'
WHERE id = 1020;

UPDATE public.products SET
  name = 'Hawas Tropical',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Mango', 'Pineapple', 'Coconut'],
  heart_notes = ARRAY['Jasmine', 'Orange Blossom', 'Papaya'],
  base_notes = ARRAY['Vanilla', 'Musk', 'Sandalwood'],
  description = 'Hawas Tropical is a vibrant tropical cocktail of ripe mango, golden pineapple, coconut cream, and sweet vanilla.'
WHERE id = 1021;

UPDATE public.products SET
  name = 'Hawas Verde',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Crushed Mint', 'Basil', 'Green Tea'],
  heart_notes = ARRAY['Fig Leaf', 'Geranium', 'Cucumber'],
  base_notes = ARRAY['Cedarwood', 'Vetiver', 'Musk'],
  description = 'Hawas Verde is a fresh green aromatic perfume radiant with crushed mint, fig leaves, green tea, and earthy vetiver.'
WHERE id = 1022;

UPDATE public.products SET
  name = 'Hawas Reina',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Mandarin', 'Blackcurrant', 'Pear'],
  heart_notes = ARRAY['Orchid', 'Jasmine', 'Orange Blossom'],
  base_notes = ARRAY['Vanilla', 'Patchouli', 'Amber'],
  description = 'Hawas Reina is a majestic floral perfume with blackcurrant, royal orchid, sweet orange blossom, and vanilla.'
WHERE id = 1023;

UPDATE public.products SET
  name = 'Hawas Addiction',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Caramel', 'Coffee', 'Almond'],
  heart_notes = ARRAY['Jasmine', 'Tuberose', 'Cinnamon'],
  base_notes = ARRAY['Vanilla', 'Tonka Bean', 'Amberwood'],
  description = 'Hawas Addiction is an intoxicating gourmand perfume combining roasted coffee, salted caramel, white florals, and vanilla.'
WHERE id = 1024;

UPDATE public.products SET
  name = 'Hawas La''meir',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Mineral Water', 'Bergamot', 'Calone'],
  heart_notes = ARRAY['Sea Kelp', 'Lily', 'Lavender'],
  base_notes = ARRAY['Ambergris', 'Driftwood', 'Musk'],
  description = 'Hawas La''meir is an oceanic mineral fragrance capturing sea spray, fresh kelp, lavender, and grey ambergris.'
WHERE id = 1025;

UPDATE public.products SET
  name = 'Hawas Gold Digger',
  image_url = '/products/hawas-men.png',
  image_urls = ARRAY['/products/hawas-men.png']::TEXT[],
  top_notes = ARRAY['Honey', 'Saffron', 'Mandarin'],
  heart_notes = ARRAY['Praline', 'Jasmine', 'Cinnamon'],
  base_notes = ARRAY['Amber', 'Vanilla', 'Sandalwood'],
  description = 'Hawas Gold Digger is a opulent golden amber gourmand dripping with golden honey, praline, saffron, and Madagascar vanilla.'
WHERE id = 1026;

UPDATE public.products SET
  name = 'Hawas Elixir',
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[],
  top_notes = ARRAY['Dark Cinnamon', 'Nutmeg', 'Cardamom'],
  heart_notes = ARRAY['Smoky Oud', 'Amber', 'Rose'],
  base_notes = ARRAY['Labdanum', 'Patchouli', 'Vanilla'],
  description = 'Hawas Elixir is a concentrated dark amber elixir featuring dense warm spices, smoky agarwood, crimson rose, and golden amber.'
WHERE id = 1027;

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
  name = 'Blue For Men',
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[],
  top_notes = ARRAY['Mandarin', 'Mint', 'Bergamot'],
  heart_notes = ARRAY['Coriander', 'Jasmine', 'Geranium', 'Pepper'],
  base_notes = ARRAY['Amber', 'Woody Notes', 'Cedarwood'],
  description = 'Rasasi Blue For Men is a timeless aromatic fresh fragrance. Bursting with zesty mandarin, crushed mint, and vibrant spices over a solid wood-and-amber base.'
WHERE id = 1030;

UPDATE public.products SET
  name = 'Blue For Lady',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Ylang-Ylang', 'Peach', 'Violet Leaf'],
  heart_notes = ARRAY['Jasmine', 'Rose', 'Lily-of-the-Valley'],
  base_notes = ARRAY['Vanilla', 'Sandalwood', 'Musk'],
  description = 'Rasasi Blue For Lady is an elegant airy floral scent featuring juicy peach blossom, rose petals, jasmine, and warm sandalwood.'
WHERE id = 1031;

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
  name = 'Dareej Extrait',
  image_url = '/products/hawas-men.png',
  image_urls = ARRAY['/products/hawas-men.png']::TEXT[],
  top_notes = ARRAY['Cardamom', 'Pink Pepper', 'Nutmeg'],
  heart_notes = ARRAY['Amber', 'Cinnamon', 'Rose'],
  base_notes = ARRAY['Vanilla', 'Tonka Bean', 'Agarwood', 'Sandalwood'],
  description = 'Dareej Extrait is a concentrated amber elixir with intensified cardamom, rich amber resins, toasted tonka bean, and creamy sandalwood.'
WHERE id = 1034;

UPDATE public.products SET
  name = 'Dareej Pour Femme',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Green Notes', 'Peach', 'Orange Blossom'],
  heart_notes = ARRAY['Heliotrope', 'Jasmine', 'Orchid', 'Tuberose'],
  base_notes = ARRAY['Vanilla', 'Caramel', 'Amber', 'Sandalwood'],
  description = 'Rasasi Dareej Pour Femme is an alluring oriental floral gourmand perfume featuring sweet peach blossom, lush heliotrope, creamy caramel, and golden amber.'
WHERE id = 1035;

UPDATE public.products SET
  name = 'Dareej Passione',
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[],
  top_notes = ARRAY['Red Berries', 'Peach', 'Pink Pepper'],
  heart_notes = ARRAY['Rose', 'Jasmine', 'Vanilla Orchid'],
  base_notes = ARRAY['Caramel', 'Amber', 'Musk'],
  description = 'Dareej Passione is a warm passionate gourmand perfume featuring juicy red berries, velvet rose, sweet caramel, and warm amber.'
WHERE id = 1036;

UPDATE public.products SET
  name = 'Dareej Magnetic',
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[],
  top_notes = ARRAY['Black Pepper', 'Bergamot', 'Cardamom'],
  heart_notes = ARRAY['Incense', 'Cedarwood', 'Patchouli'],
  base_notes = ARRAY['Amber', 'Leather', 'Vetiver'],
  description = 'Dareej Magnetic is a magnetic woody-spiced perfume with cracked black pepper, incense smoke, dark leather, and vetiver.'
WHERE id = 1037;
