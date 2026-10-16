-- Migration 62: Cut-out, evenly-scaled product photography
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Migration 61 pointed the catalogue at the brands' packshots as published. On the grid they
-- read badly, for two measurable reasons:
--
--   1. Every shot carried its own background, so the cards showed 45 different rectangles of
--      near-white instead of bottles.
--   2. The bottle filled anywhere from 41% to 100% of its frame depending on how the brand
--      had cropped it — a 2.4x spread — so identically-sized bottles rendered at wildly
--      different sizes side by side.
--
-- Every image has been reprocessed from the same first-party sources migration 61 used:
--   * background removed to real transparency. The cut uses CONNECTED COMPONENTS grown from
--     the frame edge rather than a colour threshold, so white glass, silver caps and pale
--     labels INSIDE a bottle survive instead of being punched out. The cut edge is feathered
--     rather than hard, so it does not alias against the card.
--   * cropped to the bottle, then scaled so the subject occupies 86% of a 1400x1400 square on
--     every product. One canvas, one scale, no exceptions — that is what makes a row of cards
--     line up.
--
-- These are PNGs with an alpha channel, served from cutout/<id>/<n>.png. The originals from
-- migration 61 are untouched at products/<id>/<n>.<ext>, so this is reversible by re-running 61.
--
-- 101 of 138 products carry photography, 194 images in all.
--
-- NEW SINCE 61: 3310 French Avenue Aromatix - Carnal Desire. It was found on frenchavenue.com
-- first time round but rejected by the 400px floor — its master is 384x576 and the brand
-- publishes nothing larger. It is included here because a slightly soft bottle beats a
-- placeholder, but it is the one image in the set that will not be crisp on a retina card.
--
-- STILL WITHOUT PHOTOGRAPHY (37). This is not for want of looking: their brands' own
-- catalogues were enumerated in full and searched keyword by keyword -- Rasasi 192 products,
-- Armaf 475, French Avenue 150, Afnan 101 -- and these return no match at all. Armaf publishes
-- Ventana Pour Homme and Ventana Marine but none of the five colourways; Rasasi's store lists
-- eight Hawas singles against the ~25 flankers in this catalogue. The only images in
-- circulation are on marketplaces and fan sites. They keep /placeholder-bottle.png, and the
-- distributor's asset pack is the way to close the gap:
--     3004  Rasasi Hawas Malibu
--     3005  Rasasi Hawas Kobra
--     3006  Rasasi Hawas Chrome
--     3007  Rasasi Hawas Majestic
--     3008  Rasasi Hawas For Her Eclat
--     3013  Rasasi Hawas Thunder
--     3015  Rasasi Hawas Exotic
--     3016  Rasasi Hawas Highness
--     3017  Rasasi Hawas Lava Gold
--     3018  Rasasi Hawas Overdose
--     3019  Rasasi Hawas Nautilus
--     3020  Rasasi Hawas London
--     3021  Rasasi Hawas Tropical
--     3022  Rasasi Hawas Verde
--     3023  Rasasi Hawas Reina
--     3024  Rasasi Hawas Addiction
--     3025  Rasasi Hawas La Mer
--     3026  Rasasi Hawas Gold Digger
--     3027  Rasasi Hawas Elixir
--     3028  Rasasi Hawas Black
--     3034  Rasasi Daarej Extrait Pour Homme
--     3036  Rasasi Daarej Passione for Her
--     3037  Rasasi Daarej Magnetic
--     3104  Lattafa Yara Pink
--     3108  Lattafa Asad Black
--     3117  Lattafa Fakhar Pink
--     3121  Lattafa Ameerat Al Arab Black
--     3125  Lattafa Ana Abiyedh Poudree
--     3213  Armaf Ventana Blanca
--     3214  Armaf Ventana Rosa
--     3215  Armaf Ventana Azul
--     3216  Armaf Ventana Verde
--     3217  Armaf Ventana Amarilla
--     3301  French Avenue Liquid Rouge
--     3302  French Avenue Liquid Noir
--     3311  French Avenue Bourbon Cafe
--     3404  Afnan Supremacy Silver Limited Edition
--
-- Re-running is safe: one UPDATE keyed on product id, no inserts, no deletes.

