import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { isMissingFunction } from "../../lib/rpc-errors";

/** Footer newsletter signup — previously the email was discarded client-side. */
export async function POST(request: NextRequest) {
  let body: { email?: unknown; source?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; source?: unknown };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

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
