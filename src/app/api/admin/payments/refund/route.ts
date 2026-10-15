import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentity } from "../../../../lib/auth";
import { isSameOrigin, readJsonBody } from "../../../../lib/request-guard";
import { SITE_URL } from "../../../../lib/site";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { readPaymobConfig } from "../../../../lib/payments/paymob/config";
import { executeRefund, refreshRefundState } from "../../../../lib/payments/paymob/service";

/**
 * Admin refund / void of a Paymob payment.
 *
 *   1. admin_payment_refund_begin (admin session; is_admin in SQL) reserves the
 *      request under the order's payment lock: one open request per order,
 *      never more than what remains, and the idempotency key — minted when
 *      the dialog opened — turns a double-click into a replay, not a second
 *      refund;
 *   2. Paymob's refund or void API;
 *   3. admin_payment_refund_finish records the outcome. A timeout is recorded
 *      as UNKNOWN and is never retried automatically;
 *   4. the transaction is re-read from Paymob and its authoritative refund
 *      state applied (which also emails the customer).
 *
 * Same-origin JSON only, so another site cannot drive an admin's browser here.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  orderId: z.string().regex(/^[A-Za-z0-9-]{3,100}$/),
  transactionId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  kind: z.enum(["refund", "void"]),
  amountAed: z.number().positive().max(1_000_000).optional(),
  reason: z.string().max(200).optional(),
  idempotencyKey: z.string().uuid(),
});

const REASONS: Record<string, string> = {
  not_found: "This order has no online payment.",
  not_refundable: "That transaction cannot be refunded.",
  already_voided: "This payment has already been cancelled.",
  void_not_allowed: "A payment that has been (partly) refunded cannot be voided. Use a refund instead.",
  invalid_amount: "Enter an amount above zero.",
  amount_too_high: "That is more than remains to refund on this payment.",
  refund_in_progress: "Another refund on this order is still being processed. Wait a minute and refresh.",
};

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminIdentity();
  if (!admin) return reply(403, { error: "Not authorised." });
  if (!isSameOrigin(request, SITE_URL)) return reply(403, { error: "Not authorised." });
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return reply(415, { error: "Invalid request." });
  }

  const cfg = readPaymobConfig();
  if (!cfg.ok) return reply(503, { error: "Online payments are not configured on this deployment." });

  const parsed = await readJsonBody<unknown>(request, 2048);
  if (!parsed.ok) return reply(parsed.status, { error: "Invalid request." });
  const body = bodySchema.safeParse(parsed.body);
  if (!body.success) return reply(422, { error: "Invalid request." });
  const input = body.data;

  let amountFils: number | null = null;
  if (input.kind === "refund") {
    if (input.amountAed === undefined) return reply(422, { error: REASONS.invalid_amount });
    amountFils = Math.round(input.amountAed * 100);
    if (Math.abs(amountFils - input.amountAed * 100) > 0.001 || amountFils <= 0) {
      return reply(422, { error: "Amounts are in AED with at most two decimals." });
    }
  }

  try {
    const supabase = await createSessionSupabase();
    const begin = await supabase.rpc("admin_payment_refund_begin", {
      p_order_id: input.orderId,
      p_transaction_id: input.transactionId,
      p_kind: input.kind,
      p_amount_fils: amountFils,
      p_reason: input.reason ?? null,
      p_idempotency_key: input.idempotencyKey,
    });
    if (begin.error) {
      return begin.error.code === "42501"
        ? reply(403, { error: "Not authorised." })
        : reply(500, { error: "The refund could not be started." });
    }
    const started = begin.data as {
      ok: boolean;
      reason?: string;
      replay?: boolean;
      refund_id?: string;
      status?: string;
      transaction_id?: number;
      kind?: "refund" | "void";
      amount_fils?: number;
      refundable_fils?: number;
    };
    if (!started.ok) {
      return reply(409, {
        error: REASONS[started.reason ?? ""] ?? "The refund could not be started.",
        refundableAed: typeof started.refundable_fils === "number" ? started.refundable_fils / 100 : undefined,
      });
    }
    if (started.replay) {
      // Already handled (or still in flight): never call Paymob a second time.
      return reply(200, { ok: started.status === "succeeded", status: started.status, replay: true });
    }

    const result = await executeRefund(cfg.config, {
      kind: started.kind as "refund" | "void",
      transactionId: Number(started.transaction_id),
      amountFils: Number(started.amount_fils),
    });

    await supabase.rpc("admin_payment_refund_finish", {
      p_refund_id: started.refund_id,
      p_status: result.status,
      p_refund_transaction_id: result.refundTransactionId,
      p_error_code: result.errorCode,
    });

    if (result.status !== "failed") {
      await refreshRefundState(cfg.config, Number(started.transaction_id));
    }

    return reply(200, {
      ok: result.status === "succeeded",
      status: result.status,
      message:
        result.status === "unknown"
          ? "Paymob did not confirm the outcome in time. Check the transaction in the Paymob dashboard before trying again; the order will update itself once Paymob reports it."
          : result.message,
    });
  } catch {
    return reply(500, { error: "The refund could not be completed. Check the Paymob dashboard before retrying." });
  }
}
