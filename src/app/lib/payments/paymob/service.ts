import "server-only";
import { createHash } from "node:crypto";
import { SITE_URL } from "../../site";
import { getOwnerNotificationAddress, sendEmail } from "../../email/send";
import {
  newOrderOwnerEmail,
  orderConfirmationEmail,
  paymentAttentionOwnerEmail,
  paymentRefundEmail,
  type OwnerOrderEmailData,
} from "../../email/templates";
import { PAYMOB_CHECKOUT_BASE, type PaymobConfig } from "./config";
import {
  createIntention,
  getTransaction,
  inquireOrder,
  refundTransaction,
  transactionOrderId,
  transactionParentId,
  voidTransaction,
} from "./client";
import { canonicalString, hmacMatches } from "./hmac";
import { signedTransactionSchema, type ApiTransaction, type SignedTransactionInput } from "./schema";
import {
  rpc,
  type ApplyOutcome,
  type PaymentEmailPayload,
  type PaymentView,
  type TransactionForApply,
} from "./rpc";

/**
 * Paymob orchestration: open an attempt, verify and apply what Paymob says,
 * reconcile by inquiry, send the confirmations exactly once.
 *
 * The rule throughout: the database decides (migration 63, under row locks);
 * this module only carries Paymob's answers to it and acts on the outcome.
 * Nothing here prints anything — no payloads, no secrets, no customer data.
 */

export const PAYMENT_TOKEN = /^[0-9a-f]{64}$/;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function paymentPath(token: string): string {
  return `/checkout/payment/${token}`;
}

/** Absolute URL from configuration — never from the request's Host header. */
function absolute(path: string): string {
  return `${SITE_URL.replace(/\/+$/, "")}${path}`;
}

// ---------------------------------------------------------------------------
// Starting a payment
// ---------------------------------------------------------------------------

export type StartFailure =
  | "unavailable"
  | "not_found"
  | "already_paid"
  | "closed"
  | "busy"
  | "too_many_attempts"
  | "window_closed"
  | "gateway_error";

export type StartResult = { ok: true; redirectUrl: string } | { ok: false; reason: StartFailure };

/**
 * Opens a new attempt for the order behind `token` and returns the Paymob
 * Unified Checkout URL. The URL is only handed out once the attempt's Paymob
 * order id is recorded, so nobody can pay an intention the store does not
 * track.
 */
export async function startPayment(config: PaymobConfig, token: string): Promise<StartResult> {
  if (!PAYMENT_TOKEN.test(token)) return { ok: false, reason: "not_found" };

  const opened = await rpc.openAttempt(config.rpcSecret, hashToken(token));
  if (!opened.ok) return { ok: false, reason: "unavailable" };
  const attempt = opened.data;
  if (!attempt.ok) return { ok: false, reason: attempt.reason };

  const [first = "", ...rest] = (attempt.billing.full_name || "").trim().split(/\s+/);
  const intention = await createIntention(config, {
    amountFils: attempt.amount_fils,
    specialReference: attempt.special_reference,
    expiresIn: attempt.expires_in,
    orderId: attempt.order_id,
    itemCount: attempt.item_count,
    billing: {
      firstName: attempt.billing.first_name || first || "Customer",
      lastName: attempt.billing.last_name || rest.join(" ") || "NA",
      email: attempt.billing.email,
      phone: attempt.billing.phone,
      street: attempt.billing.street,
      city: attempt.billing.city,
      postalCode: attempt.billing.postal_code,
    },
    notificationUrl: absolute("/api/payments/paymob/webhook"),
    redirectionUrl: absolute(paymentPath(token)),
  });

  if (!intention.ok) {
    await rpc.recordAttempt(config.rpcSecret, attempt.attempt_id, false, null, null, intention.code);
    return { ok: false, reason: "gateway_error" };
  }

  const recorded = await rpc.recordAttempt(
    config.rpcSecret,
    attempt.attempt_id,
    true,
    intention.intentionId,
    intention.paymobOrderId,
    null
  );
  if (!recorded.ok || recorded.data !== true) return { ok: false, reason: "gateway_error" };

  const url = new URL(`${PAYMOB_CHECKOUT_BASE}/`);
  url.searchParams.set("publicKey", config.publicKey);
  url.searchParams.set("clientSecret", intention.clientSecret);
  return { ok: true, redirectUrl: url.toString() };
}

