-- ============================================================================
-- 64. Admin products and stock: atomic saves, stock that is never invented,
--     and a "Show in shop" switch
--
-- The old admin wrote products straight from the browser, one table at a
-- time: every save deleted the product's stock rows and recreated each size at
-- 50 (wiping the real counts), re-inserted tag-based collection links behind
-- the trigger's back, invented new product ids as max(id)+1 in the browser,
-- and reported success whether or not any of it worked.
--
-- This moves those writes into three admin-only functions, each one
-- transaction:
--
--   admin_save_product(p JSONB)   create or update a product, its sizes, the
--                                 starting stock of NEW sizes only, and its
--                                 hand-picked collections. Existing stock
--                                 counts are never touched; untracked sizes
--                                 stay untracked (a missing stock row means
--                                 "always available" to place_order).
--   admin_adjust_stock(...)       add received stock, or set a count with a
--                                 check that it has not changed since it was
--                                 read; set the low-stock warning level.
--   admin_delete_product(id)      refuses when the product is in past orders
--                                 (order lines keep only a link to it, so
--                                 deleting would blank its name out of them).
--
-- And products.is_published: a hidden product disappears from the shop (the
-- public read policy), while customers still see it in their own past orders
-- and admins see everything. place_order is untouched: a hidden product left
-- in an old cart can still be bought. Setting its stock to 0 stops that.
--
-- Safe to re-run. Nothing here depends on migration 62.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Prerequisites, checked before anything changes
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_missing TEXT[] := '{}';
    v_item TEXT;
BEGIN
    IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
        v_missing := v_missing || 'public.is_admin(uuid)'::TEXT;
    END IF;
    IF pg_get_serial_sequence('public.products', 'id') IS NULL THEN
        v_missing := v_missing || 'the products.id sequence'::TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_product_size') THEN
        v_missing := v_missing || 'inventory constraint unique_product_size'::TEXT;
    END IF;

    FOREACH v_item IN ARRAY ARRAY[
        'products.compare_at_price', 'products.cost_price', 'products.image_urls', 'products.tags',
        'products.top_notes', 'products.heart_notes', 'products.base_notes', 'products.olfactory_group',
        'products.is_new', 'products.is_bestseller', 'products.is_featured_large',
        'collections.type', 'product_collections.collection_id',
        'order_items.product_id', 'orders.customer_id', 'orders.email'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = split_part(v_item, '.', 1)
              AND column_name = split_part(v_item, '.', 2)
        ) THEN
            v_missing := v_missing || ('public.' || v_item);
        END IF;
    END LOOP;

    IF cardinality(v_missing) > 0 THEN
        RAISE EXCEPTION 'Migration 64 stopped before changing anything. Missing: %',
            array_to_string(v_missing, '; ')
            USING HINT = 'Apply the earlier migrations first (60 adds compare_at_price), then run 64 again.';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. "Show in shop"
-- ---------------------------------------------------------------------------

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;

-- The shop reads products with the public key. A hidden product is left out,
-- except for a signed-in customer who has ordered it (so their order history
-- keeps its name). Admins read everything through "Admin write access on
-- products" (migration 10).
DROP POLICY IF EXISTS "Allow public read on products" ON public.products;
DROP POLICY IF EXISTS "Public read published products" ON public.products;
CREATE POLICY "Public read published products" ON public.products
    FOR SELECT
    USING (
        is_published
        OR (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM public.order_items oi
                JOIN public.orders o ON o.id = oi.order_id
                WHERE oi.product_id = products.id
                  AND (o.customer_id = auth.uid() OR o.email = auth.email())
            )
        )
    );

-- ---------------------------------------------------------------------------
-- 2. Ids come from the sequence, kept above every existing product (and the
--    seeded range, as migration 37 set up). Never moves it backwards.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_seq REGCLASS := pg_get_serial_sequence('public.products', 'id')::REGCLASS;
    v_target BIGINT;
