/**
 * Payment seam. Two providers: cash on delivery, and Paymob (online card,
 * Apple Pay and Google Pay through Paymob's hosted Unified Checkout). Which one
 * a checkout uses is decided by the store's mode (lib/payments/mode.ts), never
 * by the browser.
 */

export type PaymentMethod = "cod" | "paymob";

export type PaymentResult = {
  /**
   * Initial `orders.payment_status`. The database re-validates the
   * (method, paymentStatus) pair against its own allowlist — see
   * migration 63 — so a compromised client cannot declare an order paid.
   */
  paymentStatus: string;
  paymentRef: string | null;
};

export interface PaymentProvider {
  readonly method: PaymentMethod;
  /**
   * Declares how the order should be recorded before it is created. COD
   * settles at the door; Paymob starts unpaid, and only Paymob's own
   * confirmation (webhook or inquiry, lib/payments/paymob) marks it paid.
   */
  begin(): Promise<PaymentResult>;
}