BEGIN;

WITH shots (id, urls) AS (
    VALUES
    -- RASASI
    (3000, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3000/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3000/2.png']::TEXT[]),  -- Hawas (for Him)
    (3001, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3001/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3001/2.png']::TEXT[]),  -- Hawas Ice
    (3002, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3002/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3002/2.png']::TEXT[]),  -- Hawas for Her
    (3003, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3003/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3003/2.png']::TEXT[]),  -- Diva
    (3009, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3009/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3009/2.png']::TEXT[]),  -- Hawas Fire
    (3010, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3010/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3010/2.png']::TEXT[]),  -- Hawas Atlantis
    (3011, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3011/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3011/2.png']::TEXT[]),  -- Hawas Viper
    (3012, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3012/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3012/2.png']::TEXT[]),  -- Hawas Sapphire
    (3014, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3014/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3014/2.png']::TEXT[]),  -- Hawas Pink
    (3029, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3029/1.png']::TEXT[]),  -- Blue for Men
    (3030, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3030/1.png']::TEXT[]),  -- Blue Lady
    (3031, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3031/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3031/2.png']::TEXT[]),  -- La Yuqawam Homme
    (3032, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3032/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3032/2.png']::TEXT[]),  -- La Yuqawam Femme
    (3033, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3033/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3033/2.png']::TEXT[]),  -- Daarej Pour Homme
    (3035, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3035/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3035/2.png']::TEXT[]),  -- Daarej Pour Femme

    -- LATTAFA
    (3100, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3100/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3100/2.png']::TEXT[]),  -- Khamrah
    (3101, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3101/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3101/2.png']::TEXT[]),  -- Khamrah Qahwa
    (3102, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3102/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3102/2.png']::TEXT[]),  -- Khamrah Dukhan
    (3103, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3103/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3103/2.png']::TEXT[]),  -- Yara
    (3105, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3105/1.png']::TEXT[]),  -- Yara Candy
    (3106, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3106/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3106/2.png']::TEXT[]),  -- Yara Tous
    (3107, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3107/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3107/2.png']::TEXT[]),  -- Asad
    (3109, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3109/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3109/2.png']::TEXT[]),  -- Asad Bourbon
    (3110, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3110/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3110/2.png']::TEXT[]),  -- Asad Zanzibar
    (3111, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3111/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3111/2.png']::TEXT[]),  -- Badee Al Oud Oud for Glory
    (3112, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3112/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3112/2.png']::TEXT[]),  -- Badee Al Oud Sublime
    (3113, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3113/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3113/2.png']::TEXT[]),  -- Badee Al Oud Honor and Glory
    (3114, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3114/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3114/2.png']::TEXT[]),  -- Badee Al Oud Amethyst (Purple)
    (3115, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3115/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3115/2.png']::TEXT[]),  -- Badee Al Oud Noble Blush (Pink)
    (3116, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3116/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3116/2.png']::TEXT[]),  -- Fakhar Black
    (3118, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3118/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3118/2.png']::TEXT[]),  -- Fakhar Gold
    (3119, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3119/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3119/2.png']::TEXT[]),  -- Fakhar Rose Gold
    (3120, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3120/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3120/2.png']::TEXT[]),  -- Ameerat Al Arab (Red)
    (3122, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3122/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3122/2.png']::TEXT[]),  -- Ameerat Al Arab Prive Rose
    (3123, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3123/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3123/2.png']::TEXT[]),  -- Ana Abiyedh
    (3124, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3124/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3124/2.png']::TEXT[]),  -- Ana Abiyedh Coral
    (3126, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3126/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3126/2.png']::TEXT[]),  -- Mayar Pink
    (3127, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3127/1.png']::TEXT[]),  -- Mayar Cherry Intense
    (3128, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3128/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3128/2.png']::TEXT[]),  -- Mayar Natural Intense
    (3129, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3129/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3129/2.png']::TEXT[]),  -- Eclaire
    (3130, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3130/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3130/2.png']::TEXT[]),  -- Eclaire Banoffi
    (3131, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3131/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3131/2.png']::TEXT[]),  -- Eclaire Pistache
    (3132, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3132/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3132/2.png']::TEXT[]),  -- Ejaazi
    (3133, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3133/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3133/2.png']::TEXT[]),  -- Atlas
    (3134, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3134/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3134/2.png']::TEXT[]),  -- Al Noble Ameer
    (3135, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3135/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3135/2.png']::TEXT[]),  -- Al Noble Wazeer
    (3136, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3136/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3136/2.png']::TEXT[]),  -- Maahir Black Edition
    (3137, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3137/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3137/2.png']::TEXT[]),  -- Maahir Legacy
    (3138, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3138/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3138/2.png']::TEXT[]),  -- Maahir Gold Edition
    (3139, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3139/1.png']::TEXT[]),  -- His Confession
    (3140, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3140/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3140/2.png']::TEXT[]),  -- Her Confession
    (3141, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3141/1.png']::TEXT[]),  -- Afeef
    (3142, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3142/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3142/2.png']::TEXT[]),  -- Teriaq
    (3143, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3143/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3143/2.png']::TEXT[]),  -- Teriaq Intense
    (3144, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3144/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3144/2.png']::TEXT[]),  -- Musamam White Intense
    (3145, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3145/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3145/2.png']::TEXT[]),  -- Musamam Black Intense
    (3146, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3146/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3146/2.png']::TEXT[]),  -- Hayaati Black
    (3147, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3147/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3147/2.png']::TEXT[]),  -- Hayaati Florence
    (3148, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3148/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3148/2.png']::TEXT[]),  -- Hayaati Gold Elixir
    (3149, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3149/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3149/2.png']::TEXT[]),  -- Hayaati Al Maleky
    (3150, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3150/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3150/2.png']::TEXT[]),  -- Now (by RAVE)
    (3151, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3151/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3151/2.png']::TEXT[]),  -- Now Women (by RAVE)

    -- ARMAF
    (3200, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3200/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3200/2.png']::TEXT[]),  -- Club de Nuit Intense Man
    (3201, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3201/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3201/2.png']::TEXT[]),  -- Club de Nuit Intense Woman
    (3202, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3202/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3202/2.png']::TEXT[]),  -- Club de Nuit Woman
    (3203, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3203/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3203/2.png']::TEXT[]),  -- Club de Nuit Sillage
    (3204, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3204/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3204/2.png']::TEXT[]),  -- Club de Nuit Blue Iconic
    (3205, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3205/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3205/2.png']::TEXT[]),  -- Club de Nuit Milestone
    (3206, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3206/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3206/2.png']::TEXT[]),  -- Club De Nuit Maleka
    (3207, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3207/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3207/2.png']::TEXT[]),  -- Club De Nuit Urban Man
    (3208, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3208/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3208/2.png']::TEXT[]),  -- Club De Nuit Urban Man Elixir
    (3209, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3209/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3209/2.png']::TEXT[]),  -- Club de Nuit Intense Man Limited Edition Parfum
    (3210, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3210/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3210/2.png']::TEXT[]),  -- Club de Nuit Untold
    (3211, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3211/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3211/2.png']::TEXT[]),  -- Club de Nuit Precieux I
    (3212, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3212/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3212/2.png']::TEXT[]),  -- Club de Nuit Precieux IV
    (3218, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3218/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3218/2.png']::TEXT[]),  -- Odyssey Mandarin Sky
    (3219, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3219/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3219/2.png']::TEXT[]),  -- Odyssey Aoud
    (3220, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3220/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3220/2.png']::TEXT[]),  -- Odyssey Homme White Edition
    (3221, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3221/1.png']::TEXT[]),  -- Bucephalus X
    (3222, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3222/1.png']::TEXT[]),  -- Derby Club House

    -- FRENCH AVENUE
    (3300, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3300/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3300/2.png']::TEXT[]),  -- Liquid Brun
    (3303, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3303/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3303/2.png']::TEXT[]),  -- Vulcan Feu
    (3304, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3304/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3304/2.png']::TEXT[]),  -- Vulcan Baie
    (3305, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3305/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3305/2.png']::TEXT[]),  -- Vulcan Sable
    (3306, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3306/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3306/2.png']::TEXT[]),  -- Spectre Ghost
    (3307, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3307/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3307/2.png']::TEXT[]),  -- Spectre Wraith
    (3308, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3308/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3308/2.png']::TEXT[]),  -- Sh'mallow Fluff
    (3309, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3309/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3309/2.png']::TEXT[]),  -- Aether Extrait
    (3310, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3310/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3310/2.png']::TEXT[]),  -- Aromatix - Carnal Desire

    -- AFNAN
    (3400, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3400/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3400/2.png']::TEXT[]),  -- 9pm
    (3401, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3401/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3401/2.png']::TEXT[]),  -- 9 PM Rebel
    (3402, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3402/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3402/2.png']::TEXT[]),  -- 9PM Elixir
    (3403, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3403/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3403/2.png']::TEXT[]),  -- 9PM Night Out
    (3405, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3405/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3405/2.png']::TEXT[]),  -- Supremacy Collector's Edition Pour Homme
    (3406, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3406/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3406/2.png']::TEXT[]),  -- Supremacy Not Only Intense
    (3407, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3407/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3407/2.png']::TEXT[]),  -- Supremacy Silver
    (3408, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3408/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3408/2.png']::TEXT[]),  -- Turathi Blue

    -- AL HARAMAIN
    (3500, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3500/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3500/2.png']::TEXT[]),  -- Amber Oud Gold Edition
    (3501, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3501/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3501/2.png']::TEXT[]),  -- Amber Oud Aqua Dubai
    (3502, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3502/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3502/2.png']::TEXT[]),  -- Amber Oud Dubai Night
    (3503, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3503/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/cutout/3503/2.png']::TEXT[])   -- Amber Oud Ruby Edition
)
UPDATE public.products AS p
SET image_url  = s.urls[1],
    image_urls = s.urls
FROM shots AS s
WHERE p.id = s.id;

-- ── Prove it landed ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_cutout      INT;
    v_stale       INT;
    v_broken      INT;
    v_placeholder INT;
BEGIN
    SELECT count(*) INTO v_cutout
    FROM public.products WHERE image_url LIKE '%/product-images/cutout/%';
    IF v_cutout <> 101 THEN
        RAISE EXCEPTION 'expected 101 products on cut-out photography, got %.', v_cutout;
    END IF;

    -- nothing may still point at migration 61's un-cut originals
    SELECT count(*) INTO v_stale
    FROM public.products WHERE image_url LIKE '%/product-images/products/%';
    IF v_stale > 0 THEN
        RAISE EXCEPTION '% products still point at the un-cut originals.', v_stale;
    END IF;

    SELECT count(*) INTO v_broken
    FROM public.products
    WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0
      AND image_url IS DISTINCT FROM image_urls[1];
    IF v_broken > 0 THEN
        RAISE EXCEPTION '% products have image_url out of step with image_urls[1].', v_broken;
    END IF;

    SELECT count(*) INTO v_placeholder
    FROM public.products WHERE image_url = '/placeholder-bottle.png';
    RAISE NOTICE '% products on cut-out photography; % still on the placeholder.',
        v_cutout, v_placeholder;
END $$;

COMMIT;
