import "server-only";
import { PAYMOB_API_BASE, type PaymobConfig } from "./config";
import {
  apiTransactionSchema,
  authTokenResponseSchema,
  intentionResponseSchema,
  type ApiTransaction,
} from "./schema";

/**
 * Paymob's HTTP API, server-side only.
 *
 * Every call has a timeout, refuses redirects, never caches, and NEVER logs:
 * request bodies carry customer data and headers carry secrets. Failures come
 * back as short machine codes ("http_401", "timeout"); Paymob's own one-line
 * explanation is kept separately for the admin refund screen and goes nowhere
 * else.
 */

export type PaymobFailure = { ok: false; code: string; message?: string };

type JsonResult = { ok: true; status: number; body: unknown } | PaymobFailure;

const MAX_RESPONSE_CHARS = 256 * 1024;

async function request(
  path: string,
  init: { method: "GET" | "POST"; headers?: Record<string, string>; body?: unknown; timeoutMs: number }
): Promise<JsonResult> {
  let res: Response;
  try {
    res = await fetch(`${PAYMOB_API_BASE}${path}`, {
      method: init.method,
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(init.timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    return { ok: false, code: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
  }

  let text: string;
  try {
    text = await res.text();
  } catch {
    return { ok: false, code: "bad_response" };
  }
  if (text.length > MAX_RESPONSE_CHARS) return { ok: false, code: "bad_response" };

  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) return { ok: false, code: `http_${res.status}`, message: paymobMessage(body) };
  return { ok: true, status: res.status, body };
}

/** Paymob's `message` / `detail`, printable ASCII only, for the admin's eyes. */
function paymobMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const raw =
    typeof record.message === "string" ? record.message : typeof record.detail === "string" ? record.detail : "";
  const clean = raw.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return clean || undefined;
}

// ---------------------------------------------------------------------------
// Intention (one payment attempt) — Secret Key auth
// ---------------------------------------------------------------------------

export type IntentionInput = {
  amountFils: number;
  specialReference: string;
  expiresIn: number;
  orderId: string;
  itemCount: number;
  billing: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    postalCode: string;
  };
  notificationUrl: string;
  redirectionUrl: string;
};

export type IntentionResult =
  | { ok: true; intentionId: string; paymobOrderId: number; clientSecret: string }
  | PaymobFailure;

/** Paymob wants every billing field present; "NA" is its own convention for unknown. */
const field = (value: string, max = 50) => {
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : "NA";
};

export async function createIntention(config: PaymobConfig, input: IntentionInput): Promise<IntentionResult> {
  const result = await request("/v1/intention/", {
    method: "POST",
    timeoutMs: 15_000,
    headers: { Authorization: `Token ${config.secretKey}` },
    body: {
      amount: input.amountFils,
      currency: "AED",
      payment_methods: config.integrationIds,
      // One summary line: the sum of item amounts must equal `amount`, and a
      // single line stays true whatever the discounts and delivery.
      items: [
        {
          name: field(`Gharib order ${input.orderId}`),
          amount: input.amountFils,
          description: field(`${input.itemCount} ${input.itemCount === 1 ? "item" : "items"}`, 255),
          quantity: 1,
        },
      ],
      billing_data: {
        first_name: field(input.billing.firstName),
        last_name: field(input.billing.lastName),
        email: input.billing.email.slice(0, 255),
        phone_number: input.billing.phone.replace(/[^\d+]/g, "").slice(0, 20),
        street: field(input.billing.street, 100),
        building: "NA",
        floor: "NA",
        apartment: "NA",
        city: field(input.billing.city),
        state: "NA",
        country: "ARE",
        postal_code: field(input.billing.postalCode, 20),
      },
      special_reference: input.specialReference,
      expiration: input.expiresIn,
      notification_url: input.notificationUrl,
      redirection_url: input.redirectionUrl,
    },
  });
  if (!result.ok) return result;

  const parsed = intentionResponseSchema.safeParse(result.body);
  if (!parsed.success) return { ok: false, code: "bad_response" };
  return {
    ok: true,
    intentionId: parsed.data.id,
    paymobOrderId: parsed.data.intention_order_id,
    clientSecret: parsed.data.client_secret,
  };
}

// ---------------------------------------------------------------------------
// Refund / void — Secret Key auth. A 2xx with a body we cannot read is an
// UNKNOWN outcome, never a success: the caller re-reads the transaction.
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true; transaction: ApiTransaction | null }
  | PaymobFailure;

