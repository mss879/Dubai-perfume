import "server-only";
import { createServerSupabase, isSupabaseConfigured } from "../../supabase-server";
import { isMissingFunction } from "../../rpc-errors";

/**
 * Typed wrappers over migration 63's payment functions.
 *
 * They run on the stateless anon client — the store has no service-role key —
 * and carry PAYMENTS_RPC_SECRET, which the database checks on every call.
 * Nothing here throws or logs; every failure is a short code.
 */

export type RpcFailureCode = "not_configured" | "unauthorised" | "missing_function" | "db_error";
export type RpcResult<T> = { ok: true; data: T } | { ok: false; code: RpcFailureCode };

async function call<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  if (!isSupabaseConfigured) return { ok: false, code: "not_configured" };
  try {
    const { data, error } = await createServerSupabase().rpc(fn, args);
    if (error) {
      if (isMissingFunction(error)) return { ok: false, code: "missing_function" };
      if (error.code === "42501") return { ok: false, code: "unauthorised" };
      return { ok: false, code: "db_error" };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, code: "db_error" };
  }
}

export type PaymentMode = "cod" | "online";

/** What the browser's cart can be rebuilt from (lib/cart.ts CartLine). */
export type PaymentViewItem = {
  product: { id: number; brand: string; name: string; price: number; image_url: string };
  selectedSize: string;
  quantity: number;
};

export type PaymentView = {
  order_id: string;
  created_at: string;
  state: "awaiting" | "paid" | "expired" | "cancelled";
  payment_status: string;
  total: number;
  refunded_fils: number;
  due_at: string;
  server_time: string;
  attempts_used: number;
  attempts_max: number;
  last_attempt_status: string | null;
  paid_after_close: boolean;
  can_pay: boolean;
  can_cancel: boolean;
  items: PaymentViewItem[];
};

export type OpenAttempt =
  | {
      ok: true;
      attempt_id: string;
      order_id: string;
      special_reference: string;
      amount_fils: number;
      currency: string;
      expires_in: number;
      item_count: number;
      billing: {
        first_name: string;
        last_name: string;
        full_name: string;
        email: string;
        phone: string;
        street: string;
        city: string;
        postal_code: string;
      };
    }
  | { ok: false; reason: "not_found" | "already_paid" | "closed" | "busy" | "too_many_attempts" | "window_closed" };

/** The email payload migration 63 builds (payment_email_payload). */
export type PaymentEmailPayload = {
  order_id: string;
  email: string;
  phone: string | null;
  /** Stored as place_order was given it (anon-callable): values are not guaranteed to be text. */
  shipping: Record<string, unknown> | null;
  first_name: string;
  last_name: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total: number;
  payment_status: string;
  paid_transaction_id: number | null;
  card_brand: string | null;
  card_last4: string | null;
  refunded_fils: number;
  attention: string[];
  items: { brand: string | null; name: string | null; size: string | null; quantity: number; unit_price: number }[];
};

export type ApplyOutcome =
  | "paid_now"
  | "paid_after_close"
  | "duplicate"
  | "duplicate_payment"
  | "needs_attention"
  | "post_payment"
  | "declined"
  | "pending"
  | "unknown_order"
  | "conflict";

export type ApplyResult = {
  outcome: ApplyOutcome;
  order_id?: string;
  refresh_transaction_id?: number | null;
  email?: PaymentEmailPayload;
  alerts?: string[];
  alert?: PaymentEmailPayload;
};

export type RefundStateResult = {
  changed: boolean;
  primary?: boolean;
  order_id?: string;
  delta_fils?: number;
  voided_now?: boolean;
  refunded_fils?: number;
  reason?: string;
  email?: PaymentEmailPayload;
  alerts?: string[];
  alert?: PaymentEmailPayload;
};

export type OutboxItem = PaymentEmailPayload & {
  needs_customer: boolean;
  needs_owner: boolean;
  alerts: string[];
};

