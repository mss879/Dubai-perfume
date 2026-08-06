"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "../../lib/cart";
import { FREE_SHIPPING_THRESHOLD_AED } from "../../lib/shipping";

/**
 * The concierge's sense of timing — when a closed widget may lean in.
 *
 * Everything here is client-side observation (pathname, dwell time, the bag,
 * which product pages this session has visited); no request is made until the
 * shopper actually opens the chat. The caps are the feature: a concierge who
 * interrupts twice is a pop-up, and the maison does not do pop-ups. One nudge
 * at a time, three minutes between nudges, each rule once per session,
 * a dismissal silences that rule for a day, and the first twenty seconds of a
 * session are always left in peace.
 */

export type ConciergeNudgeDef = {
  id: string;
  /** The line on the teaser card. */
  teaser: string;
  /** The canned assistant opener if the shopper clicks through. */
  opener: string;
  suggestions: string[];
};

const VIEWED_KEY = "gharib_concierge_viewed";
const SESSION_START_KEY = "gharib_concierge_session_start";
const SHOWN_SESSION_KEY = "gharib_concierge_nudges_shown";
const DISMISSED_KEY = "gharib_concierge_nudges_dismissed";

const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 3 * 60 * 1000;
const SESSION_GRACE_MS = 20 * 1000;
const TEASER_LIFETIME_MS = 12 * 1000;

/* ── Browse tracking ─────────────────────────────────────────────────────── */

/** Product ids this session has looked at, oldest first. */
export function readViewedProductIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(VIEWED_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(-12)
      : [];
  } catch {
    return [];
  }
}

function recordViewedProduct(id: number) {
  try {
    const seen = readViewedProductIds().filter((v) => v !== id);
    seen.push(id);
    window.sessionStorage.setItem(VIEWED_KEY, JSON.stringify(seen.slice(-24)));
  } catch {
    // Private mode — browse memory just stays off.
  }
}

/* ── Frequency bookkeeping ───────────────────────────────────────────────── */

function sessionStartedAt(): number {
  try {
    const raw = window.sessionStorage.getItem(SESSION_START_KEY);
    if (raw) return Number(raw) || Date.now();
    const now = Date.now();
    window.sessionStorage.setItem(SESSION_START_KEY, String(now));
    return now;
  } catch {
    return 0;
  }
}

function shownThisSession(): Set<string> {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SHOWN_SESSION_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function markShown(id: string) {
  try {
    const shown = shownThisSession();
    shown.add(id);
    window.sessionStorage.setItem(SHOWN_SESSION_KEY, JSON.stringify([...shown]));
    window.localStorage.setItem(`${DISMISSED_KEY}_last`, String(Date.now()));
  } catch {
    /* best effort */
  }
}

function lastNudgeAt(): number {
  try {
    return Number(window.localStorage.getItem(`${DISMISSED_KEY}_last`)) || 0;
  } catch {
    return 0;
  }
}

function dismissedRules(): Record<string, number> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function markDismissed(id: string) {
  try {
    const map = dismissedRules();
    map[id] = Date.now();
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
  } catch {
    /* best effort */
  }
}

/* ── The hook ────────────────────────────────────────────────────────────── */

export function useConciergeNudges(input: { suppressed: boolean }) {
  const { suppressed } = input;
  const pathname = usePathname();
  const { lines, subtotal } = useCart();
  /** The raised teaser, pinned to the pathname it was raised on — so simple
      navigation retires it without a state write. */
  const [active, setActive] = useState<{ def: ConciergeNudgeDef; onPath: string } | null>(null);
  const activeRef = useRef(active);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Once the panel has been opened on this page-view, stay quiet. */
  const openedThisView = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (suppressed) openedThisView.current = true;
  }, [suppressed]);

  // Remember every product page this session walks through.
  useEffect(() => {
    const match = pathname?.match(/^\/product\/(\d+)$/);
    if (match) recordViewedProduct(Number(match[1]));
  }, [pathname]);

  const rules = useMemo<{ def: ConciergeNudgeDef; delayMs: number; when: () => boolean }[]>(
    () => [
      {
        delayMs: 25_000,
        when: () => pathname === "/checkout",
        def: {
          id: "checkout-help",
          teaser: "A question about checkout? I'm here.",
          opener:
            "I'm right here if anything about checkout needs a hand — delivery, payment on delivery, or a final question about a fragrance.",
          suggestions: ["When is delivery free?", "How does cash on delivery work?"],
        },
      },
      {
        delayMs: 4_000,
        when: () => readViewedProductIds().length >= 5,
        def: {
          id: "cant-decide",
          teaser: "Can't decide between them? Let me help.",
          opener:
            "You've been exploring — a good sign. Tell me the occasion it is for, or what you liked most so far, and I'll narrow it to the one.",
          suggestions: ["Help me decide", "Build my scent profile"],
        },
      },
      {
        delayMs: 40_000,
        when: () =>
          lines.length > 0 && subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD_AED,
        def: {
          id: "free-delivery",
          teaser: `AED ${Math.max(0, Math.round(FREE_SHIPPING_THRESHOLD_AED - subtotal))} from complimentary delivery.`,
          opener:
            "Your selection is close to complimentary delivery. Shall I suggest a small companion to complete the order?",
          suggestions: ["Suggest a companion", "Show me the bestsellers"],
        },
      },
      {
        delayMs: 60_000,
        when: () => pathname === "/shop" && lines.length === 0,
        def: {
          id: "shop-idle",
          teaser: "Tell me the occasion — I'll shortlist for you.",
          opener:
            "One hundred and thirty-eight compositions is a lot of shelf. Tell me the occasion — or who it is for — and I'll bring it down to three.",
          suggestions: ["Build my scent profile", "Something for evenings", "A gift under AED 300"],
        },
      },
    ],
    [pathname, lines.length, subtotal]
  );

  useEffect(() => {
    // New page-view: reset the quiet flag unless the panel is open right now.
    openedThisView.current = suppressed;
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];

    if (typeof window === "undefined") return;
    const startedAt = sessionStartedAt();

    for (const rule of rules) {
      const timer = setTimeout(() => {
        if (openedThisView.current || activeRef.current) return; // quiet, or one already up
        if (Date.now() - startedAt < SESSION_GRACE_MS) return;
        if (Date.now() - lastNudgeAt() < MIN_GAP_MS) return;
        if (shownThisSession().has(rule.def.id)) return;
        const dismissedAt = dismissedRules()[rule.def.id];
        if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;
        if (!rule.when()) return;

        markShown(rule.def.id);
        setActive({ def: rule.def, onPath: pathname ?? "" });
      }, rule.delayMs);
      timers.current.push(timer);
    }

    return () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    };
  }, [pathname, suppressed, rules]);

  // A teaser that goes unanswered folds itself away.
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(null), TEASER_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [active]);

  // Navigation retires a teaser by derivation, not by effect.
  const nudge = active && active.onPath === pathname && !suppressed ? active.def : null;

  const dismiss = useCallback(() => {
    const current = activeRef.current;
    if (current) markDismissed(current.def.id);
    setActive(null);
  }, []);

  /** The shopper clicked through — hand the nudge to the panel and go quiet. */
  const accept = useCallback(() => {
    const current = activeRef.current;
    setActive(null);
    openedThisView.current = true;
    return current?.def ?? null;
  }, []);

  return { nudge, dismiss, accept };
}
