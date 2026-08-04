/**
 * Payment seam. COD is the only provider today (owner decision — no gateway
 * until the business is approved for one). A card gateway or BNPL provider
 * later means: implement this interface, add a webhook route, register it in
 * index.ts — no checkout rework.
 */

export type PaymentMethod = "cod";

export type PaymentResult = {
  /**
   * Initial `orders.payment_status`. The database re-validates the
   * (method, paymentStatus) pair against its own allowlist — see
   * migration 42 — so a compromised client cannot declare an order paid.
   */
  paymentStatus: string;
  paymentRef: string | null;
};

export interface PaymentProvider {
  readonly method: PaymentMethod;
  /**
   * Declares how the order should be recorded before it is created.
   * COD settles at the door, so there is nothing to charge here; a gateway
   * would authorise and return its reference instead.
   */
  begin(): Promise<PaymentResult>;
}
