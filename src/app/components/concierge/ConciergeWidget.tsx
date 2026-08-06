"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { getBrowserSupabase } from "../../lib/supabase-browser";
import ConciergePanel from "./ConciergePanel";
import ConciergeNudge from "./ConciergeNudge";
import { useConciergeChat } from "./useConciergeChat";
import { useConciergeNudges } from "./useConciergeNudges";

/**
 * The perfume concierge — mount once per page, beside <CartDrawer />.
 *
 * A launcher block in the bottom-right (with the maison's version of a pulse:
 * an expanding hairline ring, no glow), the nudge teasers a closed concierge
 * may raise, and the two-zone chat window itself. Renders nothing at all on
 * back-of-house and gating routes, so a stray mount is harmless.
 */

const HIDDEN_PREFIXES = [
  "/admin",
  "/launching-soon",
  "/signin",
  "/auth",
  "/reset-password",
  "/recover",
];

const GREETING =
  "Welcome to Gharib. I know every bottle of our six houses — tell me the occasion, ask about a fragrance, or let me build your scent profile.";
const GREETING_CHIPS = [
  "Build my scent profile",
  "What are your bestsellers?",
  "Something for a gift",
];

function ConciergeWidget() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const chat = useConciergeChat();
  const { nudge, dismiss, accept } = useConciergeNudges({ suppressed: open });

  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  // First open of an empty conversation: the house greeting, free of charge.
  useEffect(() => {
    if (open && chat.hydrated && chat.messages.length === 0) {
      chat.addAssistantLocal(GREETING, GREETING_CHIPS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chat.hydrated, chat.messages.length]);

  // Signing out clears the conversation.
  //
  // For a signed-in shopper the agent has been greeting them by name and
  // avoiding what they already own, and that reply text is sitting in
  // localStorage. On a shared phone the next person would read it. The session
  // id rotates too, so nothing new is filed against the old one.
  const startOver = chat.startOver;
  useEffect(() => {
    // Guarded because getBrowserSupabase() hands back the dev-mode mock when the
    // env vars are absent, and that stand-in has no auth subscription at all —
    // unguarded, this threw during render and took every storefront route with
    // it. The concierge is mounted on fourteen pages; it must never be the
    // reason one of them fails to load.
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getBrowserSupabase().auth.onAuthStateChange((event: string) => {
        if (event === "SIGNED_OUT") startOver();
      });
      unsubscribe = () => data?.subscription?.unsubscribe?.();
    } catch {
      // No auth to listen to; the conversation simply persists as before.
    }
    return () => unsubscribe?.();
  }, [startOver]);

  // Stable, so the panel's own effects are not re-run by every parent render.
  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);

  const acceptNudge = useCallback(() => {
    const accepted = accept();
    if (accepted) {
      // The nudge's opener becomes the concierge's first word on opening —
      // it must land before the greeting effect sees an empty transcript.
      chat.addAssistantLocal(accepted.opener, accepted.suggestions);
    }
    setOpen(true);
  }, [accept, chat]);

  if (hidden) return null;

  return (
    <>
      <AnimatePresence>
        {nudge && !open && (
          <ConciergeNudge
            key={nudge.id}
            text={nudge.teaser}
            onAccept={acceptNudge}
            onDismiss={dismiss}
          />
        )}
      </AnimatePresence>

      {!open && (
        <div className="fixed bottom-6 right-6 z-[90]">
          {/* The pulse: a hairline ring that swells out of the block and
              fades. Quicker and doubled while a nudge is raised. */}
          {!reduced && (
            <motion.span
              key={nudge ? "ring-eager" : "ring-calm"}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 border border-black"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.45, 0], scale: [1, 1.35, 1.55] }}
              transition={{
                duration: nudge ? 1.2 : 1.8,
                repeat: Infinity,
                repeatDelay: nudge ? 0.6 : 2.4,
                ease: "easeOut",
              }}
            />
          )}
          <motion.button
            type="button"
            onClick={openPanel}
            aria-label="Open the perfume concierge"
            className="relative flex h-12 items-center gap-2.5 bg-[#121212] px-4 text-white transition-opacity duration-300 hover:opacity-85 cursor-pointer sm:px-5"
            animate={reduced ? undefined : { scale: [1, 1.015, 1] }}
            transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <MessageSquare className="w-[18px] h-[18px]" strokeWidth={1.25} />
            <span className="hidden text-[11px] font-medium uppercase tracking-[0.2em] sm:inline">
              Concierge
            </span>
          </motion.button>
        </div>
      )}

      <ConciergePanel
        open={open}
        onClose={closePanel}
        messages={chat.messages}
        stage={chat.stage}
        status={chat.status}
        notice={chat.notice}
        orderView={chat.orderView}
        onSend={chat.send}
        onRetry={chat.retry}
        onStartOver={chat.startOver}
        onAdd={chat.performAdd}
        onRestoreStage={chat.setStage}
        onLookupOrder={chat.lookupOrder}
        onResetOrder={chat.resetOrderView}
      />
    </>
  );
}

/**
 * Memoised because it takes no props at all: the pages that mount it are large
 * client components with their own animations, and none of that has any
 * business re-rendering an open conversation twenty times a second.
 */
export default memo(ConciergeWidget);
