import { NextRequest, NextResponse } from "next/server";
import { createSessionSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { getAdminIdentity } from "../../../lib/auth";
import { isMissingFunction } from "../../../lib/rpc-errors";
import {
  SITE_LOCK_COOKIE,
  bypassCookieOptions,
  invalidateSiteLockCache,
} from "../../../lib/site-lock";

/**
 * Read and write the site lock from the admin panel.
 *
 * Server-side because the browser must not be trusted with any of it: the
 * admin identity is re-verified here, and set_site_lock() re-verifies it a
 * second time inside the database (the panel's bundle could otherwise call the
 * RPC directly with the anon key).
 *
 * On a successful save the operator's own bypass cookie is refreshed, so
 * locking the site never locks out the person who locked it.
 */

type LockState = {
  locked: boolean;
  effectiveLocked: boolean;
  headline: string;
  message: string;
  launchAt: string | null;
  autoUnlock: boolean;
  hasPin: boolean;
  updatedAt: string | null;
  serverNow: string;
};

function shape(row: Record<string, unknown> | undefined | null): LockState | null {
  if (!row) return null;
  return {
    locked: row.locked === true,
    effectiveLocked: row.effective_locked === true,
    headline: String(row.headline ?? ""),
    message: String(row.message ?? ""),
    launchAt: (row.launch_at as string | null) ?? null,
    autoUnlock: row.auto_unlock !== false,
    hasPin: row.has_pin === true,
    updatedAt: (row.updated_at as string | null) ?? null,
    serverNow: (row.server_now as string | null) ?? new Date().toISOString(),
  };
}

const NOT_APPLIED =
  "The site lock is not available yet — database migration 52 has not been applied.";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Store database is not configured." }, { status: 503 });
  }
  if (!(await getAdminIdentity())) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.rpc("admin_site_lock_state");

  if (error) {
    if (isMissingFunction(error)) {
      return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    }
    console.error("Site lock read failed:", error.message);
    return NextResponse.json({ error: "Could not read the site lock." }, { status: 500 });
  }

  const state = shape(Array.isArray(data) ? data[0] : data);
  if (!state) {
    return NextResponse.json({ error: "The site lock row is missing." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, state });
}

type Body = {
  locked?: unknown;
  pin?: unknown;
  headline?: unknown;
  message?: unknown;
  launchInHours?: unknown;
  clearLaunch?: unknown;
  autoUnlock?: unknown;
};

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Store database is not configured." }, { status: 503 });
  }
  if (!(await getAdminIdentity())) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (pin && !/^\d{4,12}$/.test(pin)) {
    return NextResponse.json({ error: "The PIN must be 4 to 12 digits." }, { status: 422 });
  }

  let launchInHours: number | null = null;
  if (body.launchInHours !== undefined && body.launchInHours !== null && body.launchInHours !== "") {
    const hours = Number(body.launchInHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 8760) {
      return NextResponse.json(
        { error: "The countdown must be between 0 and 8760 hours (one year)." },
        { status: 422 }
      );
    }
    launchInHours = hours;
  }

  const supabase = await createSessionSupabase();

  // Every argument is "leave it alone" when null, so the panel can flip the
  // switch without resending the copy, or retime the countdown without
  // touching the PIN.
  const { data, error } = await supabase.rpc("set_site_lock", {
    p_locked: typeof body.locked === "boolean" ? body.locked : null,
    p_pin: pin || null,
    p_headline: typeof body.headline === "string" ? body.headline : null,
    p_message: typeof body.message === "string" ? body.message : null,
    p_launch_in_hours: launchInHours,
    p_clear_launch: body.clearLaunch === true,
    p_auto_unlock: typeof body.autoUnlock === "boolean" ? body.autoUnlock : null,
  });

  if (error) {
    if (isMissingFunction(error)) {
      return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    }
    // 22023 / 42501 are raised deliberately by set_site_lock with a message
    // written for the operator ("Set a PIN before locking the website."), so
    // those are passed through rather than flattened into a 500.
    if (error.code === "22023" || error.code === "42501") {
      return NextResponse.json(
        { error: error.message.replace(/^.*?:\s*/, "") },
        { status: error.code === "42501" ? 403 : 422 }
      );
    }
    console.error("Site lock write failed:", error.message);
    return NextResponse.json({ error: "Could not update the site lock." }, { status: 500 });
  }

  const state = shape(Array.isArray(data) ? data[0] : data);
  if (!state) {
    return NextResponse.json({ error: "The site lock row is missing." }, { status: 500 });
  }

  // This process's cached copy is now wrong. Other instances hold theirs for
  // up to fifteen seconds (see lib/site-lock.ts) — the lock is not expected to
  // take effect to the millisecond.
  invalidateSiteLockCache();

  const response = NextResponse.json({ ok: true, state });

  // Keep the operator on the inside of their own lock.
  const { data: token } = await supabase.rpc("admin_site_lock_token");
  if (typeof token === "string" && token) {
    response.cookies.set(
      SITE_LOCK_COOKIE,
      token,
      bypassCookieOptions(process.env.NODE_ENV === "production")
    );
  }

  return response;
}
