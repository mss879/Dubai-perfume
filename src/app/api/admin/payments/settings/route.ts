import { NextRequest, NextResponse } from "next/server";
import { getAdminIdentity } from "../../../../lib/auth";
import { isSameOrigin, readJsonBody } from "../../../../lib/request-guard";
import { SITE_URL } from "../../../../lib/site";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { readPaymobConfig } from "../../../../lib/payments/paymob/config";
import { rpc } from "../../../../lib/payments/paymob/rpc";

/**
 * The admin's view of online payment, and the owner's switch.
 *
 * GET reports whether this deployment is configured — variable NAMES only,
 * never values — whether the database accepts the payment secret, which mode
 * the store is in, and the URLs to paste into Paymob's dashboard.
 * POST flips the mode; 'online' is refused unless Paymob is fully ready, so
 * the store can never be switched into a mode that cannot take an order.
 */

export const dynamic = "force-dynamic";

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function snapshot() {
  const cfg = readPaymobConfig();
  const mode = await rpc.getPaymentMode();
  const ready = cfg.ok ? await rpc.ready(cfg.config.rpcSecret) : null;
  const base = SITE_URL.replace(/\/+$/, "");
  return {
    configured: cfg.ok,
    /** Paymob inquiry (missed-callback recovery, refund read-back) needs PAYMOB_API_KEY. */
    inquiry: cfg.ok && cfg.config.apiKey !== null,
    keyMode: cfg.status.mode,
    missing: cfg.status.missing,
    invalid: cfg.status.invalid,
    secretAccepted: Boolean(ready?.ok && ready.data.ok),
    migrationApplied: mode.ok,
    storeMode: mode.ok ? mode.data : "cod",
    cronConfigured: (process.env.PAYMENTS_CRON_SECRET || "").trim().length >= 32,
    webhookUrl: `${base}/api/payments/paymob/webhook`,
    redirectUrl: `${base}/checkout/payment`,
  };
}

export async function GET() {
  const admin = await getAdminIdentity();
  if (!admin) return reply(403, { error: "Not authorised." });
  try {
    return reply(200, { ok: true, ...(await snapshot()) });
  } catch {
    return reply(503, { error: "Payment settings are unavailable." });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminIdentity();
  if (!admin) return reply(403, { error: "Not authorised." });
  if (!isSameOrigin(request, SITE_URL)) return reply(403, { error: "Not authorised." });

  const parsed = await readJsonBody<{ mode?: unknown }>(request, 256);
  if (!parsed.ok) return reply(parsed.status, { error: "Invalid request." });
  const mode = parsed.body?.mode;
  if (mode !== "cod" && mode !== "online") return reply(422, { error: "Invalid mode." });

  try {
    if (mode === "online") {
      const current = await snapshot();
      if (!current.configured || !current.secretAccepted) {
        return reply(409, {
          error:
            "Online payment is not ready: set every Paymob variable, add the matching payments secret to the database, and redeploy first.",
          ...current,
        });
      }
    }
    const supabase = await createSessionSupabase();
    const { error } = await supabase.rpc("admin_set_payment_mode", { p_mode: mode });
    if (error) {
      if (error.code === "42501") return reply(403, { error: "Not authorised." });
      return reply(409, { error: "The payment mode could not be changed." });
    }
    return reply(200, { ok: true, ...(await snapshot()) });
  } catch {
    return reply(503, { error: "Payment settings are unavailable." });
  }
}
