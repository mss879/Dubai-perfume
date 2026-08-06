-- ============================================================================
-- 58. The bottle in the photograph
--
-- A shopper photographs something they smelled at a friend's, or screenshots a
-- bottle from Instagram, and asks "do you have this?". The agent reads the
-- picture, says honestly what it is, and pivots to the maison's closest
-- compositions. It is the most Dubai thing in the whole feature set: the
-- shopper saw it somewhere, and Gharib has the register.
--
-- THIS MIGRATION IS SMALL ON PURPOSE, and the reason is worth stating.
--
--   * The photograph never touches this database, and never touches storage.
--     It is downscaled in the browser, sent inline with one request, read once,
--     and dropped. There is no bucket, no signed URL, no retention policy to
--     get wrong later — a shopper's camera roll is not something a perfume shop
--     should be holding.
--
--   * The two columns this feature needs on concierge_messages (has_image,
--     photo_reading) were added by migration 54, several files early. That is
--     deliberate: 54 owns the shape of that table and the single write path
--     log_concierge_turn(). If this migration added columns and replaced the
--     logger too, then whichever of 54 and 58 was applied last would silently
--     win and the other's fields would stop being written, with nothing
--     anywhere to notice. One owner, one writer.
--
-- So what is left here is the read that makes the feature pay for itself: the
-- running list of bottles people walked in wanting. A customer photographing
-- the same designer original ten times a month is the clearest buying signal
-- the shop will ever get, and it arrives without anyone filling in a form.
--
-- Companion app code: src/app/components/concierge/prepareImage.ts,
-- src/app/lib/concierge/model.ts, the PHOTO PROTOCOL section of the prompt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Find the photograph turns quickly
--
-- Partial, because they are a small fraction of all messages and every query
-- that wants them wants only them.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_concierge_messages_photo
    ON public.concierge_messages (created_at DESC)
    WHERE has_image;

-- ---------------------------------------------------------------------------
-- 2. admin_concierge_photo_demand() — what people bring in
--
-- Grouped on what the agent READ in the picture, which is model-authored text
-- rather than a catalogue id, so it is deliberately loose: "Baccarat Rouge 540"
-- and "Baccarat Rouge" will sit as two rows. Tightening that into a lookup
-- table would mean guessing a canonical name for every designer house on earth,
-- and the owner reading the list can see through the near-duplicates far more
-- reliably than any normalisation would.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_concierge_photo_demand(p_days INT DEFAULT 90)
RETURNS TABLE (
    reading   TEXT,
    times     BIGINT,
    last_seen TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_days INT := GREATEST(LEAST(COALESCE(p_days, 90), 365), 1);
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'not authorised';
    END IF;

    RETURN QUERY
    SELECT m.photo_reading,
           count(*),
           max(m.created_at)
      FROM public.concierge_messages m
     WHERE m.photo_reading IS NOT NULL
       AND btrim(m.photo_reading) <> ''
       AND m.created_at >= now() - make_interval(days => v_days)
     GROUP BY m.photo_reading
     ORDER BY count(*) DESC, max(m.created_at) DESC
     LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_concierge_photo_demand(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_concierge_photo_demand(INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Operations note.
--
-- Whether the configured model actually accepts images cannot be settled from
-- here, or from the repository. Send ONE photograph through the concierge in
-- production on the day this ships. If the reply opens with the apology line
-- ("I could not read that photograph just now"), the model is text-only and
-- CONCIERGE_VISION_MODEL needs setting in the environment — the feature
-- degrades to a normal text turn rather than failing, so nothing breaks
-- meanwhile, but nobody is reading any pictures either.
--
-- Once photographs are arriving:
--
--   SELECT * FROM public.admin_concierge_photo_demand(90);
--
-- Read it as a buying list. A bottle appearing repeatedly is a house the shop
-- has no answer to, and the row next to it is how often that cost a sale.
-- ---------------------------------------------------------------------------
