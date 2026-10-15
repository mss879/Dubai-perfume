import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paymob's transaction-callback signature.
 *
 * HMAC-SHA512, keyed with the merchant's HMAC secret, over twenty fields of the
 * transaction concatenated in Paymob's documented order with no separator.
 * Booleans are the literal strings "true"/"false". Paymob does not document
 * how a null field is rendered; it is rendered as the empty string here, and a
 * callback that fails to verify for that (or any) reason changes nothing — the
 * webhook route falls back to asking Paymob's authenticated API instead.
 *
 * Because the fields are joined with no separator, values could slide across a
 * boundary without changing the signed string. The strict schema in schema.ts
 * (literal booleans, safe integers, an ISO timestamp, a three-letter currency)
 * runs BEFORE this and pins every boundary but two integer pairs; the route
 * pins those with the configured integration ids and the attempt's own
 * Paymob order id and amount.
 *
 * Deliberately free of `server-only` and of non-erasable TypeScript, so the
 * documented test vector can be checked with plain Node.
 */

export type SignedTransaction = {
  amount_cents: number;
  created_at: string;
  currency: string;
  error_occured: boolean;
  has_parent_transaction: boolean;
  id: number;
  integration_id: number;
  is_3d_secure: boolean;
  is_auth: boolean;
  is_capture: boolean;
  is_refunded: boolean;
  is_standalone_payment: boolean;
  is_voided: boolean;
  order: { id: number };
  owner: number;
  pending: boolean;
  source_data: { pan?: string | null; sub_type?: string | null; type?: string | null };
  success: boolean;
};

function render(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/** The exact string Paymob signs, in Paymob's field order. */
export function canonicalString(t: SignedTransaction): string {
  return [
    t.amount_cents,
    t.created_at,
    t.currency,
    t.error_occured,
    t.has_parent_transaction,
    t.id,
    t.integration_id,
    t.is_3d_secure,
    t.is_auth,
    t.is_capture,
    t.is_refunded,
    t.is_standalone_payment,
    t.is_voided,
    t.order.id,
    t.owner,
    t.pending,
    t.source_data.pan,
    t.source_data.sub_type,
    t.source_data.type,
    t.success,
  ]
    .map(render)
    .join("");
}

export function computeHmac(secret: string, message: string): string {
  return createHmac("sha512", secret).update(message, "utf8").digest("hex");
}

const HEX_SHA512 = /^[0-9a-f]{128}$/;

/**
 * Constant-time check of a received signature against every accepted secret.
 * A missing, empty, non-hex or wrong-length value is a mismatch, never a throw.
 */
export function hmacMatches(received: string | null | undefined, message: string, secrets: readonly string[]): boolean {
  const supplied = (received ?? "").trim().toLowerCase();
  if (!HEX_SHA512.test(supplied)) return false;
  const got = Buffer.from(supplied, "hex");
  let matched = false;
  for (const secret of secrets) {
    if (!secret) continue;
    const expected = Buffer.from(computeHmac(secret, message), "hex");
    // Every secret is tried, so the timing says nothing about which matched.
    if (expected.length === got.length && timingSafeEqual(expected, got)) matched = true;
  }
  return matched;
}
