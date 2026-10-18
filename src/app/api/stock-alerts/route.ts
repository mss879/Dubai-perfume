import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";
import { isBot, readJsonBody } from "../../lib/request-guard";

/** "Notify me when it's back" on a sold-out size (request_stock_alert, migration 70). */

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  invalid_email: "Please enter a valid email address.",
  in_stock: "Good news: that size is in stock now.",
  unknown_product: "That size isn't available.",
  too_many: "You're already waiting for a lot of perfumes. We'll write as each comes back.",
  off: "Alerts aren't available just now.",
};

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody<{ productId?: unknown; size?: unknown; email?: unknown; company?: unknown }>(request, 2 * 1024);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: parsed.status });
  if (isBot(parsed.body.company)) return NextResponse.json({ ok: true });
  const productId = Number(parsed.body.productId);
  const size = typeof parsed.body.size === "string" ? parsed.body.size.slice(0, 50) : "";
  const email = String(parsed.body.email ?? "").trim();
  if (!Number.isSafeInteger(productId) || productId <= 0 || !size) return NextResponse.json({ ok: false, error: MESSAGES.unknown_product }, { status: 422 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, error: MESSAGES.invalid_email }, { status: 422 });
  if (!isSupabaseConfigured) return NextResponse.json({ ok: false, error: MESSAGES.off }, { status: 503 });

  const supabase = createServerSupabase();
  if (!(await checkRateLimit(supabase, `stock-alert:ip:${clientKey(request)}`, 15, 3600))) {
    return NextResponse.json({ ok: false, error: "Please wait a little before trying again." }, { status: 429 });
  }
  const { data, error } = await supabase.rpc("request_stock_alert", { p_product_id: productId, p_size: size, p_email: email });
  const result = (data ?? {}) as { ok?: boolean; reason?: string };
  if (error) return NextResponse.json({ ok: false, error: MESSAGES.off }, { status: 503 });
  if (!result.ok) return NextResponse.json({ ok: false, error: MESSAGES[result.reason ?? ""] ?? MESSAGES.off }, { status: 422 });
  return NextResponse.json({ ok: true });
}
