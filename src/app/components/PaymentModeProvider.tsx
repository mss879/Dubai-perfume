"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * How the storefront describes payment: "online" once this deployment is set
 * up for Paymob (card, Apple Pay, Google Pay), "cod" otherwise. Copy only —
 * the checkout reads the store's live mode itself, and the server enforces it.
 */
export type StorefrontPaymentMode = "online" | "cod";

const PaymentModeContext = createContext<StorefrontPaymentMode>("cod");

export function PaymentModeProvider({ mode, children }: { mode: StorefrontPaymentMode; children: ReactNode }) {
  return <PaymentModeContext.Provider value={mode}>{children}</PaymentModeContext.Provider>;
}

export function usePaymentMode(): StorefrontPaymentMode {
  return useContext(PaymentModeContext);
}
