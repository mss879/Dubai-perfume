-- Migration 22: Add Product Images Array Column and product-images Storage Bucket
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- 1. Add image_urls array column to public.products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- 2. Populate image_urls with existing image_url to ensure database consistency
UPDATE public.products 
SET image_urls = ARRAY[image_url] 
WHERE image_urls = '{}' OR image_urls IS NULL;

-- 3. Create the product-images bucket inside storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage Security Policies for product-images bucket
-- Allow anyone (including anonymous clients) to read images from the public bucket
CREATE POLICY "Allow public select on product-images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');

-- Restrict write/update/delete access exclusively to active Administrators
CREATE POLICY "Allow admin write on product-images"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND is_admin = true
        )
    )
    WITH CHECK (
        bucket_id = 'product-images'
        AND EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND is_admin = true
        )
    );
