import type { PaymentProvider, PaymentResult } from "./types";

export const codProvider: PaymentProvider = {
  method: "cod",
  async begin(): Promise<PaymentResult> {
    // Nothing is captured online: the courier collects on delivery.
    return {
      paymentStatus: "pending_collection",
      paymentRef: null,
    };
  },
};
