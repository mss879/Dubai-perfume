"use client";

/**
 * Where a code the concierge offered waits for checkout.
 *
 * The agent never applies a discount — it offers one, and the shopper still
 * presses Apply themselves on the checkout page, where place_order remains the
 * only thing that redeems anything. This is just a note passed between two
 * pages so nobody has to remember eight characters across a navigation.
 *
 * Read-and-clear: a code survives exactly one trip to checkout. Leaving it in
 * storage would have it reappear on an unrelated order next week.
 */

const KEY = "gharib_concierge_offer";
const TTL_MS = 24 * 60 * 60 * 1000;

type Stashed = { code: string; savedAt: number };

/** Announced so a checkout page already on screen can pick the code up. */
export const OFFER_CODE_EVENT = "gharib:offer-code";

export function stashOfferCode(code: string): void {
  const clean = code.trim().toUpperCase().slice(0, 100);
  if (!clean || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ code: clean, savedAt: Date.now() } satisfies Stashed)
    );
    // The concierge is mounted ON the checkout page, so a code accepted there
    // would otherwise sit in storage until the next navigation — which, at
    // checkout, may never come. Mirrors the gharib:cart event in lib/cart.ts.
    window.dispatchEvent(new CustomEvent(OFFER_CODE_EVENT));
  } catch {
    // Storage blocked — the shopper types the code themselves, as before.
  }
}

/** Returns the parked code once, then forgets it. */
export function takeOfferCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<Stashed>;
    if (typeof parsed.code !== "string" || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed.code;
  } catch {
    return null;
  }
}
