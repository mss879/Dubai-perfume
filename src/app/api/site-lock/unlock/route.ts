import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../../lib/rate-limit";
import { SITE_LOCK_COOKIE, bypassCookieOptions } from "../../../lib/site-lock";

/**
 * Exchanges the access PIN for the bypass cookie that gets a visitor past the
 * "Launching soon" page.
 *
 * The PIN is never compared here — verify_site_lock_pin() (migration 52) does
 * it inside the database, against a bcrypt hash this process cannot read, and
 * returns the bypass token only on a match. That function also keeps its own
 * ten-strikes-then-cool-off counter, which is what actually protects a 4-digit
 * secret; the limiter below is the cheaper outer layer that stops a flood ever
 * reaching it.
 */

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Store database is not configured." }, { status: 503 });
  }

  const supabase = createServerSupabase();

  // Ten attempts a minute per caller. The database throttle is the real
  // defence — this one keeps the traffic off it.
  const allowed = await checkRateLimit(supabase, `site-lock:${clientKey(request)}`, 10, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  let pin = "";
  try {
    const body = (await request.json()) as { pin?: unknown };
    pin = String(body.pin ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!/^\d{4,12}$/.test(pin)) {
    return NextResponse.json({ error: "That PIN was not recognised." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("verify_site_lock_pin", { p_pin: pin });

  if (error) {
    console.error("Site lock PIN check failed:", error.message);
    return NextResponse.json({ error: "Could not check that PIN." }, { status: 500 });
  }

  const token = typeof data === "string" ? data : null;
  if (!token) {
    // One message for a wrong PIN, an unset PIN and a cooling-off period alike:
    // the caller learns nothing about which it was.
    return NextResponse.json({ error: "That PIN was not recognised." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SITE_LOCK_COOKIE,
    token,
    bypassCookieOptions(process.env.NODE_ENV === "production")
  );
  return response;
}
