/**
 * Browser-side bookkeeping for an online order waiting on Paymob.
 *
 * Client-safe: no secrets here, only the payment page's own path (which the
 * shopper already holds) and the one host the browser may be sent to for
 * payment. Every read is defensive — storage can be blocked or tampered with,
 * and a path is honoured only if it is exactly this site's payment-page shape.
 */

export const PENDING_PAYMENT_KEY = "gharib_pending_payment";
export const PAYMENT_PATH = /^\/checkout\/payment\/[0-9a-f]{64}$/;

/** Paymob Unified Checkout (UAE). Kept in step with lib/payments/paymob/config.ts. */
export const PAYMOB_CHECKOUT_ORIGIN = "https://uae.checkout.paymob.com";

export type PendingPayment = { path: string; orderId: string; expiresAt: number };

export function isPaymobCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.origin === PAYMOB_CHECKOUT_ORIGIN && url.pathname === "/";
  } catch {
    return false;
  }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = window.localStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as PendingPayment;
    if (!saved || typeof saved.path !== "string" || !PAYMENT_PATH.test(saved.path) || !(saved.expiresAt > Date.now())) {
      window.localStorage.removeItem(PENDING_PAYMENT_KEY);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

export function savePendingPayment(pending: PendingPayment): void {
  try {
    window.localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending));
  } catch {
    // Storage blocked: the payment page link still works from history.
  }
}

/** Forget the marker — only if it points at this payment page (or at any, without a path). */
export function clearPendingPayment(path?: string): void {
  try {
    const current = readPendingPayment();
    if (!current || !path || current.path === path) window.localStorage.removeItem(PENDING_PAYMENT_KEY);
  } catch {
    // Nothing to clear.
  }
}
