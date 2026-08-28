-- Migration 60: Real cost, retail and compare-at pricing for the whole catalogue
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Sources, both supplied by the owner, both 139 rows, and they line up one-to-one:
--   "Perfume Price.xlsx"   -> Pricing (Cost)  ->  products.cost_price
--   "fragrance_list.xlsx"  -> Price (AED)     ->  products.compare_at_price
--
-- Owner's pricing rule: the fragrance-list figure is the "was" price shown struck through, the
-- shelf price is 10% off it, and every shelf price ends in .49 or .99. So the shelf price is
-- ROUND(compare_at_price * 0.90, 2) nudged to whichever nearby .49 or .99 sits closest.
--
-- What this file does
--   1. Adds products.compare_at_price, the struck-through "was" figure. Nullable, because NULL
--      simply means "no was-price, show the plain price".
--   2. Writes compare_at_price and price for all 138 products, retiring the AED 199.00
--      placeholder that migration 37 seeded on every single row.
--   3. Writes cost_price for the 127 products that carry a cost in the sheet.
--   4. Leaves brand, name, sizes, gender tags and the note pyramids alone. All 414 note fields
--      were compared against both spreadsheets on the live database before this file was
--      written and every one matched exactly, so there is nothing there to correct.
--
-- Margin: no product sells below cost. These 6 keep under 15%:
--     3030  RASASI Blue Lady                                   cost   29.00   sells   32.99   keeps   3.99
--     3101  LATTAFA Khamrah Qahwa                              cost   64.00   sells   71.99   keeps   7.99
--     3122  LATTAFA Ameerat Al Arab Prive Rose                 cost   33.00   sells   35.99   keeps   2.99
--     3401  AFNAN 9 PM Rebel                                   cost   97.00   sells  107.99   keeps  10.99
--     3403  AFNAN 9PM Night Out                                cost  132.00   sells  134.99   keeps   2.99
--     3405  AFNAN Supremacy Collector's Edition Pour Homme     cost  152.00   sells  161.99   keeps   9.99
--
-- Rounding to the nearest .49 / .99 lands these 5 a hair under a full 10% off. The
-- storefront makes no "10% off" claim - it shows the two prices and lets them speak - so this
-- is cosmetic, but it is here so nobody is surprised by it later:
--     3115  LATTAFA Badee Al Oud Noble Blush (Pink)            was  147.00   sells  132.49   (9.87% off)
--     3118  LATTAFA Fakhar Gold                                was   72.00   sells   64.99   (9.74% off)
--     3144  LATTAFA Musamam White Intense                      was  206.00   sells  185.49   (9.96% off)
--     3145  LATTAFA Musamam Black Intense                      was  206.00   sells  185.49   (9.96% off)
--     3309  FRENCH AVENUE Aether Extrait                       was  162.00   sells  145.99   (9.88% off)
--
-- These 11 products have no cost in "Perfume Price.xlsx", so their cost_price is left
-- untouched at 0.00 and every margin report will read them as pure profit until you fill it in:
--     3012  RASASI Hawas Sapphire
--     3015  RASASI Hawas Exotic
--     3016  RASASI Hawas Highness
--     3017  RASASI Hawas Lava Gold
--     3018  RASASI Hawas Overdose
--     3024  RASASI Hawas Addiction
--     3103  LATTAFA Yara
--     3132  LATTAFA Ejaazi
--     3134  LATTAFA Al Noble Ameer
--     3135  LATTAFA Al Noble Wazeer
--     3308  FRENCH AVENUE Sh'mallow Fluff
--
-- NOTE FOR THE STOREFRONT: AED used to render with zero decimals, which would have shown
-- 139.49 as "AED 139" and thrown the charm ending away. src/app/lib/currency-shared.ts now
-- formats AED with two decimals. Run this migration BEFORE deploying that code - the catalogue
-- pages name compare_at_price in their SELECT, and PostgREST fails the whole query on a column
-- that does not exist yet.
--
-- Re-running this file is safe: one UPDATE keyed on product id, no inserts, no deletes, and
-- the ALTER is guarded with IF NOT EXISTS.

BEGIN;

-- ── 1. The struck-through "was" price ───────────────────────────────────────────────────────
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10, 2);

