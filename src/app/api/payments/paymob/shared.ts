import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { readJsonBody } from "../../../lib/request-guard";
import { checkRateLimit, clientKey } from "../../../lib/rate-limit";
import { createServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { readPaymobConfig, type PaymobConfig } from "../../../lib/payments/paymob/config";
import { PAYMENT_TOKEN } from "../../../lib/payments/paymob/service";

/**
 * Common entry for the shopper's payment routes (status, retry, cancel).
 * The payment token in the body is the only credential: 256 bits, held by the
 * shopper's browser, stored server-side only as a hash.
 */

export function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

type Entry = { ok: true; config: PaymobConfig; token: string } | { ok: false; response: NextResponse };

export async function enterPaymentRoute(
  request: NextRequest,
  limit: { bucket: string; max: number; windowSeconds: number }
): Promise<Entry> {
  const cfg = readPaymobConfig();
  if (!cfg.ok || !isSupabaseConfigured) {
    return { ok: false, response: json(503, { ok: false, reason: "unavailable" }) };
  }

  const parsed = await readJsonBody<{ token?: unknown }>(request, 1024);
  if (!parsed.ok) return { ok: false, response: json(parsed.status, { ok: false, reason: "invalid" }) };
  const token = typeof parsed.body?.token === "string" ? parsed.body.token : "";
  if (!PAYMENT_TOKEN.test(token)) return { ok: false, response: json(404, { ok: false, reason: "not_found" }) };

  const allowed = await checkRateLimit(
    createServerSupabase(),
    `${limit.bucket}:ip:${clientKey(request)}`,
    limit.max,
    limit.windowSeconds
  );
  if (!allowed) return { ok: false, response: json(429, { ok: false, reason: "busy" }) };

  return { ok: true, config: cfg.config, token };
}
