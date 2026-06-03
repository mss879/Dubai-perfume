-- Alter wishlists table to add wishlist_type column
ALTER TABLE public.wishlists ADD COLUMN IF NOT EXISTS wishlist_type VARCHAR(50) DEFAULT 'favorite';

-- Drop the old primary key constraint (implicitly named wishlists_pkey by Postgres)
ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_pkey;

-- Create the new primary key that includes wishlist_type to allow items in different tabs
ALTER TABLE public.wishlists ADD PRIMARY KEY (customer_id, product_id, wishlist_type);
