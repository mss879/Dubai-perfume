-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Migration 69: offers — bundles, buy-more-save-more, checkout add-ons and a free gift
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Automatic offers the shopper doesn't have to type in, priced by ONE calculation in the
-- database, offer_quote(), used by:
--   • bag_quote()      the bag and checkout preview (public, read-only),
--   • check_discount() so a code is priced after the offers, as the order will be,
--   • place_order()    the order itself (and so the amount Paymob is asked for).
-- The preview and the order can therefore never disagree.
--
-- Four kinds, in public.offers:
--   tiered  "Buy more, save more": with N or more qualifying perfumes in the bag, each of
--           them is X% off (optionally plus free delivery). count_by = 'same_product' counts
--           per perfume instead ("two of the same, 15% off": signature + backup).
--   bundle  A fixed set (a layering duo, His & Hers, a house trio, an occasion gift box) at a
--           set price or X% off, optionally with free delivery and gift wrapping.
--   addon   A checkout add-on: one unit of a chosen perfume at a special price, when the rest
--           of the bag is at least AED X (and, optionally, holds something from a scope).
--   gift    A free gift once the bag's goods, after offer savings, reach AED X.
--
-- Rules, in order: add-ons first (the shopper ticked a promised price), then fixed sets
-- (largest saving first), then tiered offers (best saving first, each once). A unit of a
-- perfume is in at most one offer. Then the gift is chosen. Free delivery is still decided
-- on the bag before any saving (AED 300, as lib/shipping.ts), exactly as before.
--
-- Discount codes and offers: a code discounts only the items that are NOT already in an
-- offer. A whole-order code with discounts.combines_with_offers = TRUE instead applies to the
-- whole bag after the offer savings. With no offers running, every code prices exactly as
-- in migration 67.
--
-- place_order() is migration 67's, with only the offer lines added (see the diff notes at
-- its head). Nothing about payments changes: the order total is still the one figure
-- order_payments.amount_fils is taken from, by the same expression.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
    v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF to_regclass('public.order_payments') IS NULL THEN
        v_missing := array_append(v_missing, 'public.order_payments (migration 63)');
    END IF;
    IF to_regprocedure('public.discount_quote(public.discounts, jsonb, numeric, numeric)') IS NULL THEN
        v_missing := array_append(v_missing, 'public.discount_quote (migration 67)');
    END IF;
    IF to_regclass('public.product_costs') IS NULL THEN
        v_missing := array_append(v_missing, 'public.product_costs (migration 68)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_published') THEN
        v_missing := array_append(v_missing, 'public.products.is_published (migration 64)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'collections' AND column_name = 'brand') THEN
        v_missing := array_append(v_missing, 'public.collections.brand (migration 24)');
    END IF;
    IF array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'Migration 69 stopped before changing anything. Missing: %', array_to_string(v_missing, ', ');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Tables and columns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offers (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL,
    -- Which admin template made it (buy_more, backup, layering, his_hers, house, occasion,
    -- addon, gift): wording and icons only, never pricing.
    template TEXT NOT NULL DEFAULT 'custom',
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    priority INT NOT NULL DEFAULT 0,
    -- What qualifies (tiered offers, and an add-on's "bag must hold" condition).
    scope TEXT NOT NULL DEFAULT 'all',
    scope_brands TEXT[] NOT NULL DEFAULT '{}',
    scope_collection_ids TEXT[] NOT NULL DEFAULT '{}',
    scope_product_ids INT[] NOT NULL DEFAULT '{}',
    count_by TEXT NOT NULL DEFAULT 'items',
    -- tiered: [{"min_qty": 2, "percent": 10, "free_delivery": true}, ...]
    tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- bundle: [{"product_id": 12, "size": "100ml" or "", "qty": 1}, ...]
    bundle_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    bundle_price NUMERIC(10, 2),
    bundle_percent NUMERIC(5, 2),
    free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
    gift_wrap BOOLEAN NOT NULL DEFAULT FALSE,
    -- addon / gift: the perfume offered.
    product_id INT,
    product_size TEXT,
    addon_price NUMERIC(10, 2),
    -- addon: the rest of the bag must reach this; gift: the bag must reach this.
    min_subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_shape_check;
ALTER TABLE public.offers ADD CONSTRAINT offers_shape_check CHECK (
        kind IN ('tiered', 'bundle', 'addon', 'gift')
    AND scope IN ('all', 'brands', 'collections', 'products')
    AND count_by IN ('items', 'same_product')
    AND length(btrim(title)) BETWEEN 1 AND 80
    AND (description IS NULL OR length(description) <= 300)
    AND (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
    AND min_subtotal >= 0
    AND cardinality(scope_brands) <= 20
    AND cardinality(scope_collection_ids) <= 50
    AND cardinality(scope_product_ids) <= 300
    AND (scope <> 'brands' OR cardinality(scope_brands) >= 1)
    AND (scope <> 'collections' OR cardinality(scope_collection_ids) >= 1)
    AND (scope <> 'products' OR cardinality(scope_product_ids) >= 1)
    AND (kind <> 'tiered' OR (jsonb_typeof(tiers) = 'array' AND jsonb_array_length(tiers) BETWEEN 1 AND 5))
    AND (kind <> 'bundle' OR (
            jsonb_typeof(bundle_lines) = 'array' AND jsonb_array_length(bundle_lines) BETWEEN 1 AND 6
        AND ((bundle_price IS NOT NULL) <> (bundle_percent IS NOT NULL))
        AND (bundle_price IS NULL OR bundle_price > 0)
        AND (bundle_percent IS NULL OR (bundle_percent > 0 AND bundle_percent <= 90))))
    AND (kind <> 'addon' OR (product_id IS NOT NULL AND addon_price IS NOT NULL AND addon_price >= 0))
    AND (kind <> 'gift' OR (product_id IS NOT NULL AND min_subtotal > 0))
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.offers FROM PUBLIC;
GRANT SELECT ON TABLE public.offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offers TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.offers_id_seq TO authenticated;

-- Shoppers see the offers running now (what the shop shows anyway); admins see all.
DROP POLICY IF EXISTS "Shop reads live offers" ON public.offers;
CREATE POLICY "Shop reads live offers"
    ON public.offers FOR SELECT TO anon, authenticated
    USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));
DROP POLICY IF EXISTS "Admins manage offers" ON public.offers;
CREATE POLICY "Admins manage offers"
    ON public.offers FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Which offers each order used, for the admin's order page and the offer's results.
CREATE TABLE IF NOT EXISTS public.order_offers (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    offer_id INT,               -- no foreign key: deleting an offer keeps the history
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    saving NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- for a gift: the gift's shop price
    units INT NOT NULL DEFAULT 0,
    gift_wrap BOOLEAN NOT NULL DEFAULT FALSE,
    free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_offers_order ON public.order_offers (order_id);
CREATE INDEX IF NOT EXISTS idx_order_offers_offer ON public.order_offers (offer_id);

ALTER TABLE public.order_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_offers FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.order_offers TO authenticated;
DROP POLICY IF EXISTS "Admins read order offers" ON public.order_offers;
CREATE POLICY "Admins read order offers"
    ON public.order_offers FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_saving NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS offer_id INT;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS combines_with_offers BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 2. Small helpers (internal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.offer_live(o public.offers)
RETURNS BOOLEAN AS $$
    SELECT o.is_active AND (o.starts_at IS NULL OR o.starts_at <= now()) AND (o.ends_at IS NULL OR o.ends_at >= now());
$$ LANGUAGE sql STABLE SET search_path = public, pg_temp;

-- Whether a perfume counts towards an offer's scope. "Collections" means hand-picked
-- members plus, for a brand page, every perfume of that brand: the rule the shop's
-- collection pages and discount codes (migration 67) use.
CREATE OR REPLACE FUNCTION public.offer_covers(o public.offers, p_product_id INT, p_brand TEXT)
RETURNS BOOLEAN AS $$
    SELECT CASE o.scope
        WHEN 'all' THEN TRUE
        WHEN 'brands' THEN upper(btrim(COALESCE(p_brand, ''))) IN (SELECT upper(btrim(b)) FROM unnest(o.scope_brands) b)
        WHEN 'products' THEN p_product_id = ANY(o.scope_product_ids)
        WHEN 'collections' THEN
               EXISTS (SELECT 1 FROM public.product_collections pc
                       WHERE pc.product_id = p_product_id AND pc.collection_id = ANY(o.scope_collection_ids))
            OR EXISTS (SELECT 1 FROM public.collections c
                       WHERE c.id = ANY(o.scope_collection_ids)
                         AND NULLIF(btrim(c.brand), '') IS NOT NULL
                         AND upper(btrim(c.brand)) = upper(btrim(COALESCE(p_brand, ''))))
        ELSE FALSE
    END;
$$ LANGUAGE sql STABLE SET search_path = public, pg_temp;

-- The highest tier the count reaches, or NULL.
CREATE OR REPLACE FUNCTION public.offer_tier(p_tiers JSONB, p_count INT)
RETURNS JSONB AS $$
    SELECT t FROM jsonb_array_elements(COALESCE(p_tiers, '[]'::jsonb)) t
    WHERE jsonb_typeof(t) = 'object' AND COALESCE(t->>'min_qty', '') ~ '^[0-9]{1,2}$'
      AND (t->>'min_qty')::INT BETWEEN 2 AND 20 AND (t->>'min_qty')::INT <= p_count
      AND COALESCE(t->>'percent', '0') ~ '^[0-9]{1,2}(\.[0-9]{1,2})?$'
    ORDER BY (t->>'min_qty')::INT DESC LIMIT 1;
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

-- The next tier above the count, or NULL.
CREATE OR REPLACE FUNCTION public.offer_next_tier(p_tiers JSONB, p_count INT)
RETURNS JSONB AS $$
    SELECT t FROM jsonb_array_elements(COALESCE(p_tiers, '[]'::jsonb)) t
    WHERE jsonb_typeof(t) = 'object' AND COALESCE(t->>'min_qty', '') ~ '^[0-9]{1,2}$'
      AND (t->>'min_qty')::INT BETWEEN 2 AND 20 AND (t->>'min_qty')::INT > p_count
      AND COALESCE(t->>'percent', '0') ~ '^[0-9]{1,2}(\.[0-9]{1,2})?$'
    ORDER BY (t->>'min_qty')::INT ASC LIMIT 1;
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

-- Sellable right now in that size: untracked (no stock row) or at least one in stock.
CREATE OR REPLACE FUNCTION public.offer_in_stock(p_product_id INT, p_size TEXT)
RETURNS BOOLEAN AS $$
    SELECT COALESCE((SELECT stock_level >= 1 FROM public.inventory
                     WHERE product_id = p_product_id AND size = COALESCE(p_size, '')), TRUE);
$$ LANGUAGE sql STABLE SET search_path = public, pg_temp;

-- A few words for what qualifies ("Lattafa", "the Oud collection"); NULL for everything.
CREATE OR REPLACE FUNCTION public.offer_scope_label(o public.offers)
RETURNS TEXT AS $$
DECLARE
    v_names TEXT;
    v_count INT;
BEGIN
    CASE o.scope
    WHEN 'brands' THEN
        SELECT string_agg(initcap(lower(btrim(b))), ' or ' ORDER BY b) INTO v_names FROM unnest(o.scope_brands) b;
        RETURN v_names;
    WHEN 'collections' THEN
        SELECT string_agg(c.title, ' or ' ORDER BY c.title) INTO v_names
        FROM public.collections c WHERE c.id = ANY(o.scope_collection_ids);
        RETURN COALESCE(v_names, 'the chosen collections');
    WHEN 'products' THEN
        SELECT string_agg(x.label, ', '), max(x.total) INTO v_names, v_count FROM (
            SELECT replace(p.name, '_', ' ') AS label, count(*) OVER () AS total
            FROM public.products p WHERE p.id = ANY(o.scope_product_ids)
            ORDER BY p.name LIMIT 3) x;
        v_count := cardinality(o.scope_product_ids);
        RETURN COALESCE(v_names, 'the chosen perfumes')
            || CASE WHEN v_count > 3 THEN ' and ' || (v_count - 3) || ' more' ELSE '' END;
    ELSE
        RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, pg_temp;

-- A fixed set's value at shop prices, and what the set costs.
CREATE OR REPLACE FUNCTION public.offer_bundle_base(o public.offers)
RETURNS NUMERIC AS $$
    SELECT COALESCE(sum(p.price * GREATEST(COALESCE((l->>'qty')::INT, 1), 1)), 0)
    FROM jsonb_array_elements(COALESCE(o.bundle_lines, '[]'::jsonb)) l
    JOIN public.products p ON p.id = (l->>'product_id')::INT;
$$ LANGUAGE sql STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.offer_bundle_price(o public.offers)
RETURNS NUMERIC AS $$
    SELECT CASE WHEN o.bundle_price IS NOT NULL THEN o.bundle_price
                ELSE round(public.offer_bundle_base(o) * (100 - COALESCE(o.bundle_percent, 0)) / 100, 2) END;
$$ LANGUAGE sql STABLE SET search_path = public, pg_temp;

-- Every perfume in the set exists and is on sale.
CREATE OR REPLACE FUNCTION public.offer_bundle_available(o public.offers)
RETURNS BOOLEAN AS $$
    SELECT jsonb_array_length(COALESCE(o.bundle_lines, '[]'::jsonb)) > 0
       AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(o.bundle_lines) l
            LEFT JOIN public.products p ON p.id = (l->>'product_id')::INT
            WHERE p.id IS NULL OR p.is_published IS FALSE);
$$ LANGUAGE sql STABLE SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 3. offer_quote(items): THE calculation. Internal.
--    items: [{product_id, size, quantity}] — anything malformed is ignored here; place_order
--    refuses it separately. Prices come from the catalogue, never from the caller.
--    Returns {goods, saving, free_delivery, applied[], remaining[], gift, nudges[], addons[]}.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.offer_quote(p_items JSONB)
RETURNS JSONB AS $$
DECLARE
    v_pid INT[];
    v_size TEXT[];
    v_qty INT[];
    v_rem INT[];
    v_price NUMERIC[];
    v_brand TEXT[];
    v_pub BOOLEAN[];
    v_n INT;
    i INT;
    j INT;
    k INT;
    v_offer public.offers%ROWTYPE;
    v_applied JSONB := '[]'::jsonb;
    v_saving NUMERIC := 0;
    v_free BOOLEAN := FALSE;
    v_goods NUMERIC := 0;
    v_line JSONB;
    v_sets INT;
    v_avail INT;
    v_base NUMERIC;
    v_set_price NUMERIC;
    v_need INT;
    v_take INT;
    v_units INT;
    v_used INT[] := '{}';
    v_best_id INT;
    v_best_score NUMERIC;
    v_best_saving NUMERIC;
    v_best_take INT[];
    v_best_free BOOLEAN;
    v_best_title TEXT;
    v_best_units INT;
    v_cand_saving NUMERIC;
    v_cand_take INT[];
    v_cand_free BOOLEAN;
    v_cand_units INT;
    v_tier JSONB;
    v_count INT;
    v_value NUMERIC;
    v_gift JSONB := NULL;
    v_nudges JSONB := '[]'::jsonb;
    v_addons JSONB := '[]'::jsonb;
    v_remaining JSONB := '[]'::jsonb;
    v_after NUMERIC;
BEGIN
    WITH bag AS (
        SELECT (e->>'product_id')::INT AS pid, COALESCE(e->>'size', '') AS size,
               LEAST(sum((e->>'quantity')::INT), 100)::INT AS qty
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END) e
        WHERE jsonb_typeof(e) = 'object'
          AND COALESCE(e->>'product_id', '') ~ '^[0-9]{1,9}$'
          AND COALESCE(e->>'quantity', '') ~ '^[0-9]{1,3}$'
          AND (e->>'quantity')::INT >= 1
          AND length(COALESCE(e->>'size', '')) <= 50
        GROUP BY 1, 2
    )
    SELECT array_agg(b.pid ORDER BY b.pid, b.size), array_agg(b.size ORDER BY b.pid, b.size),
           array_agg(b.qty ORDER BY b.pid, b.size), array_agg(p.price ORDER BY b.pid, b.size),
           array_agg(upper(btrim(COALESCE(p.brand, ''))) ORDER BY b.pid, b.size),
           array_agg(p.is_published IS NOT FALSE ORDER BY b.pid, b.size)
    INTO v_pid, v_size, v_qty, v_price, v_brand, v_pub
    FROM bag b JOIN public.products p ON p.id = b.pid;

    v_n := COALESCE(array_length(v_pid, 1), 0);
    IF v_n = 0 THEN
        RETURN jsonb_build_object('goods', 0, 'saving', 0, 'free_delivery', FALSE, 'applied', '[]'::jsonb,
                                  'remaining', '[]'::jsonb, 'gift', NULL, 'nudges', '[]'::jsonb, 'addons', '[]'::jsonb);
    END IF;
    v_rem := v_qty;
    FOR i IN 1..v_n LOOP
        v_goods := v_goods + v_price[i] * v_qty[i];
    END LOOP;

    -- A. Checkout add-ons: one unit at the promised price.
    FOR v_offer IN
        SELECT * FROM public.offers o WHERE o.kind = 'addon' AND public.offer_live(o) ORDER BY o.priority DESC, o.id
    LOOP
        j := NULL;
        FOR i IN 1..v_n LOOP
            IF v_pid[i] = v_offer.product_id AND v_pub[i] AND v_rem[i] >= 1
               AND (COALESCE(v_offer.product_size, '') = '' OR v_size[i] = v_offer.product_size) THEN
                j := i;
                EXIT;
            END IF;
        END LOOP;
        CONTINUE WHEN j IS NULL OR v_offer.addon_price >= v_price[j];
        -- The rest of the bag must earn it.
        v_value := v_goods - v_price[j];
        CONTINUE WHEN v_value <= 0 OR v_value < v_offer.min_subtotal;
        IF v_offer.scope <> 'all' THEN
            v_count := 0;
            FOR i IN 1..v_n LOOP
                IF v_qty[i] - (CASE WHEN i = j THEN 1 ELSE 0 END) > 0
                   AND public.offer_covers(v_offer, v_pid[i], v_brand[i]) THEN
                    v_count := v_count + 1;
                END IF;
            END LOOP;
            CONTINUE WHEN v_count = 0;
        END IF;
        v_rem[j] := v_rem[j] - 1;
        v_saving := v_saving + (v_price[j] - v_offer.addon_price);
        v_applied := v_applied || jsonb_build_object('offer_id', v_offer.id, 'kind', 'addon', 'title', v_offer.title,
            'saving', v_price[j] - v_offer.addon_price, 'units', 1, 'free_delivery', FALSE, 'gift_wrap', FALSE);
    END LOOP;

    -- B. Fixed sets, the largest saving first, as many whole sets as the bag holds.
    FOR v_offer IN
        SELECT o.* FROM public.offers o
        WHERE o.kind = 'bundle' AND public.offer_live(o) AND public.offer_bundle_available(o)
        ORDER BY public.offer_bundle_base(o) - public.offer_bundle_price(o) DESC, o.priority DESC, o.id
    LOOP
        v_base := public.offer_bundle_base(v_offer);
        v_set_price := public.offer_bundle_price(v_offer);
        CONTINUE WHEN v_base <= 0 OR v_set_price >= v_base;
        v_sets := 10;
        FOR v_line IN SELECT * FROM jsonb_array_elements(v_offer.bundle_lines) LOOP
            v_avail := 0;
            FOR i IN 1..v_n LOOP
                IF v_pid[i] = (v_line->>'product_id')::INT
                   AND (COALESCE(v_line->>'size', '') = '' OR v_size[i] = v_line->>'size') THEN
                    v_avail := v_avail + v_rem[i];
                END IF;
            END LOOP;
            v_sets := LEAST(v_sets, v_avail / GREATEST(COALESCE((v_line->>'qty')::INT, 1), 1));
        END LOOP;
        CONTINUE WHEN v_sets < 1;
        v_units := 0;
        FOR v_line IN SELECT * FROM jsonb_array_elements(v_offer.bundle_lines) LOOP
            v_need := v_sets * GREATEST(COALESCE((v_line->>'qty')::INT, 1), 1);
            v_units := v_units + v_need;
            FOR i IN 1..v_n LOOP
                EXIT WHEN v_need = 0;
                IF v_pid[i] = (v_line->>'product_id')::INT
                   AND (COALESCE(v_line->>'size', '') = '' OR v_size[i] = v_line->>'size') THEN
                    v_take := LEAST(v_rem[i], v_need);
                    v_rem[i] := v_rem[i] - v_take;
                    v_need := v_need - v_take;
                END IF;
            END LOOP;
        END LOOP;
        v_saving := v_saving + v_sets * (v_base - v_set_price);
        v_free := v_free OR v_offer.free_delivery;
        v_applied := v_applied || jsonb_build_object('offer_id', v_offer.id, 'kind', 'bundle', 'title', v_offer.title,
            'saving', v_sets * (v_base - v_set_price), 'units', v_units, 'sets', v_sets,
            'free_delivery', v_offer.free_delivery, 'gift_wrap', v_offer.gift_wrap);
    END LOOP;

    -- C. Buy more, save more: the best offer on what's left, then the next best, each once.
    LOOP
        v_best_id := NULL;
        v_best_score := 0;
        FOR v_offer IN
            SELECT * FROM public.offers o
            WHERE o.kind = 'tiered' AND public.offer_live(o) AND NOT (o.id = ANY(v_used))
            ORDER BY o.priority DESC, o.id
        LOOP
            v_cand_take := array_fill(0, ARRAY[v_n]);
            v_cand_saving := 0;
            v_cand_free := FALSE;
            v_cand_units := 0;
            IF v_offer.count_by = 'items' THEN
                v_count := 0;
                v_value := 0;
                FOR i IN 1..v_n LOOP
                    IF v_rem[i] > 0 AND v_pub[i] AND public.offer_covers(v_offer, v_pid[i], v_brand[i]) THEN
                        v_count := v_count + v_rem[i];
                        v_value := v_value + v_price[i] * v_rem[i];
                    END IF;
                END LOOP;
                v_tier := public.offer_tier(v_offer.tiers, v_count);
                IF v_tier IS NOT NULL THEN
                    v_cand_saving := round(v_value * LEAST(COALESCE((v_tier->>'percent')::NUMERIC, 0), 90) / 100, 2);
                    v_cand_free := COALESCE((v_tier->>'free_delivery')::BOOLEAN, FALSE);
                    v_cand_units := v_count;
                    FOR i IN 1..v_n LOOP
                        IF v_rem[i] > 0 AND v_pub[i] AND public.offer_covers(v_offer, v_pid[i], v_brand[i]) THEN
                            v_cand_take[i] := v_rem[i];
                        END IF;
                    END LOOP;
                END IF;
            ELSE
                -- Per perfume, whatever the size.
                FOR k IN SELECT DISTINCT x FROM unnest(v_pid) x LOOP
                    v_count := 0;
                    v_value := 0;
                    FOR i IN 1..v_n LOOP
                        IF v_pid[i] = k AND v_rem[i] > 0 AND v_pub[i] AND public.offer_covers(v_offer, v_pid[i], v_brand[i]) THEN
                            v_count := v_count + v_rem[i];
                            v_value := v_value + v_price[i] * v_rem[i];
                        END IF;
                    END LOOP;
                    v_tier := public.offer_tier(v_offer.tiers, v_count);
                    CONTINUE WHEN v_tier IS NULL;
                    v_cand_saving := v_cand_saving + round(v_value * LEAST(COALESCE((v_tier->>'percent')::NUMERIC, 0), 90) / 100, 2);
                    v_cand_free := v_cand_free OR COALESCE((v_tier->>'free_delivery')::BOOLEAN, FALSE);
                    v_cand_units := v_cand_units + v_count;
                    FOR i IN 1..v_n LOOP
                        IF v_pid[i] = k AND v_rem[i] > 0 AND v_pub[i] AND public.offer_covers(v_offer, v_pid[i], v_brand[i]) THEN
                            v_cand_take[i] := v_rem[i];
                        END IF;
                    END LOOP;
                END LOOP;
            END IF;
            -- Free delivery counts as the flat fee when comparing offers.
            IF v_cand_units > 0 AND v_cand_saving + (CASE WHEN v_cand_free THEN 25 ELSE 0 END) > v_best_score THEN
                v_best_id := v_offer.id;
                v_best_score := v_cand_saving + CASE WHEN v_cand_free THEN 25 ELSE 0 END;
                v_best_saving := v_cand_saving;
                v_best_take := v_cand_take;
                v_best_free := v_cand_free;
                v_best_title := v_offer.title;
                v_best_units := v_cand_units;
            END IF;
        END LOOP;
        EXIT WHEN v_best_id IS NULL;
        FOR i IN 1..v_n LOOP
            v_rem[i] := v_rem[i] - v_best_take[i];
        END LOOP;
        v_used := v_used || v_best_id;
        v_saving := v_saving + v_best_saving;
        v_free := v_free OR v_best_free;
        v_applied := v_applied || jsonb_build_object('offer_id', v_best_id, 'kind', 'tiered', 'title', v_best_title,
            'saving', v_best_saving, 'units', v_best_units, 'free_delivery', v_best_free, 'gift_wrap', FALSE);
    END LOOP;

    v_saving := LEAST(round(v_saving, 2), v_goods);
    v_after := v_goods - v_saving;

    -- D. The free gift: the highest threshold the bag reaches, if the gift is in stock.
    SELECT jsonb_build_object('offer_id', o.id, 'title', o.title, 'product_id', p.id,
               'size', COALESCE(NULLIF(o.product_size, ''), p.sizes[1], ''),
               'name', replace(p.name, '_', ' '), 'brand', p.brand, 'image_url', p.image_url,
               'value', p.price, 'threshold', o.min_subtotal)
    INTO v_gift
    FROM public.offers o JOIN public.products p ON p.id = o.product_id
    WHERE o.kind = 'gift' AND public.offer_live(o) AND p.is_published IS NOT FALSE
      AND o.min_subtotal <= v_after
      AND public.offer_in_stock(p.id, COALESCE(NULLIF(o.product_size, ''), p.sizes[1], ''))
    ORDER BY o.min_subtotal DESC, o.priority DESC, o.id
    LIMIT 1;

    -- E. Nudges: the next step within reach (at most two more perfumes, or the next gift).
    FOR v_offer IN
        SELECT * FROM public.offers o WHERE o.kind = 'tiered' AND public.offer_live(o) ORDER BY o.priority DESC, o.id
    LOOP
        EXIT WHEN jsonb_array_length(v_nudges) >= 2;
        IF v_offer.count_by = 'items' THEN
            v_count := 0;
            FOR i IN 1..v_n LOOP
                IF v_pub[i] AND public.offer_covers(v_offer, v_pid[i], v_brand[i]) THEN
                    v_count := v_count + v_qty[i];
                END IF;
            END LOOP;
            CONTINUE WHEN v_count = 0;
            v_tier := public.offer_next_tier(v_offer.tiers, v_count);
            CONTINUE WHEN v_tier IS NULL OR (v_tier->>'min_qty')::INT - v_count > 2;
            v_nudges := v_nudges || jsonb_build_object('kind', 'tiered', 'offer_id', v_offer.id, 'title', v_offer.title,
                'missing_units', (v_tier->>'min_qty')::INT - v_count,
                'percent', COALESCE((v_tier->>'percent')::NUMERIC, 0),
                'free_delivery', COALESCE((v_tier->>'free_delivery')::BOOLEAN, FALSE),
                'scope_label', public.offer_scope_label(v_offer));
        ELSE
            -- A single bottle of a perfume that a second would discount.
            FOR i IN 1..v_n LOOP
                IF v_pub[i] AND v_qty[i] = 1 AND public.offer_covers(v_offer, v_pid[i], v_brand[i])
                   AND (SELECT sum(q) FROM unnest(v_pid, v_qty) AS t(p, q) WHERE p = v_pid[i]) = 1 THEN
                    v_tier := public.offer_next_tier(v_offer.tiers, 1);
                    IF v_tier IS NOT NULL AND (v_tier->>'min_qty')::INT = 2 THEN
                        v_nudges := v_nudges || jsonb_build_object('kind', 'same_product', 'offer_id', v_offer.id,
                            'title', v_offer.title, 'product_id', v_pid[i], 'size', v_size[i], 'missing_units', 1,
                            'percent', COALESCE((v_tier->>'percent')::NUMERIC, 0),
                            'free_delivery', COALESCE((v_tier->>'free_delivery')::BOOLEAN, FALSE));
                        EXIT;
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    SELECT v_nudges || COALESCE(jsonb_agg(x.n), '[]'::jsonb) INTO v_nudges FROM (
        SELECT jsonb_build_object('kind', 'gift', 'offer_id', o.id, 'title', o.title,
                   'missing_aed', round(o.min_subtotal - v_after, 2), 'gift_name', replace(p.name, '_', ' '),
                   'gift_brand', p.brand) AS n
        FROM public.offers o JOIN public.products p ON p.id = o.product_id
        WHERE o.kind = 'gift' AND public.offer_live(o) AND p.is_published IS NOT FALSE
          AND o.min_subtotal > v_after
          AND public.offer_in_stock(p.id, COALESCE(NULLIF(o.product_size, ''), p.sizes[1], ''))
        ORDER BY o.min_subtotal ASC, o.id
        LIMIT 1) x;

    -- F. Add-ons the bag qualifies for but doesn't hold yet (for the checkout tick box).
    SELECT COALESCE(jsonb_agg(x.a ORDER BY x.prio DESC, x.id), '[]'::jsonb) INTO v_addons FROM (
        SELECT o.id, o.priority AS prio, jsonb_build_object('offer_id', o.id, 'title', o.title, 'description', o.description,
                   'product_id', p.id, 'size', COALESCE(NULLIF(o.product_size, ''), p.sizes[1], ''),
                   'name', replace(p.name, '_', ' '), 'brand', p.brand, 'image_url', p.image_url,
                   'price', p.price, 'addon_price', o.addon_price) AS a
        FROM public.offers o JOIN public.products p ON p.id = o.product_id
        WHERE o.kind = 'addon' AND public.offer_live(o) AND p.is_published IS NOT FALSE
          AND o.addon_price < p.price
          AND v_goods >= GREATEST(o.min_subtotal, 0.01)
          AND public.offer_in_stock(p.id, COALESCE(NULLIF(o.product_size, ''), p.sizes[1], ''))
          AND NOT (p.id = ANY(v_pid))
          AND (o.scope = 'all' OR EXISTS (
                SELECT 1 FROM unnest(v_pid, v_brand) AS t(pid, brand) WHERE public.offer_covers(o, t.pid, t.brand)))
        ORDER BY o.priority DESC, o.id
        LIMIT 2) x;

    FOR i IN 1..v_n LOOP
        IF v_rem[i] > 0 THEN
            v_remaining := v_remaining || jsonb_build_object('product_id', v_pid[i], 'size', v_size[i], 'quantity', v_rem[i]);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'goods', v_goods,
        'saving', v_saving,
        'free_delivery', v_free,
        'applied', v_applied,
        'remaining', v_remaining,
        'gift', v_gift,
        'nudges', v_nudges,
        'addons', v_addons
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 4. code_quote(): a discount code priced AFTER the offers. Internal.
--    With no offer touching the bag it is exactly migration 67's discount_quote().
--    Adds 'covered': the code would have applied, but offers already cover those items.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.code_quote(
    p_discount public.discounts,
    p_items JSONB,
    p_offer JSONB,
    p_subtotal NUMERIC,
    p_shipping_fee NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_target TEXT := COALESCE(p_discount.applies_to, 'order');
    v_free BOOLEAN := COALESCE((p_offer->>'free_delivery')::BOOLEAN, FALSE);
    v_offer_saving NUMERIC := COALESCE((p_offer->>'saving')::NUMERIC, 0);
    v_touched BOOLEAN := p_offer IS NOT NULL AND jsonb_array_length(COALESCE(p_offer->'applied', '[]'::jsonb)) > 0;
    v_base NUMERIC;
    v_quote JSONB;
    v_full JSONB;
BEGIN
    IF v_target = 'delivery' THEN
        RETURN public.discount_quote(p_discount, p_items, p_subtotal,
                                     CASE WHEN v_free THEN 0 ELSE p_shipping_fee END)
               || jsonb_build_object('covered', FALSE);
    END IF;
    IF NOT v_touched OR p_items IS NULL THEN
        RETURN public.discount_quote(p_discount, p_items, p_subtotal, p_shipping_fee)
               || jsonb_build_object('covered', FALSE);
    END IF;

    IF v_target = 'order' THEN
        IF p_discount.combines_with_offers THEN
            v_base := GREATEST(COALESCE(p_subtotal, 0) - v_offer_saving, 0);
        ELSE
            SELECT COALESCE(sum(p.price * (r->>'quantity')::INT), 0) INTO v_base
            FROM jsonb_array_elements(COALESCE(p_offer->'remaining', '[]'::jsonb)) r
            JOIN public.products p ON p.id = (r->>'product_id')::INT;
        END IF;
        v_quote := public.discount_quote(p_discount, NULL, v_base, p_shipping_fee);
        RETURN v_quote || jsonb_build_object('covered', v_base <= 0);
    END IF;

    -- A code for chosen perfumes or collections: only the units no offer took.
    v_quote := public.discount_quote(p_discount, COALESCE(p_offer->'remaining', '[]'::jsonb), p_subtotal, p_shipping_fee);
    IF COALESCE((v_quote->>'goods')::NUMERIC, 0) <= 0 THEN
        v_full := public.discount_quote(p_discount, p_items, p_subtotal, p_shipping_fee);
        RETURN v_quote || jsonb_build_object('covered', COALESCE((v_full->>'goods')::NUMERIC, 0) > 0);
    END IF;
    RETURN v_quote || jsonb_build_object('covered', FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 5. code_check(): migration 67's check_discount() rules, after the offers. Internal.
--    New reason: covered_by_offers (every item the code would discount is in an offer).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.code_check(
    p_code TEXT,
    p_items JSONB,
    p_subtotal NUMERIC,
    p_offer JSONB
) RETURNS JSONB AS $$
DECLARE
    v_discount public.discounts%ROWTYPE;
    v_shipping NUMERIC;
    v_minimum NUMERIC;
    v_quote JSONB;
    v_goods NUMERIC;
    v_delivery NUMERIC;
    v_target TEXT;
BEGIN
    IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'invalid', 'minimum', NULL);
    END IF;

    -- The same rule as place_order (and lib/shipping.ts): free from AED 300, else AED 25.
    v_shipping := CASE WHEN p_subtotal < 300 THEN 25 ELSE 0 END;

    SELECT * INTO v_discount FROM public.discounts
    WHERE upper(code) = upper(trim(p_code));

    IF NOT FOUND OR v_discount.is_active IS NOT TRUE
       OR (v_discount.starts_at IS NOT NULL AND v_discount.starts_at > CURRENT_TIMESTAMP) THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'invalid', 'minimum', NULL);
    END IF;
    IF v_discount.ends_at IS NOT NULL AND v_discount.ends_at < CURRENT_TIMESTAMP THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'expired', 'minimum', NULL);
    END IF;
    IF v_discount.usage_limit IS NOT NULL AND v_discount.usage_count >= v_discount.usage_limit THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'exhausted', 'minimum', NULL);
    END IF;

    v_minimum := COALESCE(v_discount.min_requirement, 0);
    IF p_subtotal < v_minimum THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'minimum_not_met', 'minimum', v_minimum);
    END IF;

    v_target := COALESCE(v_discount.applies_to, 'order');
    v_quote := public.code_quote(v_discount, p_items, p_offer, p_subtotal, v_shipping);

    IF NOT (v_quote->>'priced')::BOOLEAN THEN
        RETURN jsonb_build_object('valid', TRUE, 'discount_amount', NULL, 'reason', NULL,
                                  'applies_to', v_target, 'applies_label', public.discount_target_label(v_discount),
                                  'priced', FALSE);
    END IF;

    v_goods := COALESCE((v_quote->>'goods')::NUMERIC, 0);
    v_delivery := COALESCE((v_quote->>'delivery')::NUMERIC, 0);

    IF COALESCE((v_quote->>'covered')::BOOLEAN, FALSE) AND v_goods + v_delivery <= 0 THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'covered_by_offers',
                                  'minimum', NULL, 'applies_to', v_target,
                                  'applies_label', public.discount_target_label(v_discount));
    END IF;
    IF v_target <> 'order' AND v_goods + v_delivery <= 0 THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0,
                                  'reason', CASE WHEN v_target = 'delivery' THEN 'delivery_already_free' ELSE 'not_applicable' END,
                                  'minimum', NULL, 'applies_to', v_target,
                                  'applies_label', public.discount_target_label(v_discount));
    END IF;

    RETURN jsonb_build_object('valid', TRUE, 'discount_amount', v_goods + v_delivery, 'reason', NULL,
                              'goods', v_goods, 'delivery', v_delivery,
                              'applies_to', v_target, 'applies_label', public.discount_target_label(v_discount),
                              'combines_with_offers', v_discount.combines_with_offers,
                              'priced', TRUE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- A bag as the shop sends it, cleaned: [{product_id, size, quantity}], at most 50 lines.
CREATE OR REPLACE FUNCTION public.offer_clean_bag(p_items JSONB)
RETURNS JSONB AS $$
    SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', (e->>'product_id')::INT,
                                                 'size', left(COALESCE(e->>'size', ''), 50),
                                                 'quantity', (e->>'quantity')::INT)), '[]'::jsonb)
    FROM (SELECT e FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END) e
          LIMIT 50) s
    WHERE jsonb_typeof(e) = 'object'
      AND COALESCE(e->>'product_id', '') ~ '^[0-9]{1,9}$'
      AND COALESCE(e->>'quantity', '') ~ '^[0-9]{1,2}$'
      AND (e->>'quantity')::INT BETWEEN 1 AND 20;
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.offer_live(public.offers) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_covers(public.offers, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_tier(JSONB, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_next_tier(JSONB, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_in_stock(INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_scope_label(public.offers) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_bundle_base(public.offers) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_bundle_price(public.offers) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_bundle_available(public.offers) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_quote(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.code_quote(public.discounts, JSONB, JSONB, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.code_check(TEXT, JSONB, NUMERIC, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_clean_bag(JSONB) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. bag_quote(items, code): the preview the bag and checkout show. Public, read-only.
--    The same figures place_order() will charge.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bag_quote(p_items JSONB, p_code TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_items JSONB := public.offer_clean_bag(p_items);
    v_subtotal NUMERIC;
    v_offer JSONB;
    v_ship NUMERIC;
    v_offer_ship NUMERIC := 0;
    v_code JSONB := NULL;
    v_code_goods NUMERIC := 0;
    v_code_delivery NUMERIC := 0;
    v_total NUMERIC;
    v_picks JSONB := '[]'::jsonb;
    v_ids INT[];
BEGIN
    SELECT COALESCE(sum(p.price * (i->>'quantity')::INT), 0), array_agg((i->>'product_id')::INT)
    INTO v_subtotal, v_ids
    FROM jsonb_array_elements(v_items) i
    JOIN public.products p ON p.id = (i->>'product_id')::INT;

    v_offer := public.offer_quote(v_items);
    v_ship := CASE WHEN v_subtotal > 0 AND v_subtotal < 300 THEN 25 ELSE 0 END;
    IF COALESCE((v_offer->>'free_delivery')::BOOLEAN, FALSE) THEN
        v_offer_ship := v_ship;
    END IF;

    IF p_code IS NOT NULL AND length(trim(p_code)) > 0 AND v_subtotal > 0 THEN
        v_code := public.code_check(left(trim(p_code), 40), v_items, v_subtotal, v_offer);
        IF COALESCE((v_code->>'valid')::BOOLEAN, FALSE) AND COALESCE((v_code->>'priced')::BOOLEAN, FALSE) THEN
            v_code_goods := COALESCE((v_code->>'goods')::NUMERIC, 0);
            v_code_delivery := COALESCE((v_code->>'delivery')::NUMERIC, 0);
        END IF;
    END IF;

    v_total := GREATEST(v_subtotal - COALESCE((v_offer->>'saving')::NUMERIC, 0) - v_code_goods, 0)
             + GREATEST(v_ship - v_offer_ship - v_code_delivery, 0);

    -- The free delivery nudge: a perfume or two that would close the gap.
    IF v_subtotal > 0 AND v_subtotal < 300 AND v_offer_ship = 0 THEN
        SELECT COALESCE(jsonb_agg(x.j ORDER BY x.best DESC, x.price, x.id), '[]'::jsonb) INTO v_picks FROM (
            SELECT p.id, p.price, COALESCE(p.is_bestseller, FALSE) AS best,
                   jsonb_build_object('product_id', p.id, 'name', replace(p.name, '_', ' '), 'brand', p.brand,
                                      'price', p.price, 'image_url', p.image_url, 'size', p.sizes[1]) AS j
            FROM public.products p
            WHERE p.is_published IS NOT FALSE
              AND p.price >= 300 - v_subtotal AND p.price <= 300 - v_subtotal + 120 AND p.price > 1
              AND NOT (p.id = ANY(COALESCE(v_ids, '{}')))
              AND array_length(p.sizes, 1) > 0
              AND public.offer_in_stock(p.id, p.sizes[1])
            ORDER BY COALESCE(p.is_bestseller, FALSE) DESC, p.price ASC, p.id
            LIMIT 3) x;
    END IF;

    RETURN jsonb_build_object(
        'subtotal', v_subtotal,
        'offer_saving', COALESCE((v_offer->>'saving')::NUMERIC, 0),
        'offer_delivery', v_offer_ship,
        'applied', COALESCE(v_offer->'applied', '[]'::jsonb),
        'gift', v_offer->'gift',
        'nudges', COALESCE(v_offer->'nudges', '[]'::jsonb),
        'addons', COALESCE(v_offer->'addons', '[]'::jsonb),
        'code', v_code,
        'code_goods', v_code_goods,
        'code_delivery', v_code_delivery,
        'shipping_fee', v_ship,
        'total', v_total,
        'to_free_delivery', CASE WHEN v_subtotal > 0 AND v_offer_ship = 0 THEN GREATEST(300 - v_subtotal, 0) ELSE 0 END,
        'free_delivery_picks', v_picks
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.bag_quote(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bag_quote(JSONB, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. live_offer_cards(product_id): the offers the shop shows, with what the shopper needs
--    to see (a set's perfumes, prices and saving). With a product id, only the offers that
--    involve it (its sets, the buy-more offers it counts towards, the free gift). Public.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.live_offer_cards(p_product_id INT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_brand TEXT;
BEGIN
    IF p_product_id IS NOT NULL THEN
        SELECT brand INTO v_brand FROM public.products WHERE id = p_product_id AND is_published IS NOT FALSE;
        IF NOT FOUND THEN
            RETURN '[]'::jsonb;
        END IF;
    END IF;

    RETURN COALESCE((
        SELECT jsonb_agg(card ORDER BY sort_kind, prio DESC, id)
        FROM (
            SELECT o.id, o.priority AS prio,
                   CASE o.kind WHEN 'bundle' THEN 1 WHEN 'tiered' THEN 2 WHEN 'gift' THEN 3 ELSE 4 END AS sort_kind,
                   jsonb_build_object(
                       'id', o.id, 'kind', o.kind, 'template', o.template, 'title', o.title,
                       'description', o.description, 'ends_at', o.ends_at,
                       'free_delivery', o.free_delivery, 'gift_wrap', o.gift_wrap,
                       'scope', o.scope, 'scope_label', public.offer_scope_label(o),
                       'count_by', o.count_by, 'tiers', o.tiers,
                       'bundle', CASE WHEN o.kind = 'bundle' THEN jsonb_build_object(
                           'base', public.offer_bundle_base(o),
                           'price', public.offer_bundle_price(o),
                           'lines', (SELECT jsonb_agg(jsonb_build_object(
                                         'product_id', p.id, 'name', replace(p.name, '_', ' '), 'brand', p.brand,
                                         'price', p.price, 'image_url', p.image_url,
                                         'size', COALESCE(NULLIF(l->>'size', ''), p.sizes[1], ''),
                                         'qty', GREATEST(COALESCE((l->>'qty')::INT, 1), 1),
                                         'in_stock', public.offer_in_stock(p.id, COALESCE(NULLIF(l->>'size', ''), p.sizes[1], ''))))
                                     FROM jsonb_array_elements(o.bundle_lines) l
                                     JOIN public.products p ON p.id = (l->>'product_id')::INT)) END,
                       'product', CASE WHEN o.kind IN ('gift', 'addon') THEN (
                           SELECT jsonb_build_object('product_id', p.id, 'name', replace(p.name, '_', ' '), 'brand', p.brand,
                                      'price', p.price, 'image_url', p.image_url,
                                      'size', COALESCE(NULLIF(o.product_size, ''), p.sizes[1], ''))
                           FROM public.products p WHERE p.id = o.product_id) END,
                       'addon_price', o.addon_price,
                       'min_subtotal', o.min_subtotal
                   ) AS card
            FROM public.offers o
            WHERE public.offer_live(o)
              AND (o.kind <> 'bundle' OR public.offer_bundle_available(o))
              AND (o.kind NOT IN ('gift', 'addon') OR EXISTS (
                    SELECT 1 FROM public.products p WHERE p.id = o.product_id AND p.is_published IS NOT FALSE))
              AND (p_product_id IS NULL
                   OR (o.kind = 'bundle' AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.bundle_lines) l
                                                     WHERE (l->>'product_id')::INT = p_product_id))
                   OR (o.kind = 'tiered' AND public.offer_covers(o, p_product_id, v_brand))
                   OR o.kind = 'gift')
            LIMIT 40
        ) s
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.live_offer_cards(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_offer_cards(INT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. check_discount(): migration 67's, now pricing the code after the offers. The bag may
--    carry sizes (sets can name one). Same signature, grants and answers; one new reason.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_discount(
    p_code TEXT,
    p_items JSONB DEFAULT NULL,
    p_subtotal NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_items JSONB := NULL;
    v_subtotal NUMERIC;
    v_offer JSONB := NULL;
BEGIN
    IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
        RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'invalid', 'minimum', NULL);
    END IF;

    IF p_items IS NOT NULL THEN
        IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 50 THEN
            RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'invalid', 'minimum', NULL);
        END IF;
        -- Only well-formed lines count; prices come from the catalogue.
        v_items := public.offer_clean_bag(p_items);
        SELECT COALESCE(sum(p.price * (i->>'quantity')::INT), 0) INTO v_subtotal
        FROM jsonb_array_elements(v_items) i
        JOIN public.products p ON p.id = (i->>'product_id')::INT;
        v_offer := public.offer_quote(v_items);
    ELSE
        v_subtotal := GREATEST(COALESCE(p_subtotal, 0), 0);
    END IF;

    RETURN public.code_check(p_code, v_items, v_subtotal, v_offer);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.check_discount(TEXT, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_discount(TEXT, JSONB, NUMERIC) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. place_order(): migration 67's, with only the offer lines added:
--    the bag is rebuilt from the order-line fields only; offer_quote() prices it and may add
--    the free gift as one more line in the sorted stock loop (a gift that can't be sent is
--    left out instead of failing the order; it is never charged and never counts towards
--    the subtotal); the code is priced by code_quote() after the offers; the total takes
--    the offer saving (and free delivery) off; orders.offer_saving, order_items.is_gift /
--    offer_id and order_offers record it. Payment lines are byte-for-byte migration 67's.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT,
    p_shipping JSONB,
    p_items JSONB,
    p_discount_code TEXT DEFAULT NULL,
    p_abandoned_cart_id UUID DEFAULT NULL,
    p_currency TEXT DEFAULT 'AED',
    p_exchange_rate NUMERIC DEFAULT 1,
    p_payment_method TEXT DEFAULT 'cod',
    p_payment_status TEXT DEFAULT 'pending_collection'
) RETURNS JSONB AS $$
DECLARE
    v_order_id TEXT;
    v_item JSONB;
    v_product public.products%ROWTYPE;
    v_qty INT;
    v_size TEXT;
    v_stock INT;
    v_subtotal NUMERIC(10,2) := 0;
    v_shipping_fee NUMERIC(10,2) := 0;
    v_discount public.discounts%ROWTYPE;
    v_discount_id INT;
    v_discount_amount NUMERIC(10,2) := 0;
    -- Migration 67: a delivery code takes its saving off the delivery fee.
    v_ship_discount NUMERIC(10,2) := 0;
    v_quote JSONB;
    -- Migration 69: automatic offers (see offer_quote).
    v_bag JSONB;
    v_items JSONB;
    v_offer_q JSONB;
    v_gift JSONB;
    v_is_gift BOOLEAN;
    v_gift_dropped BOOLEAN := FALSE;
    v_offer_saving NUMERIC(10,2) := 0;
    v_offer_ship NUMERIC(10,2) := 0;
    v_total NUMERIC(10,2);
    v_free_shipping_threshold CONSTANT NUMERIC := 300;
    v_flat_shipping_fee CONSTANT NUMERIC := 25;
    v_line_count INT;
    v_customer_id UUID := auth.uid();
    v_mode TEXT;
    v_online BOOLEAN;
    v_reserved JSONB := '[]'::jsonb;
    v_token TEXT;
    v_cart_id UUID;
BEGIN
    -- Input validation
    IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 255 THEN
        RAISE EXCEPTION 'invalid_email';
    END IF;
    IF p_shipping IS NULL OR jsonb_typeof(p_shipping) <> 'object' THEN
        RAISE EXCEPTION 'invalid_shipping_address';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'invalid_items';
    END IF;
    v_line_count := jsonb_array_length(p_items);
    IF v_line_count < 1 OR v_line_count > 50 THEN
        RAISE EXCEPTION 'invalid_items';
    END IF;
    IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'invalid_currency';
    END IF;
    IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 OR p_exchange_rate > 1000 THEN
        RAISE EXCEPTION 'invalid_exchange_rate';
    END IF;

    -- Payment seam. The pairing of method to initial status is fixed HERE, and
    -- the owner's switch decides which pair is open. 'paid' is only ever
    -- reached through payment_apply_transaction(), which needs the secret.
    v_mode := COALESCE((SELECT mode FROM public.payment_settings WHERE id), 'cod');
    IF p_payment_method = 'cod' AND p_payment_status = 'pending_collection' AND v_mode = 'cod' THEN
        v_online := FALSE;
    ELSIF p_payment_method = 'paymob' AND p_payment_status = 'awaiting_payment' AND v_mode = 'online'
          AND EXISTS (SELECT 1 FROM public.app_config WHERE name = 'payments' AND length(value) >= 20) THEN
        IF length(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g')) < 7 THEN
            RAISE EXCEPTION 'phone_required';
        END IF;
        v_online := TRUE;
    ELSE
        RAISE EXCEPTION 'unsupported_payment_method';
    END IF;

    -- Migration 69: the shopper's lines, carrying only what an order line has (so no
    -- "gift" flag can be sent in), the automatic offers on them, and the free gift if
    -- the bag earns one. The gift joins the sorted stock loop below like any line.
    SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', e->'product_id', 'size', e->'size',
                                                 'quantity', e->'quantity')), '[]'::jsonb)
    INTO v_bag FROM jsonb_array_elements(p_items) e;
    v_offer_q := public.offer_quote(v_bag);
    v_gift := v_offer_q->'gift';
    v_items := v_bag;
    IF v_gift IS NOT NULL AND jsonb_typeof(v_gift) = 'object' THEN
        v_items := v_items || jsonb_build_array(jsonb_build_object(
            'product_id', (v_gift->>'product_id')::INT, 'size', v_gift->>'size', 'quantity', 1,
            'gift', TRUE, 'offer_id', (v_gift->>'offer_id')::INT));
    END IF;

    -- Sorted, so concurrent orders (and releases) lock inventory rows in one
    -- global order and cannot deadlock each other.
    FOR v_item IN
        SELECT value FROM jsonb_array_elements(v_items)
        ORDER BY (value->>'product_id')::INT, COALESCE(value->>'size', '')
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INT, 0);
        v_size := COALESCE(v_item->>'size', '');
        v_is_gift := COALESCE((v_item->>'gift')::BOOLEAN, FALSE);
        IF v_qty < 1 OR v_qty > 20 THEN
            RAISE EXCEPTION 'invalid_quantity';
        END IF;

        SELECT * INTO v_product FROM public.products
        WHERE id = (v_item->>'product_id')::INT;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'unknown_product:%', v_item->>'product_id';
        END IF;
        IF v_product.sizes IS NOT NULL AND array_length(v_product.sizes, 1) > 0
           AND NOT (v_size = ANY(v_product.sizes)) THEN
            -- A gift that can't be sent is left out; it never stops the order.
            IF v_is_gift THEN v_gift_dropped := TRUE; CONTINUE; END IF;
            RAISE EXCEPTION 'invalid_size:%', v_product.name;
        END IF;

        -- Lock the inventory row; missing rows are treated as not stock-tracked.
        -- See the operations note at the foot of migration 42.
        SELECT stock_level INTO v_stock FROM public.inventory
        WHERE product_id = v_product.id AND size = v_size
        FOR UPDATE;
        IF FOUND THEN
            IF v_stock < v_qty THEN
                IF v_is_gift THEN v_gift_dropped := TRUE; CONTINUE; END IF;
                RAISE EXCEPTION 'out_of_stock:%', v_product.name;
            END IF;
            UPDATE public.inventory SET stock_level = stock_level - v_qty
            WHERE product_id = v_product.id AND size = v_size;
            v_reserved := v_reserved || jsonb_build_object(
                'product_id', v_product.id, 'size', v_size, 'qty', v_qty
            );
        END IF;

        IF NOT v_is_gift THEN
            v_subtotal := v_subtotal + (v_product.price * v_qty);
        END IF;
    END LOOP;

    IF v_subtotal < v_free_shipping_threshold THEN
        v_shipping_fee := v_flat_shipping_fee;
    END IF;

    -- Migration 69: what the automatic offers take off, and delivery if one makes it free.
    v_offer_saving := LEAST(COALESCE((v_offer_q->>'saving')::NUMERIC, 0), v_subtotal);
    IF COALESCE((v_offer_q->>'free_delivery')::BOOLEAN, FALSE) THEN
        v_offer_ship := v_shipping_fee;
    END IF;

    -- Discount redemption (atomic: row locked, usage counted here only). For
    -- an online order the use is given back if it is never paid.
    IF p_discount_code IS NOT NULL AND length(trim(p_discount_code)) > 0 THEN
        SELECT * INTO v_discount FROM public.discounts
        WHERE upper(code) = upper(trim(p_discount_code))
          AND is_active = TRUE
          AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
          AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'invalid_discount_code';
        END IF;
        IF v_discount.usage_limit IS NOT NULL AND v_discount.usage_count >= v_discount.usage_limit THEN
            RAISE EXCEPTION 'discount_exhausted';
        END IF;
        IF v_subtotal < COALESCE(v_discount.min_requirement, 0) THEN
            RAISE EXCEPTION 'discount_minimum_not_met:%', v_discount.min_requirement;
        END IF;
        -- Migration 67: what the code covers (the whole order, chosen perfumes,
        -- collections, or delivery), priced by the one calculation that
        -- check_discount() also uses, so the preview and the order agree.
        -- Migration 69: priced after the offers (code_quote; with no offer in the bag it is
        -- exactly discount_quote).
        v_quote := public.code_quote(v_discount, v_bag, v_offer_q, v_subtotal, v_shipping_fee);
        v_discount_amount := COALESCE((v_quote->>'goods')::NUMERIC, 0);
        v_ship_discount := COALESCE((v_quote->>'delivery')::NUMERIC, 0);
        IF COALESCE((v_quote->>'covered')::BOOLEAN, FALSE) AND v_discount_amount + v_ship_discount <= 0 THEN
            RAISE EXCEPTION 'discount_covered_by_offers';
        END IF;
        IF COALESCE(v_discount.applies_to, 'order') <> 'order' AND v_discount_amount + v_ship_discount <= 0 THEN
            RAISE EXCEPTION 'discount_not_applicable';
        END IF;
        UPDATE public.discounts SET usage_count = usage_count + 1 WHERE id = v_discount.id;
        v_discount_id := v_discount.id;
    END IF;

    v_total := GREATEST(v_subtotal - v_offer_saving - v_discount_amount, 0)
             + GREATEST(v_shipping_fee - v_offer_ship - v_ship_discount, 0);

    IF v_online AND v_total <= 0 THEN
        RAISE EXCEPTION 'online_payment_not_needed';
    END IF;

    v_order_id := 'ORD-' || nextval('public.order_number_seq')::TEXT;

    INSERT INTO public.orders (
        id, customer_id, email, phone, total_price, status, shipping_address,
        currency, exchange_rate, converted_total,
        payment_method, payment_status, discount_code, discount_amount, shipping_fee, offer_saving
    ) VALUES (
        v_order_id, v_customer_id, lower(p_email), left(p_phone, 50), v_total, 'pending', p_shipping,
        p_currency, p_exchange_rate, round(v_total * p_exchange_rate, 2)::TEXT || ' ' || p_currency,
        p_payment_method, p_payment_status,
        CASE WHEN v_discount_amount + v_ship_discount > 0 THEN upper(trim(p_discount_code)) END,
        v_offer_saving + v_offer_ship + v_discount_amount + v_ship_discount, v_shipping_fee,
        v_offer_saving + v_offer_ship
    );

    INSERT INTO public.order_items (order_id, product_id, size, quantity, unit_price, is_gift, offer_id)
    SELECT v_order_id,
           (item->>'product_id')::INT,
           item->>'size',
           (item->>'quantity')::INT,
           CASE WHEN COALESCE((item->>'gift')::BOOLEAN, FALSE) THEN 0 ELSE p.price END,
           COALESCE((item->>'gift')::BOOLEAN, FALSE),
           (item->>'offer_id')::INT
    FROM jsonb_array_elements(v_items) AS item
    JOIN public.products p ON p.id = (item->>'product_id')::INT
    WHERE NOT (COALESCE((item->>'gift')::BOOLEAN, FALSE) AND v_gift_dropped);

    -- Migration 69: which offers this order used (the admin's order page and results).
    INSERT INTO public.order_offers (order_id, offer_id, kind, title, saving, units, gift_wrap, free_delivery)
    SELECT v_order_id, (a->>'offer_id')::INT, a->>'kind', a->>'title', COALESCE((a->>'saving')::NUMERIC, 0),
           COALESCE((a->>'units')::INT, 0), COALESCE((a->>'gift_wrap')::BOOLEAN, FALSE),
           COALESCE((a->>'free_delivery')::BOOLEAN, FALSE)
    FROM jsonb_array_elements(COALESCE(v_offer_q->'applied', '[]'::jsonb)) a;
    IF v_gift IS NOT NULL AND jsonb_typeof(v_gift) = 'object' AND NOT v_gift_dropped THEN
        INSERT INTO public.order_offers (order_id, offer_id, kind, title, saving, units)
        VALUES (v_order_id, (v_gift->>'offer_id')::INT, 'gift', v_gift->>'title',
                COALESCE((v_gift->>'value')::NUMERIC, 0), 1);
    END IF;

    IF v_online THEN
        INSERT INTO public.order_tracking (order_id, status, location, description)
        VALUES (v_order_id, 'Order Placed', 'Dubai Headquarters',
                'We have received your order and are awaiting confirmation of your payment.');

        -- 2 × UUIDv4 = 244 random bits, hex-encoded. Only the hash is kept.
        v_token := replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', '');

        IF p_abandoned_cart_id IS NOT NULL THEN
            SELECT id INTO v_cart_id FROM public.abandoned_carts
            WHERE id = p_abandoned_cart_id AND lower(email) = lower(p_email);
        END IF;

        INSERT INTO public.order_payments (
            order_id, view_token_hash, amount_fils, due_at,
            payer_first_name, payer_last_name, pending_cart_id, reserved_lines, discount_id
        ) VALUES (
            v_order_id,
            encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
            (v_total * 100)::INTEGER,
            -- Paymob's one-hour intention, plus ten minutes' grace.
            now() + interval '70 minutes',
            left(trim(COALESCE(p_first_name, '')), 50),
            left(trim(COALESCE(p_last_name, '')), 50),
            v_cart_id,
            v_reserved,
            v_discount_id
        );
    ELSE
        INSERT INTO public.order_tracking (order_id, status, location, description)
        VALUES (v_order_id, 'Order Placed', 'Dubai Headquarters',
                'We have received your order. Payment is collected on delivery.');

        -- Keep the customer registry truthful (previously never maintained).
        IF v_customer_id IS NOT NULL THEN
            UPDATE public.customers
            SET total_spent = COALESCE(total_spent, 0) + v_total,
                orders_count = COALESCE(orders_count, 0) + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_customer_id;
        END IF;

        -- Convert the shopper's abandoned cart (email-guarded)
        IF p_abandoned_cart_id IS NOT NULL THEN
            UPDATE public.abandoned_carts
            SET converted = TRUE, converted_order_id = v_order_id, updated_at = CURRENT_TIMESTAMP
            WHERE id = p_abandoned_cart_id AND lower(email) = lower(p_email);
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'subtotal', v_subtotal,
        'shipping_fee', v_shipping_fee,
        'discount_amount', v_discount_amount + v_ship_discount,
        -- Migration 69: the automatic offers' saving (delivery included), and the gift.
        'offer_saving', v_offer_saving + v_offer_ship,
        'gift', CASE WHEN v_gift_dropped THEN NULL ELSE v_gift END,
        'total', v_total,
        'currency', p_currency,
        'payment_method', p_payment_method,
        'payment_status', p_payment_status,
        'payment_token', v_token
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.place_order(
    TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(
    TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC, TEXT, TEXT
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Who may manage offers is RLS above. The helpers stay internal; the shop calls only
--     bag_quote(), live_offer_cards(), check_discount() and place_order().
-- ---------------------------------------------------------------------------

COMMIT;