/** The only address a shopper's browser is ever sent to for payment. */
export function isPaymobCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === PAYMOB_CHECKOUT_BASE && url.pathname === "/";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Turning Paymob's data into what the database accepts
// ---------------------------------------------------------------------------

const clip = (value: string | null | undefined, max: number): string | null => {
  if (!value) return null;
  const clean = value.replace(/[^\x20-\x7E]/g, "").trim().slice(0, max);
  return clean || null;
};

/** Last four digits of a card number, only from a value that is clearly a masked card. */
function lastFour(pan: string | null | undefined): string | null {
  if (!pan) return null;
  if (/^\d{4}$/.test(pan)) return pan;
  if (/^[0-9xX*\s-]{8,23}$/.test(pan) && /[xX*]/.test(pan)) {
    const digits = pan.replace(/\D/g, "");
    return digits.length >= 4 ? digits.slice(-4) : null;
  }
  return null;
}

/** From a callback whose signature verified. Only HMAC-covered fields are used. */
function fromSigned(t: SignedTransactionInput, config: PaymobConfig): TransactionForApply {
  return {
    id: t.id,
    paymob_order_id: t.order.id,
    amount_fils: t.amount_cents,
    currency: t.currency,
    success: t.success,
    pending: t.pending,
    is_auth: t.is_auth,
    is_capture: t.is_capture,
    is_voided: t.is_voided,
    is_refunded: t.is_refunded,
    is_3d_secure: t.is_3d_secure,
    has_parent: t.has_parent_transaction,
    integration_id: t.integration_id,
    integration_known: config.integrationIds.includes(t.integration_id),
    source_type: clip(t.source_data.type, 32),
    source_sub_type: clip(t.source_data.sub_type, 32),
    pan_last4: lastFour(t.source_data.pan),
  };
}

/** From Paymob's authenticated API: may also carry the uncovered fields. */
function fromApi(t: ApiTransaction, config: PaymobConfig): TransactionForApply {
  return {
    id: t.id,
    paymob_order_id: transactionOrderId(t),
    amount_fils: t.amount_cents,
    currency: t.currency,
    success: t.success,
    pending: t.pending,
    is_auth: t.is_auth,
    is_capture: t.is_capture,
    is_voided: t.is_voided,
    is_refunded: t.is_refunded,
    is_3d_secure: t.is_3d_secure,
    has_parent: t.has_parent_transaction,
    integration_id: t.integration_id,
    integration_known: config.integrationIds.includes(t.integration_id),
    source_type: clip(t.source_data?.type, 32),
    source_sub_type: clip(t.source_data?.sub_type, 32),
    pan_last4: lastFour(t.source_data?.pan),
    gateway_message: clip(t.data?.message, 120),
    kind_hint: t.is_refund ? "refund" : t.is_void ? "void" : t.has_parent_transaction && t.is_capture ? "capture" : null,
    parent_transaction_id: transactionParentId(t),
  };
}

// ---------------------------------------------------------------------------
// The webhook's trust decision
// ---------------------------------------------------------------------------

export type CallbackVerdict =
  | { verified: true; transaction: SignedTransactionInput }
  | { verified: false; paymobOrderId: number | null };

