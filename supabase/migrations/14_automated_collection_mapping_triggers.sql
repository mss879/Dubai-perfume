-- Migration 14: Add Trigger to Sync Automated Collections on Product Modifications
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- Create trigger function
CREATE OR REPLACE FUNCTION public.sync_product_automated_collections()
RETURNS TRIGGER AS $$
DECLARE
    col_record RECORD;
    rule_record RECORD;
    matches BOOLEAN;
BEGIN
    -- 1. Remove this product's connections to any automated collections first
    DELETE FROM public.product_collections
    WHERE product_id = NEW.id
      AND collection_id IN (SELECT id FROM public.collections WHERE type = 'automated');

    -- 2. Iterate through all automated collections and evaluate rules
    FOR col_record IN SELECT id, rules FROM public.collections WHERE type = 'automated' LOOP
        matches := FALSE;
        
        -- Check if rules is a JSON array
        IF jsonb_typeof(col_record.rules) = 'array' THEN
            -- Parse each rule inside the array
            -- Rule format: {"field": "tag", "relation": "equals", "value": "some_value"}
            FOR rule_record IN SELECT * FROM jsonb_to_recordset(col_record.rules) AS x(field TEXT, relation TEXT, value TEXT) LOOP
                IF rule_record.field = 'tag' AND rule_record.relation = 'equals' THEN
                    IF NEW.tags IS NOT NULL AND rule_record.value = ANY(NEW.tags) THEN
                        matches := TRUE;
                    END IF;
                END IF;
            END LOOP;
        END IF;

        IF matches THEN
            INSERT INTO public.product_collections (product_id, collection_id)
            VALUES (NEW.id, col_record.id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to products table
DROP TRIGGER IF EXISTS trg_sync_product_automated_collections ON public.products;
CREATE TRIGGER trg_sync_product_automated_collections
    AFTER INSERT OR UPDATE OF tags, id ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_product_automated_collections();
