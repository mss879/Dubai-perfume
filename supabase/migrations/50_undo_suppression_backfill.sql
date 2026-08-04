-- Migration 50: undo migration 49's suppression backfill
-- ════════════════════════════════════════════════════════════════════════════════
-- Migration 49 §4 seeded public.email_suppressions from every abandoned cart
-- carrying recovery_opted_out = TRUE, on the reasoning that those people had
-- pressed unsubscribe. They had not.
--
-- WHERE THAT FLAG ACTUALLY COMES FROM
--   Migration 45 §3 (line 92) runs, once, behind the
--   app_config.cart_recovery_backfilled_at marker:
--
--       UPDATE public.abandoned_carts SET recovery_opted_out = TRUE;
--
--   No WHERE clause. It flags every row in the table at that instant —
--   converted carts of past paying customers included. It is a TEMPORAL
--   exemption meaning "do not mail the backlog that existed when recovery was
--   switched on", which is exactly how docs/production-rollout.md describes it:
--   "Recovery starts from carts abandoned afterwards."
--
-- WHAT 49 TURNED IT INTO
--   A permanent, per-person suppression. Because 49 also made
--   capture_abandoned_cart() birth a suppressed address's future carts with
--   recovery_opted_out = TRUE, and claim_abandoned_carts_for_recovery() skips
--   those at every stage, each backfilled address would never receive a
--   recovery email again — not for this cart, but ever. The admin panel would
--   also label them "OPTED OUT", telling the owner they unsubscribed when they
--   never did. email_suppressions is referenced nowhere in the application and
--   has RLS on with no policies, so there is no un-suppress path short of
--   direct SQL. This migration is that path.
--
-- WHY DELETING IS SAFE
--   A genuine unsubscribe can only be created by stop_cart_recovery(), which is
--   reachable solely from a link inside a recovery email. Those emails are sent
--   by /api/cart-recovery, which refuses every call until CART_RECOVERY_SECRET
--   is set in BOTH the environment and app_config — part of this launch, not yet
--   done. So no recovery email has been delivered, no unsubscribe link has been
--   pressed, and every row the backfill created is grandfathering rather than
--   consent. The predicate below is still scoped rather than a blanket delete,
--   so that a suppression which does NOT trace back to a grandfathered cart is
--   left alone.
--
--   Worst case if one genuine unsubscribe did slip into that window: that person
--   becomes eligible for reminders again and can press the link again, which
--   still works. The opposite error — silently never mailing hundreds of
--   shoppers and showing the owner a false "OPTED OUT" — is the larger harm and
--   is invisible.
--
-- The per-cart recovery_opted_out flags are deliberately NOT touched. They are
-- migration 45's grandfathering doing its job, and clearing them would mail the
-- very backlog 45 set out to exempt.

DELETE FROM public.email_suppressions s
WHERE s.reason = 'cart_recovery'
  AND EXISTS (
      SELECT 1
      FROM public.abandoned_carts ac
      WHERE lower(ac.email) = s.email
        AND ac.recovery_opted_out = TRUE
  );

-- After this, the list is filled only by real stop_cart_recovery() calls — by
-- someone actually pressing the link — which is what it was always meant to be.
-- Everything else migration 49 established (the table, the capture-time
-- suppression, the 25-cart cap, stop_cart_recovery writing to it) stands, and an
-- unsubscribe from here on is permanent and survives the next checkout session.
