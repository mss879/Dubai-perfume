import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminIdentity } from "../../../lib/auth";
import { isSameOrigin } from "../../../lib/request-guard";
import { SITE_URL } from "../../../lib/site";
import { readPaymobConfig } from "../../../lib/payments/paymob/config";
import { runReconcile } from "../../../lib/payments/paymob/service";

/**
 * The payment check, run every ten minutes by the scheduler
 * (netlify/functions/payments-reconcile.mts) and on demand from the admin
 * panel. Asks Paymob about unpaid orders, releases the ones whose payment
 * window has closed (only after Paymob confirmed nothing was paid), and sends
 * any confirmation or owner alert still owed.
 *
 * Authorised by `Authorization: Bearer <PAYMENTS_CRON_SECRET>` (compared in
 * constant time; unset means closed) or by a signed-in admin from this site.
 * Open through the site lock: job endpoints authenticate themselves.
 * Returns counts only.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 26;

function bearerMatches(request: NextRequest): boolean {
  const secret = (process.env.PAYMENTS_CRON_SECRET || "").trim();
  if (secret.length < 32) return false;
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const supplied = createHash("sha256").update(match[1].trim(), "utf8").digest();
  const expected = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(supplied, expected);
}

export async function POST(request: NextRequest) {
  try {
    const viaCron = bearerMatches(request);
    if (!viaCron) {
      const admin = isSameOrigin(request, SITE_URL) ? await getAdminIdentity() : null;
      if (!admin) {
        return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
      }
    }

    const cfg = readPaymobConfig();
    if (!cfg.ok) {
      return NextResponse.json(
        { ok: false, reason: "payments_not_configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const counts = await runReconcile(cfg.config, 8_000);
    return NextResponse.json({ ok: true, ...counts }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
