-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Migration 70: growth features, each with an on/off switch and settings in the admin
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- One table of switches (store_features) holds, for every feature, whether it is on and its
-- settings. Everything starts OFF: until the owner switches a feature on, the shop behaves
-- exactly as before this migration.
--
--   one_page_checkout   checkout opens straight on the details form (bag editable beside it)
--   trust_strip         reassurance lines at checkout (and on product pages)
--   delivery_estimate   "Order within 3 h for delivery tomorrow"
--   pay_later           Tabby / Tamara instalment line (the payment itself is Paymob's)
--   wallet_badges       Apple Pay / Google Pay / card marks, shown up front
--   demand_signals      "12 bought this week", "Bestseller in Woody & Oud" (real orders)
--   gift_options        gift wrap (paid or free), a gift message, prices left off the slip
--   send_to_someone     a recipient's name and phone, and an optional delivery date
--   gift_cards          digital gift cards, bought online and emailed to the recipient
--   shop_filters        notes, occasion, season, strength and how long it lasts
--   inspired_by         "If you love <a famous scent>" lines and search
--   recently_viewed     recently viewed perfumes and a "back for more?" prompt
--   reorder_reminders   an email N days after delivery: "Running low? Reorder in one tap"
--   back_in_stock       "Notify me" on sold-out sizes, and the email when they're back
--   referrals           "Give AED 50, get AED 50" with a personal code and link
--   loyalty             points per dirham, redeemable at checkout, and a birthday gift
--   cart_reminders      automatic cart reminders; the last one carries a single-use code
--   welcome_offer       "join the list" offer shown at the end of a visit (a personal code)
--
-- What changes for an order (place_order, re-created with one extra, optional argument
-- p_options; called without it, it behaves exactly as migration 69's):
--   • gift wrap fee, gift message, "leave prices off", recipient and delivery date;
--   • loyalty points used, and a gift card (or reward credit) spent;
--   • personal codes: one person's code (issued_for), first order only, referral codes,
--     and codes that bring a free gift (the welcome "discovery vial");
--   • an order the gift card / points pay for in full is recorded as paid ('credit').
-- The payment lines are unchanged: order_payments.amount_fils is still the order total
-- times 100, so Paymob is asked for exactly what is left to pay.
--
-- Points are credited when an order is delivered; cancelling an order gives back the points
-- and gift card balance it used (triggers, so every cancel path is covered, including an
-- unpaid online order released by the payment job).
--
-- The scheduled jobs (gift card delivery, back-in-stock, reorder reminders, birthdays,
-- cart-reminder codes) check the CART_RECOVERY secret (app_config row 'cart_recovery', as
-- migration 45), so the existing CART_RECOVERY_SECRET is all the server needs.
--
-- The old gift_cards rows (sample data from migration 03, never used by checkout) are
-- switched off: redeeming a card is now real money.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
    v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF to_regprocedure('public.offer_quote(jsonb)') IS NULL THEN
        v_missing := array_append(v_missing, 'public.offer_quote (migration 69)');
    END IF;
    IF to_regprocedure('public.bag_quote(jsonb, text)') IS NULL THEN
        v_missing := array_append(v_missing, 'public.bag_quote (migration 69)');
    END IF;
    IF to_regclass('public.order_payments') IS NULL THEN
        v_missing := array_append(v_missing, 'public.order_payments (migration 63)');
    END IF;
    IF to_regprocedure('public.verify_job_secret(text, text)') IS NULL THEN
        v_missing := array_append(v_missing, 'public.verify_job_secret (migration 45)');
    END IF;
    IF to_regprocedure('public.subscribe_newsletter(text, text)') IS NULL THEN
        v_missing := array_append(v_missing, 'public.subscribe_newsletter (migration 41)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'combines_with_offers') THEN
        v_missing := array_append(v_missing, 'public.discounts.combines_with_offers (migration 69)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'street') THEN
        v_missing := array_append(v_missing, 'public.customers.street (migration 51)');
    END IF;
    IF array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'Migration 70 needs these first: %', array_to_string(v_missing, ', ');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. The switches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_features (
    key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID
);
ALTER TABLE public.store_features ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_features FROM PUBLIC, anon, authenticated;

INSERT INTO public.store_features (key) VALUES
    ('one_page_checkout'), ('trust_strip'), ('delivery_estimate'), ('pay_later'), ('wallet_badges'),
    ('demand_signals'), ('gift_options'), ('send_to_someone'), ('gift_cards'), ('shop_filters'),
    ('inspired_by'), ('recently_viewed'), ('reorder_reminders'), ('back_in_stock'), ('referrals'),
    ('loyalty'), ('cart_reminders'), ('welcome_offer')
ON CONFLICT (key) DO NOTHING;

-- What went wrong inside a trigger or job, for the admin to see (never shown to shoppers).
CREATE TABLE IF NOT EXISTS public.growth_events (
    id BIGSERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (length(kind) <= 40),
    order_id TEXT,
    detail TEXT CHECK (length(detail) <= 400),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.growth_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.growth_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.growth_events TO authenticated;
DROP POLICY IF EXISTS "Admins read growth events" ON public.growth_events;
CREATE POLICY "Admins read growth events" ON public.growth_events
    FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.feature_on(p_key TEXT)
RETURNS BOOLEAN AS $$
    SELECT COALESCE((SELECT enabled FROM public.store_features WHERE key = p_key), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.feature_settings(p_key TEXT)
RETURNS JSONB AS $$
    SELECT COALESCE((SELECT settings FROM public.store_features WHERE key = p_key), '{}'::jsonb);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- A number from a feature's settings, kept within bounds; the default when absent or not a number.
CREATE OR REPLACE FUNCTION public.feature_num(p_settings JSONB, p_field TEXT, p_default NUMERIC, p_min NUMERIC, p_max NUMERIC)
RETURNS NUMERIC AS $$
    SELECT LEAST(GREATEST(
        CASE WHEN jsonb_typeof(p_settings -> p_field) = 'number' THEN (p_settings ->> p_field)::NUMERIC ELSE p_default END,
        p_min), p_max);
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.feature_bool(p_settings JSONB, p_field TEXT, p_default BOOLEAN)
RETURNS BOOLEAN AS $$
    SELECT CASE WHEN jsonb_typeof(p_settings -> p_field) = 'boolean' THEN (p_settings ->> p_field)::BOOLEAN ELSE p_default END;
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.feature_text(p_settings JSONB, p_field TEXT, p_default TEXT, p_max INT)
RETURNS TEXT AS $$
    SELECT left(COALESCE(NULLIF(btrim(CASE WHEN jsonb_typeof(p_settings -> p_field) = 'string'
                                           THEN p_settings ->> p_field END), ''), p_default), p_max);
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

-- An unguessable code from an alphabet without look-alike characters (no 0/O, 1/I/L).
CREATE OR REPLACE FUNCTION public.growth_random_code(p_len INT)
RETURNS TEXT AS $$
DECLARE
    v_alphabet CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    v_raw BYTEA := decode(replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', ''), 'hex');
    v_out TEXT := '';
    i INT;
BEGIN
    FOR i IN 0 .. LEAST(GREATEST(COALESCE(p_len, 6), 1), 24) - 1 LOOP
        -- Bytes 6 and 8 of each UUID carry its version and variant; skip past them.
        v_out := v_out || substr(v_alphabet, (get_byte(v_raw, CASE WHEN i >= 6 THEN i + 3 ELSE i END) % 32) + 1, 1);
    END LOOP;
    RETURN v_out;
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp;

-- True only for the JSON value true (so "yes", 1 or a string never counts, and never errors).
CREATE OR REPLACE FUNCTION public.opt_true(p JSONB, p_field TEXT)
RETURNS BOOLEAN AS $$
    SELECT COALESCE(p -> p_field = 'true'::jsonb, FALSE);
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

-- The shop's view of the switches: every feature, on or off, and its settings. No secrets.
CREATE OR REPLACE FUNCTION public.get_store_features()
RETURNS JSONB AS $$
    SELECT COALESCE(jsonb_object_agg(key, jsonb_build_object('enabled', enabled, 'settings', settings,
                                                             'updated_at', updated_at)), '{}'::jsonb)
    FROM public.store_features;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.feature_on(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feature_settings(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.growth_random_code(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feature_num(JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feature_bool(JSONB, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feature_text(JSONB, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.opt_true(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_store_features() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_features() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Products: filters and "inspired by"
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS occasions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seasons TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS strength TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS longevity TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS inspired_by TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_growth_attributes_check') THEN
        ALTER TABLE public.products ADD CONSTRAINT products_growth_attributes_check CHECK (
            (strength IS NULL OR strength IN ('light', 'moderate', 'strong', 'intense'))
            AND (longevity IS NULL OR longevity IN ('short', 'moderate', 'long', 'very_long'))
            AND (inspired_by IS NULL OR char_length(inspired_by) BETWEEN 1 AND 120)
            AND occasions <@ ARRAY['everyday', 'office', 'evening', 'date', 'special', 'travel']::TEXT[]
            AND seasons <@ ARRAY['spring', 'summer', 'autumn', 'winter']::TEXT[]
        );
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Orders: gift options, recipient, credits, and when it was delivered
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_kind TEXT NOT NULL DEFAULT 'goods';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gift_wrap BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gift_wrap_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gift_message TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS hide_prices BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS send_to_other BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS recipient_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS points_redeemed INT NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS points_value NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS points_earned INT NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gift_card_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gift_card_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reorder_reminded_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_growth_check') THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_growth_check CHECK (
            order_kind IN ('goods', 'gift_card')
            AND gift_wrap_fee >= 0 AND points_redeemed >= 0 AND points_value >= 0
            AND points_earned >= 0 AND gift_card_amount >= 0
            AND (gift_message IS NULL OR char_length(gift_message) <= 500)
            AND (recipient_name IS NULL OR char_length(recipient_name) <= 120)
            AND (recipient_phone IS NULL OR char_length(recipient_phone) <= 50)
        );
    END IF;
END $$;

-- Orders delivered before this migration: when, as near as the timeline knows.
UPDATE public.orders o
SET delivered_at = COALESCE(
        (SELECT max(t.updated_at) FROM public.order_tracking t
         WHERE t.order_id = o.id AND t.status ILIKE 'delivered%'),
        o.updated_at, o.created_at)
WHERE o.status = 'delivered' AND o.delivered_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_delivered_at_idx ON public.orders (delivered_at) WHERE status = 'delivered';
CREATE INDEX IF NOT EXISTS orders_email_lower_idx ON public.orders (lower(email));

-- ---------------------------------------------------------------------------
-- 4. Discount codes for one person: welcome, cart-reminder and referral codes
-- ---------------------------------------------------------------------------
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS issued_for TEXT;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS first_order_only BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS referrer_id UUID;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS gift_product_id INT;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS gift_size TEXT;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS source_ref TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discounts_kind_check') THEN
        ALTER TABLE public.discounts ADD CONSTRAINT discounts_kind_check
            CHECK (kind IN ('manual', 'welcome', 'recovery', 'referral'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS discounts_issued_for_idx ON public.discounts (issued_for) WHERE issued_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS discounts_source_ref_idx ON public.discounts (source_ref) WHERE source_ref IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Gift cards (the old table, finally used) and their ledger
-- ---------------------------------------------------------------------------
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS status TEXT;
-- Rows from before this migration are sample data: switched off for good.
UPDATE public.gift_cards SET kind = 'legacy', status = 'void', is_active = FALSE, balance = 0 WHERE kind IS NULL;
UPDATE public.gift_cards SET status = 'void' WHERE status IS NULL;
ALTER TABLE public.gift_cards ALTER COLUMN kind SET DEFAULT 'purchased';
ALTER TABLE public.gift_cards ALTER COLUMN kind SET NOT NULL;
ALTER TABLE public.gift_cards ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.gift_cards ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS send_on DATE;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS buyer_notified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS created_by UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_cards_growth_check') THEN
        ALTER TABLE public.gift_cards ADD CONSTRAINT gift_cards_growth_check CHECK (
            kind IN ('purchased', 'issued', 'reward', 'legacy')
            AND status IN ('pending', 'active', 'void')
            AND balance >= 0 AND balance <= initial_value
            AND (message IS NULL OR char_length(message) <= 400)
            AND (recipient_name IS NULL OR char_length(recipient_name) <= 120)
            AND (sender_name IS NULL OR char_length(sender_name) <= 120)
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS gift_cards_code_norm_idx ON public.gift_cards ((regexp_replace(upper(code), '[^A-Z0-9]', '', 'g')));
CREATE INDEX IF NOT EXISTS gift_cards_order_idx ON public.gift_cards (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gift_cards_customer_idx ON public.gift_cards (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gift_cards_due_idx ON public.gift_cards (created_at) WHERE status = 'active' AND sent_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gift_card_ledger (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL REFERENCES public.gift_cards(code) ON DELETE CASCADE,
    order_id TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount <> 0),
    kind TEXT NOT NULL CHECK (kind IN ('issue', 'spend', 'restore', 'void', 'adjust')),
    note TEXT CHECK (length(note) <= 200),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gift_card_ledger_order_idx ON public.gift_card_ledger (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gift_card_ledger_code_idx ON public.gift_card_ledger (code, created_at);
ALTER TABLE public.gift_card_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gift_card_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.gift_card_ledger TO authenticated;
DROP POLICY IF EXISTS "Admins read the gift card ledger" ON public.gift_card_ledger;
CREATE POLICY "Admins read the gift card ledger" ON public.gift_card_ledger
    FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Loyalty points: one ledger, no balance column anyone could edit
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birthday DATE;

CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
    id BIGSERIAL PRIMARY KEY,
    customer_id UUID NOT NULL,
    points INT NOT NULL CHECK (points <> 0),
    kind TEXT NOT NULL CHECK (kind IN ('earn', 'redeem', 'restore', 'reverse', 'birthday', 'bonus', 'adjust', 'expire')),
    order_id TEXT,
    note TEXT CHECK (length(note) <= 200),
    available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID
);
CREATE INDEX IF NOT EXISTS loyalty_ledger_customer_idx ON public.loyalty_ledger (customer_id, created_at DESC);
-- One of each per order, so a trigger firing twice can never pay out twice.
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_order_once ON public.loyalty_ledger (order_id, kind)
    WHERE order_id IS NOT NULL AND kind IN ('earn', 'redeem', 'restore', 'reverse');
-- One birthday gift a year (note holds the year).
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_birthday_once ON public.loyalty_ledger (customer_id, note)
    WHERE kind = 'birthday';
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.loyalty_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.loyalty_ledger TO authenticated;
DROP POLICY IF EXISTS "Shoppers read their own points" ON public.loyalty_ledger;
CREATE POLICY "Shoppers read their own points" ON public.loyalty_ledger
    FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.is_admin(auth.uid()));

-- A shopper may set their birthday once (it decides a yearly gift); after that only an admin can change it.
CREATE OR REPLACE FUNCTION public.pin_customer_birthday()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
        RETURN NEW;
    END IF;
    IF OLD.birthday IS NOT NULL THEN
        NEW.birthday := OLD.birthday;
    ELSIF NEW.birthday IS NOT NULL AND (NEW.birthday > CURRENT_DATE OR NEW.birthday < DATE '1900-01-01') THEN
        NEW.birthday := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS pin_customer_birthday ON public.customers;
CREATE TRIGGER pin_customer_birthday
    BEFORE UPDATE OF birthday ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.pin_customer_birthday();

-- The points a shopper can spend now (pending ones excluded), after the inactivity rule.
CREATE OR REPLACE FUNCTION public.loyalty_available(p_customer UUID)
RETURNS INT AS $$
DECLARE
    v_raw INT;
    v_last TIMESTAMP WITH TIME ZONE;
    v_months INT := public.feature_num(public.feature_settings('loyalty'), 'expiry_months', 12, 0, 60)::INT;
BEGIN
    IF p_customer IS NULL THEN
        RETURN 0;
    END IF;
    SELECT COALESCE(sum(points), 0) INTO v_raw
    FROM public.loyalty_ledger WHERE customer_id = p_customer AND available_at <= now();
    IF v_months > 0 THEN
        SELECT max(created_at) INTO v_last FROM public.loyalty_ledger
        WHERE customer_id = p_customer AND kind IN ('earn', 'redeem', 'birthday', 'bonus', 'adjust');
        IF v_last IS NOT NULL AND v_last < now() - make_interval(months => v_months) THEN
            RETURN 0;
        END IF;
    END IF;
    RETURN GREATEST(v_raw, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Writes the expiry the read above only assumes, so later points don't revive old ones.
CREATE OR REPLACE FUNCTION public.loyalty_settle(p_customer UUID)
RETURNS VOID AS $$
DECLARE
    v_raw INT;
BEGIN
    IF p_customer IS NULL OR public.loyalty_available(p_customer) > 0 THEN
        RETURN;
    END IF;
    SELECT COALESCE(sum(points), 0) INTO v_raw
    FROM public.loyalty_ledger WHERE customer_id = p_customer AND available_at <= now();
    IF v_raw > 0 THEN
        INSERT INTO public.loyalty_ledger (customer_id, points, kind, note)
        VALUES (p_customer, -v_raw, 'expire', 'Expired after a period without activity');
    END IF;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- What points are worth for an order: blocks of redeem_points, each worth redeem_value_aed,
-- capped at max_share_pct of the goods (after offers and codes).
CREATE OR REPLACE FUNCTION public.loyalty_redeemable(p_available INT, p_goods NUMERIC)
RETURNS JSONB AS $$
DECLARE
    v_s JSONB := public.feature_settings('loyalty');
    v_points INT := public.feature_num(v_s, 'redeem_points', 100, 1, 100000)::INT;
    v_value NUMERIC := public.feature_num(v_s, 'redeem_value_aed', 5, 1, 10000);
    v_min INT := public.feature_num(v_s, 'min_redeem', 100, 0, 100000)::INT;
    v_share NUMERIC := public.feature_num(v_s, 'max_share_pct', 50, 1, 100);
    v_blocks INT := 0;
BEGIN
    IF COALESCE(p_available, 0) >= GREATEST(v_min, 1) AND COALESCE(p_goods, 0) > 0 THEN
        v_blocks := LEAST(floor(p_available::NUMERIC / v_points),
                          floor(floor(p_goods * v_share / 100) / v_value))::INT;
    END IF;
    RETURN jsonb_build_object(
        'blocks', GREATEST(v_blocks, 0),
        'points', GREATEST(v_blocks, 0) * v_points,
        'value', GREATEST(v_blocks, 0) * v_value,
        'redeem_points', v_points, 'redeem_value', v_value, 'min_redeem', v_min, 'max_share_pct', v_share);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Points an order earns: earn_points for every earn_per_aed spent on goods.
CREATE OR REPLACE FUNCTION public.loyalty_earned(p_base NUMERIC)
RETURNS INT AS $$
    SELECT CASE WHEN COALESCE(p_base, 0) <= 0 THEN 0 ELSE
        (floor(p_base / public.feature_num(public.feature_settings('loyalty'), 'earn_per_aed', 1, 1, 1000))
         * public.feature_num(public.feature_settings('loyalty'), 'earn_points', 1, 0, 1000))::INT END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.loyalty_available(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_settle(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_redeemable(INT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_earned(NUMERIC) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Referrals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_codes (
    customer_id UUID PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{2,8}-[A-Z0-9]{4}$'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.referral_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.referral_codes TO authenticated;
DROP POLICY IF EXISTS "Read own referral code" ON public.referral_codes;
CREATE POLICY "Read own referral code" ON public.referral_codes
    FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.referrals (
    id BIGSERIAL PRIMARY KEY,
    referrer_id UUID NOT NULL,
    code TEXT NOT NULL,
    order_id TEXT NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    friend_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rewarded', 'capped', 'cancelled')),
    reward_code VARCHAR(100),
    reward_amount NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    rewarded_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id, created_at DESC);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.referrals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.referrals TO authenticated;
DROP POLICY IF EXISTS "Admins read referrals" ON public.referrals;
CREATE POLICY "Admins read referrals" ON public.referrals
    FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Keeps every referral code's discount in step with the owner's settings.
CREATE OR REPLACE FUNCTION public.referral_sync_discounts()
RETURNS VOID AS $$
DECLARE
    v_s JSONB := public.feature_settings('referrals');
BEGIN
    UPDATE public.discounts SET
        type = 'fixed_amount',
        value = public.feature_num(v_s, 'friend_reward', 50, 5, 1000),
        min_requirement = public.feature_num(v_s, 'friend_min_order', 200, 0, 10000),
        is_active = public.feature_on('referrals'),
        first_order_only = TRUE,
        usage_limit = NULL,
        ends_at = NULL
    WHERE kind = 'referral';
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.referral_sync_discounts() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Back-in-stock requests and marketing opt-outs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_alerts (
    id BIGSERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size TEXT NOT NULL CHECK (length(size) <= 50),
    email TEXT NOT NULL CHECK (length(email) <= 255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notified_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX IF NOT EXISTS stock_alerts_open_once ON public.stock_alerts (product_id, size, email)
    WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS stock_alerts_waiting_idx ON public.stock_alerts (created_at) WHERE notified_at IS NULL;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stock_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.stock_alerts TO authenticated;
DROP POLICY IF EXISTS "Admins manage stock alerts" ON public.stock_alerts;
CREATE POLICY "Admins manage stock alerts" ON public.stock_alerts
    FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.marketing_optouts (
    email TEXT PRIMARY KEY CHECK (email = lower(email) AND length(email) <= 255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_optouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketing_optouts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.marketing_optouts TO authenticated;
DROP POLICY IF EXISTS "Admins read opt-outs" ON public.marketing_optouts;
CREATE POLICY "Admins read opt-outs" ON public.marketing_optouts
    FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 9. code_check(): migration 69's, plus codes that bring a free gift (type 'gift')
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
    v_gift JSONB;
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

    -- Migration 70: a code whose reward is a perfume, added free.
    IF v_discount.type = 'gift' THEN
        SELECT jsonb_build_object('product_id', p.id, 'name', replace(p.name, '_', ' '), 'brand', p.brand,
                                  'size', COALESCE(NULLIF(v_discount.gift_size, ''), p.sizes[1]),
                                  'image_url', p.image_url, 'value', p.price)
        INTO v_gift FROM public.products p WHERE p.id = v_discount.gift_product_id;
        IF v_gift IS NULL OR NOT public.offer_in_stock((v_gift->>'product_id')::INT, v_gift->>'size') THEN
            RETURN jsonb_build_object('valid', FALSE, 'discount_amount', 0, 'reason', 'gift_unavailable', 'minimum', NULL);
        END IF;
        RETURN jsonb_build_object('valid', TRUE, 'discount_amount', 0, 'reason', NULL, 'goods', 0, 'delivery', 0,
                                  'applies_to', 'order', 'applies_label', 'a free gift', 'gift', v_gift,
                                  'combines_with_offers', TRUE, 'priced', TRUE,
                                  'personal', v_discount.issued_for IS NOT NULL OR v_discount.first_order_only);
    END IF;

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
                              'priced', TRUE,
                              'personal', v_discount.issued_for IS NOT NULL OR v_discount.first_order_only);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.code_check(TEXT, JSONB, NUMERIC, JSONB) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. checkout_quote(): the bag (bag_quote) plus gift wrap, points and a gift card.
--     The checkout's figures; place_order() charges the same.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gift_card_find(p_code TEXT)
RETURNS public.gift_cards AS $$
    SELECT g.* FROM public.gift_cards g
    WHERE regexp_replace(upper(g.code), '[^A-Z0-9]', '', 'g')
          = regexp_replace(upper(COALESCE(p_code, '')), '[^A-Z0-9]', '', 'g')
      AND length(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9]', '', 'g')) >= 8
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.gift_card_find(TEXT) FROM PUBLIC, anon, authenticated;

-- 'ok' when the card can be spent now; otherwise why not.
CREATE OR REPLACE FUNCTION public.gift_card_state(g public.gift_cards)
RETURNS TEXT AS $$
    SELECT CASE
        WHEN g.code IS NULL OR g.status <> 'active' OR g.is_active IS FALSE THEN 'invalid'
        WHEN g.expires_at IS NOT NULL AND g.expires_at < now() THEN 'expired'
        WHEN g.balance <= 0 THEN 'empty'
        ELSE 'ok' END;
$$ LANGUAGE sql STABLE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.gift_card_state(public.gift_cards) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.checkout_quote(p_items JSONB, p_code TEXT DEFAULT NULL, p_options JSONB DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_opts JSONB := CASE WHEN jsonb_typeof(p_options) = 'object' THEN p_options ELSE '{}'::jsonb END;
    v_q JSONB := public.bag_quote(p_items, p_code);
    v_gift_s JSONB := public.feature_settings('gift_options');
    v_wrap_fee NUMERIC := 0;
    v_offer_wraps BOOLEAN;
    v_total NUMERIC;
    v_goods NUMERIC;
    v_uid UUID := auth.uid();
    v_available INT := 0;
    v_redeem JSONB := NULL;
    v_points_used INT := 0;
    v_points_value NUMERIC := 0;
    v_card public.gift_cards;
    v_card_state TEXT := NULL;
    v_card_amount NUMERIC := 0;
BEGIN
    v_total := COALESCE((v_q->>'total')::NUMERIC, 0);
    v_goods := GREATEST(COALESCE((v_q->>'subtotal')::NUMERIC, 0) - COALESCE((v_q->>'offer_saving')::NUMERIC, 0)
                        - COALESCE((v_q->>'code_goods')::NUMERIC, 0), 0);
    SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_q->'applied', '[]'::jsonb)) a
                   WHERE COALESCE((a->>'gift_wrap')::BOOLEAN, FALSE)) INTO v_offer_wraps;

    IF public.feature_on('gift_options') AND public.feature_bool(v_gift_s, 'wrap_enabled', TRUE)
       AND public.opt_true(v_opts, 'gift_wrap') AND NOT v_offer_wraps THEN
        v_wrap_fee := public.feature_num(v_gift_s, 'wrap_price', 15, 0, 500);
    END IF;
    v_total := v_total + v_wrap_fee;

    IF public.feature_on('loyalty') AND v_uid IS NOT NULL THEN
        v_available := public.loyalty_available(v_uid);
        v_redeem := public.loyalty_redeemable(v_available, v_goods);
        IF public.opt_true(v_opts, 'use_points') THEN
            v_points_used := COALESCE((v_redeem->>'points')::INT, 0);
            v_points_value := LEAST(COALESCE((v_redeem->>'value')::NUMERIC, 0), v_total);
        END IF;
    END IF;
    v_total := v_total - v_points_value;

    IF length(regexp_replace(COALESCE(v_opts->>'gift_card', ''), '[^A-Za-z0-9]', '', 'g')) > 0 THEN
        v_card := public.gift_card_find(v_opts->>'gift_card');
        v_card_state := public.gift_card_state(v_card);
        IF v_card_state = 'ok' THEN
            v_card_amount := LEAST(v_card.balance, v_total);
        END IF;
    END IF;
    v_total := v_total - v_card_amount;

    RETURN v_q || jsonb_build_object(
        'gift_wrap_fee', v_wrap_fee,
        'gift_wrap_included', v_offer_wraps,
        'points', CASE WHEN v_redeem IS NULL THEN NULL ELSE jsonb_build_object(
            'available', v_available, 'usable', COALESCE((v_redeem->>'points')::INT, 0),
            'usable_value', COALESCE((v_redeem->>'value')::NUMERIC, 0),
            'used', v_points_used, 'value', v_points_value,
            'min_redeem', (v_redeem->>'min_redeem')::INT) END,
        'gift_card', CASE WHEN v_card_state IS NULL THEN NULL ELSE jsonb_build_object(
            'status', v_card_state, 'amount', v_card_amount,
            'balance', CASE WHEN v_card_state = 'ok' THEN v_card.balance END,
            'balance_after', CASE WHEN v_card_state = 'ok' THEN v_card.balance - v_card_amount END) END,
        'total_before_credits', v_total + v_points_value + v_card_amount,
        'total', GREATEST(v_total, 0)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.checkout_quote(JSONB, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_quote(JSONB, TEXT, JSONB) TO anon, authenticated;

-- A gift card's balance, for the "check your balance" box. Rate-limited by the app.
CREATE OR REPLACE FUNCTION public.check_gift_card(p_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_card public.gift_cards := public.gift_card_find(p_code);
    v_state TEXT := public.gift_card_state(v_card);
BEGIN
    RETURN jsonb_build_object('status', v_state,
                              'balance', CASE WHEN v_state IN ('ok', 'empty') THEN v_card.balance END,
                              'expires_at', CASE WHEN v_state IN ('ok', 'empty', 'expired') THEN v_card.expires_at END);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.check_gift_card(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_gift_card(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. place_order(): migration 69's, plus p_options (all optional). Diff notes:
--   • a code's free gift joins the stock loop like the offer's gift ('gift_key' tells them apart);
--   • personal codes: issued_for, first_order_only, referral (not your own);
--   • after the 69 total: + gift wrap fee, − points, − gift card; paid in full → 'credit'/'paid';
--   • new columns are filled in; referrals/ledgers written after the order row.
--   The order_payments insert is unchanged (amount_fils = v_total * 100).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.place_order(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC, TEXT, TEXT);

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
    p_payment_status TEXT DEFAULT 'pending_collection',
    p_options JSONB DEFAULT NULL
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
    -- Migration 70
    v_opts JSONB := CASE WHEN jsonb_typeof(p_options) = 'object' THEN p_options ELSE '{}'::jsonb END;
    v_code_gift JSONB;
    v_dropped TEXT[] := ARRAY[]::TEXT[];
    v_gift_s JSONB;
    v_send_s JSONB;
    v_wrap BOOLEAN := FALSE;
    v_wrap_fee NUMERIC(10,2) := 0;
    v_message TEXT;
    v_hide_prices BOOLEAN := FALSE;
    v_other BOOLEAN := FALSE;
    v_recipient_name TEXT;
    v_recipient_phone TEXT;
    v_delivery_date DATE;
    v_today DATE := (now() AT TIME ZONE 'Asia/Dubai')::DATE;
    v_redeem JSONB;
    v_points_used INT := 0;
    v_points_value NUMERIC(10,2) := 0;
    v_points_earned INT := 0;
    v_card public.gift_cards;
    v_card_state TEXT;
    v_card_amount NUMERIC(10,2) := 0;
    v_paid_by_credit BOOLEAN := FALSE;
    v_method TEXT := p_payment_method;
    v_status TEXT := p_payment_status;
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
    -- reached through payment_apply_transaction(), which needs the secret
    -- (or, migration 70, when a gift card and points pay the whole order: see below).
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
            'gift', TRUE, 'gift_key', 'offer', 'offer_id', (v_gift->>'offer_id')::INT));
    END IF;

    -- Migration 70: a code whose reward is a perfume (the welcome offer). Read only here;
    -- the code itself is locked and checked after the stock loop, as before.
    IF p_discount_code IS NOT NULL AND length(trim(p_discount_code)) > 0 THEN
        SELECT jsonb_build_object('product_id', d.gift_product_id,
                                  'size', COALESCE(NULLIF(d.gift_size, ''), (SELECT p.sizes[1] FROM public.products p WHERE p.id = d.gift_product_id), ''))
        INTO v_code_gift
        FROM public.discounts d
        WHERE upper(d.code) = upper(trim(p_discount_code)) AND d.is_active = TRUE
          AND d.type = 'gift' AND d.gift_product_id IS NOT NULL;
        IF v_code_gift IS NOT NULL THEN
            v_items := v_items || jsonb_build_array(jsonb_build_object(
                'product_id', (v_code_gift->>'product_id')::INT, 'size', v_code_gift->>'size', 'quantity', 1,
                'gift', TRUE, 'gift_key', 'code'));
        END IF;
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
            IF v_is_gift THEN v_dropped := array_append(v_dropped, v_item->>'gift_key'); CONTINUE; END IF;
            RAISE EXCEPTION 'unknown_product:%', v_item->>'product_id';
        END IF;
        IF v_product.sizes IS NOT NULL AND array_length(v_product.sizes, 1) > 0
           AND NOT (v_size = ANY(v_product.sizes)) THEN
            -- A gift that can't be sent is left out; it never stops the order.
            IF v_is_gift THEN v_dropped := array_append(v_dropped, v_item->>'gift_key'); CONTINUE; END IF;
            RAISE EXCEPTION 'invalid_size:%', v_product.name;
        END IF;

        -- Lock the inventory row; missing rows are treated as not stock-tracked.
        -- See the operations note at the foot of migration 42.
        SELECT stock_level INTO v_stock FROM public.inventory
        WHERE product_id = v_product.id AND size = v_size
        FOR UPDATE;
        IF FOUND THEN
            IF v_stock < v_qty THEN
                IF v_is_gift THEN v_dropped := array_append(v_dropped, v_item->>'gift_key'); CONTINUE; END IF;
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
        -- Migration 70: codes for one person, for a first order, and referral codes.
        IF v_discount.issued_for IS NOT NULL AND lower(trim(p_email)) <> lower(v_discount.issued_for) THEN
            RAISE EXCEPTION 'discount_not_yours';
        END IF;
        IF v_discount.kind = 'referral' AND (
            v_discount.referrer_id = v_customer_id
            OR EXISTS (SELECT 1 FROM public.customers c
                       WHERE c.id = v_discount.referrer_id AND lower(c.email) = lower(trim(p_email)))) THEN
            RAISE EXCEPTION 'referral_own_code';
        END IF;
        IF v_discount.first_order_only AND EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.status <> 'cancelled' AND o.order_kind = 'goods'
              AND (lower(o.email) = lower(trim(p_email)) OR (v_customer_id IS NOT NULL AND o.customer_id = v_customer_id))) THEN
            RAISE EXCEPTION 'discount_first_order_only';
        END IF;
        IF v_subtotal < COALESCE(v_discount.min_requirement, 0) THEN
            RAISE EXCEPTION 'discount_minimum_not_met:%', v_discount.min_requirement;
        END IF;
        IF v_discount.type = 'gift' THEN
            -- Its reward is the free perfume added above; a code whose gift can't be sent isn't spent.
            IF v_code_gift IS NULL OR 'code' = ANY(v_dropped) THEN
                RAISE EXCEPTION 'discount_gift_unavailable';
            END IF;
        ELSE
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
        END IF;
        UPDATE public.discounts SET usage_count = usage_count + 1 WHERE id = v_discount.id;
        v_discount_id := v_discount.id;
    END IF;

    v_total := GREATEST(v_subtotal - v_offer_saving - v_discount_amount, 0)
             + GREATEST(v_shipping_fee - v_offer_ship - v_ship_discount, 0);

    -- Migration 70: gift options (Admin → Gift wrap & message).
    IF public.feature_on('gift_options') THEN
        v_gift_s := public.feature_settings('gift_options');
        IF public.feature_bool(v_gift_s, 'wrap_enabled', TRUE) AND public.opt_true(v_opts, 'gift_wrap') THEN
            v_wrap := TRUE;
            v_wrap_fee := public.feature_num(v_gift_s, 'wrap_price', 15, 0, 500);
        END IF;
        IF public.feature_bool(v_gift_s, 'message_enabled', TRUE) THEN
            v_message := NULLIF(btrim(left(regexp_replace(COALESCE(v_opts->>'gift_message', ''),
                                                          E'[\\x01-\\x09\\x0B-\\x1F\\x7F]', '', 'g'),
                                           public.feature_num(v_gift_s, 'message_max', 250, 20, 500)::INT)), '');
        END IF;
        IF public.feature_bool(v_gift_s, 'hide_prices_enabled', TRUE) THEN
            v_hide_prices := public.opt_true(v_opts, 'hide_prices');
        END IF;
    END IF;
    -- A set that arrives gift-wrapped (migration 69's occasion boxes) already includes it.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_offer_q->'applied', '[]'::jsonb)) a
               WHERE COALESCE((a->>'gift_wrap')::BOOLEAN, FALSE)) THEN
        v_wrap := TRUE;
        v_wrap_fee := 0;
    END IF;
    v_total := v_total + v_wrap_fee;

    -- Migration 70: sending to someone else (Admin → Send to someone else).
    IF public.feature_on('send_to_someone') AND public.opt_true(v_opts, 'send_to_other') THEN
        v_send_s := public.feature_settings('send_to_someone');
        v_other := TRUE;
        v_recipient_name := NULLIF(btrim(left(COALESCE(v_opts->>'recipient_name', ''), 120)), '');
        v_recipient_phone := NULLIF(btrim(left(COALESCE(v_opts->>'recipient_phone', ''), 50)), '');
        IF v_recipient_name IS NULL THEN
            RAISE EXCEPTION 'recipient_name_required';
        END IF;
        IF public.feature_bool(v_send_s, 'date_enabled', TRUE)
           AND COALESCE(v_opts->>'delivery_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            BEGIN
                v_delivery_date := (v_opts->>'delivery_date')::DATE;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'invalid_delivery_date';
            END;
            IF v_delivery_date < v_today + public.feature_num(v_send_s, 'min_days', 1, 0, 14)::INT
               OR v_delivery_date > v_today + public.feature_num(v_send_s, 'max_days', 30, 1, 90)::INT THEN
                RAISE EXCEPTION 'invalid_delivery_date';
            END IF;
        END IF;
    END IF;

    -- Migration 70: loyalty points (signed-in shoppers; Admin → Loyalty points).
    IF public.feature_on('loyalty') AND v_customer_id IS NOT NULL AND public.opt_true(v_opts, 'use_points') THEN
        PERFORM pg_advisory_xact_lock(hashtext('loyalty:' || v_customer_id::TEXT));
        PERFORM public.loyalty_settle(v_customer_id);
        v_redeem := public.loyalty_redeemable(public.loyalty_available(v_customer_id),
                                              GREATEST(v_subtotal - v_offer_saving - v_discount_amount, 0));
        v_points_used := COALESCE((v_redeem->>'points')::INT, 0);
        v_points_value := LEAST(COALESCE((v_redeem->>'value')::NUMERIC, 0), v_total);
        IF v_points_value <= 0 THEN
            v_points_used := 0;
            v_points_value := 0;
        END IF;
    END IF;
    v_total := v_total - v_points_value;

    -- Migration 70: a gift card or reward credit (any active card can be spent).
    IF length(regexp_replace(COALESCE(v_opts->>'gift_card', ''), '[^A-Za-z0-9]', '', 'g')) > 0 THEN
        v_card := public.gift_card_find(v_opts->>'gift_card');
        IF v_card.code IS NOT NULL THEN
            SELECT * INTO v_card FROM public.gift_cards WHERE code = v_card.code FOR UPDATE;
        END IF;
        v_card_state := public.gift_card_state(v_card);
        IF v_card_state <> 'ok' THEN
            RAISE EXCEPTION 'gift_card_%', v_card_state;
        END IF;
        v_card_amount := LEAST(v_card.balance, v_total);
        IF v_card_amount > 0 THEN
            UPDATE public.gift_cards SET balance = balance - v_card_amount, last_used_at = now()
            WHERE code = v_card.code;
        END IF;
    END IF;
    v_total := v_total - v_card_amount;

    IF v_total <= 0 AND v_points_value + v_card_amount > 0 THEN
        -- Paid in full by the card and/or points: nothing left to collect or charge.
        v_total := 0;
        v_paid_by_credit := TRUE;
        v_online := FALSE;
        v_method := 'credit';
        v_status := 'paid';
    ELSIF v_online AND v_total <= 0 THEN
        RAISE EXCEPTION 'online_payment_not_needed';
    END IF;

    -- Points this order will earn once delivered (on what was paid for goods).
    IF public.feature_on('loyalty') THEN
        v_points_earned := public.loyalty_earned(GREATEST(v_subtotal - v_offer_saving - v_discount_amount - v_points_value, 0));
    END IF;

    v_order_id := 'ORD-' || nextval('public.order_number_seq')::TEXT;

    INSERT INTO public.orders (
        id, customer_id, email, phone, total_price, status, shipping_address,
        currency, exchange_rate, converted_total,
        payment_method, payment_status, discount_code, discount_amount, shipping_fee, offer_saving,
        order_kind, gift_wrap, gift_wrap_fee, gift_message, hide_prices,
        send_to_other, recipient_name, recipient_phone, delivery_date,
        points_redeemed, points_value, points_earned, gift_card_code, gift_card_amount
    ) VALUES (
        v_order_id, v_customer_id, lower(p_email), left(p_phone, 50), v_total, 'pending', p_shipping,
        p_currency, p_exchange_rate, round(v_total * p_exchange_rate, 2)::TEXT || ' ' || p_currency,
        v_method, v_status,
        CASE WHEN v_discount_amount + v_ship_discount > 0 OR v_discount.type = 'gift' THEN upper(trim(p_discount_code)) END,
        v_offer_saving + v_offer_ship + v_discount_amount + v_ship_discount + v_points_value + v_card_amount,
        v_shipping_fee, v_offer_saving + v_offer_ship,
        'goods', v_wrap, v_wrap_fee, v_message, v_hide_prices,
        v_other, v_recipient_name, v_recipient_phone, v_delivery_date,
        v_points_used, v_points_value, v_points_earned,
        CASE WHEN v_card_amount > 0 THEN v_card.code END, v_card_amount
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
    WHERE NOT (COALESCE((item->>'gift')::BOOLEAN, FALSE) AND COALESCE(item->>'gift_key', 'offer') = ANY(v_dropped));

    -- Migration 69: which offers this order used (the admin's order page and results).
    INSERT INTO public.order_offers (order_id, offer_id, kind, title, saving, units, gift_wrap, free_delivery)
    SELECT v_order_id, (a->>'offer_id')::INT, a->>'kind', a->>'title', COALESCE((a->>'saving')::NUMERIC, 0),
           COALESCE((a->>'units')::INT, 0), COALESCE((a->>'gift_wrap')::BOOLEAN, FALSE),
           COALESCE((a->>'free_delivery')::BOOLEAN, FALSE)
    FROM jsonb_array_elements(COALESCE(v_offer_q->'applied', '[]'::jsonb)) a;
    IF v_gift IS NOT NULL AND jsonb_typeof(v_gift) = 'object' AND NOT ('offer' = ANY(v_dropped)) THEN
        INSERT INTO public.order_offers (order_id, offer_id, kind, title, saving, units)
        VALUES (v_order_id, (v_gift->>'offer_id')::INT, 'gift', v_gift->>'title',
                COALESCE((v_gift->>'value')::NUMERIC, 0), 1);
    END IF;

    -- Migration 70: what the order spent, on the ledgers, and the referral it came from.
    IF v_points_used > 0 THEN
        INSERT INTO public.loyalty_ledger (customer_id, points, kind, order_id, note)
        VALUES (v_customer_id, -v_points_used, 'redeem', v_order_id, 'Used on order ' || v_order_id);
    END IF;
    IF v_card_amount > 0 THEN
        INSERT INTO public.gift_card_ledger (code, order_id, amount, kind)
        VALUES (v_card.code, v_order_id, -v_card_amount, 'spend');
    END IF;
    IF v_discount_id IS NOT NULL AND v_discount.kind = 'referral' AND v_discount.referrer_id IS NOT NULL THEN
        INSERT INTO public.referrals (referrer_id, code, order_id, friend_email, status)
        VALUES (v_discount.referrer_id, upper(v_discount.code), v_order_id, lower(trim(p_email)), 'pending');
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
                CASE WHEN v_paid_by_credit
                     THEN 'We have received your order. It is paid in full with your gift card or points.'
                     ELSE 'We have received your order. Payment is collected on delivery.' END);

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
        'gift', CASE WHEN 'offer' = ANY(v_dropped) THEN NULL ELSE v_gift END,
        -- Migration 70
        'code_gift', CASE WHEN v_code_gift IS NULL OR 'code' = ANY(v_dropped) THEN NULL ELSE (
            SELECT jsonb_build_object('product_id', p.id, 'name', replace(p.name, '_', ' '), 'brand', p.brand,
                                      'size', v_code_gift->>'size')
            FROM public.products p WHERE p.id = (v_code_gift->>'product_id')::INT) END,
        'gift_wrap', v_wrap,
        'gift_wrap_fee', v_wrap_fee,
        'points_redeemed', v_points_used,
        'points_value', v_points_value,
        'points_earned', v_points_earned,
        'gift_card_amount', v_card_amount,
        'paid_by_credit', v_paid_by_credit,
        'total', v_total,
        'currency', p_currency,
        'payment_method', v_method,
        'payment_status', v_status,
        'payment_token', v_token
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.place_order(
    TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC, TEXT, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(
    TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC, TEXT, TEXT, JSONB
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. When an order is delivered, or cancelled (triggers, so every path is covered)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.growth_issue_card(
    p_kind TEXT, p_amount NUMERIC, p_months INT, p_customer UUID,
    p_recipient_name TEXT, p_recipient_email TEXT, p_sender_name TEXT, p_message TEXT,
    p_order_id TEXT, p_status TEXT, p_note TEXT
) RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_raw TEXT;
    v_try INT := 0;
BEGIN
    LOOP
        v_raw := public.growth_random_code(12);
        v_code := 'GC-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.gift_cards WHERE code = v_code);
        v_try := v_try + 1;
        IF v_try > 8 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
    END LOOP;
    INSERT INTO public.gift_cards (code, balance, initial_value, is_active, expires_at, kind, status, order_id,
                                   customer_id, recipient_name, recipient_email, sender_name, message, note,
                                   activated_at, created_by)
    VALUES (v_code, round(p_amount, 2), round(p_amount, 2), TRUE,
            now() + make_interval(months => GREATEST(COALESCE(p_months, 12), 1)),
            p_kind, p_status, p_order_id, p_customer, left(p_recipient_name, 120), lower(left(p_recipient_email, 255)),
            left(p_sender_name, 120), left(p_message, 400), left(p_note, 200),
            CASE WHEN p_status = 'active' THEN now() END, auth.uid());
    INSERT INTO public.gift_card_ledger (code, order_id, amount, kind, note)
    VALUES (v_code, p_order_id, round(p_amount, 2), 'issue', left(p_note, 200));
    RETURN v_code;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.growth_issue_card(TEXT, NUMERIC, INT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.growth_void_order_cards(p_order_id TEXT, p_note TEXT)
RETURNS VOID AS $$
DECLARE
    r RECORD;
BEGIN
    -- A card bought with this order, while it is still unused, is cancelled with it.
    FOR r IN SELECT code, balance FROM public.gift_cards
             WHERE order_id = p_order_id AND kind = 'purchased' AND status <> 'void' AND balance = initial_value
             FOR UPDATE LOOP
        UPDATE public.gift_cards SET status = 'void', is_active = FALSE, balance = 0 WHERE code = r.code;
        IF r.balance > 0 THEN
            INSERT INTO public.gift_card_ledger (code, order_id, amount, kind, note)
            VALUES (r.code, p_order_id, -r.balance, 'void', left(p_note, 200));
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.growth_void_order_cards(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.growth_order_delivered(p_order_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_earner UUID;
    v_ref public.referrals%ROWTYPE;
    v_s JSONB;
    v_rewarded INT;
    v_amount NUMERIC;
    v_referrer RECORD;
    v_code TEXT;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN RETURN; END IF;

    -- Points: to the shopper's account, or to the account with the order's email.
    IF v_order.points_earned > 0 AND v_order.order_kind = 'goods'
       AND NOT EXISTS (SELECT 1 FROM public.loyalty_ledger WHERE order_id = p_order_id AND kind = 'earn') THEN
        v_earner := COALESCE(v_order.customer_id,
                             (SELECT c.id FROM public.customers c WHERE lower(c.email) = lower(v_order.email) LIMIT 1));
        IF v_earner IS NOT NULL THEN
            INSERT INTO public.loyalty_ledger (customer_id, points, kind, order_id, note, available_at)
            VALUES (v_earner, v_order.points_earned, 'earn', p_order_id, 'Order ' || p_order_id,
                    now() + make_interval(days => public.feature_num(public.feature_settings('loyalty'),
                                                                    'available_after_days', 0, 0, 60)::INT))
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- Referral: the friend's first order has arrived, so the referrer's reward is issued.
    SELECT * INTO v_ref FROM public.referrals WHERE order_id = p_order_id AND status = 'pending' FOR UPDATE;
    IF FOUND THEN
        v_s := public.feature_settings('referrals');
        SELECT count(*) INTO v_rewarded FROM public.referrals
        WHERE referrer_id = v_ref.referrer_id AND status = 'rewarded';
        SELECT c.email, c.first_name INTO v_referrer FROM public.customers c WHERE c.id = v_ref.referrer_id;
        IF v_referrer.email IS NULL THEN
            UPDATE public.referrals SET status = 'cancelled' WHERE id = v_ref.id;
        ELSIF v_rewarded >= public.feature_num(v_s, 'max_rewards', 20, 1, 500) THEN
            UPDATE public.referrals SET status = 'capped' WHERE id = v_ref.id;
        ELSE
            v_amount := public.feature_num(v_s, 'referrer_reward', 50, 5, 1000);
            v_code := public.growth_issue_card('reward', v_amount,
                public.feature_num(v_s, 'reward_valid_months', 6, 1, 36)::INT, v_ref.referrer_id,
                v_referrer.first_name, v_referrer.email, 'Gharib',
                'Thank you for introducing a friend to Gharib. This credit is yours to spend on your next order.',
                NULL, 'active', 'Referral reward for order ' || p_order_id);
            UPDATE public.referrals SET status = 'rewarded', reward_code = v_code, reward_amount = v_amount,
                                        rewarded_at = now()
            WHERE id = v_ref.id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.growth_order_delivered(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.growth_order_cancelled(p_order_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_entry public.loyalty_ledger%ROWTYPE;
    r RECORD;
BEGIN
    -- Points it used come back.
    SELECT * INTO v_entry FROM public.loyalty_ledger WHERE order_id = p_order_id AND kind = 'redeem';
    IF FOUND THEN
        INSERT INTO public.loyalty_ledger (customer_id, points, kind, order_id, note)
        VALUES (v_entry.customer_id, -v_entry.points, 'restore', p_order_id, 'Order ' || p_order_id || ' cancelled')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Points it earned go (pending ones too: the reversal matures with them).
    SELECT * INTO v_entry FROM public.loyalty_ledger WHERE order_id = p_order_id AND kind = 'earn';
    IF FOUND THEN
        INSERT INTO public.loyalty_ledger (customer_id, points, kind, order_id, note, available_at)
        VALUES (v_entry.customer_id, -v_entry.points, 'reverse', p_order_id, 'Order ' || p_order_id || ' cancelled',
                v_entry.available_at)
        ON CONFLICT DO NOTHING;
    END IF;

    -- A gift card it spent is topped back up (what was spent less anything already given back).
    FOR r IN SELECT l.code, sum(l.amount) AS net
             FROM public.gift_card_ledger l
             WHERE l.order_id = p_order_id AND l.kind IN ('spend', 'restore')
             GROUP BY l.code HAVING sum(l.amount) < 0 LOOP
        UPDATE public.gift_cards SET balance = LEAST(balance - r.net, initial_value) WHERE code = r.code;
        INSERT INTO public.gift_card_ledger (code, order_id, amount, kind, note)
        VALUES (r.code, p_order_id, -r.net, 'restore', 'Order ' || p_order_id || ' cancelled');
    END LOOP;

    PERFORM public.growth_void_order_cards(p_order_id, 'Order cancelled');

    UPDATE public.referrals SET status = 'cancelled' WHERE order_id = p_order_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.growth_order_cancelled(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.orders_growth_before()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' AND NEW.delivered_at IS NULL THEN
        NEW.delivered_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS orders_growth_before ON public.orders;
CREATE TRIGGER orders_growth_before
    BEFORE UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.orders_growth_before();

-- Never lets a hiccup here fail the update that fired it (a payment release, an admin's
-- status change): the error is recorded for the admin instead.
CREATE OR REPLACE FUNCTION public.orders_growth_after()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
            PERFORM public.growth_order_delivered(NEW.id);
        ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
            PERFORM public.growth_order_cancelled(NEW.id);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.growth_events (kind, order_id, detail)
        VALUES ('order_status_trigger', NEW.id, left(SQLERRM, 400));
    END;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS orders_growth_after ON public.orders;
CREATE TRIGGER orders_growth_after
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.orders_growth_after();

-- A gift card order: the card comes alive when Paymob confirms the payment, and is
-- cancelled (if unused) when the payment is returned.
CREATE OR REPLACE FUNCTION public.orders_gift_card_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_kind = 'gift_card' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
        BEGIN
            IF NEW.payment_status IN ('paid', 'partially_refunded') THEN
                UPDATE public.gift_cards SET status = 'active', activated_at = COALESCE(activated_at, now())
                WHERE order_id = NEW.id AND status = 'pending';
            ELSIF NEW.payment_status IN ('refunded', 'voided') THEN
                PERFORM public.growth_void_order_cards(NEW.id, 'Payment returned');
            END IF;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.growth_events (kind, order_id, detail)
            VALUES ('gift_card_payment_trigger', NEW.id, left(SQLERRM, 400));
        END;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS orders_gift_card_payment ON public.orders;
CREATE TRIGGER orders_gift_card_payment
    AFTER UPDATE OF payment_status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.orders_gift_card_payment();

REVOKE ALL ON FUNCTION public.orders_growth_before() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orders_growth_after() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orders_gift_card_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_customer_birthday() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 13. Buying a gift card: an online-only order of its own, paid through the same Paymob
--     path as any order (order_payments row, payment page, webhook). No stock, no delivery.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_gift_card_order(
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT,
    p_card JSONB
) RETURNS JSONB AS $$
DECLARE
    v_s JSONB := public.feature_settings('gift_cards');
    v_amount NUMERIC;
    v_allowed BOOLEAN;
    v_recipient_name TEXT;
    v_recipient_email TEXT;
    v_sender_name TEXT;
    v_message TEXT;
    v_send_on DATE;
    v_today DATE := (now() AT TIME ZONE 'Asia/Dubai')::DATE;
    v_order_id TEXT;
    v_token TEXT;
    v_code TEXT;
    v_name TEXT;
BEGIN
    IF NOT public.feature_on('gift_cards') THEN
        RAISE EXCEPTION 'gift_cards_off';
    END IF;
    IF COALESCE((SELECT mode FROM public.payment_settings WHERE id), 'cod') <> 'online'
       OR NOT EXISTS (SELECT 1 FROM public.app_config WHERE name = 'payments' AND length(value) >= 20) THEN
        RAISE EXCEPTION 'gift_cards_need_online_payment';
    END IF;
    IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 255 THEN
        RAISE EXCEPTION 'invalid_email';
    END IF;
    IF length(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g')) < 7 THEN
        RAISE EXCEPTION 'phone_required';
    END IF;
    IF p_card IS NULL OR jsonb_typeof(p_card) <> 'object' OR jsonb_typeof(p_card->'amount') <> 'number' THEN
        RAISE EXCEPTION 'invalid_gift_card';
    END IF;

    v_amount := round((p_card->>'amount')::NUMERIC, 2);
    SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_s->'amounts') = 'array'
                                                           THEN v_s->'amounts' ELSE '[100,200,300,500]'::jsonb END) a
                   WHERE jsonb_typeof(a) = 'number' AND (a #>> '{}')::NUMERIC = v_amount)
    INTO v_allowed;
    IF NOT v_allowed AND NOT (public.feature_bool(v_s, 'allow_custom', TRUE)
                              AND v_amount >= public.feature_num(v_s, 'min_amount', 50, 10, 5000)
                              AND v_amount <= public.feature_num(v_s, 'max_amount', 2000, 50, 20000)
                              AND v_amount = round(v_amount)) THEN
        RAISE EXCEPTION 'invalid_gift_card_amount';
    END IF;

    v_recipient_email := lower(btrim(COALESCE(p_card->>'recipient_email', '')));
    IF v_recipient_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_recipient_email) > 255 THEN
        RAISE EXCEPTION 'invalid_recipient_email';
    END IF;
    v_recipient_name := NULLIF(btrim(left(COALESCE(p_card->>'recipient_name', ''), 120)), '');
    IF v_recipient_name IS NULL THEN
        RAISE EXCEPTION 'recipient_name_required';
    END IF;
    v_sender_name := COALESCE(NULLIF(btrim(left(COALESCE(p_card->>'sender_name', ''), 120)), ''),
                              NULLIF(btrim(COALESCE(p_first_name, '')), ''), 'A friend');
    v_message := NULLIF(btrim(left(regexp_replace(COALESCE(p_card->>'message', ''),
                                                  E'[\\x01-\\x09\\x0B-\\x1F\\x7F]', '', 'g'), 300)), '');
    IF COALESCE(p_card->>'send_on', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       AND public.feature_bool(v_s, 'allow_scheduled', TRUE) THEN
        BEGIN
            v_send_on := (p_card->>'send_on')::DATE;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'invalid_send_date';
        END;
        IF v_send_on < v_today OR v_send_on > v_today + 90 THEN
            RAISE EXCEPTION 'invalid_send_date';
        END IF;
        IF v_send_on = v_today THEN v_send_on := NULL; END IF;
    END IF;

    v_name := btrim(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''));
    v_order_id := 'ORD-' || nextval('public.order_number_seq')::TEXT;

    INSERT INTO public.orders (
        id, customer_id, email, phone, total_price, status, shipping_address,
        currency, exchange_rate, converted_total, payment_method, payment_status,
        discount_amount, shipping_fee, order_kind
    ) VALUES (
        v_order_id, auth.uid(), lower(p_email), left(p_phone, 50), v_amount, 'pending',
        jsonb_build_object('kind', 'gift_card', 'name', left(v_name, 120), 'street', 'Digital gift card',
                           'city', 'By email', 'country', 'United Arab Emirates'),
        'AED', 1, v_amount::TEXT || ' AED', 'paymob', 'awaiting_payment', 0, 0, 'gift_card'
    );

    INSERT INTO public.order_tracking (order_id, status, location, description)
    VALUES (v_order_id, 'Order Placed', 'Dubai Headquarters',
            'We have received your gift card order and are awaiting confirmation of your payment.');

    v_code := public.growth_issue_card('purchased', v_amount,
        public.feature_num(v_s, 'valid_months', 12, 1, 60)::INT, NULL,
        v_recipient_name, v_recipient_email, v_sender_name, v_message, v_order_id, 'pending',
        'Bought with order ' || v_order_id);
    UPDATE public.gift_cards SET send_on = v_send_on, sender_email = lower(p_email) WHERE code = v_code;

    v_token := replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', '');
    INSERT INTO public.order_payments (
        order_id, view_token_hash, amount_fils, due_at, payer_first_name, payer_last_name, reserved_lines
    ) VALUES (
        v_order_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), (v_amount * 100)::INTEGER,
        now() + interval '70 minutes',
        left(trim(COALESCE(p_first_name, '')), 50), left(trim(COALESCE(p_last_name, '')), 50), '[]'::jsonb
    );

    RETURN jsonb_build_object('order_id', v_order_id, 'total', v_amount, 'payment_token', v_token,
                              'payment_method', 'paymob', 'payment_status', 'awaiting_payment');
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.place_gift_card_order(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_gift_card_order(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 14. The shopper's own rewards: points, referral, gift cards and credit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_rewards()
RETURNS JSONB AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT;
    v_birthday DATE;
    v_l JSONB := public.feature_settings('loyalty');
    v_r JSONB := public.feature_settings('referrals');
    v_available INT;
    v_pending INT;
    v_code TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501';
    END IF;
    SELECT lower(email), birthday INTO v_email, v_birthday FROM public.customers WHERE id = v_uid;
    v_available := public.loyalty_available(v_uid);
    SELECT COALESCE(sum(points), 0) INTO v_pending FROM public.loyalty_ledger
    WHERE customer_id = v_uid AND available_at > now();
    SELECT code INTO v_code FROM public.referral_codes WHERE customer_id = v_uid;

    RETURN jsonb_build_object(
        'birthday', v_birthday,
        'loyalty', jsonb_build_object(
            'enabled', public.feature_on('loyalty'),
            'program_name', public.feature_text(v_l, 'program_name', 'Gharib Rewards', 60),
            'available', v_available,
            'pending', GREATEST(v_pending, 0),
            'earn_points', public.feature_num(v_l, 'earn_points', 1, 0, 1000),
            'earn_per_aed', public.feature_num(v_l, 'earn_per_aed', 1, 1, 1000),
            'redeem_points', public.feature_num(v_l, 'redeem_points', 100, 1, 100000),
            'redeem_value_aed', public.feature_num(v_l, 'redeem_value_aed', 5, 1, 10000),
            'min_redeem', public.feature_num(v_l, 'min_redeem', 100, 0, 100000),
            'max_share_pct', public.feature_num(v_l, 'max_share_pct', 50, 1, 100),
            'birthday_points', public.feature_num(v_l, 'birthday_points', 0, 0, 100000),
            'history', COALESCE((SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM (
                SELECT points, kind, note, order_id, created_at, available_at FROM public.loyalty_ledger
                WHERE customer_id = v_uid ORDER BY created_at DESC LIMIT 20) h), '[]'::jsonb)),
        'referral', jsonb_build_object(
            'enabled', public.feature_on('referrals'),
            'code', v_code,
            'friend_reward', public.feature_num(v_r, 'friend_reward', 50, 5, 1000),
            'friend_min_order', public.feature_num(v_r, 'friend_min_order', 200, 0, 10000),
            'referrer_reward', public.feature_num(v_r, 'referrer_reward', 50, 5, 1000),
            'friends', (SELECT count(*) FROM public.referrals WHERE referrer_id = v_uid AND status <> 'cancelled'),
            'rewarded', (SELECT count(*) FROM public.referrals WHERE referrer_id = v_uid AND status = 'rewarded'),
            'earned', (SELECT COALESCE(sum(reward_amount), 0) FROM public.referrals WHERE referrer_id = v_uid AND status = 'rewarded')),
        'gift_cards', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'code', g.code, 'kind', g.kind, 'balance', g.balance, 'initial_value', g.initial_value,
                'expires_at', g.expires_at) ORDER BY g.created_at DESC)
            FROM public.gift_cards g
            WHERE g.status = 'active' AND g.balance > 0 AND (g.expires_at IS NULL OR g.expires_at > now())
              AND (g.customer_id = v_uid OR (v_email IS NOT NULL AND g.recipient_email = v_email AND g.sent_at IS NOT NULL))),
            '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.my_rewards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_rewards() TO authenticated;

-- The shopper's referral code, made the first time they ask for it.
CREATE OR REPLACE FUNCTION public.my_referral_code()
RETURNS JSONB AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_code TEXT;
    v_name TEXT;
    v_first TEXT;
    v_try INT := 0;
    v_s JSONB := public.feature_settings('referrals');
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501';
    END IF;
    IF NOT public.feature_on('referrals') THEN
        RETURN jsonb_build_object('enabled', FALSE);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_uid) THEN
        RAISE EXCEPTION 'no_account' USING ERRCODE = '42501';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('referral:' || v_uid::TEXT));
    SELECT code INTO v_code FROM public.referral_codes WHERE customer_id = v_uid;
    IF v_code IS NULL THEN
        SELECT first_name INTO v_first FROM public.customers WHERE id = v_uid;
        v_name := left(upper(regexp_replace(COALESCE(v_first, ''), '[^A-Za-z]', '', 'g')), 8);
        IF length(v_name) < 2 THEN v_name := 'FRIEND'; END IF;
        LOOP
            v_code := v_name || '-' || public.growth_random_code(4);
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code)
                  AND NOT EXISTS (SELECT 1 FROM public.discounts WHERE upper(code) = v_code);
            v_try := v_try + 1;
            IF v_try > 8 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
        END LOOP;
        INSERT INTO public.referral_codes (customer_id, code) VALUES (v_uid, v_code);
        INSERT INTO public.discounts (code, title, type, value, min_requirement, starts_at, ends_at, usage_limit,
                                      usage_count, is_active, kind, first_order_only, referrer_id, applies_to)
        VALUES (v_code, 'Referral from ' || initcap(lower(v_name)), 'fixed_amount',
                public.feature_num(v_s, 'friend_reward', 50, 5, 1000),
                public.feature_num(v_s, 'friend_min_order', 200, 0, 10000),
                now(), NULL, NULL, 0, TRUE, 'referral', TRUE, v_uid, 'order');
    END IF;
    RETURN jsonb_build_object('enabled', TRUE, 'code', v_code);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_code() TO authenticated;

-- What a referral link shows the friend before they order (no personal data).
CREATE OR REPLACE FUNCTION public.referral_offer(p_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_d public.discounts%ROWTYPE;
BEGIN
    SELECT * INTO v_d FROM public.discounts
    WHERE kind = 'referral' AND upper(code) = upper(btrim(COALESCE(p_code, ''))) AND is_active;
    IF NOT FOUND OR NOT public.feature_on('referrals') THEN
        RETURN jsonb_build_object('valid', FALSE);
    END IF;
    RETURN jsonb_build_object('valid', TRUE, 'code', v_d.code, 'reward', v_d.value, 'min_order', v_d.min_requirement);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.referral_offer(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_offer(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 15. Welcome offer and back-in-stock requests (public, rate-limited by the app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_welcome_offer(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
    v_s JSONB := public.feature_settings('welcome_offer');
    v_email TEXT := lower(btrim(COALESCE(p_email, '')));
    v_reward TEXT;
    v_type TEXT;
    v_value NUMERIC := 0;
    v_gift_id INT;
    v_gift_size TEXT;
    v_existing public.discounts%ROWTYPE;
    v_code TEXT;
    v_ends TIMESTAMP WITH TIME ZONE;
    v_try INT := 0;
BEGIN
    IF NOT public.feature_on('welcome_offer') THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'off');
    END IF;
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 255 THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'invalid_email');
    END IF;
    PERFORM public.subscribe_newsletter(v_email, 'welcome');
    PERFORM pg_advisory_xact_lock(hashtext('welcome:' || v_email));

    -- The welcome is for a first order, once per address.
    IF EXISTS (SELECT 1 FROM public.orders o WHERE lower(o.email) = v_email AND o.status <> 'cancelled'
               AND o.order_kind = 'goods') THEN
        RETURN jsonb_build_object('ok', TRUE, 'code', NULL);
    END IF;
    SELECT * INTO v_existing FROM public.discounts
    WHERE kind = 'welcome' AND issued_for = v_email ORDER BY id DESC LIMIT 1;
    IF FOUND THEN
        IF v_existing.is_active AND (v_existing.ends_at IS NULL OR v_existing.ends_at > now())
           AND COALESCE(v_existing.usage_count, 0) < COALESCE(v_existing.usage_limit, 1) THEN
            RETURN jsonb_build_object('ok', TRUE, 'code', v_existing.code, 'ends_at', v_existing.ends_at, 'repeat', TRUE);
        END IF;
        RETURN jsonb_build_object('ok', TRUE, 'code', NULL);
    END IF;

    v_reward := public.feature_text(v_s, 'reward', 'percent', 10);
    IF v_reward = 'gift' THEN
        v_type := 'gift';
        v_gift_id := public.feature_num(v_s, 'gift_product_id', 0, 0, 2147483647)::INT;
        SELECT COALESCE(NULLIF(public.feature_text(v_s, 'gift_size', '', 50), ''), p.sizes[1])
        INTO v_gift_size FROM public.products p WHERE p.id = v_gift_id AND p.is_published IS NOT FALSE;
        IF v_gift_size IS NULL THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'unavailable');
        END IF;
    ELSIF v_reward = 'amount' THEN
        v_type := 'fixed_amount';
        v_value := public.feature_num(v_s, 'amount', 25, 1, 500);
    ELSE
        v_type := 'percentage';
        v_value := public.feature_num(v_s, 'percent', 10, 1, 50);
    END IF;

    v_ends := now() + make_interval(days => public.feature_num(v_s, 'code_days', 14, 1, 90)::INT);
    LOOP
        v_code := 'WELCOME-' || public.growth_random_code(6);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.discounts WHERE upper(code) = v_code);
        v_try := v_try + 1;
        IF v_try > 8 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
    END LOOP;
    INSERT INTO public.discounts (code, title, type, value, min_requirement, starts_at, ends_at, usage_limit,
                                  usage_count, is_active, kind, issued_for, first_order_only, gift_product_id,
                                  gift_size, applies_to)
    VALUES (v_code, 'Welcome offer', v_type, v_value, public.feature_num(v_s, 'min_order', 0, 0, 5000),
            now(), v_ends, 1, 0, TRUE, 'welcome', v_email, TRUE,
            CASE WHEN v_type = 'gift' THEN v_gift_id END, CASE WHEN v_type = 'gift' THEN v_gift_size END, 'order');
    RETURN jsonb_build_object('ok', TRUE, 'code', v_code, 'ends_at', v_ends);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.claim_welcome_offer(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_welcome_offer(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_stock_alert(p_product_id INT, p_size TEXT, p_email TEXT)
RETURNS JSONB AS $$
DECLARE
    v_email TEXT := lower(btrim(COALESCE(p_email, '')));
    v_product public.products%ROWTYPE;
BEGIN
    IF NOT public.feature_on('back_in_stock') THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'off');
    END IF;
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 255 THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'invalid_email');
    END IF;
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND is_published IS NOT FALSE;
    IF NOT FOUND OR NOT (COALESCE(p_size, '') = ANY(v_product.sizes)) THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'unknown_product');
    END IF;
    IF public.offer_in_stock(p_product_id, p_size) THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'in_stock');
    END IF;
    IF (SELECT count(*) FROM public.stock_alerts WHERE email = v_email AND notified_at IS NULL) >= 25 THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'too_many');
    END IF;
    INSERT INTO public.stock_alerts (product_id, size, email) VALUES (p_product_id, p_size, v_email)
    ON CONFLICT (product_id, size, email) WHERE notified_at IS NULL DO NOTHING;
    RETURN jsonb_build_object('ok', TRUE);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.request_stock_alert(INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_stock_alert(INT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 16. Popularity: real orders only, counted, never who bought
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demand_signals(p_product_ids INT[])
RETURNS JSONB AS $$
DECLARE
    v_s JSONB := public.feature_settings('demand_signals');
    v_window INT := public.feature_num(v_s, 'window_days', 7, 1, 60)::INT;
    v_min INT := public.feature_num(v_s, 'min_orders', 3, 1, 100)::INT;
    v_top INT := public.feature_num(v_s, 'family_top', 3, 1, 10)::INT;
    v_family_window INT := public.feature_num(v_s, 'family_window_days', 30, 7, 180)::INT;
    v_result JSONB;
BEGIN
    IF NOT public.feature_on('demand_signals') OR p_product_ids IS NULL OR cardinality(p_product_ids) = 0 THEN
        RETURN '[]'::jsonb;
    END IF;
    WITH counted AS (
        SELECT oi.product_id,
               count(DISTINCT o.id) FILTER (WHERE o.created_at >= now() - make_interval(days => v_window)) AS recent,
               count(DISTINCT o.id) AS window_orders
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE o.created_at >= now() - make_interval(days => GREATEST(v_window, v_family_window))
          AND o.status <> 'cancelled' AND o.order_kind = 'goods'
          AND (o.payment_method <> 'paymob' OR o.payment_status IN ('paid', 'partially_refunded'))
          AND COALESCE(oi.is_gift, FALSE) = FALSE
        GROUP BY oi.product_id
    ),
    ranked AS (
        SELECT p.id, p.olfactory_group, COALESCE(c.recent, 0) AS recent, COALESCE(c.window_orders, 0) AS family_orders,
               rank() OVER (PARTITION BY p.olfactory_group ORDER BY COALESCE(c.window_orders, 0) DESC) AS family_rank
        FROM public.products p
        LEFT JOIN counted c ON c.product_id = p.id
        WHERE p.is_published IS NOT FALSE
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'product_id', r.id,
        'recent_orders', CASE WHEN public.feature_bool(v_s, 'show_count', TRUE) AND r.recent >= v_min THEN r.recent END,
        'window_days', v_window,
        'family', CASE WHEN public.feature_bool(v_s, 'show_family', TRUE) AND r.family_rank <= v_top
                            AND r.family_orders >= v_min THEN r.olfactory_group END,
        'family_rank', CASE WHEN r.family_rank <= v_top AND r.family_orders >= v_min THEN r.family_rank END)), '[]'::jsonb)
    INTO v_result
    FROM ranked r
    WHERE r.id = ANY(p_product_ids[1:200]);
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.demand_signals(INT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.demand_signals(INT[]) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 17. The scheduled jobs (the CART_RECOVERY secret, as migration 45). They claim and stamp
--     in one statement, so two overlapping runs never mail the same person twice.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.growth_require_secret(p_secret TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT public.verify_job_secret('cart_recovery', p_secret) THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.growth_require_secret(TEXT) FROM PUBLIC, anon, authenticated;

-- Gift cards due to be emailed to their recipient (bought, rewards, and the owner's own).
CREATE OR REPLACE FUNCTION public.claim_gift_card_deliveries(p_secret TEXT, p_limit INT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    WITH due AS (
        SELECT g.code FROM public.gift_cards g
        WHERE g.status = 'active' AND g.sent_at IS NULL AND g.recipient_email IS NOT NULL
          AND g.kind IN ('purchased', 'reward', 'issued')
          AND (g.send_on IS NULL OR g.send_on <= (now() AT TIME ZONE 'Asia/Dubai')::DATE)
        ORDER BY g.created_at
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
        FOR UPDATE SKIP LOCKED
    ), claimed AS (
        UPDATE public.gift_cards g SET sent_at = now()
        FROM due WHERE g.code = due.code AND g.sent_at IS NULL
        RETURNING g.code, g.kind, g.initial_value, g.balance, g.expires_at, g.recipient_name, g.recipient_email,
                  g.sender_name, g.message, g.order_id
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO v_result FROM claimed c;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.release_gift_card_delivery(p_secret TEXT, p_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    UPDATE public.gift_cards SET sent_at = NULL WHERE code = p_code AND sent_at IS NOT NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- After the recipient's email went: a gift card order has nothing left to do.
CREATE OR REPLACE FUNCTION public.gift_card_delivered(p_secret TEXT, p_code TEXT)
RETURNS VOID AS $$
DECLARE
    v_order TEXT;
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    SELECT g.order_id INTO v_order FROM public.gift_cards g
    JOIN public.orders o ON o.id = g.order_id
    WHERE g.code = p_code AND o.order_kind = 'gift_card' AND o.status IN ('pending', 'processing', 'accepted', 'fulfilled');
    IF v_order IS NOT NULL THEN
        UPDATE public.orders SET status = 'delivered', updated_at = now() WHERE id = v_order;
        INSERT INTO public.order_tracking (order_id, status, location, description)
        VALUES (v_order, 'Delivered', 'By email', 'The gift card was emailed to its recipient.');
    END IF;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- The buyer's note that their card is paid for (and when it will arrive).
CREATE OR REPLACE FUNCTION public.claim_gift_card_receipts(p_secret TEXT, p_limit INT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    WITH due AS (
        SELECT g.code FROM public.gift_cards g
        WHERE g.kind = 'purchased' AND g.status = 'active' AND g.buyer_notified_at IS NULL AND g.sender_email IS NOT NULL
        ORDER BY g.created_at
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
        FOR UPDATE SKIP LOCKED
    ), claimed AS (
        UPDATE public.gift_cards g SET buyer_notified_at = now()
        FROM due WHERE g.code = due.code AND g.buyer_notified_at IS NULL
        RETURNING g.code, g.initial_value, g.recipient_name, g.recipient_email, g.sender_name, g.sender_email,
                  g.send_on, g.order_id, g.expires_at
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'order_id', c.order_id, 'amount', c.initial_value, 'recipient_name', c.recipient_name,
        'recipient_email', c.recipient_email, 'sender_name', c.sender_name, 'buyer_email', c.sender_email,
        'send_on', c.send_on, 'expires_at', c.expires_at)), '[]'::jsonb) INTO v_result
    FROM claimed c;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- Back in stock: the requests whose size can be ordered again.
CREATE OR REPLACE FUNCTION public.claim_stock_alerts(p_secret TEXT, p_limit INT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    IF NOT public.feature_on('back_in_stock') THEN
        RETURN '[]'::jsonb;
    END IF;
    WITH due AS (
        SELECT a.id FROM public.stock_alerts a
        JOIN public.products p ON p.id = a.product_id
        WHERE a.notified_at IS NULL AND p.is_published IS NOT FALSE
          AND a.size = ANY(p.sizes)
          AND public.offer_in_stock(a.product_id, a.size)
        ORDER BY a.created_at
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
        FOR UPDATE OF a SKIP LOCKED
    ), claimed AS (
        UPDATE public.stock_alerts a SET notified_at = now()
        FROM due WHERE a.id = due.id AND a.notified_at IS NULL
        RETURNING a.id, a.email, a.product_id, a.size
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id, 'email', c.email, 'product_id', c.product_id, 'size', c.size,
        'brand', p.brand, 'name', replace(p.name, '_', ' '), 'image_url', p.image_url, 'price', p.price)), '[]'::jsonb)
    INTO v_result
    FROM claimed c JOIN public.products p ON p.id = c.product_id;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.release_stock_alert(p_secret TEXT, p_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    UPDATE public.stock_alerts SET notified_at = NULL WHERE id = p_id AND notified_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.stock_alerts b WHERE b.id <> p_id AND b.notified_at IS NULL
                      AND b.product_id = stock_alerts.product_id AND b.size = stock_alerts.size AND b.email = stock_alerts.email);
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- Reorder reminders: delivered N days ago, nothing ordered since, not opted out.
CREATE OR REPLACE FUNCTION public.claim_reorder_reminders(p_secret TEXT, p_limit INT)
RETURNS JSONB AS $$
DECLARE
    v_days INT := public.feature_num(public.feature_settings('reorder_reminders'), 'days_after', 75, 14, 365)::INT;
    v_result JSONB;
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    IF NOT public.feature_on('reorder_reminders') THEN
        RETURN '[]'::jsonb;
    END IF;
    WITH due AS (
        SELECT DISTINCT ON (lower(o.email)) o.id
        FROM public.orders o
        WHERE o.status = 'delivered' AND o.order_kind = 'goods' AND o.delivered_at IS NOT NULL
          AND o.delivered_at <= now() - make_interval(days => v_days)
          AND o.delivered_at >= now() - make_interval(days => v_days + 21)
          AND o.reorder_reminded_at IS NULL
          AND o.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
          AND NOT EXISTS (SELECT 1 FROM public.marketing_optouts m WHERE m.email = lower(o.email))
          AND NOT EXISTS (SELECT 1 FROM public.orders n WHERE lower(n.email) = lower(o.email)
                          AND n.created_at > o.created_at AND n.status <> 'cancelled')
        ORDER BY lower(o.email), o.delivered_at DESC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
    ), claimed AS (
        UPDATE public.orders o SET reorder_reminded_at = now()
        FROM due WHERE o.id = due.id AND o.reorder_reminded_at IS NULL
        RETURNING o.id, o.email, o.shipping_address
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'order_id', c.id, 'email', c.email, 'name', c.shipping_address->>'name',
        'lines', COALESCE((SELECT jsonb_agg(jsonb_build_object('product_id', oi.product_id, 'size', oi.size,
                                                                'quantity', oi.quantity) ORDER BY oi.id)
                           FROM public.order_items oi WHERE oi.order_id = c.id AND COALESCE(oi.is_gift, FALSE) = FALSE),
                          '[]'::jsonb))), '[]'::jsonb)
    INTO v_result FROM claimed c;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.release_reorder_reminder(p_secret TEXT, p_order_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    UPDATE public.orders SET reorder_reminded_at = NULL WHERE id = p_order_id AND reorder_reminded_at IS NOT NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- The bag a reorder link refills: perfumes still on sale, no personal data.
CREATE OR REPLACE FUNCTION public.get_reorder_lines(p_secret TEXT, p_order_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'product_id', p.id, 'brand', p.brand, 'name', replace(p.name, '_', ' '), 'price', p.price,
        'image_url', p.image_url,
        'size', CASE WHEN oi.size = ANY(p.sizes) THEN oi.size ELSE p.sizes[1] END,
        'quantity', oi.quantity) ORDER BY oi.id), '[]'::jsonb)
    INTO v_result
    FROM public.order_items oi JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND COALESCE(oi.is_gift, FALSE) = FALSE AND p.is_published IS NOT FALSE;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.marketing_opt_out(p_secret TEXT, p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    IF COALESCE(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RETURN FALSE;
    END IF;
    INSERT INTO public.marketing_optouts (email) VALUES (lower(btrim(p_email))) ON CONFLICT DO NOTHING;
    -- The cart reminders have their own stop switch; this one stops them too.
    UPDATE public.abandoned_carts SET recovery_opted_out = TRUE WHERE lower(email) = lower(btrim(p_email));
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- Birthdays today (Dubai): the year's points, once. Returns who to congratulate.
CREATE OR REPLACE FUNCTION public.claim_birthday_rewards(p_secret TEXT, p_limit INT)
RETURNS JSONB AS $$
DECLARE
    v_points INT := public.feature_num(public.feature_settings('loyalty'), 'birthday_points', 0, 0, 100000)::INT;
    v_today DATE := (now() AT TIME ZONE 'Asia/Dubai')::DATE;
    v_result JSONB;
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    IF NOT public.feature_on('loyalty') OR v_points <= 0 THEN
        RETURN '[]'::jsonb;
    END IF;
    WITH due AS (
        SELECT c.id, c.email, c.first_name FROM public.customers c
        WHERE c.birthday IS NOT NULL AND COALESCE(c.is_admin, FALSE) = FALSE
          AND (to_char(c.birthday, 'MM-DD') = to_char(v_today, 'MM-DD')
               -- 29 February birthdays are celebrated on the 28th in other years.
               OR (to_char(c.birthday, 'MM-DD') = '02-29' AND to_char(v_today, 'MM-DD') = '02-28'
                   AND extract(day FROM make_date(extract(year FROM v_today)::INT, 3, 1) - 1) = 28))
          AND NOT EXISTS (SELECT 1 FROM public.loyalty_ledger l WHERE l.customer_id = c.id AND l.kind = 'birthday'
                          AND l.note = extract(year FROM v_today)::TEXT)
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    ), given AS (
        INSERT INTO public.loyalty_ledger (customer_id, points, kind, note)
        SELECT d.id, v_points, 'birthday', extract(year FROM v_today)::TEXT FROM due d
        ON CONFLICT DO NOTHING
        RETURNING customer_id
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('email', d.email, 'first_name', d.first_name, 'points', v_points,
                                                 'opted_out', EXISTS (SELECT 1 FROM public.marketing_optouts m
                                                                      WHERE m.email = lower(d.email)))), '[]'::jsonb)
    INTO v_result
    FROM due d JOIN given g ON g.customer_id = d.id;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- Cart reminders: the single-use code the last reminder carries (one per cart, made once).
CREATE OR REPLACE FUNCTION public.issue_recovery_code(p_secret TEXT, p_cart_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_s JSONB := public.feature_settings('cart_reminders');
    v_email TEXT;
    v_existing public.discounts%ROWTYPE;
    v_code TEXT;
    v_ends TIMESTAMP WITH TIME ZONE;
    v_pct NUMERIC := public.feature_num(v_s, 'code_percent', 10, 1, 50);
    v_try INT := 0;
BEGIN
    PERFORM public.growth_require_secret(p_secret);
    IF NOT public.feature_on('cart_reminders') OR NOT public.feature_bool(v_s, 'code_enabled', TRUE) THEN
        RETURN jsonb_build_object('code', NULL);
    END IF;
    SELECT lower(email) INTO v_email FROM public.abandoned_carts WHERE id = p_cart_id;
    IF v_email IS NULL THEN
        RETURN jsonb_build_object('code', NULL);
    END IF;
    SELECT * INTO v_existing FROM public.discounts WHERE kind = 'recovery' AND source_ref = p_cart_id::TEXT LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('code', v_existing.code, 'ends_at', v_existing.ends_at, 'percent', v_existing.value,
                                  'min_order', v_existing.min_requirement);
    END IF;
    v_ends := now() + make_interval(hours => public.feature_num(v_s, 'code_hours', 48, 1, 336)::INT);
    LOOP
        v_code := 'BACK-' || public.growth_random_code(6);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.discounts WHERE upper(code) = v_code);
        v_try := v_try + 1;
        IF v_try > 8 THEN RAISE EXCEPTION 'code_generation_failed'; END IF;
    END LOOP;
    INSERT INTO public.discounts (code, title, type, value, min_requirement, starts_at, ends_at, usage_limit,
                                  usage_count, is_active, kind, issued_for, source_ref, applies_to)
    VALUES (v_code, 'Cart reminder code', 'percentage', v_pct, public.feature_num(v_s, 'code_min_order', 0, 0, 5000),
            now(), v_ends, 1, 0, TRUE, 'recovery', v_email, p_cart_id::TEXT, 'order');
    RETURN jsonb_build_object('code', v_code, 'ends_at', v_ends, 'percent', v_pct,
                              'min_order', public.feature_num(v_s, 'code_min_order', 0, 0, 5000));
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;

-- The jobs are called by the server with the secret, under the public key (as migration 45).
REVOKE ALL ON FUNCTION public.claim_gift_card_deliveries(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_gift_card_delivery(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gift_card_delivered(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_gift_card_receipts(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_stock_alerts(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_stock_alert(TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_reorder_reminders(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_reorder_reminder(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_reorder_lines(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketing_opt_out(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_birthday_rewards(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_recovery_code(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_gift_card_deliveries(TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_gift_card_delivery(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gift_card_delivered(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gift_card_receipts(TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stock_alerts(TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_stock_alert(TEXT, BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reorder_reminders(TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_reorder_reminder(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_reorder_lines(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_opt_out(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_birthday_rewards(TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_recovery_code(TEXT, UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 18. The owner's controls
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_store_feature(p_key TEXT, p_enabled BOOLEAN, p_settings JSONB)
RETURNS JSONB AS $$
DECLARE
    v_row public.store_features%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
    IF p_settings IS NOT NULL AND (jsonb_typeof(p_settings) <> 'object' OR length(p_settings::TEXT) > 16000) THEN
        RAISE EXCEPTION 'invalid_settings' USING ERRCODE = '22023';
    END IF;
    UPDATE public.store_features SET
        enabled = COALESCE(p_enabled, enabled),
        settings = COALESCE(p_settings, settings),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE key = p_key
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'unknown_feature' USING ERRCODE = '22023';
    END IF;
    IF p_key = 'referrals' THEN
        PERFORM public.referral_sync_discounts();
    END IF;
    RETURN jsonb_build_object('key', v_row.key, 'enabled', v_row.enabled, 'settings', v_row.settings,
                              'updated_at', v_row.updated_at);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.admin_set_store_feature(TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_store_feature(TEXT, BOOLEAN, JSONB) TO authenticated;

-- A gift card from the owner (a gesture, a replacement, a prize). Emailed by the job when an email is given.
CREATE OR REPLACE FUNCTION public.admin_issue_gift_card(p JSONB)
RETURNS JSONB AS $$
DECLARE
    v_amount NUMERIC;
    v_email TEXT;
    v_code TEXT;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
    IF p IS NULL OR jsonb_typeof(p) <> 'object' OR jsonb_typeof(p->'amount') <> 'number' THEN
        RAISE EXCEPTION 'invalid_gift_card' USING ERRCODE = '22023';
    END IF;
    v_amount := round((p->>'amount')::NUMERIC, 2);
    IF v_amount < 1 OR v_amount > 20000 THEN
        RAISE EXCEPTION 'invalid_gift_card_amount' USING ERRCODE = '22023';
    END IF;
    v_email := NULLIF(lower(btrim(COALESCE(p->>'recipient_email', ''))), '');
    IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'invalid_recipient_email' USING ERRCODE = '22023';
    END IF;
    v_code := public.growth_issue_card('issued', v_amount,
        public.feature_num(p, 'valid_months', 12, 1, 60)::INT,
        (SELECT c.id FROM public.customers c WHERE v_email IS NOT NULL AND lower(c.email) = v_email LIMIT 1),
        NULLIF(btrim(COALESCE(p->>'recipient_name', '')), ''), v_email,
        COALESCE(NULLIF(btrim(COALESCE(p->>'sender_name', '')), ''), 'Gharib'),
        NULLIF(btrim(COALESCE(p->>'message', '')), ''), NULL, 'active',
        COALESCE(NULLIF(btrim(COALESCE(p->>'note', '')), ''), 'Issued by the owner'));
    -- No email: nothing to send (the owner hands the code over).
    IF v_email IS NULL THEN
        UPDATE public.gift_cards SET sent_at = now() WHERE code = v_code;
    END IF;
    RETURN jsonb_build_object('code', v_code);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.admin_issue_gift_card(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_gift_card(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_gift_card_action(p_code TEXT, p_action TEXT)
RETURNS JSONB AS $$
DECLARE
    v_card public.gift_cards%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_card FROM public.gift_cards WHERE code = p_code FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'unknown_gift_card' USING ERRCODE = '22023';
    END IF;
    IF p_action = 'void' THEN
        IF v_card.status <> 'void' THEN
            UPDATE public.gift_cards SET status = 'void', is_active = FALSE, balance = 0 WHERE code = p_code;
            IF v_card.balance > 0 THEN
                INSERT INTO public.gift_card_ledger (code, amount, kind, note)
                VALUES (p_code, -v_card.balance, 'void', 'Cancelled by the owner');
            END IF;
        END IF;
    ELSIF p_action = 'resend' THEN
        IF v_card.status <> 'active' OR v_card.recipient_email IS NULL THEN
            RAISE EXCEPTION 'cannot_resend' USING ERRCODE = '22023';
        END IF;
        UPDATE public.gift_cards SET sent_at = NULL, send_on = NULL WHERE code = p_code;
    ELSE
        RAISE EXCEPTION 'unknown_action' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('ok', TRUE);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.admin_gift_card_action(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_gift_card_action(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_points(p_email TEXT, p_points INT, p_note TEXT)
RETURNS JSONB AS $$
DECLARE
    v_customer UUID;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
    IF p_points IS NULL OR p_points = 0 OR abs(p_points) > 1000000 THEN
        RAISE EXCEPTION 'invalid_points' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_customer FROM public.customers WHERE lower(email) = lower(btrim(COALESCE(p_email, '')));
    IF v_customer IS NULL THEN
        RAISE EXCEPTION 'no_account' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('loyalty:' || v_customer::TEXT));
    IF p_points < 0 AND public.loyalty_available(v_customer) + p_points < 0 THEN
        RAISE EXCEPTION 'not_enough_points' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.loyalty_ledger (customer_id, points, kind, note, created_by)
    VALUES (v_customer, p_points, 'adjust', left(COALESCE(NULLIF(btrim(p_note), ''), 'Adjusted by the owner'), 200), auth.uid());
    RETURN jsonb_build_object('ok', TRUE, 'available', public.loyalty_available(v_customer));
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.admin_adjust_points(TEXT, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_points(TEXT, INT, TEXT) TO authenticated;

-- Points per member, for the admin's Loyalty page (admins only).
CREATE OR REPLACE FUNCTION public.admin_loyalty_members(p_limit INT)
RETURNS JSONB AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not_authorised' USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE((
        SELECT jsonb_agg(m ORDER BY m.available DESC, m.lifetime DESC) FROM (
            SELECT c.id, c.email, c.first_name, c.last_name,
                   public.loyalty_available(c.id) AS available,
                   COALESCE((SELECT sum(points) FROM public.loyalty_ledger l
                             WHERE l.customer_id = c.id AND l.available_at > now()), 0) AS pending,
                   COALESCE((SELECT sum(points) FROM public.loyalty_ledger l
                             WHERE l.customer_id = c.id AND l.kind IN ('earn', 'birthday', 'bonus')), 0) AS lifetime,
                   (SELECT max(created_at) FROM public.loyalty_ledger l WHERE l.customer_id = c.id) AS last_activity
            FROM public.customers c
            WHERE EXISTS (SELECT 1 FROM public.loyalty_ledger l WHERE l.customer_id = c.id)
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)) m), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.admin_loyalty_members(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_loyalty_members(INT) TO authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFYING THIS MIGRATION (SQL editor)
--   SELECT key, enabled FROM public.store_features ORDER BY key;          -- 18 rows, all false
--   SELECT public.get_store_features() ? 'loyalty';                        -- true
--   SELECT count(*) FROM public.gift_cards WHERE status <> 'void';         -- 0 (old samples off)
--   SELECT pg_get_function_identity_arguments('public.place_order'::regproc);  -- ends with p_options jsonb
--
-- UNDOING IT (only if it must be taken back before any feature is used)
--   Re-run migration 69's place_order section (it drops nothing), then:
--   DROP FUNCTION public.place_order(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, NUMERIC, TEXT, TEXT, JSONB);
--   DROP TRIGGER orders_growth_before ON public.orders; DROP TRIGGER orders_growth_after ON public.orders;
--   DROP TRIGGER orders_gift_card_payment ON public.orders; DROP TRIGGER pin_customer_birthday ON public.customers;
--   The new tables and columns can stay: nothing reads them without this migration's functions.
-- ---------------------------------------------------------------------------
