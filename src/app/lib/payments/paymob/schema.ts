import "server-only";
import { z } from "zod";

/**
 * Shapes of what Paymob sends and returns, validated strictly.
 *
 * The signed-transaction schema runs BEFORE the HMAC is computed: every field
 * that goes into the separator-less signed string must have exactly the JSON
 * type and format Paymob uses, or the callback is refused. That is what stops
 * characters being moved from one field into its neighbour while the signed
 * string — and so the signature — stays the same.
 */

const safeInt = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positiveInt = safeInt.min(1);
const isoTimestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?([+-]\d{2}:?\d{2}|Z)?$/);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const sourceText = z.string().max(64).nullable().optional();

export const signedTransactionSchema = z.object({
  id: positiveInt,
  amount_cents: safeInt,
  created_at: isoTimestamp,
  currency: currencyCode,
  error_occured: z.boolean(),
  has_parent_transaction: z.boolean(),
  integration_id: positiveInt,
  is_3d_secure: z.boolean(),
  is_auth: z.boolean(),
  is_capture: z.boolean(),
  is_refunded: z.boolean(),
  is_standalone_payment: z.boolean(),
  is_voided: z.boolean(),
  order: z.object({ id: positiveInt }),
  owner: positiveInt,
  pending: z.boolean(),
  source_data: z.object({ pan: sourceText, sub_type: sourceText, type: sourceText }),
  success: z.boolean(),
});

export type SignedTransactionInput = z.infer<typeof signedTransactionSchema>;

/** The transaction-processed callback body. */
export const callbackSchema = z.object({
  type: z.string().max(40),
  obj: z.unknown(),
});

/**
 * A transaction as Paymob's authenticated API returns it. Trusted (it came
 * over TLS from Paymob, with our credentials), so it may also carry the
 * fields the webhook signature does not cover. `order` has been seen both as
 * an object and as a bare id; both are accepted.
 */
export const apiTransactionSchema = z.object({
  id: positiveInt,
  amount_cents: safeInt,
  currency: currencyCode,
  success: z.boolean(),
  pending: z.boolean(),
  is_auth: z.boolean(),
  is_capture: z.boolean(),
  is_voided: z.boolean(),
  is_refunded: z.boolean(),
  is_3d_secure: z.boolean().optional().default(false),
  has_parent_transaction: z.boolean(),
  integration_id: positiveInt,
  order: z.union([positiveInt, z.object({ id: positiveInt })]),
  source_data: z
    .object({ pan: sourceText, sub_type: sourceText, type: sourceText })
    .nullable()
    .optional(),
  refunded_amount_cents: safeInt.nullable().optional(),
  is_refund: z.boolean().optional(),
  is_void: z.boolean().optional(),
  parent_transaction: z.union([positiveInt, z.object({ id: positiveInt })]).nullable().optional(),
  data: z.object({ message: z.string().nullable().optional() }).nullable().optional(),
});

export type ApiTransaction = z.infer<typeof apiTransactionSchema>;

export const intentionResponseSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{4,100}$/),
  intention_order_id: positiveInt,
  client_secret: z.string().regex(/^[A-Za-z0-9_-]{8,300}$/),
});

export const authTokenResponseSchema = z.object({
  token: z.string().min(20).max(4096),
});
