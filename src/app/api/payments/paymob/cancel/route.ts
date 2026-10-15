import { NextRequest } from "next/server";
import { hashToken, shopperView } from "../../../../lib/payments/paymob/service";
import { rpc } from "../../../../lib/payments/paymob/rpc";
import { enterPaymentRoute, json } from "../shared";

/**
 * "Change my order": releases an unpaid order (its stock and discount use go
 * back) and hands the browser its lines so the bag can be rebuilt. Paymob is
 * asked first, and the database refuses while a payment is still in flight —
 * a paid order can never be cancelled from here.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const entry = await enterPaymentRoute(request, { bucket: "payment_cancel", max: 10, windowSeconds: 600 });
    if (!entry.ok) return entry.response;

    const view = await shopperView(entry.config, entry.token, { sync: true, minIntervalSeconds: 5 });
    if (!view) return json(404, { ok: false, reason: "not_found" });
    if (view.state !== "awaiting") {
      return json(409, { ok: false, reason: view.state === "paid" ? "already_paid" : "closed", view });
    }

    const cancelled = await rpc.cancel(entry.config.rpcSecret, hashToken(entry.token));
    if (!cancelled.ok) return json(503, { ok: false, reason: "unavailable" });
    if (!cancelled.data.ok) return json(409, { ok: false, reason: cancelled.data.reason ?? "not_cancellable" });

    return json(200, { ok: true, items: view.items });
  } catch {
    return json(503, { ok: false, reason: "unavailable" });
  }
}