/** The sanitized transaction payment_apply_transaction accepts. */
export type TransactionForApply = {
  id: number;
  paymob_order_id: number;
  amount_fils: number;
  currency: string;
  success: boolean;
  pending: boolean;
  is_auth: boolean;
  is_capture: boolean;
  is_voided: boolean;
  is_refunded: boolean;
  is_3d_secure: boolean;
  has_parent: boolean;
  integration_id: number;
  integration_known: boolean;
  source_type: string | null;
  source_sub_type: string | null;
  pan_last4: string | null;
  gateway_message?: string | null;
  kind_hint?: string | null;
  parent_transaction_id?: number | null;
};

export const rpc = {
  /** Public: no secret. */
  getPaymentMode: () => call<PaymentMode>("get_payment_mode", {}),
  ready: (secret: string) => call<{ ok: boolean; mode: PaymentMode }>("payment_ready", { p_secret: secret }),
  openAttempt: (secret: string, tokenHash: string) =>
    call<OpenAttempt>("payment_open_attempt", { p_secret: secret, p_token_hash: tokenHash }),
  recordAttempt: (
    secret: string,
    attemptId: string,
    ok: boolean,
    intentionId: string | null,
    paymobOrderId: number | null,
    errorCode: string | null
  ) =>
    call<boolean>("payment_record_attempt", {
      p_secret: secret,
      p_attempt_id: attemptId,
      p_ok: ok,
      p_intention_id: intentionId,
      p_paymob_order_id: paymobOrderId,
      p_error_code: errorCode,
    }),
  applyTransaction: (secret: string, txn: TransactionForApply, via: "webhook" | "inquiry") =>
    call<ApplyResult>("payment_apply_transaction", { p_secret: secret, p_txn: txn, p_via: via }),
  applyRefundState: (secret: string, transactionId: number, refundedFils: number, isVoided: boolean) =>
    call<RefundStateResult>("payment_apply_refund_state", {
      p_secret: secret,
      p_transaction_id: transactionId,
      p_refunded_fils: refundedFils,
      p_is_voided: isVoided,
    }),
  view: (secret: string, tokenHash: string) =>
    call<PaymentView | null>("payment_view", { p_secret: secret, p_token_hash: tokenHash }),
  cancel: (secret: string, tokenHash: string) =>
    call<{ ok: boolean; reason?: string; order_id?: string }>("payment_cancel", {
      p_secret: secret,
      p_token_hash: tokenHash,
    }),
  claimSync: (secret: string, orderId: string, minIntervalSeconds: number) =>
    call<{
      claimed: boolean;
      state?: string;
      paymob_order_ids?: number[];
      payment_transaction_ids?: number[];
    }>("payment_claim_sync", {
      p_secret: secret,
      p_order_id: orderId,
      p_min_interval_seconds: minIntervalSeconds,
    }),
  noteSync: (secret: string, orderId: string, ok: boolean, errorCode: string | null) =>
    call<boolean>("payment_note_sync", {
      p_secret: secret,
      p_order_id: orderId,
      p_ok: ok,
      p_error_code: errorCode,
    }),
  orderForPaymobOrder: (secret: string, paymobOrderId: number) =>
    call<string | null>("payment_order_for_paymob_order", {
      p_secret: secret,
      p_paymob_order_id: paymobOrderId,
    }),
  syncQueue: (secret: string, limit: number) =>
    call<{ order_id: string; overdue: boolean }[]>("payment_sync_queue", { p_secret: secret, p_limit: limit }),
  expire: (secret: string, orderId: string) =>
    call<{ expired: boolean; reason?: string }>("payment_expire", { p_secret: secret, p_order_id: orderId }),
  outboxClaim: (secret: string, orderId: string | null, limit: number) =>
    call<OutboxItem[]>("payment_outbox_claim", { p_secret: secret, p_order_id: orderId, p_limit: limit }),
  outboxDone: (
    secret: string,
    orderId: string,
    customerSent: boolean,
    ownerSent: boolean,
    alertsSent: string[],
    errorCode: string | null
  ) =>
    call<boolean>("payment_outbox_done", {
      p_secret: secret,
      p_order_id: orderId,
      p_customer_sent: customerSent,
      p_owner_sent: ownerSent,
      p_alerts_sent: alertsSent,
      p_error_code: errorCode,
    }),
};
