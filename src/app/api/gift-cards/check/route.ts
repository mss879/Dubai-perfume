import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../../lib/rate-limit";
import { readJsonBody } from "../../../lib/request-guard";

/** A gift card's balance (check_gift_card, migration 70). Tightly throttled: codes can't be guessed here. */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody<{ code?: unknown }>(request, 512);
  if (!parsed.ok) return NextResponse.json({ ok: false }, { status: parsed.status });
  const code = typeof parsed.body.code === "string" ? parsed.body.code.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) : "";
  if (code.replace(/-/g, "").length < 8) return NextResponse.json({ ok: true, status: "invalid" });
  if (!isSupabaseConfigured) return NextResponse.json({ ok: false }, { status: 503 });
  const supabase = createServerSupabase();
  if (!(await checkRateLimit(supabase, `giftcard-check:ip:${clientKey(request)}`, 10, 600))) {
    return NextResponse.json({ ok: false, error: "Please wait a few minutes before checking again." }, { status: 429 });
  }
  const { data, error } = await supabase.rpc("check_gift_card", { p_code: code });
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  const r = (data ?? {}) as { status?: string; balance?: number | null; expires_at?: string | null };
  return NextResponse.json({ ok: true, status: r.status ?? "invalid", balance: r.balance == null ? null : Number(r.balance), expiresAt: r.expires_at ?? null });
}
