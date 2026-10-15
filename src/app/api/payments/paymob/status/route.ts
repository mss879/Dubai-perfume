import { NextRequest } from "next/server";
import { shopperView } from "../../../../lib/payments/paymob/service";
import { enterPaymentRoute, json } from "../shared";

/**
 * The payment page's poll. While the order is unpaid it asks Paymob directly
 * (at most every ten seconds per order, however many tabs poll), so the page
 * learns the outcome even when the webhook is late or lost.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const entry = await enterPaymentRoute(request, { bucket: "payment_status", max: 120, windowSeconds: 600 });
    if (!entry.ok) return entry.response;

    const view = await shopperView(entry.config, entry.token, { sync: true, minIntervalSeconds: 10 });
    if (!view) return json(404, { ok: false, reason: "not_found" });
    return json(200, { ok: true, view });
  } catch {
    return json(503, { ok: false, reason: "unavailable" });
  }
}
