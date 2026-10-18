import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { readJsonBody } from "../../lib/request-guard";
import { jobSecret, verifyUnsubscribe } from "../../lib/marketing-links";

/**
 * The unsubscribe link in the store's marketing emails. The link is signed
 * (lib/marketing-links.ts), so nobody can unsubscribe someone else. It stops
 * reorder reminders, birthday emails and cart reminders for that address.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody<{ email?: unknown; token?: unknown }>(request, 1024);
  if (!parsed.ok) return NextResponse.json({ ok: false }, { status: parsed.status });
  const email = String(parsed.body.email ?? "").trim().toLowerCase();
  const token = typeof parsed.body.token === "string" ? parsed.body.token : "";
  if (!verifyUnsubscribe(email, token)) return NextResponse.json({ ok: false, error: "This link isn't valid." }, { status: 403 });
  if (!isSupabaseConfigured) return NextResponse.json({ ok: false, error: "Please try again later." }, { status: 503 });
  const { error } = await createServerSupabase().rpc("marketing_opt_out", { p_secret: jobSecret(), p_email: email });
  if (error) return NextResponse.json({ ok: false, error: "Please try again later." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
