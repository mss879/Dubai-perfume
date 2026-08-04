-- Migration 41: Newsletter subscribers (the footer forms previously discarded emails)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    source VARCHAR(50) DEFAULT 'footer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Admins can read/manage the list; the public writes only through the function below
CREATE POLICY "Admin access on newsletter_subscribers"
    ON public.newsletter_subscribers FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.subscribe_newsletter(p_email TEXT, p_source TEXT DEFAULT 'footer')
RETURNS BOOLEAN AS $$
BEGIN
    IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 255 THEN
        RETURN FALSE;
    END IF;
    INSERT INTO public.newsletter_subscribers (email, source)
    VALUES (lower(trim(p_email)), left(COALESCE(p_source, 'footer'), 50))
    ON CONFLICT (email) DO NOTHING;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.subscribe_newsletter(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(TEXT, TEXT) TO anon, authenticated;