function claimedOrderId(obj: unknown): number | null {
  if (!obj || typeof obj !== "object") return null;
  const order = (obj as { order?: unknown }).order;
  const id = order && typeof order === "object" ? (order as { id?: unknown }).id : order;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Strict shape -> pins (integration id, optional owner id) -> HMAC, in that
 * order. Anything short of all three is unverified, and an unverified callback
 * may at most prompt the server to ask Paymob itself.
 */
export function verifyCallback(obj: unknown, hmac: string | null, config: PaymobConfig): CallbackVerdict {
  const parsed = signedTransactionSchema.safeParse(obj);
  if (!parsed.success) return { verified: false, paymobOrderId: claimedOrderId(obj) };
  const t = parsed.data;
  const pinned =
    config.integrationIds.includes(t.integration_id) &&
    (config.ownerId === null || t.owner === config.ownerId);
  if (!pinned || !hmacMatches(hmac, canonicalString(t), config.hmacSecrets)) {
    return { verified: false, paymobOrderId: t.order.id };
  }
  return { verified: true, transaction: t };
}

// ---------------------------------------------------------------------------
// Applying, and what follows
// ---------------------------------------------------------------------------

export type ApplyFollowUp = { ok: true; outcome: ApplyOutcome; orderId?: string } | { ok: false };

export async function applyVerifiedCallback(config: PaymobConfig, t: SignedTransactionInput) {
  return applyAndFollowUp(config, fromSigned(t, config), "webhook");
}

async function applyAndFollowUp(
  config: PaymobConfig,
  txn: TransactionForApply,
  via: "webhook" | "inquiry"
): Promise<ApplyFollowUp> {
  const applied = await rpc.applyTransaction(config.rpcSecret, txn, via);
  if (!applied.ok) return { ok: false };
  const result = applied.data;

  if (result.outcome === "paid_now" && result.email && result.order_id) {
    await sendConfirmations(config, result.order_id, result.email, result.alerts ?? []);
  } else if (result.alerts?.length && result.alert && result.order_id) {
    const sent = await sendAlerts(result.order_id, result.alert, result.alerts);
    await rpc.outboxDone(config.rpcSecret, result.order_id, false, false, sent, sent.length ? null : "alert_failed");
  }
  if (result.refresh_transaction_id) {
    await refreshRefundState(config, result.refresh_transaction_id);
  }
  return { ok: true, outcome: result.outcome, orderId: result.order_id };
}

/**
 * Re-reads a payment transaction from Paymob and records its refund / void
 * state. The refunded amount is never taken from a webhook (not signed).
 */
export async function refreshRefundState(config: PaymobConfig, transactionId: number): Promise<boolean> {
  const fetched = await getTransaction(config, transactionId);
  if (!fetched.ok || !fetched.transaction) return false;
  const t = fetched.transaction;
  return recordRefundState(config, transactionId, t.refunded_amount_cents ?? 0, t.is_voided);
}

/**
 * Records a refund total / void for a payment transaction, then tells the
 * customer and flags anything new. The database only ever moves these forward
 * (refunds grow, voids stay), so a later, fuller read can only confirm them.
 *
 * Callers pass numbers Paymob itself gave this server: a read-back of the
 * transaction (refreshRefundState), or Paymob's answer to the refund or void
 * the admin just made (the refund route, when there is no API key to read it
 * back). Never a webhook's unsigned fields.
 */
export async function recordRefundState(
  config: PaymobConfig,
  transactionId: number,
  refundedFils: number,
  voided: boolean
): Promise<boolean> {
  const applied = await rpc.applyRefundState(config.rpcSecret, transactionId, refundedFils, voided);
  if (!applied.ok) return false;
  const r = applied.data;

  if (r.changed && r.primary && r.email && r.order_id) {
    try {
      const data = emailData(r.email);
      const voided = Boolean(r.voided_now);
      const message = paymentRefundEmail(data, { amountAed: (r.delta_fils ?? 0) / 100, voided });
      await sendEmail(
        { to: r.email.email, ...message },
        {
          quiet: true,
          idempotencyKey: voided
            ? `paymob/void/${r.order_id}`
            : `paymob/refund/${r.order_id}/${r.refunded_fils ?? 0}`,
        }
      );
    } catch {
      // The refund is recorded either way; the notice is a courtesy.
    }
  }
  if (r.alerts?.length && r.alert && r.order_id) {
    const sent = await sendAlerts(r.order_id, r.alert, r.alerts);
    await rpc.outboxDone(config.rpcSecret, r.order_id, false, false, sent, sent.length ? null : "alert_failed");
  }
  return true;
}

// ---------------------------------------------------------------------------
// Reconciling by inquiry
// ---------------------------------------------------------------------------

export type SyncResult = "synced" | "partial" | "throttled" | "error";

/**
 * Asks Paymob about every attempt on the order and applies what it says.
 * Throttled per order in the database, however many callers ask. Only when
 * every inquiry answered is the order marked as synced — which is what lets
 * an overdue order expire.
 */
export async function syncOrder(config: PaymobConfig, orderId: string, minIntervalSeconds: number): Promise<SyncResult> {
  const claim = await rpc.claimSync(config.rpcSecret, orderId, minIntervalSeconds);
  if (!claim.ok) return "error";
  if (!claim.data.claimed) return "throttled";

  if (!config.apiKey) {
    // Notifications only: Paymob's signed callbacks are the whole record and
    // there is no one to ask. "Synced" therefore means no callback has reported
    // a payment by now. Past the deadline that is what releases an unpaid order,
    // and Paymob's own page closed at least ten minutes before it (the
    // intention's expiry), so a payment cannot still be on its way. One that is
    // anyway arrives as paid_after_close and is flagged to the owner.
    await rpc.noteSync(config.rpcSecret, orderId, true, null);
    return "synced";
  }

  let allAnswered = true;
  for (const paymobOrderId of (claim.data.paymob_order_ids ?? []).slice(0, 5)) {
    const inquiry = await inquireOrder(config, paymobOrderId);
    if (!inquiry.ok) {
      allAnswered = false;
      continue;
    }
    const t = inquiry.transaction;
    if (!t) continue;
    if (transactionOrderId(t) !== paymobOrderId) {
      allAnswered = false;
      continue;
    }
    // The latest transaction may be a refund or void: make sure the payment it
    // belongs to is recorded first.
    const parentId = t.has_parent_transaction ? transactionParentId(t) : null;
    if (parentId) {
      const parent = await getTransaction(config, parentId);
      if (parent.ok && parent.transaction && transactionOrderId(parent.transaction) === paymobOrderId) {
        await applyAndFollowUp(config, fromApi(parent.transaction, config), "inquiry");
      } else if (!parent.ok) {
        allAnswered = false;
      }
    }
    const applied = await applyAndFollowUp(config, fromApi(t, config), "inquiry");
    if (!applied.ok) allAnswered = false;
  }

  // Refunds made directly in Paymob's dashboard.
  for (const transactionId of (claim.data.payment_transaction_ids ?? []).slice(0, 5)) {
    await refreshRefundState(config, transactionId);
  }

  await rpc.noteSync(config.rpcSecret, orderId, allAnswered, allAnswered ? null : "inquiry_failed");
  return allAnswered ? "synced" : "partial";
}

/** For a webhook that did not verify: ask Paymob directly, at most once a minute per order. */
export async function syncForPaymobOrder(config: PaymobConfig, paymobOrderId: number): Promise<void> {
  if (!config.apiKey) return; // nothing to ask without the API key
  const found = await rpc.orderForPaymobOrder(config.rpcSecret, paymobOrderId);
  if (found.ok && found.data) await syncOrder(config, found.data, 60);
}

/** The shopper's payment page, optionally asking Paymob first. */
export async function shopperView(
  config: PaymobConfig,
  token: string,
  options: { sync: boolean; minIntervalSeconds?: number }
): Promise<PaymentView | null> {
  if (!PAYMENT_TOKEN.test(token)) return null;
  const hash = hashToken(token);
  const first = await rpc.view(config.rpcSecret, hash);
  if (!first.ok || !first.data) return null;
  if (!options.sync || first.data.state !== "awaiting") return first.data;
  await syncOrder(config, first.data.order_id, options.minIntervalSeconds ?? 10);
  const again = await rpc.view(config.rpcSecret, hash);
  return again.ok && again.data ? again.data : first.data;
}

/** The scheduled job: check what is due, expire what is overdue, send what is owed. */
export async function runReconcile(config: PaymobConfig, budgetMs: number) {
  const started = Date.now();
  const counts = { checked: 0, expired: 0, emailed: 0 };

  const queue = await rpc.syncQueue(config.rpcSecret, 25);
  if (queue.ok) {
    for (const item of queue.data) {
      if (Date.now() - started > budgetMs) break;
      try {
        await syncOrder(config, item.order_id, 60);
        counts.checked += 1;
        if (item.overdue) {
          const expired = await rpc.expire(config.rpcSecret, item.order_id);
          if (expired.ok && expired.data.expired) counts.expired += 1;
        }
      } catch {
        // Left for the next run; the rest of the queue still gets checked.
      }
    }
  }
  if (Date.now() - started < budgetMs) {
    counts.emailed = await deliverOutbox(config, null, 10);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Admin refunds — the Paymob half. The route holds the request open in the
// database (admin_payment_refund_begin) before this runs.
// ---------------------------------------------------------------------------

export type RefundExecution = {
  status: "succeeded" | "failed" | "unknown";
  refundTransactionId: number | null;
  errorCode: string | null;
  message?: string;
};

export async function executeRefund(
  config: PaymobConfig,
  request: { kind: "refund" | "void"; transactionId: number; amountFils: number }
): Promise<RefundExecution> {
  const result =
    request.kind === "void"
      ? await voidTransaction(config, request.transactionId)
      : await refundTransaction(config, request.transactionId, request.amountFils);

  if (!result.ok) {
    const definite = /^http_4\d\d$/.test(result.code) && result.code !== "http_408" && result.code !== "http_429";
    return {
      status: definite ? "failed" : "unknown",
      refundTransactionId: null,
      errorCode: result.code,
      message: result.message,
    };
  }
  const t = result.transaction;
  if (!t) return { status: "unknown", refundTransactionId: null, errorCode: "bad_response" };
  if (t.pending) return { status: "unknown", refundTransactionId: t.id, errorCode: "pending" };
  return t.success
    ? { status: "succeeded", refundTransactionId: t.id, errorCode: null }
    : { status: "failed", refundTransactionId: t.id, errorCode: "declined", message: clip(t.data?.message, 160) ?? undefined };
}

// ---------------------------------------------------------------------------
// Email — every message has an idempotency key, so a retried send is
// delivered once. Nothing is printed when a send fails; the outbox retries.
// ---------------------------------------------------------------------------

/** Text or nothing: a shipping value that is not a string never reaches the templates. */
function text(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function emailData(p: PaymentEmailPayload): OwnerOrderEmailData {
  const shipping = p.shipping ?? {};
  const cardLabel =
    p.card_brand && p.card_last4 ? `${p.card_brand} ending ${p.card_last4}` : p.card_brand || null;
  return {
    orderId: p.order_id,
    customerName: [p.first_name, p.last_name].filter(Boolean).join(" ") || text(shipping.name),
    lines: (p.items ?? []).map((item) => ({
      name: item.name ?? "Fragrance",
      brand: item.brand,
      size: item.size,
      quantity: Number(item.quantity) || 1,
      unitPriceAed: Number(item.unit_price) || 0,
    })),
    subtotalAed: Number(p.subtotal) || 0,
    shippingFeeAed: Number(p.shipping_fee) || 0,
    discountAed: Number(p.discount_amount) || 0,
    totalAed: Number(p.total) || 0,
    payment: { method: "paymob", cardLabel },
    customerEmail: p.email,
    phone: p.phone,
    shipping: {
      name: text(shipping.name),
      street: text(shipping.street),
      city: text(shipping.city),
      country: text(shipping.country),
      postal_code: text(shipping.postal_code),
    },
  };
}

async function sendConfirmations(
  config: PaymobConfig,
  orderId: string,
  payload: PaymentEmailPayload,
  alerts: string[]
): Promise<void> {
  // What went out is recorded even if building a later message throws, so the
  // outbox retries only the rest and the caller (a webhook) still answers.
  let customerSent = false;
  let ownerSent = false;
  let sentAlerts: string[] = [];
  let failed = true;
  try {
    const data = emailData(payload);
    customerSent = (
      await sendEmail(
        { to: payload.email, ...orderConfirmationEmail(data) },
        { quiet: true, idempotencyKey: `paymob/confirmation/${orderId}` }
      )
    ).ok;
    const ownerAddress = getOwnerNotificationAddress();
    ownerSent = ownerAddress
      ? (
          await sendEmail(
            { to: ownerAddress, ...newOrderOwnerEmail(data) },
            { quiet: true, idempotencyKey: `paymob/owner/${orderId}` }
          )
        ).ok
      : false;
    sentAlerts = alerts.length ? await sendAlerts(orderId, payload, alerts) : [];
    failed = !customerSent || !ownerSent || sentAlerts.length < alerts.length;
  } catch {
    failed = true;
  }
  await rpc.outboxDone(config.rpcSecret, orderId, customerSent, ownerSent, sentAlerts, failed ? "send_failed" : null);
}

async function sendAlerts(orderId: string, payload: PaymentEmailPayload, alerts: string[]): Promise<string[]> {
  const to = getOwnerNotificationAddress();
  if (!to || alerts.length === 0) return [];
  try {
    const message = paymentAttentionOwnerEmail(emailData(payload), alerts);
    const sent = await sendEmail(
      { to, ...message },
      { quiet: true, idempotencyKey: `paymob/alert/${orderId}/${[...alerts].sort().join("+")}` }
    );
    return sent.ok ? alerts : [];
  } catch {
    return [];
  }
}

/** Sends whatever the outbox says is still owed. Returns how many orders were handled. */
export async function deliverOutbox(config: PaymobConfig, orderId: string | null, limit: number): Promise<number> {
  const claimed = await rpc.outboxClaim(config.rpcSecret, orderId, limit);
  if (!claimed.ok) return 0;
  for (const item of claimed.data) {
    // One order's bad data must not hold up the others: each is settled on its own.
    let customerSent = false;
    let ownerSent = false;
    let alertsSent: string[] = [];
    let failed = true;
    try {
      const data = emailData(item);
      if (item.needs_customer) {
        const r = await sendEmail(
          { to: item.email, ...orderConfirmationEmail(data) },
          { quiet: true, idempotencyKey: `paymob/confirmation/${item.order_id}` }
        );
        customerSent = r.ok;
      }
      if (item.needs_owner) {
        const to = getOwnerNotificationAddress();
        const r = to
          ? await sendEmail(
              { to, ...newOrderOwnerEmail(data) },
              { quiet: true, idempotencyKey: `paymob/owner/${item.order_id}` }
            )
          : { ok: false };
        ownerSent = r.ok;
      }
      alertsSent = item.alerts?.length ? await sendAlerts(item.order_id, item, item.alerts) : [];
      failed =
        (item.needs_customer && !customerSent) ||
        (item.needs_owner && !ownerSent) ||
        alertsSent.length < (item.alerts?.length ?? 0);
    } catch {
      failed = true;
    }
    await rpc.outboxDone(config.rpcSecret, item.order_id, customerSent, ownerSent, alertsSent, failed ? "send_failed" : null);
  }
  return claimed.data.length;
}