async function transactionAction(
  config: PaymobConfig,
  path: string,
  body: Record<string, number>
): Promise<ActionResult> {
  const result = await request(path, {
    method: "POST",
    timeoutMs: 20_000,
    headers: { Authorization: `Token ${config.secretKey}` },
    body,
  });
  if (!result.ok) return result;
  const parsed = apiTransactionSchema.safeParse(result.body);
  return { ok: true, transaction: parsed.success ? parsed.data : null };
}

export function refundTransaction(config: PaymobConfig, transactionId: number, amountFils: number) {
  return transactionAction(config, "/api/acceptance/void_refund/refund", {
    transaction_id: transactionId,
    amount_cents: amountFils,
  });
}

export function voidTransaction(config: PaymobConfig, transactionId: number) {
  return transactionAction(config, "/api/acceptance/void_refund/void", { transaction_id: transactionId });
}

// ---------------------------------------------------------------------------
// Inquiry — API Key -> short-lived auth token (Bearer). The token is cached in
// this instance for well under its lifetime and is never written anywhere.
// ---------------------------------------------------------------------------

let cachedToken: { key: string; token: string; expires: number } | null = null;

async function authToken(config: PaymobConfig, force = false): Promise<{ ok: true; token: string } | PaymobFailure> {
  const apiKey = config.apiKey;
  // Notifications-only: there is nothing to ask Paymob with.
  if (!apiKey) return { ok: false, code: "no_api_key" };
  if (!force && cachedToken && cachedToken.key === apiKey && cachedToken.expires > Date.now()) {
    return { ok: true, token: cachedToken.token };
  }
  const result = await request("/api/auth/tokens", {
    method: "POST",
    timeoutMs: 10_000,
    body: { api_key: apiKey },
  });
  if (!result.ok) return result;
  const parsed = authTokenResponseSchema.safeParse(result.body);
  if (!parsed.success) return { ok: false, code: "bad_response" };
  cachedToken = { key: apiKey, token: parsed.data.token, expires: Date.now() + 45 * 60_000 };
  return { ok: true, token: parsed.data.token };
}

export type InquiryResult = { ok: true; transaction: ApiTransaction | null } | PaymobFailure;

/** One transaction by its id, with every field (refund totals included). */
export async function getTransaction(config: PaymobConfig, transactionId: number): Promise<InquiryResult> {
  for (const force of [false, true]) {
    const token = await authToken(config, force);
    if (!token.ok) return token;
    const result = await request(`/api/acceptance/transactions/${transactionId}`, {
      method: "GET",
      timeoutMs: 10_000,
      headers: { Authorization: `Bearer ${token.token}` },
    });
    if (!result.ok) {
      if (result.code === "http_401" && !force) continue;
      if (result.code === "http_404") return { ok: true, transaction: null };
      return result;
    }
    const parsed = apiTransactionSchema.safeParse(result.body);
    return parsed.success ? { ok: true, transaction: parsed.data } : { ok: false, code: "bad_response" };
  }
  return { ok: false, code: "http_401" };
}

/**
 * The LATEST transaction on a Paymob order (one intention). `transaction:
 * null` means Paymob answered and there is nothing to report — which is what
 * lets an unpaid order expire. Anything Paymob would not answer is a failure.
 */
export async function inquireOrder(config: PaymobConfig, paymobOrderId: number): Promise<InquiryResult> {
  for (const force of [false, true]) {
    const token = await authToken(config, force);
    if (!token.ok) return token;
    const result = await request("/api/ecommerce/orders/transaction_inquiry", {
      method: "POST",
      timeoutMs: 10_000,
      body: { auth_token: token.token, order_id: String(paymobOrderId) },
    });
    if (!result.ok) {
      if (result.code === "http_401" && !force) continue;
      if (result.code === "http_404") return { ok: true, transaction: null };
      return result;
    }
    if (!result.body || typeof result.body !== "object" || !("id" in (result.body as object))) {
      return { ok: true, transaction: null };
    }
    const parsed = apiTransactionSchema.safeParse(result.body);
    return parsed.success ? { ok: true, transaction: parsed.data } : { ok: false, code: "bad_response" };
  }
  return { ok: false, code: "http_401" };
}

/** `order` arrives as an object or a bare id. */
export function transactionOrderId(t: ApiTransaction): number {
  return typeof t.order === "number" ? t.order : t.order.id;
}

/** `parent_transaction` likewise. */
export function transactionParentId(t: ApiTransaction): number | null {
  if (t.parent_transaction == null) return null;
  return typeof t.parent_transaction === "number" ? t.parent_transaction : t.parent_transaction.id;
}
