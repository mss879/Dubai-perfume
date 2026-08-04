import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { isMissingFunction } from "../../../lib/rpc-errors";
import { checkRateLimit, clientKey } from "../../../lib/rate-limit";
import { readJsonBody } from "../../../lib/request-guard";

/**
 * "Stop these reminders", from the footer of every recovery email.
 *
 * A POST rather than a GET on the link itself: mail scanners and link
 * pre-fetchers follow GETs, and a shopper whose corporate mail filter opened
 * the link would have been unsubscribed without ever seeing it. The link opens
 * /recover/stop, which asks, and that page posts here.
 *
 * The token is the only credential. It is a v4 UUID that reached exactly one
 * inbox, and the worst an attacker who guessed one could do is stop an email.
 */

const MAX_ATTEMPTS_PER_IP = 20;
const ATTEMPTS_WINDOW_SECONDS = 600;

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const parsed = await readJsonBody<{ token?: unknown }>(request);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false }, { status: parsed.status });
  }

  const token = String(parsed.body?.token ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return NextResponse.json({ ok: false, error: "This link is not valid." }, { status: 422 });
  }

  const supabase = createServerSupabase();
  if (
    !(await checkRateLimit(
      supabase,
      `cart-recovery-stop:ip:${clientKey(request)}`,
      MAX_ATTEMPTS_PER_IP,
      ATTEMPTS_WINDOW_SECONDS
    ))
  ) {
    return NextResponse.json(
      { ok: false, error: "Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const { data, error } = await supabase.rpc("stop_cart_recovery", { p_token: token });

  if (error) {
    if (isMissingFunction(error)) {
      console.error("stop_cart_recovery is missing — apply migration 45.");
    } else {
      console.error("Cart recovery unsubscribe failed:", error.message);
    }
    return NextResponse.json(
      { ok: false, error: "We could not action this just now. Please write to us and we will." },
      { status: 503 }
    );
  }

  // A token that matches nothing answers the same as one that does. Telling a
  // caller which tokens are real is the only thing this endpoint could leak.
  if (data !== true) {
    console.info("[cart-recovery] unsubscribe called with an unknown token.");
  }
  return NextResponse.json({ ok: true });
}
