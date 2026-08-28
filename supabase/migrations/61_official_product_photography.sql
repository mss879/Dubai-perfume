-- Migration 61: Official product photography for the catalogue
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- 192 images for 100 of 138 products, sourced from each brand's OWN online
-- store and copied into this project's public product-images bucket. Nothing is hotlinked:
-- next.config.ts sets img-src to 'self' data: blob: https://*.supabase.co, so an external URL
-- would render as a broken image, and next/image only whitelists the Supabase storage host.
--
-- Sources, all first-party:
--     Rasasi          rasasistore.com + rasasionline.com
--     Lattafa         lattafa.com
--     Armaf           armaf.com
--     Afnan           afnan.com
--     Al Haramain     shop.alharamainperfumes.com
--     French Avenue   frenchavenue.com
--
-- Every URL below was downloaded, decoded, checked to be at least 400px on the short side, and
-- byte-hashed so the same photograph could not be reused across two different products. Then
-- each file was uploaded and read back from the public bucket at HTTP 200. The images were also
-- reviewed by eye against the product names before this file was written. Median short side is
-- 2048px; the whole set is 83MB.
--
-- image_url takes the first image (the card and hero thumbnail); image_urls takes the full set
-- for the product-page gallery. Products with no image are LEFT ALONE on the placeholder rather
-- than given a near-miss bottle from a different flanker.
--
-- 38 products have no official image. Their brands do not publish one on their own store,
-- and the only pictures available are on marketplaces and fan sites, which carry other retailers'
-- watermarks and copyright. These keep /placeholder-bottle.png:
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
--     3310  French Avenue Aromatix - Carnal Desire
--     3311  French Avenue Bourbon Cafe
--     3404  Afnan Supremacy Silver Limited Edition
--
-- 8 products have only ONE image, so their gallery will not have a second angle:
--     3029  Rasasi Blue for Men
--     3030  Rasasi Blue Lady
--     3105  Lattafa Yara Candy
--     3127  Lattafa Mayar Cherry Intense
--     3139  Lattafa His Confession
--     3141  Lattafa Afeef
--     3221  Armaf Bucephalus X
--     3222  Armaf Derby Club House
--
-- LICENSING: this is the manufacturers' own product photography. Using it as an authorised
-- reseller is the normal arrangement, but confirm with your distributor that your reseller terms
-- cover it before launch.
--
-- Re-running is safe: one UPDATE keyed on product id, no inserts, no deletes.

BEGIN;

