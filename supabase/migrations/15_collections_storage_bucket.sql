-- Migration 15: Add Storage Bucket and policies for Collection Cover Images
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- 1. Alter public.collections and public.products columns to TEXT to prevent any VARCHAR(512) length limitation crashes
ALTER TABLE public.collections ALTER COLUMN cover_image TYPE TEXT;
ALTER TABLE public.products ALTER COLUMN image_url TYPE TEXT;

-- 2. Create the collection-covers bucket inside storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('collection-covers', 'collection-covers', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Security Hardening policies (Row-Level Security)
-- Allow anyone (including anonymous clients) to read images from the public bucket
CREATE POLICY "Allow public select on collection-covers"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'collection-covers');

-- Restrict write/update/delete access exclusively to active Administrators
CREATE POLICY "Allow admin write on collection-covers"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'collection-covers'
        AND EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND is_admin = true
        )
    )
    WITH CHECK (
        bucket_id = 'collection-covers'
        AND EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND is_admin = true
        )
    );