COMMENT ON COLUMN public.products.compare_at_price IS
    'Recommended retail price, shown struck through beside price. NULL, or any value not above '
    'price, means the storefront shows no was-price.';

-- Refuse a negative was-price coming from the admin panel.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.products'::regclass
          AND conname  = 'products_compare_at_price_non_negative'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT products_compare_at_price_non_negative
            CHECK (compare_at_price IS NULL OR compare_at_price >= 0);
    END IF;
END $$;

-- ── 2. Was-price, shelf price and cost, per product ─────────────────────────────────────────
-- Columns: (product id, compare_at_price, price, cost_price)
-- A NULL cost means the sheet had none, and the row keeps whatever cost_price it already holds.
WITH sheet (id, compare_at_price, price, cost_price) AS (
    VALUES
    -- RASASI
    (3000, 155.00, 139.49, 56.00),
    (3001, 175.00, 157.49, 56.00),
    (3002, 155.00, 139.49, 56.00),
    (3003, 175.00, 157.49, 49.00),
    (3004, 175.00, 157.49, 49.00),
    (3005, 175.00, 157.49, 55.00),
    (3006, 175.00, 157.49, 73.00),
    (3007, 175.00, 157.49, 57.00),
    (3008, 175.00, 157.49, 46.00),
    (3009, 175.00, 157.49, 77.00),
    (3010, 175.00, 157.49, 82.00),
    (3011, 175.00, 157.49, 82.00),
    (3012, 175.00, 157.49, NULL),  -- no cost in the sheet
    (3013, 175.00, 157.49, 72.00),
    (3014, 175.00, 157.49, 75.00),
    (3015, 175.00, 157.49, NULL),  -- no cost in the sheet
    (3016, 175.00, 157.49, NULL),  -- no cost in the sheet
    (3017, 175.00, 157.49, NULL),  -- no cost in the sheet
    (3018, 175.00, 157.49, NULL),  -- no cost in the sheet
    (3019, 175.00, 157.49, 72.00),
    (3020, 175.00, 157.49, 65.00),
    (3021, 175.00, 157.49, 75.00),
    (3022, 175.00, 157.49, 77.00),
    (3023, 175.00, 157.49, 72.00),
    (3024, 175.00, 157.49, NULL),  -- no cost in the sheet
    (3025, 175.00, 157.49, 73.00),
    (3026, 175.00, 157.49, 73.00),
    (3027, 175.00, 157.49, 56.00),
    (3028, 175.00, 157.49, 56.00),
    (3029, 47.25, 42.49, 31.00),
    (3030, 36.75, 32.99, 29.00),  -- thin: cost 29.00, keeps 3.99
    (3031, 275.00, 247.49, 102.00),
    (3032, 275.00, 247.49, 102.00),
    (3033, 55.00, 49.49, 32.00),
    (3034, 55.00, 49.49, 32.00),
    (3035, 55.00, 49.49, 32.00),
    (3036, 55.00, 49.49, 32.00),
    (3037, 55.00, 49.49, 32.00),

    -- LATTAFA
    (3100, 90.00, 80.99, 64.00),
    (3101, 80.00, 71.99, 64.00),  -- thin: cost 64.00, keeps 7.99
    (3102, 90.00, 80.99, 64.00),
    (3103, 75.00, 67.49, NULL),  -- no cost in the sheet
    (3104, 75.00, 67.49, 50.00),
    (3105, 75.00, 67.49, 50.00),
    (3106, 75.00, 67.49, 50.00),
    (3107, 80.00, 71.99, 50.00),
    (3108, 75.00, 67.49, 50.00),
    (3109, 85.00, 76.49, 50.00),
    (3110, 68.00, 60.99, 50.00),
    (3111, 160.00, 143.99, 54.00),
    (3112, 140.00, 125.99, 54.00),
    (3113, 140.00, 125.99, 54.00),
    (3114, 90.00, 80.99, 54.00),
    (3115, 147.00, 132.49, 54.00),
    (3116, 80.00, 71.99, 45.50),
    (3117, 80.00, 71.99, 45.50),
    (3118, 72.00, 64.99, 45.50),
    (3119, 85.00, 76.49, 45.50),
    (3120, 55.00, 49.49, 33.00),
    (3121, 55.00, 49.49, 33.00),
    (3122, 40.00, 35.99, 33.00),  -- thin: cost 33.00, keeps 2.99
    (3123, 50.00, 44.99, 36.00),
    (3124, 50.00, 44.99, 36.00),
    (3125, 50.00, 44.99, 36.00),
    (3126, 119.00, 106.99, 47.00),
    (3127, 119.00, 106.99, 47.00),
    (3128, 119.00, 106.99, 47.00),
    (3129, 183.00, 164.49, 68.00),
    (3130, 183.00, 164.49, 68.00),
    (3131, 183.00, 164.49, 68.00),
    (3132, 70.00, 62.99, NULL),  -- no cost in the sheet
    (3133, 155.00, 139.49, 62.00),
    (3134, 103.00, 92.49, NULL),  -- no cost in the sheet
    (3135, 103.00, 92.49, NULL),  -- no cost in the sheet
    (3136, 155.00, 139.49, 59.00),
    (3137, 155.00, 139.49, 59.00),
    (3138, 155.00, 139.49, 59.00),
    (3139, 230.00, 206.99, 87.00),
    (3140, 230.00, 206.99, 87.00),
    (3141, 225.00, 202.49, 87.00),
    (3142, 230.00, 206.99, 87.00),
    (3143, 230.00, 206.99, 87.00),
    (3144, 206.00, 185.49, 77.00),
    (3145, 206.00, 185.49, 77.00),
    (3146, 70.00, 62.99, 32.00),
    (3147, 70.00, 62.99, 32.00),
    (3148, 70.00, 62.99, 32.00),
    (3149, 70.00, 62.99, 32.00),
    (3150, 85.00, 76.49, 39.00),
    (3151, 85.00, 76.49, 39.00),

    -- ARMAF
    (3200, 155.00, 139.49, 75.00),  -- one product, two bottles: 105ml lists 155, 200ml lists 275. Priced off the 105ml.
    (3201, 125.00, 112.49, 65.00),
    (3202, 135.00, 121.49, 67.00),
    (3203, 260.00, 233.99, 97.00),
    (3204, 260.00, 233.99, 92.00),
    (3205, 180.00, 161.99, 82.00),
    (3206, 210.00, 188.99, 77.00),
    (3207, 120.00, 107.99, 72.00),
    (3208, 145.00, 130.49, 74.00),
    (3209, 350.00, 314.99, 167.00),
    (3210, 360.00, 323.99, 129.00),
    (3211, 350.00, 314.99, 112.00),
    (3212, 350.00, 314.99, 112.00),
    (3213, 140.00, 125.99, 49.50),
    (3214, 100.00, 89.99, 49.50),
    (3215, 100.00, 89.99, 49.50),
    (3216, 140.00, 125.99, 49.50),
    (3217, 140.00, 125.99, 49.50),
    (3218, 140.00, 125.99, 49.50),
    (3219, 140.00, 125.99, 49.50),
    (3220, 140.00, 125.99, 49.50),
    (3221, 140.00, 125.99, 49.50),
    (3222, 140.00, 125.99, 49.50),

    -- FRENCH AVENUE
    (3300, 124.00, 111.49, 72.00),
    (3301, 124.00, 111.49, 72.00),
    (3302, 124.00, 111.49, 72.00),
    (3303, 149.00, 133.99, 77.00),
    (3304, 149.00, 133.99, 77.00),
    (3305, 139.00, 124.99, 77.00),
    (3306, 113.00, 101.49, 77.00),
    (3307, 113.00, 101.49, 72.00),
    (3308, 120.00, 107.99, NULL),  -- no cost in the sheet
    (3309, 162.00, 145.99, 77.00),
    (3310, 198.00, 177.99, 92.00),
    (3311, 160.00, 143.99, 87.00),

    -- AFNAN
    (3400, 100.00, 89.99, 77.00),
    (3401, 120.00, 107.99, 97.00),  -- thin: cost 97.00, keeps 10.99
    (3402, 120.00, 107.99, 89.00),
    (3403, 150.00, 134.99, 132.00),  -- thin: cost 132.00, keeps 2.99
    (3404, 120.00, 107.99, 75.00),
    (3405, 180.00, 161.99, 152.00),  -- thin: cost 152.00, keeps 9.99
    (3406, 180.00, 161.99, 127.00),
    (3407, 120.00, 107.99, 82.00),
    (3408, 180.00, 161.99, 82.00),

    -- AL HARAMAIN
    (3500, 350.00, 314.99, 127.00),
    (3501, 400.00, 359.99, 119.00),
    (3502, 400.00, 359.99, 119.00),
    (3503, 450.00, 404.99, 137.00)
)
UPDATE public.products AS p
SET compare_at_price = s.compare_at_price::DECIMAL(10, 2),
    price            = s.price::DECIMAL(10, 2),
    cost_price       = COALESCE(s.cost_price, p.cost_price)::DECIMAL(10, 2)
