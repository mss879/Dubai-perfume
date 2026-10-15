import type { PaymentProvider, PaymentResult } from "./types";

export const paymobProvider: PaymentProvider = {
  method: "paymob",
  async begin(): Promise<PaymentResult> {
    // Created unpaid. The shopper pays on Paymob's hosted page afterwards.
    return {
      paymentStatus: "awaiting_payment",
      paymentRef: null,
    };
  },
};
