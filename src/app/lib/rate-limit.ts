import "server-only";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingFunction } from "./rpc-errors";

/**
 * Abuse throttling for the public write endpoints (checkout, contact,
 * discount lookups, newsletter, cart autosave).
 *
 * The counter lives in the database (check_rate_limit, migration 44) because
 * each request runs in a fresh, short-lived function instance — an in-process
 * counter would reset constantly and throttle nothing.
 */

let warned = false;

/**
 * True when the caller may proceed.
 *
 * FAILS OPEN on every fault, including the function not existing yet: a
 * limiter that refuses traffic when its own storage is unavailable would take
 * the store offline, which is a far worse outcome than an unthrottled hour.
 * The warning is logged once per instance so the log is not flooded.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      if (!warned) {
        warned = true;
        console.warn(
          isMissingFunction(error)
            ? "check_rate_limit is missing — apply migration 44. Requests pass unthrottled until then."
            : `Rate limiting unavailable (${error.message}) — requests pass unthrottled.`
        );
      }
      return true;
    }
    return data !== false;
  } catch (err) {
    // A transport-level failure rejects rather than returning { error }. Left
    // unhandled it would surface as a 500 from checkout — the limiter taking
    // the store down is precisely what failing open exists to prevent.
    if (!warned) {
      warned = true;
      console.warn(
        `Rate limiting threw (${err instanceof Error ? err.message : "unknown"}) — requests pass unthrottled.`
      );
    }
    return true;
  }
}

/**
 * The caller identity a bucket key is built from.
 *
 * ORDER MATTERS, and it is the opposite of what looks natural.
 * x-forwarded-for is supplied by the caller and only *appended to* by the edge,
 * so its first entry is whatever the client wrote there. Trusting it first let
 * anyone mint a fresh bucket per request by rotating one header, which defeated
 * every limit in the app. x-nf-client-connection-ip is set by Netlify from the
 * real socket and cannot be forged from outside, so it wins.
 *
 * The x-forwarded-for fallback is kept for local development and for any host
 * that does not set the platform header; there the limiter is best-effort
 * rather than a guarantee.
 *
 * When neither header is present every caller shares the "unknown" bucket.
 * That is deliberately coarse — unrelated shoppers can then throttle each
 * other — but an identity we cannot establish must not become an unlimited one.
 */
export function clientKey(request: NextRequest): string {
  const platform = request.headers.get("x-nf-client-connection-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (platform || forwarded || "unknown").slice(0, 64);
}
