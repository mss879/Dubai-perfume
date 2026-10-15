import type { Metadata } from "next";
import CheckoutClient from "./CheckoutClient";
import { resolveCheckoutMode } from "../lib/payments/mode";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Read per request: the owner's switch lives in the database. The checkout
  // API decides again on submit, so a page left open across a switch is safe.
  const paymentMode = await resolveCheckoutMode();
  return <CheckoutClient paymentMode={paymentMode} />;
}
