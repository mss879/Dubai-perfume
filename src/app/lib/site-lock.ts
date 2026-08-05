import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Reading side of the site lock (migration 52).
 *
 * Deliberately NOT marked `server-only`, and deliberately not built on
 * lib/supabase-server.ts: this module is imported by src/proxy.ts, which runs
 * outside the React Server Component graph and has no access to `next/headers`.
 * It creates its own stateless anon client instead. Nothing here is secret —
 * see the note on the fingerprint below.
 */

/** Holds the bypass token for a visitor who has entered the right PIN. */
export const SITE_LOCK_COOKIE = "gharib_preview";

/** The holding page the proxy rewrites locked requests to. */
export const LAUNCHING_SOON_PATH = "/launching-soon";

export type SiteLockState = {
  locked: boolean;
  headline: string;
  message: string;
  /** ISO timestamp of the launch, or null when no date has been announced. */
  launchAt: string | null;
  autoUnlock: boolean;
  hasPin: boolean;
  /** SHA-256 of the bypass token. Safe to hold in memory; see verifyBypass. */
  unlockFingerprint: string;
  /** The database clock, so the countdown does not trust the visitor's. */
  serverNow: string;
};

const UNLOCKED: SiteLockState = {
  locked: false,
  headline: "Launching soon",
  message: "",
  launchAt: null,
  autoUnlock: true,
  hasPin: false,
  unlockFingerprint: "",
  serverNow: new Date().toISOString(),
};

/**
 * The proxy runs on every public request, so the lock state is cached in the
 * instance rather than fetched each time. Fifteen seconds is short enough that
 * flipping the switch in the admin panel looks immediate and long enough that a
 * busy minute costs four round-trips instead of thousands.
 */
const CACHE_TTL_MS = 15_000;

let cached: { at: number; state: SiteLockState } | null = null;
let lastGood: SiteLockState | null = null;
let warned = false;

/**
 * Failures are cached exactly like successes.
 *
 * Without this, a store that has not applied migration 52 — or one riding out
 * a database wobble — retries the lookup on every single request and pays the
 * round-trip every time. Caching the fallback means a persistent fault costs
 * one attempt per TTL instead of one per visitor; the price is that applying
 * the migration takes up to a TTL to be noticed, which is the right trade.
 */
function remember(state: SiteLockState, at: number): SiteLockState {
  cached = { at, state };
  return state;
}

function warnOnce(message: string) {
  if (warned) return;
  warned = true;
  console.warn(message);
}

/**
 * Current lock state.
 *
 * FAILS OPEN, but only after trying the last known good answer first. The two
 * failure modes are not symmetric: serving the holding page because of a
 * transient database blip takes a live, order-taking storefront offline, while
 * serving the storefront during the same blip briefly reveals a shop that is
 * not open yet. The first is a revenue outage, the second is cosmetic — so a
 * fault resolves towards the site staying up.
 */
export async function readSiteLock(): Promise<SiteLockState> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.state;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // No database means no storefront to protect.
    return UNLOCKED;
  }

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc("get_site_lock");

    if (error) {
      // PGRST202 here means migration 52 has not been applied yet, which is
      // simply "there is no lock" rather than a fault.
      warnOnce(
        `Site lock unavailable (${error.message}) — the storefront stays open. Apply migration 52 if this persists.`
      );
      return remember(lastGood ?? UNLOCKED, now);
    }

    // get_site_lock() RETURNS TABLE, so PostgREST hands back an array of rows.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return remember(lastGood ?? UNLOCKED, now);

    const state: SiteLockState = {
      locked: row.locked === true,
      headline: typeof row.headline === "string" ? row.headline : UNLOCKED.headline,
      message: typeof row.message === "string" ? row.message : "",
      launchAt: row.launch_at ?? null,
      autoUnlock: row.auto_unlock !== false,
      hasPin: row.has_pin === true,
      unlockFingerprint: typeof row.unlock_fingerprint === "string" ? row.unlock_fingerprint : "",
      serverNow: row.server_now ?? new Date().toISOString(),
    };

    lastGood = state;
    return remember(state, now);
  } catch (err) {
    warnOnce(
      `Site lock lookup threw (${err instanceof Error ? err.message : "unknown"}) — the storefront stays open.`
    );
    return remember(lastGood ?? UNLOCKED, now);
  }
}

/** Drops the cache so a change made in the admin panel is visible at once. */
export function invalidateSiteLockCache(): void {
  cached = null;
}

/**
 * Does this visitor's cookie carry the current bypass token?
 *
 * The proxy never holds the token itself — only SHA-256 of it, which
 * get_site_lock() publishes precisely so this comparison can happen without a
 * database round-trip. The token is a v4 UUID, so the fingerprint gives an
 * attacker nothing to work back from.
 *
 * Compared with timingSafeEqual out of habit rather than necessity: both sides
 * are already hashes, so the comparison leaks nothing useful either way.
 */
export function verifyBypass(cookieValue: string | undefined, fingerprint: string): boolean {
  if (!cookieValue || !fingerprint) return false;

  const presented = createHash("sha256").update(cookieValue).digest();
  let expected: Buffer;
  try {
    expected = Buffer.from(fingerprint, "hex");
  } catch {
    return false;
  }

  if (expected.length !== presented.length) return false;
  return timingSafeEqual(presented, expected);
}

/** Cookie options for the bypass. Session-length, httpOnly, same-site. */
export function bypassCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    // Thirty days. Long enough that the owner and whoever they hand the PIN to
    // are not re-prompted through a launch week, short enough to expire.
    maxAge: 60 * 60 * 24 * 30,
  };
}
