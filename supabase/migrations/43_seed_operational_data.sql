-- ============================================================================
-- 43. Operational data repair + stock seeding
--
-- Fixes two things found by auditing the live database against the front end:
--
--   1. `order_tracking` holds 8 rows pointing at ORD-9922, ORD-9923 and
--      ORD-2547 — none of which exist in `orders`. They are leftovers from an
--      early seed. They surface as ghost entries in the admin tracking view and
--      would attach themselves to any future order that reuses those ids.
--
--   2. `inventory` is completely empty. `place_order` only enforces stock for
--      (product_id, size) pairs that HAVE a row, so with an empty table every
--      one of the 138 products sells without limit, the admin Inventory tab
--      shows nothing, and "inventory is decremented" is not true of any order.
--
-- The stock figure seeded here is a placeholder so the stock path is wired and
-- demonstrable end to end. Replace it with your real counts in the admin
-- Inventory Tracker before you start selling.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Remove tracking rows whose order no longer exists
-- ---------------------------------------------------------------------------

DELETE FROM public.order_tracking t
WHERE NOT EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = t.order_id
);

-- Stop it happening again. The column was declared with a REFERENCES clause in
-- migration 03, but the orphans prove the constraint is not actually present on
-- this database — add it if it is missing.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'order_tracking_order_id_fkey'
          AND conrelid = 'public.order_tracking'::regclass
    ) THEN
        ALTER TABLE public.order_tracking
            ADD CONSTRAINT order_tracking_order_id_fkey
            FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Give every catalogue line a stock row
--
-- One row per (product, size) using each product's own `sizes` array, so the
-- size a shopper picks on the product page is the size that gets decremented.
-- ---------------------------------------------------------------------------

INSERT INTO public.inventory (product_id, size, stock_level, low_stock_threshold)
SELECT p.id, s.size, 25, 5
FROM public.products p
CROSS JOIN LATERAL unnest(
    CASE
        WHEN p.sizes IS NULL OR array_length(p.sizes, 1) IS NULL THEN ARRAY['50ml']
        ELSE p.sizes
    END
) AS s(size)
ON CONFLICT (product_id, size) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Verification (run after applying):
--
--   SELECT count(*) FROM public.inventory;            -- expect ~1 per product-size
--   SELECT count(*) FROM public.order_tracking t
--     WHERE NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = t.order_id);
--                                                     -- expect 0
-- ---------------------------------------------------------------------------
