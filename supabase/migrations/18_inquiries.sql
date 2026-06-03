-- Migration 18: Create Contact Inquiries Table
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow public to insert contact inquiries (for submission on contact page)
CREATE POLICY "Allow public insert contact inquiries" 
ON public.contact_inquiries FOR INSERT 
TO public 
WITH CHECK (true);

-- Allow authenticated admin users to select (read) contact inquiries
CREATE POLICY "Allow admin read contact inquiries" 
ON public.contact_inquiries FOR SELECT 
TO authenticated 
USING (public.is_admin(auth.uid()));

-- Allow authenticated admin users to delete contact inquiries
CREATE POLICY "Allow admin delete contact inquiries" 
ON public.contact_inquiries FOR DELETE 
TO authenticated 
USING (public.is_admin(auth.uid()));
