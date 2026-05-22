-- Create wishlists table
CREATE TABLE IF NOT EXISTS public.wishlists (
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_id, product_id)
);

-- Create order_tracking table
CREATE TABLE IF NOT EXISTS public.order_tracking (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) REFERENCES public.orders(id) ON DELETE CASCADE,
    status VARCHAR(100) NOT NULL, -- Placed, Blending, Quality Control, In Transit, Delivered
    location VARCHAR(255) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════
-- CUSTOMER PORTAL RLS POLICIES
-- ══════════════════════════════════════════════════════

-- Wishlist Policies
CREATE POLICY "Allow users to view their own wishlist" 
    ON public.wishlists FOR SELECT 
    USING (auth.uid() = customer_id);

CREATE POLICY "Allow users to add to their own wishlist" 
    ON public.wishlists FOR INSERT 
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Allow users to delete from their own wishlist" 
    ON public.wishlists FOR DELETE 
    USING (auth.uid() = customer_id);

-- Customer Order Policies (View only their own orders)
CREATE POLICY "Allow users to view their own orders" 
    ON public.orders FOR SELECT 
    USING (auth.uid() = customer_id OR email = auth.email());

CREATE POLICY "Allow users to view their own order items" 
    ON public.order_items FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE public.orders.id = public.order_items.order_id 
            AND (public.orders.customer_id = auth.uid() OR public.orders.email = auth.email())
        )
    );

-- Order Tracking public SELECT
CREATE POLICY "Allow public select on order tracking" 
    ON public.order_tracking FOR SELECT 
    USING (true);

-- ══════════════════════════════════════════════════════
-- ADMIN RLS POLICIES (Full bypass for is_admin = true)
-- ══════════════════════════════════════════════════════

-- Products & Collections Admin Write policies
CREATE POLICY "Admin write access on products" ON public.products FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin write access on collections" ON public.collections FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin write access on product_collections" ON public.product_collections FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Inventory Admin access
CREATE POLICY "Admin access on inventory" ON public.inventory FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on transfers" ON public.transfers FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Orders Admin access
CREATE POLICY "Admin access on orders" ON public.orders FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on order_items" ON public.order_items FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on gift_cards" ON public.gift_cards FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Customers profile access (Users read themselves, admins manage all)
CREATE POLICY "Users read/write own profile" ON public.customers FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin full access on customers" ON public.customers FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Marketing & Discounts Admin access
CREATE POLICY "Admin access on marketing" ON public.marketing_campaigns FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on discounts" ON public.discounts FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on cms_pages" ON public.cms_pages FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on blog_posts" ON public.blog_posts FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on markets" ON public.markets FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on analytics" ON public.analytics_events FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin access on order_tracking" ON public.order_tracking FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- ══════════════════════════════════════════════════════
-- SEED PORTAL ADD-ONS (Mocks)
-- ══════════════════════════════════════════════════════

-- Seed Wishlist (Mocks)
INSERT INTO public.wishlists (customer_id, product_id) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 2),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 4),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 101),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 9),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 5)
ON CONFLICT DO NOTHING;

-- Seed Order Tracking Steps (Mocks for ORD-9922 and ORD-9923)
INSERT INTO public.order_tracking (order_id, status, location, description) VALUES
('ORD-9922', 'Order Placed', 'Dubai Headquarters', 'We have received your exclusive order selection.'),
('ORD-9922', 'Accepted', 'Dubai Headquarters', 'Order has been reviewed and accepted by the administrative team.'),
('ORD-9922', 'Fulfilled', 'Dubai Distribution Port', 'Your fragrance package has been carefully blended, packaged, and fulfilled by our scent curators.'),
('ORD-9922', 'Out for Delivery', 'Local Carrier Hub', 'Your shipment is out for delivery with our express carrier.'),

('ORD-9923', 'Order Placed', 'Dubai Headquarters', 'We have received your exclusive order selection.'),
('ORD-9923', 'Accepted', 'Dubai Headquarters', 'Order has been reviewed and accepted by the administrative team.'),
('ORD-9923', 'Fulfilled', 'Dubai Distribution Port', 'Your fragrance package has been carefully blended, packaged, and fulfilled by our scent curators.')
ON CONFLICT (id) DO NOTHING;
