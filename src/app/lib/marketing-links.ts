import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "./site";

/**
 * Signed links for the store's own emails: "unsubscribe" and "reorder in one
 * tap". Each carries a short HMAC made with the jobs' secret
 * (CART_RECOVERY_SECRET), so a link can't be made up for someone else's
 * address or order. Without the secret there are no links (and no emails).
 */

const secret = () => (process.env.CART_RECOVERY_SECRET || "").trim();

function sign(kind: string, value: string): string | null {
  const key = secret();
  if (key.length < 20) return null;
  return createHmac("sha256", key).update(`${kind}:${value}`).digest("base64url").slice(0, 32);
}

function matches(kind: string, value: string, token: string | null | undefined): boolean {
  const expected = sign(kind, value);
  if (!expected || typeof token !== "string" || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

const normalEmail = (email: string) => email.trim().toLowerCase();

export function unsubscribeUrl(email: string): string | null {
  const token = sign("unsubscribe", normalEmail(email));
  return token ? `${SITE_URL}/unsubscribe?e=${encodeURIComponent(normalEmail(email))}&t=${token}` : null;
}

export function verifyUnsubscribe(email: string, token: string | null | undefined): boolean {
  return matches("unsubscribe", normalEmail(email), token);
}

export function reorderUrl(orderId: string): string | null {
  const token = sign("reorder", orderId);
  return token ? `${SITE_URL}/reorder?o=${encodeURIComponent(orderId)}&t=${token}` : null;
}

export function verifyReorder(orderId: string, token: string | null | undefined): boolean {
  return matches("reorder", orderId, token);
}

/** The secret the job functions check in the database (app_config 'cart_recovery'). */
export function jobSecret(): string {
  return secret();
}
