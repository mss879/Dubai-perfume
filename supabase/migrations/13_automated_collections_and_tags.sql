-- Migration 13: Add tags to products, and rules to collections for Automated Collections
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- 1. Add tags column to public.products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 2. Add type and rules columns to public.collections table
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'manual';
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '[]'::jsonb;

-- 3. Populate tags for existing seed products to enable smart matching
UPDATE public.products SET tags = ARRAY['memoir', 'noble', 'wood', 'oud'] WHERE id = 101;
UPDATE public.products SET tags = ARRAY['floral', 'sweet', 'jasmine', 'blooms'] WHERE id = 102;
UPDATE public.products SET tags = ARRAY['oriental', 'oud', 'spice', 'mystic'] WHERE id = 103;
UPDATE public.products SET tags = ARRAY['fresh', 'aquatic', 'marine', 'ocean'] WHERE id = 104;
UPDATE public.products SET tags = ARRAY['wood', 'oud', 'greatness', 'saffron'] WHERE id = 1;
UPDATE public.products SET tags = ARRAY['floral', 'sweet', 'juliette', 'rose'] WHERE id = 2;
UPDATE public.products SET tags = ARRAY['fresh', 'aquatic', 'phantom', 'modern'] WHERE id = 3;
UPDATE public.products SET tags = ARRAY['amber', 'oriental', 'devil', 'sandalwood'] WHERE id = 4;
UPDATE public.products SET tags = ARRAY['floral', 'sweet', 'cherry', 'gourmand'] WHERE id = 5;
UPDATE public.products SET tags = ARRAY['wood', 'oud', 'toy', 'rose'] WHERE id = 6;
UPDATE public.products SET tags = ARRAY['fresh', 'aquatic', 'epicentro', 'volcanic'] WHERE id = 7;
UPDATE public.products SET tags = ARRAY['amber', 'oriental', 'gothic', 'incense'] WHERE id = 8;
UPDATE public.products SET tags = ARRAY['wood', 'oud', 'ganymede', 'leather'] WHERE id = 9;

-- 4. Mark current collections as manual for baseline stability
UPDATE public.collections SET type = 'manual';

-- 5. Insert an automated (smart) collection for live demonstration
INSERT INTO public.collections (id, title, description, cover_image, type, rules)
VALUES (
    'smart-ouds',
    'Automated Oud Vault',
    'Smart collection automatically populated with all fragrances containing the oud tag.',
    '/campaign-gold.png',
    'automated',
    '[{"field": "tag", "relation": "equals", "value": "oud"}]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, rules = EXCLUDED.rules;

-- Populate association records for smart collections (linking all products with tag 'oud')
INSERT INTO public.product_collections (product_id, collection_id)
SELECT id, 'smart-ouds'
FROM public.products
WHERE 'oud' = ANY(tags)
ON CONFLICT DO NOTHING;

-- Grant public INSERT permissions on product_collections for manual updates in sandbox
CREATE POLICY "Allow public insert on product_collections" 
    ON public.product_collections FOR INSERT 
    WITH CHECK (true);

-- Grant public DELETE permissions on product_collections for manual removals
CREATE POLICY "Allow public delete on product_collections" 
    ON public.product_collections FOR DELETE 
    USING (true);
