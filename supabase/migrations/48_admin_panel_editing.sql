-- Migration 48: Give the admin panel the write paths its screens implied
-- ════════════════════════════════════════════════════════════════════════════════
-- The panel rendered several tables it could only read. Four of the five gaps
-- were UI-only (customers.note, transfers, collections and discounts all have
-- both the columns and an "Admin ... FOR ALL" policy from migration 10, so the
-- browser client could always have written them). Two were real:
--
--   1. contact_inquiries had SELECT (18), DELETE (18) and INSERT (44) policies
--      for admins but NO UPDATE policy, and no column to record an answer.
--      Marking an inquiry answered would have failed silently — PostgREST
--      reports an RLS-blocked UPDATE as "0 rows matched", not as an error.
--
--   2. public.discounts.id is SERIAL, but the panel inserted a client-computed
--      id (discounts.length + 1). Supplying an explicit id does not advance the
--      sequence, so the sequence now trails the real MAX(id) on any store where
--      a discount was created from the panel. The next insert that lets the
--      sequence assign would collide on the primary key. The panel is fixed to
--      omit id; this resyncs the sequence so that fix is safe.
--
-- Note on the reply feature: replies are sent by /api/admin/inquiry-reply,
-- which re-verifies the admin server-side and keeps RESEND_API_KEY off the
-- client — the same shape as /api/admin/order-status.

-- ---------------------------------------------------------------------------
-- 1. contact_inquiries: an answered state, and permission to set it
-- ---------------------------------------------------------------------------

ALTER TABLE public.contact_inquiries
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'new';

ALTER TABLE public.contact_inquiries
    ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP WITH TIME ZONE;

-- What was actually sent back, so the log is a record of the exchange rather
-- than of the customer's half of it.
ALTER TABLE public.contact_inquiries
    ADD COLUMN IF NOT EXISTS admin_reply TEXT;

ALTER TABLE public.contact_inquiries
    ADD COLUMN IF NOT EXISTS replied_by VARCHAR(255);

-- Constrained rather than free text: the badge in the panel switches on this,
-- and a typo'd status would render as neither state.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'contact_inquiries_status_check'
          AND conrelid = 'public.contact_inquiries'::regclass
    ) THEN
        ALTER TABLE public.contact_inquiries
            ADD CONSTRAINT contact_inquiries_status_check
            CHECK (status IN ('new', 'answered'));
    END IF;
END $$;

-- The missing policy. USING chooses which rows an admin may update; WITH CHECK
-- is stated explicitly rather than left to default to USING, so the intent
-- survives anyone later narrowing one of the two.
DROP POLICY IF EXISTS "Admin update contact inquiries" ON public.contact_inquiries;

CREATE POLICY "Admin update contact inquiries"
    ON public.contact_inquiries FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Unanswered-first is the only ordering the inquiries tab asks for.
CREATE INDEX IF NOT EXISTS contact_inquiries_status_idx
    ON public.contact_inquiries (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. discounts: resync the identity sequence after client-supplied ids
--
-- setval(..., is_called => true) means the NEXT nextval() returns MAX(id) + 1.
-- GREATEST(..., 1) keeps setval legal on an empty table, where MAX(id) is NULL
-- and the sequence's minimum value is 1.
-- ---------------------------------------------------------------------------

SELECT setval(
    pg_get_serial_sequence('public.discounts', 'id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.discounts), 0), 1),
    true
);