FROM sheet AS s
WHERE p.id = s.id;

-- ── 3. Prove the update actually landed ─────────────────────────────────────────────────────
-- The storefront's write paths swallow their own errors, so this migration checks itself
-- rather than trusting a clean run.
DO $$
DECLARE
    v_total       INT;
    v_priced      INT;
    v_placeholder INT;
    v_not_charm   INT;
    v_no_saving   INT;
    v_off_target  INT;
    v_costed      INT;
    v_below_cost  INT;
    v_row         RECORD;
BEGIN
    SELECT count(*) INTO v_total  FROM public.products;
    SELECT count(*) INTO v_priced FROM public.products WHERE compare_at_price IS NOT NULL;

    IF v_total <> 138 THEN
        RAISE EXCEPTION 'expected 138 products, found %. The catalogue changed since this file was written; do not run it.', v_total;
    END IF;
    IF v_priced <> 138 THEN
        RAISE EXCEPTION 'only % of 138 products picked up a compare_at_price. Product ids no longer match the sheet.', v_priced;
    END IF;

    SELECT count(*) INTO v_placeholder FROM public.products WHERE price = 199.00;
    IF v_placeholder > 0 THEN
        RAISE EXCEPTION '% products are still sitting on the 199.00 placeholder.', v_placeholder;
    END IF;

    -- every shelf price must end in .49 or .99
    SELECT count(*) INTO v_not_charm
    FROM public.products
    WHERE (round(price * 100)::BIGINT % 100) NOT IN (49, 99);
    IF v_not_charm > 0 THEN
        RAISE EXCEPTION '% products do not end in .49 or .99.', v_not_charm;
    END IF;

    -- the struck-through price must actually be higher than what we charge
    SELECT count(*) INTO v_no_saving
    FROM public.products WHERE compare_at_price <= price;
    IF v_no_saving > 0 THEN
        RAISE EXCEPTION '% products would show a was-price at or below the selling price.', v_no_saving;
    END IF;

    -- and the shelf price must sit within one charm step of a true 10% off
    SELECT count(*) INTO v_off_target
    FROM public.products
    WHERE abs(price - round(compare_at_price * 0.90, 2)) > 0.51;
    IF v_off_target > 0 THEN
        RAISE EXCEPTION '% products are not within a rounding step of 10%% off.', v_off_target;
    END IF;

    SELECT count(*) INTO v_costed FROM public.products WHERE cost_price > 0;
    RAISE NOTICE 'Priced % products at ~10%% off, all ending .49 or .99. % carry a real cost, % are still at 0.00 and need one.',
        v_total, v_costed, v_total - v_costed;

    SELECT count(*) INTO v_below_cost
    FROM public.products WHERE cost_price > 0 AND price < cost_price;
    IF v_below_cost > 0 THEN
        RAISE WARNING '% products now sell BELOW COST:', v_below_cost;
        FOR v_row IN
            SELECT id, brand, name, cost_price, compare_at_price, price
            FROM public.products
            WHERE cost_price > 0 AND price < cost_price
            ORDER BY price - cost_price
        LOOP
            RAISE WARNING '    % % % - cost %, was %, sells % (loses %)',
                v_row.id, v_row.brand, v_row.name, v_row.cost_price,
                v_row.compare_at_price, v_row.price, v_row.price - v_row.cost_price;
        END LOOP;
    END IF;
END $$;

COMMIT;

-- ── After running ───────────────────────────────────────────────────────────────────────────
-- public.place_order re-prices every basket line from products.price on the server, so these
-- figures are live for customers the moment this commits. Nothing needs redeploying for the
-- prices themselves; the struck-through display ships with the storefront change.
