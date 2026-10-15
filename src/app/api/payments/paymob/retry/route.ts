import { NextRequest } from "next/server";
import { shopperView, startPayment } from "../../../../lib/payments/paymob/service";
import { enterPaymentRoute, json } from "../shared";

/**
 * "Pay now" / "Try again": a fresh Paymob intention for the same order.
 * Paymob is asked first, so a payment that has just gone through is never
 * offered a second time.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const entry = await enterPaymentRoute(request, { bucket: "payment_retry", max: 10, windowSeconds: 600 });
    if (!entry.ok) return entry.response;

    const view = await shopperView(entry.config, entry.token, { sync: true, minIntervalSeconds: 5 });
    if (!view) return json(404, { ok: false, reason: "not_found" });
    if (view.state !== "awaiting") {
      return json(409, { ok: false, reason: view.state === "paid" ? "already_paid" : "closed", view });
    }

    const started = await startPayment(entry.config, entry.token);
    if (!started.ok) {
      return json(started.reason === "gateway_error" || started.reason === "unavailable" ? 503 : 409, {
        ok: false,
        reason: started.reason,
      });
    }
    return json(200, { ok: true, redirectUrl: started.redirectUrl });
  } catch {
    return json(503, { ok: false, reason: "unavailable" });
  }
}
