import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { isMissingFunction } from "../../lib/rpc-errors";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";
import { readJsonBody } from "../../lib/request-guard";

/** Signups per IP before the route stops accepting them — nobody joins twice. */
const MAX_SIGNUPS_PER_IP = 10;
const SIGNUPS_WINDOW_SECONDS = 3600;

/** Footer newsletter signup — previously the email was discarded client-side. */
export async function POST(request: NextRequest) {
  const parsed = await readJsonBody<{ email?: unknown; source?: unknown }>(request);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false }, { status: parsed.status });
  }
  const body = parsed.body;

  const email = String(body?.email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email address." },
      { status: 422 }
    );
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const supabase = createServerSupabase();
  if (
    !(await checkRateLimit(
      supabase,
      `newsletter:ip:${clientKey(request)}`,
      MAX_SIGNUPS_PER_IP,
      SIGNUPS_WINDOW_SECONDS
    ))
  ) {
    return NextResponse.json(
      { ok: false, error: "Please wait a little before subscribing again." },
      { status: 429 }
    );
  }

  const { error } = await supabase.rpc("subscribe_newsletter", {
    p_email: email,
    p_source: typeof body?.source === "string" ? body.source.slice(0, 50) : "footer",
  });

  if (error) {
    if (isMissingFunction(error)) {
      console.error("subscribe_newsletter is missing — apply migrations 38–42.");
    } else {
      console.error("Newsletter signup failed:", error.message);
    }
    return NextResponse.json(
      { ok: false, error: "Subscription is temporarily unavailable." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
