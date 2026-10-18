"use client";

import { useSyncExternalStore } from "react";

/**
 * Perfumes this browser looked at (Admin → Recently viewed), most recent
 * first. Kept in the shopper's own browser only: nothing is sent anywhere.
 * Built like the bag (lib/cart.ts): one external store, cached snapshot.
 */

export type ViewedProduct = { id: number; brand: string; name: string; price: number; image: string; at: number };

const KEY = "gharib_viewed_v1";
const EVENT = "gharib:viewed";
const MAX = 20;
const EMPTY: ViewedProduct[] = [];

let cachedRaw: string | null | undefined;
let cached: ViewedProduct[] = EMPTY;

export function readViewed(): ViewedProduct[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as ViewedProduct[]) : [];
    cached = Array.isArray(parsed)
      ? parsed.filter((p) => p && Number.isInteger(p.id) && typeof p.name === "string").slice(0, MAX)
      : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

export function recordView(product: Omit<ViewedProduct, "at">): void {
  if (typeof window === "undefined") return;
  const next = [{ ...product, at: Date.now() }, ...readViewed().filter((p) => p.id !== product.id)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // Storage blocked: nothing is remembered, and nothing breaks.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useRecentlyViewed(): ViewedProduct[] {
  return useSyncExternalStore(subscribe, readViewed, () => EMPTY);
}

/* ── Visits: when this browser was last here, and pages seen this visit ── */

const LAST_VISIT = "gharib_last_visit";
const SESSION_START = "gharib_session_start";
const SESSION_PAGES = "gharib_session_pages";

export type VisitInfo = {
  /** When this browser was last on the site before this visit, or null for a first visit. */
  previousVisitAt: number | null;
  /** When this visit began. */
  startedAt: number;
};

let visit: VisitInfo | null = null;

/** Worked out once per page load: the previous visit, and when this one started. */
export function readVisit(): VisitInfo | null {
  if (typeof window === "undefined") return null;
  if (visit) return visit;
  try {
    const started = Number(window.sessionStorage.getItem(SESSION_START)) || 0;
    if (started) {
      visit = { previousVisitAt: Number(window.sessionStorage.getItem(`${LAST_VISIT}_before`)) || null, startedAt: started };
    } else {
      const previous = Number(window.localStorage.getItem(LAST_VISIT)) || null;
      const now = Date.now();
      window.sessionStorage.setItem(SESSION_START, String(now));
      if (previous) window.sessionStorage.setItem(`${LAST_VISIT}_before`, String(previous));
      visit = { previousVisitAt: previous, startedAt: now };
    }
  } catch {
    visit = { previousVisitAt: null, startedAt: Date.now() };
  }
  return visit;
}

/** Marks this moment as "last seen", and counts a page view for this visit. */
export function notePageView(): number {
  try {
    window.localStorage.setItem(LAST_VISIT, String(Date.now()));
    const pages = (Number(window.sessionStorage.getItem(SESSION_PAGES)) || 0) + 1;
    window.sessionStorage.setItem(SESSION_PAGES, String(pages));
    return pages;
  } catch {
    return 1;
  }
}

export function pagesThisVisit(): number {
  try {
    return Number(window.sessionStorage.getItem(SESSION_PAGES)) || 0;
  } catch {
    return 0;
  }
}