BEGIN
    SELECT GREATEST(COALESCE(MAX(id), 0), 4000, COALESCE(pg_sequence_last_value(v_seq), 0))
    INTO v_target
    FROM public.products;
    PERFORM setval(v_seq, v_target, true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Indexes for the admin's order lists and the checks below
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON public.order_tracking (order_id, id);

-- ---------------------------------------------------------------------------
-- 4. Helpers: strict readers for the JSON the admin sends
-- ---------------------------------------------------------------------------

-- A trimmed string field, or NULL. Raises if present but not a string or too long.
CREATE OR REPLACE FUNCTION public.admin_json_text(p JSONB, p_key TEXT, p_max INT)
RETURNS TEXT AS $$
DECLARE
    v TEXT;
BEGIN
    IF p IS NULL OR NOT (p ? p_key) OR jsonb_typeof(p -> p_key) = 'null' THEN
        RETURN NULL;
    END IF;
    IF jsonb_typeof(p -> p_key) <> 'string' THEN
        RAISE EXCEPTION 'invalid_%', p_key USING ERRCODE = '22023';
    END IF;
    v := btrim(p ->> p_key);
    IF length(v) > p_max THEN
        RAISE EXCEPTION 'too_long_%', p_key USING ERRCODE = '22023';
    END IF;
    RETURN NULLIF(v, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- An array of trimmed, non-empty, distinct strings in the order given.
CREATE OR REPLACE FUNCTION public.admin_json_text_array(p JSONB, p_key TEXT, p_max_items INT, p_max_len INT)
RETURNS TEXT[] AS $$
DECLARE
    v_out TEXT[] := '{}';
    v_item JSONB;
    v_text TEXT;
BEGIN
    IF p IS NULL OR NOT (p ? p_key) OR jsonb_typeof(p -> p_key) = 'null' THEN
        RETURN '{}';
    END IF;
    IF jsonb_typeof(p -> p_key) <> 'array' THEN
        RAISE EXCEPTION 'invalid_%', p_key USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p -> p_key) LOOP
        IF jsonb_typeof(v_item) <> 'string' THEN
            RAISE EXCEPTION 'invalid_%', p_key USING ERRCODE = '22023';
        END IF;
        v_text := btrim(v_item #>> '{}');
        IF v_text = '' THEN
            CONTINUE;
        END IF;
        IF length(v_text) > p_max_len THEN
            RAISE EXCEPTION 'too_long_%', p_key USING ERRCODE = '22023';
        END IF;
        IF NOT (v_text = ANY(v_out)) THEN
            v_out := v_out || v_text;
        END IF;
    END LOOP;
    IF cardinality(v_out) > p_max_items THEN
        RAISE EXCEPTION 'too_many_%', p_key USING ERRCODE = '22023';
    END IF;
    RETURN v_out;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- A money amount: a JSON number, two decimals at most, within bounds; NULL when absent.
CREATE OR REPLACE FUNCTION public.admin_json_money(p JSONB, p_key TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v NUMERIC;
BEGIN
    IF p IS NULL OR NOT (p ? p_key) OR jsonb_typeof(p -> p_key) = 'null' THEN
        RETURN NULL;
    END IF;
    IF jsonb_typeof(p -> p_key) <> 'number' THEN
        RAISE EXCEPTION 'invalid_%', p_key USING ERRCODE = '22023';
    END IF;
    v := (p ->> p_key)::NUMERIC;
    IF v < 0 OR v > 1000000 OR v <> round(v, 2) THEN
        RAISE EXCEPTION 'invalid_%', p_key USING ERRCODE = '22023';
    END IF;
    RETURN v;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- A whole number within bounds; NULL when absent.
CREATE OR REPLACE FUNCTION public.admin_json_count(p JSONB, p_key TEXT, p_max INT)
RETURNS INT AS $$
DECLARE
    v NUMERIC;
BEGIN
    IF p IS NULL OR NOT (p ? p_key) OR jsonb_typeof(p -> p_key) = 'null' THEN
        RETURN NULL;
    END IF;
    IF jsonb_typeof(p -> p_key) <> 'number' THEN
        RAISE EXCEPTION 'invalid_%', p_key USING ERRCODE = '22023';
    END IF;
    v := (p ->> p_key)::NUMERIC;
    IF v < 0 OR v > p_max OR v <> trunc(v) THEN
        RAISE EXCEPTION 'invalid_%', p_key USING ERRCODE = '22023';
    END IF;
    RETURN v::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 5. admin_save_product
--
-- Input (JSON):
--   id (number, to update) | omitted (to create)
--   brand, name, olfactory_group (required strings)
--   price (number > 0), compare_at_price (number | null), cost_price (number)
--   tagline, description (strings)
--   sizes (string[] ≥ 1), images (string[] ≤ 5; the first is the main photo)
--   tags, top_notes, heart_notes, base_notes (string[])
--   is_new, is_bestseller, is_featured_large, is_published (booleans)
--   stock { "<size>": { "initial": n, "threshold": n } }
--       initial: only for sizes that have no stock row yet (starts tracking);
--       threshold: the low-stock warning level for that size.
--   collections (string[]): the hand-picked collections; tag-based ones are
--       left to the trigger from migration 14.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_save_product(p JSONB)
RETURNS JSONB AS $$
DECLARE
    v_id INT;
    v_creating BOOLEAN;
    v_seq REGCLASS := pg_get_serial_sequence('public.products', 'id')::REGCLASS;
    v_max INT;
    v_brand TEXT;
    v_name TEXT;
    v_family TEXT;
    v_price NUMERIC;
    v_compare NUMERIC;
    v_cost NUMERIC;
    v_sizes TEXT[];
    v_images TEXT[];
    v_size TEXT;
    v_entry JSONB;
    v_initial INT;
    v_threshold INT;
    v_collections TEXT[];
    v_flags JSONB := '{}';
    v_key TEXT;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
    END IF;
    IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
        RAISE EXCEPTION 'invalid_product' USING ERRCODE = '22023';
    END IF;

    v_brand := upper(public.admin_json_text(p, 'brand', 255));
    v_name := public.admin_json_text(p, 'name', 255);
    v_family := public.admin_json_text(p, 'olfactory_group', 255);
    IF v_brand IS NULL THEN RAISE EXCEPTION 'missing_brand' USING ERRCODE = '22023'; END IF;
    IF v_name IS NULL THEN RAISE EXCEPTION 'missing_name' USING ERRCODE = '22023'; END IF;
    IF v_family IS NULL THEN RAISE EXCEPTION 'missing_olfactory_group' USING ERRCODE = '22023'; END IF;

    v_price := public.admin_json_money(p, 'price');
    IF v_price IS NULL OR v_price <= 0 THEN
        RAISE EXCEPTION 'invalid_price' USING ERRCODE = '22023';
    END IF;
    v_compare := public.admin_json_money(p, 'compare_at_price');
    IF v_compare IS NOT NULL AND v_compare <= 0 THEN
        v_compare := NULL;
    END IF;
    v_cost := COALESCE(public.admin_json_money(p, 'cost_price'), 0);

    v_sizes := public.admin_json_text_array(p, 'sizes', 12, 50);
    IF cardinality(v_sizes) = 0 THEN
        RAISE EXCEPTION 'missing_sizes' USING ERRCODE = '22023';
    END IF;
    v_images := public.admin_json_text_array(p, 'images', 5, 512);
    FOREACH v_size IN ARRAY v_images LOOP
        IF NOT (v_size LIKE 'https://%' OR v_size LIKE '/%') OR v_size LIKE '//%' THEN
            RAISE EXCEPTION 'invalid_images' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    FOREACH v_key IN ARRAY ARRAY['is_new', 'is_bestseller', 'is_featured_large', 'is_published'] LOOP
        IF p ? v_key AND jsonb_typeof(p -> v_key) NOT IN ('boolean', 'null') THEN
            RAISE EXCEPTION 'invalid_%', v_key USING ERRCODE = '22023';
        END IF;
    END LOOP;

    IF p ? 'id' AND jsonb_typeof(p -> 'id') <> 'null' THEN
        -- ── Update ──────────────────────────────────────────────────────
        v_creating := FALSE;
        v_id := public.admin_json_count(p, 'id', 2147483647);
        -- NO KEY UPDATE, not UPDATE: a checkout holding this product's stock rows
        -- takes a KEY SHARE lock on it (the order line's foreign key), which a
        -- full FOR UPDATE would block while this waited for the stock rows: a
        -- deadlock. Two saves of the same product still queue behind each other.
        PERFORM 1 FROM public.products WHERE id = v_id FOR NO KEY UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0002';
        END IF;

        UPDATE public.products SET
            brand = v_brand,
            name = v_name,
            olfactory_group = v_family,
            price = v_price,
            compare_at_price = v_compare,
            cost_price = v_cost,
            tagline = public.admin_json_text(p, 'tagline', 255),
            description = public.admin_json_text(p, 'description', 5000),
            sizes = v_sizes,
            image_url = COALESCE(v_images[1], '/placeholder-bottle.png'),
            image_urls = v_images,
            tags = ARRAY(SELECT lower(t) FROM unnest(public.admin_json_text_array(p, 'tags', 40, 50)) t),
            top_notes = public.admin_json_text_array(p, 'top_notes', 30, 80),
            heart_notes = public.admin_json_text_array(p, 'heart_notes', 30, 80),
            base_notes = public.admin_json_text_array(p, 'base_notes', 30, 80),
            is_new = COALESCE((p ->> 'is_new')::BOOLEAN, is_new),
            is_bestseller = COALESCE((p ->> 'is_bestseller')::BOOLEAN, is_bestseller),
            is_featured_large = COALESCE((p ->> 'is_featured_large')::BOOLEAN, is_featured_large),
            is_published = COALESCE((p ->> 'is_published')::BOOLEAN, is_published)
        WHERE id = v_id;
    ELSE
        -- ── Create ──────────────────────────────────────────────────────
        -- One creator at a time picks the id: from the sequence, but never at
        -- or below an id that already exists.
        v_creating := TRUE;
        PERFORM pg_advisory_xact_lock(hashtext('public.products.id'));
        v_id := nextval(v_seq);
        SELECT COALESCE(MAX(id), 0) INTO v_max FROM public.products;
        IF v_id <= v_max THEN
            v_id := v_max + 1;
            PERFORM setval(v_seq, v_id, true);
        END IF;

        INSERT INTO public.products (
            id, brand, name, olfactory_group, price, compare_at_price, cost_price, tagline, description,
            sizes, image_url, image_urls, tags, top_notes, heart_notes, base_notes,
            is_new, is_bestseller, is_featured_large, is_published
        ) VALUES (
            v_id, v_brand, v_name, v_family, v_price, v_compare, v_cost,
            public.admin_json_text(p, 'tagline', 255),
            public.admin_json_text(p, 'description', 5000),
            v_sizes,
            COALESCE(v_images[1], '/placeholder-bottle.png'),
            v_images,
            ARRAY(SELECT lower(t) FROM unnest(public.admin_json_text_array(p, 'tags', 40, 50)) t),
            public.admin_json_text_array(p, 'top_notes', 30, 80),
            public.admin_json_text_array(p, 'heart_notes', 30, 80),
            public.admin_json_text_array(p, 'base_notes', 30, 80),
            COALESCE((p ->> 'is_new')::BOOLEAN, TRUE),
            COALESCE((p ->> 'is_bestseller')::BOOLEAN, FALSE),
            COALESCE((p ->> 'is_featured_large')::BOOLEAN, FALSE),
            COALESCE((p ->> 'is_published')::BOOLEAN, TRUE)
        );
    END IF;

    -- ── Stock ───────────────────────────────────────────────────────────
    -- Lock this product's stock rows in place_order's order (product, size),
    -- so a save and a checkout can never deadlock.
    PERFORM 1 FROM public.inventory WHERE product_id = v_id ORDER BY size FOR UPDATE;

    -- A size taken off the product takes its stock row with it.
    DELETE FROM public.inventory WHERE product_id = v_id AND NOT (size = ANY (v_sizes));

    IF p ? 'stock' AND jsonb_typeof(p -> 'stock') NOT IN ('object', 'null') THEN
        RAISE EXCEPTION 'invalid_stock' USING ERRCODE = '22023';
    END IF;
    FOREACH v_size IN ARRAY v_sizes LOOP
        v_entry := p -> 'stock' -> v_size;
        IF v_entry IS NULL OR jsonb_typeof(v_entry) = 'null' THEN
            CONTINUE;
        END IF;
        IF jsonb_typeof(v_entry) <> 'object' THEN
            RAISE EXCEPTION 'invalid_stock' USING ERRCODE = '22023';
        END IF;
        v_initial := public.admin_json_count(v_entry, 'initial', 100000);
        v_threshold := public.admin_json_count(v_entry, 'threshold', 100000);
        IF v_initial IS NOT NULL THEN
            -- Only ever STARTS tracking a size: an existing count is never replaced.
            INSERT INTO public.inventory (product_id, size, stock_level, low_stock_threshold)
            VALUES (v_id, v_size, v_initial, COALESCE(v_threshold, 5))
            ON CONFLICT (product_id, size) DO NOTHING;
        END IF;
        IF v_threshold IS NOT NULL THEN
            UPDATE public.inventory SET low_stock_threshold = v_threshold, updated_at = now()
            WHERE product_id = v_id AND size = v_size;
        END IF;
    END LOOP;

    -- ── Hand-picked collections ─────────────────────────────────────────
    IF p ? 'collections' THEN
        v_collections := public.admin_json_text_array(p, 'collections', 100, 100);
        DELETE FROM public.product_collections pc
        USING public.collections c
        WHERE pc.product_id = v_id
          AND c.id = pc.collection_id
          AND COALESCE(c.type, 'manual') <> 'automated'
          AND NOT (pc.collection_id = ANY (v_collections));
        INSERT INTO public.product_collections (product_id, collection_id)
        SELECT v_id, c.id
        FROM public.collections c
        WHERE c.id = ANY (v_collections)
          AND COALESCE(c.type, 'manual') <> 'automated'
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object('ok', TRUE, 'id', v_id, 'created', v_creating);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 6. admin_adjust_stock
--
--   p_mode 'add'       received stock: count + p_value (starts tracking if the
--                      size had no row). Never conflicts.
--   p_mode 'set'       a stocktake: count = p_value, but only if the count is
--                      still p_expected (when given); otherwise nothing changes
--                      and the current count comes back as 'changed'.
--   p_mode 'threshold' the low-stock warning level for a tracked size.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_adjust_stock(
    p_product_id INT,
    p_size TEXT,
    p_mode TEXT,
    p_value INT,
    p_expected INT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_sizes TEXT[];
    v_row public.inventory%ROWTYPE;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
    END IF;
    IF p_mode NOT IN ('add', 'set', 'threshold') THEN
        RAISE EXCEPTION 'invalid_mode' USING ERRCODE = '22023';
    END IF;
    IF p_value IS NULL OR p_value < 0 OR p_value > 100000 OR (p_mode = 'add' AND p_value = 0) THEN
        RAISE EXCEPTION 'invalid_value' USING ERRCODE = '22023';
    END IF;

    SELECT sizes INTO v_sizes FROM public.products WHERE id = p_product_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;
    IF p_size IS NULL OR NOT (p_size = ANY (v_sizes)) THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'unknown_size');
    END IF;

    SELECT * INTO v_row FROM public.inventory
    WHERE product_id = p_product_id AND size = p_size
    FOR UPDATE;

    IF NOT FOUND THEN
        IF p_mode = 'threshold' THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'untracked');
        END IF;
        -- First count for this size: it is tracked from now on.
        INSERT INTO public.inventory (product_id, size, stock_level, low_stock_threshold)
        VALUES (p_product_id, p_size, p_value, 5)
        ON CONFLICT (product_id, size) DO NOTHING
        RETURNING * INTO v_row;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'changed');
        END IF;
    ELSIF p_mode = 'add' THEN
        UPDATE public.inventory SET stock_level = stock_level + p_value, updated_at = now()
        WHERE id = v_row.id
        RETURNING * INTO v_row;
    ELSIF p_mode = 'set' THEN
        IF p_expected IS NOT NULL AND v_row.stock_level <> p_expected THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'changed', 'stock_level', v_row.stock_level);
        END IF;
        UPDATE public.inventory SET stock_level = p_value, updated_at = now()
        WHERE id = v_row.id
        RETURNING * INTO v_row;
    ELSE
        UPDATE public.inventory SET low_stock_threshold = p_value, updated_at = now()
        WHERE id = v_row.id
        RETURNING * INTO v_row;
    END IF;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'stock_level', v_row.stock_level,
        'low_stock_threshold', v_row.low_stock_threshold
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 7. admin_delete_product
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_product(p_id INT)
RETURNS JSONB AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
    END IF;
    -- Stock rows first, in place_order's order, then the product: a checkout
    -- of this product finishes (and its order line is seen below) before the
    -- delete goes ahead, instead of the two deadlocking.
    PERFORM 1 FROM public.inventory WHERE product_id = p_id ORDER BY size FOR UPDATE;
    PERFORM 1 FROM public.products WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;
    IF EXISTS (SELECT 1 FROM public.order_items WHERE product_id = p_id) THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'has_orders');
    END IF;
    -- Its stock rows and collection links go with it (ON DELETE CASCADE).
    DELETE FROM public.products WHERE id = p_id;
    RETURN jsonb_build_object('ok', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 8. Who may call what
--
-- Supabase's default privileges grant EXECUTE to anon and authenticated
-- directly, so every function is revoked from all three first. The helpers
-- are internal; the three admin functions are callable by signed-in users and
-- refuse anyone who is not an admin.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.admin_json_text(JSONB, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_json_text_array(JSONB, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_json_money(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_json_count(JSONB, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_save_product(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_adjust_stock(INT, TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_product(INT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_save_product(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_stock(INT, TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- To undo the "Show in shop" rule only (every product visible again):
--
--   DROP POLICY IF EXISTS "Public read published products" ON public.products;
--   CREATE POLICY "Allow public read on products" ON public.products FOR SELECT USING (true);
-- ---------------------------------------------------------------------------
