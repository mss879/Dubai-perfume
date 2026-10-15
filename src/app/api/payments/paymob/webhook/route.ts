import { NextRequest, NextResponse } from "next/server";
import { readJsonBody } from "../../../../lib/request-guard";
import { readPaymobConfig } from "../../../../lib/payments/paymob/config";
import {
  applyVerifiedCallback,
  syncForPaymobOrder,
  verifyCallback,
} from "../../../../lib/payments/paymob/service";

/**
 * Paymob's transaction-processed callback (server to server).
 *
 * Open through the site lock (src/proxy.ts) because it authenticates itself:
 * a strict shape check, the configured integration ids, then Paymob's
 * HMAC-SHA512 compared in constant time. A callback that fails any of those
 * changes nothing; at most it prompts the server to ask Paymob's authenticated
 * API about the order (throttled to once a minute per order), so a genuine
 * payment is never lost to a signature quirk and a forged one never counts.
 *
 * Answers carry no detail. Nothing is logged: the body holds customer data.
 *   200  processed, duplicate, or not ours
 *   401  not verified
 *   400 / 413  not a callback
 *   503  configuration or database unavailable — Paymob may retry
 */

export const dynamic = "force-dynamic";

const MAX_BODY = 64 * 1024;

function reply(status: number) {
  return NextResponse.json({ received: status < 300 }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const cfg = readPaymobConfig();
    if (!cfg.ok) return reply(503);

    const parsed = await readJsonBody<unknown>(request, MAX_BODY);
    if (!parsed.ok) return reply(parsed.status);
    const body = parsed.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400);

    // Card-token callbacks (saved cards) and anything else are not used here.
    if ((body as { type?: unknown }).type !== "TRANSACTION") return reply(200);

    const verdict = verifyCallback(
      (body as { obj?: unknown }).obj,
      request.nextUrl.searchParams.get("hmac"),
      cfg.config
    );
    if (!verdict.verified) {
      if (verdict.paymobOrderId) await syncForPaymobOrder(cfg.config, verdict.paymobOrderId);
      return reply(401);
    }

    const applied = await applyVerifiedCallback(cfg.config, verdict.transaction);
    return reply(applied.ok ? 200 : 503);
  } catch {
    return reply(503);
  }
}