WITH shots (id, urls) AS (
    VALUES
    -- RASASI
    (3000, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3000/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3000/2.jpg']::TEXT[]),  -- Hawas (for Him)  [503x503 / 503x670]
    (3001, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3001/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3001/2.jpg']::TEXT[]),  -- Hawas Ice  [2048x2048 / 2048x2728]
    (3002, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3002/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3002/2.jpg']::TEXT[]),  -- Hawas for Her  [2048x2048 / 2048x2728]
    (3003, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3003/1.webp', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3003/2.webp']::TEXT[]),  -- Diva  [1500x1500 / 1920x1920]
    (3009, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3009/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3009/2.jpg']::TEXT[]),  -- Hawas Fire  [2048x2048 / 2048x2165]
    (3010, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3010/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3010/2.jpg']::TEXT[]),  -- Hawas Atlantis  [2048x2048 / 2048x2728]
    (3011, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3011/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3011/2.jpg']::TEXT[]),  -- Hawas Viper  [2048x2048 / 2048x2728]
    (3012, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3012/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3012/2.jpg']::TEXT[]),  -- Hawas Sapphire  [2000x2000 / 2000x2000]
    (3014, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3014/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3014/2.png']::TEXT[]),  -- Hawas Pink  [2048x2048 / 2048x2048]
    (3029, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3029/1.webp']::TEXT[]),  -- Blue for Men  [800x800]
    (3030, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3030/1.webp']::TEXT[]),  -- Blue Lady  [800x800]
    (3031, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3031/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3031/2.jpg']::TEXT[]),  -- La Yuqawam Homme  [2048x2728 / 2048x2728]
    (3032, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3032/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3032/2.jpg']::TEXT[]),  -- La Yuqawam Femme  [2048x2728 / 2048x2728]
    (3033, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3033/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3033/2.jpg']::TEXT[]),  -- Daarej Pour Homme  [2048x2728 / 2048x2728]
    (3035, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3035/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3035/2.jpg']::TEXT[]),  -- Daarej Pour Femme  [2048x2728 / 2048x2728]

    -- LATTAFA
    (3100, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3100/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3100/2.jpg']::TEXT[]),  -- Khamrah  [2560x2560 / 2560x2560]
    (3101, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3101/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3101/2.jpg']::TEXT[]),  -- Khamrah Qahwa  [2560x2560 / 2560x2560]
    (3102, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3102/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3102/2.jpg']::TEXT[]),  -- Khamrah Dukhan  [2056x2560 / 2560x2170]
    (3103, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3103/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3103/2.jpg']::TEXT[]),  -- Yara  [2560x2560 / 2560x2560]
    (3105, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3105/1.png']::TEXT[]),  -- Yara Candy  [1170x2362]
    (3106, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3106/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3106/2.jpg']::TEXT[]),  -- Yara Tous  [2560x2560 / 2560x2560]
    (3107, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3107/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3107/2.jpg']::TEXT[]),  -- Asad  [2480x2480 / 2560x2560]
    (3109, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3109/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3109/2.jpg']::TEXT[]),  -- Asad Bourbon  [1214x2560 / 2089x2560]
    (3110, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3110/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3110/2.jpg']::TEXT[]),  -- Asad Zanzibar  [2560x2560 / 2560x2560]
    (3111, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3111/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3111/2.jpg']::TEXT[]),  -- Badee Al Oud Oud for Glory  [2560x2560 / 2560x2560]
    (3112, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3112/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3112/2.jpg']::TEXT[]),  -- Badee Al Oud Sublime  [2560x2560 / 2560x2560]
    (3113, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3113/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3113/2.jpg']::TEXT[]),  -- Badee Al Oud Honor and Glory  [2560x2560 / 2560x2560]
    (3114, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3114/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3114/2.jpg']::TEXT[]),  -- Badee Al Oud Amethyst (Purple)  [1754x1754 / 1754x1754]
    (3115, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3115/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3115/2.jpg']::TEXT[]),  -- Badee Al Oud Noble Blush (Pink)  [1142x1772 / 2048x2560]
    (3116, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3116/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3116/2.jpg']::TEXT[]),  -- Fakhar Black  [2560x2560 / 2560x2560]
    (3118, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3118/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3118/2.png']::TEXT[]),  -- Fakhar Gold  [2560x2560 / 2480x2480]
    (3119, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3119/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3119/2.jpg']::TEXT[]),  -- Fakhar Rose Gold  [2480x2480 / 2560x2560]
    (3120, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3120/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3120/2.png']::TEXT[]),  -- Ameerat Al Arab (Red)  [1024x1024 / 1024x1024]
    (3122, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3122/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3122/2.jpg']::TEXT[]),  -- Ameerat Al Arab Prive Rose  [2560x2560 / 2560x2560]
    (3123, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3123/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3123/2.jpg']::TEXT[]),  -- Ana Abiyedh  [2560x2560 / 2560x2560]
    (3124, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3124/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3124/2.jpg']::TEXT[]),  -- Ana Abiyedh Coral  [1209x2560 / 1637x2560]
    (3126, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3126/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3126/2.jpg']::TEXT[]),  -- Mayar Pink  [2560x2560 / 2560x2560]
    (3127, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3127/1.jpg']::TEXT[]),  -- Mayar Cherry Intense  [1116x2560]
    (3128, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3128/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3128/2.jpg']::TEXT[]),  -- Mayar Natural Intense  [2560x2560 / 2560x2560]
    (3129, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3129/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3129/2.jpg']::TEXT[]),  -- Eclaire  [2560x2560 / 2560x2560]
    (3130, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3130/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3130/2.jpg']::TEXT[]),  -- Eclaire Banoffi  [1087x2560 / 1805x2560]
    (3131, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3131/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3131/2.jpg']::TEXT[]),  -- Eclaire Pistache  [1084x2560 / 1736x2560]
    (3132, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3132/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3132/2.jpg']::TEXT[]),  -- Ejaazi  [2560x2560 / 2560x2560]
    (3133, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3133/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3133/2.png']::TEXT[]),  -- Atlas  [3508x2480 / 3508x2480]
    (3134, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3134/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3134/2.jpg']::TEXT[]),  -- Al Noble Ameer  [2560x2560 / 2560x2560]
    (3135, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3135/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3135/2.jpg']::TEXT[]),  -- Al Noble Wazeer  [2560x2560 / 2560x2560]
    (3136, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3136/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3136/2.jpg']::TEXT[]),  -- Maahir Black Edition  [2560x2560 / 2560x2560]
    (3137, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3137/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3137/2.jpg']::TEXT[]),  -- Maahir Legacy  [2560x2560 / 2560x2560]
    (3138, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3138/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3138/2.jpg']::TEXT[]),  -- Maahir Gold Edition  [2480x2480 / 2560x2560]
    (3139, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3139/1.jpg']::TEXT[]),  -- His Confession  [2194x2560]
    (3140, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3140/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3140/2.jpg']::TEXT[]),  -- Her Confession  [2162x2560 / 1668x2560]
    (3141, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3141/1.png']::TEXT[]),  -- Afeef  [2097x3121]
    (3142, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3142/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3142/2.jpg']::TEXT[]),  -- Teriaq  [2560x2560 / 2560x2560]
    (3143, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3143/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3143/2.jpg']::TEXT[]),  -- Teriaq Intense  [702x1600 / 1102x1600]
    (3144, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3144/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3144/2.jpg']::TEXT[]),  -- Musamam White Intense  [1025x2245 / 2560x2560]
    (3145, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3145/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3145/2.jpg']::TEXT[]),  -- Musamam Black Intense  [1500x1500 / 1500x1500]
    (3146, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3146/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3146/2.jpg']::TEXT[]),  -- Hayaati Black  [2560x2560 / 2560x2560]
    (3147, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3147/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3147/2.jpg']::TEXT[]),  -- Hayaati Florence  [2560x2560 / 2560x2560]
    (3148, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3148/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3148/2.jpg']::TEXT[]),  -- Hayaati Gold Elixir  [2560x2560 / 2560x2560]
    (3149, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3149/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3149/2.jpg']::TEXT[]),  -- Hayaati Al Maleky  [2560x2560 / 2560x2560]
    (3150, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3150/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3150/2.jpg']::TEXT[]),  -- Now (by RAVE)  [2560x2560 / 2560x2560]
    (3151, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3151/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3151/2.jpg']::TEXT[]),  -- Now Women (by RAVE)  [2560x2560 / 2560x2560]

    -- ARMAF
    (3200, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3200/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3200/2.jpg']::TEXT[]),  -- Club de Nuit Intense Man  [2048x2048 / 2048x2048]
    (3201, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3201/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3201/2.jpg']::TEXT[]),  -- Club de Nuit Intense Woman  [900x900 / 756x756]
    (3202, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3202/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3202/2.jpg']::TEXT[]),  -- Club de Nuit Woman  [2048x2048 / 756x756]
    (3203, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3203/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3203/2.jpg']::TEXT[]),  -- Club de Nuit Sillage  [2048x2048 / 756x756]
    (3204, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3204/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3204/2.jpg']::TEXT[]),  -- Club de Nuit Blue Iconic  [1600x1600 / 756x757]
    (3205, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3205/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3205/2.jpg']::TEXT[]),  -- Club de Nuit Milestone  [2048x2048 / 756x756]
    (3206, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3206/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3206/2.jpg']::TEXT[]),  -- Club De Nuit Maleka  [900x900 / 756x756]
    (3207, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3207/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3207/2.jpg']::TEXT[]),  -- Club De Nuit Urban Man  [756x756 / 756x756]
    (3208, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3208/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3208/2.jpg']::TEXT[]),  -- Club De Nuit Urban Man Elixir  [2048x2048 / 756x756]
    (3209, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3209/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3209/2.jpg']::TEXT[]),  -- Club de Nuit Intense Man Limited Edition Parfum  [756x756 / 756x756]
    (3210, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3210/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3210/2.jpg']::TEXT[]),  -- Club de Nuit Untold  [2048x2048 / 756x756]
    (3211, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3211/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3211/2.jpg']::TEXT[]),  -- Club de Nuit Precieux I  [2048x2048 / 756x756]
    (3212, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3212/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3212/2.jpg']::TEXT[]),  -- Club de Nuit Precieux IV  [900x900 / 756x756]
    (3218, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3218/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3218/2.jpg']::TEXT[]),  -- Odyssey Mandarin Sky  [1200x1200 / 900x900]
    (3219, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3219/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3219/2.jpg']::TEXT[]),  -- Odyssey Aoud  [756x756 / 756x756]
    (3220, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3220/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3220/2.jpg']::TEXT[]),  -- Odyssey Homme White Edition  [756x756 / 756x756]
    (3221, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3221/1.jpg']::TEXT[]),  -- Bucephalus X  [1600x1600]
    (3222, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3222/1.jpg']::TEXT[]),  -- Derby Club House  [1600x1600]

    -- FRENCH AVENUE
    (3300, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3300/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3300/2.jpg']::TEXT[]),  -- Liquid Brun  [1334x2000 / 1334x2000]
    (3303, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3303/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3303/2.jpg']::TEXT[]),  -- Vulcan Feu  [1334x2000 / 1334x2000]
    (3304, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3304/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3304/2.jpg']::TEXT[]),  -- Vulcan Baie  [2048x3070 / 2048x3070]
    (3305, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3305/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3305/2.jpg']::TEXT[]),  -- Vulcan Sable  [1334x2000 / 1334x2000]
    (3306, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3306/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3306/2.jpg']::TEXT[]),  -- Spectre Ghost  [1334x2000 / 1334x2000]
    (3307, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3307/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3307/2.jpg']::TEXT[]),  -- Spectre Wraith  [1334x2000 / 1334x2000]
    (3308, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3308/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3308/2.jpg']::TEXT[]),  -- Sh'mallow Fluff  [2048x3071 / 2048x3071]
    (3309, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3309/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3309/2.jpg']::TEXT[]),  -- Aether Extrait  [1334x2000 / 1334x2000]

    -- AFNAN
    (3400, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3400/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3400/2.jpg']::TEXT[]),  -- 9pm  [1080x1080 / 1080x1080]
    (3401, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3401/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3401/2.png']::TEXT[]),  -- 9 PM Rebel  [1080x1080 / 1080x1080]
    (3402, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3402/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3402/2.png']::TEXT[]),  -- 9PM Elixir  [2000x2000 / 2000x2000]
    (3403, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3403/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3403/2.png']::TEXT[]),  -- 9PM Night Out  [2000x2000 / 2000x2000]
    (3405, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3405/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3405/2.png']::TEXT[]),  -- Supremacy Collector's Edition Pour Homme  [2880x2880 / 2880x2880]
    (3406, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3406/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3406/2.jpg']::TEXT[]),  -- Supremacy Not Only Intense  [1080x1080 / 1080x1080]
    (3407, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3407/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3407/2.jpg']::TEXT[]),  -- Supremacy Silver  [1080x1080 / 1080x1080]
    (3408, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3408/1.png', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3408/2.png']::TEXT[]),  -- Turathi Blue  [2000x2000 / 2000x2000]

    -- AL HARAMAIN
    (3500, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3500/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3500/2.jpg']::TEXT[]),  -- Amber Oud Gold Edition  [1080x1080 / 1080x1080]
    (3501, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3501/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3501/2.jpg']::TEXT[]),  -- Amber Oud Aqua Dubai  [1080x1080 / 1080x1080]
    (3502, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3502/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3502/2.jpg']::TEXT[]),  -- Amber Oud Dubai Night  [1080x1080 / 1080x1080]
    (3503, ARRAY['https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3503/1.jpg', 'https://oinvkhwaljobqhrocqky.supabase.co/storage/v1/object/public/product-images/products/3503/2.jpg']::TEXT[])   -- Amber Oud Ruby Edition  [1080x1080 / 1080x1080]
)
UPDATE public.products AS p
SET image_url  = s.urls[1],
    image_urls = s.urls
FROM shots AS s
WHERE p.id = s.id;

-- ── Prove it landed ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_updated     INT;
    v_placeholder INT;
    v_broken      INT;
BEGIN
    SELECT count(*) INTO v_updated
    FROM public.products
    WHERE image_url LIKE '%/storage/v1/object/public/product-images/products/%';
    IF v_updated <> 100 THEN
        RAISE EXCEPTION 'expected 100 products to take real photography, got %.', v_updated;
    END IF;

    -- image_url must always be the first entry of image_urls, or the card and the
    -- gallery disagree about which shot leads.
    SELECT count(*) INTO v_broken
    FROM public.products
    WHERE image_urls IS NOT NULL
      AND array_length(image_urls, 1) > 0
      AND image_url IS DISTINCT FROM image_urls[1];
    IF v_broken > 0 THEN
        RAISE EXCEPTION '% products have image_url out of step with image_urls[1].', v_broken;
    END IF;

    SELECT count(*) INTO v_placeholder
    FROM public.products WHERE image_url = '/placeholder-bottle.png';
    RAISE NOTICE '% products now carry official photography; % still on the placeholder.',
        v_updated, v_placeholder;
END $$;

COMMIT;
