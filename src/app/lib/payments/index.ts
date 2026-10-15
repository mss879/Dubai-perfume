import { codProvider } from "./cod";
import { paymobProvider } from "./paymob-provider";
import type { PaymentMethod, PaymentProvider } from "./types";

const providers: Record<PaymentMethod, PaymentProvider> = {
  cod: codProvider,
  paymob: paymobProvider,
};

export function getPaymentProvider(method: string): PaymentProvider | null {
  return providers[method as PaymentMethod] ?? null;
}

export type { PaymentMethod, PaymentProvider } from "./types";
