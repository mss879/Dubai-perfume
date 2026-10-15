import type { Metadata } from "next";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import PaymentReturnClient from "./PaymentReturnClient";

/**
 * Where Paymob sends a shopper back when it does not know the order's own
 * payment page — wallets such as Apple Pay use the Redirect URL configured on
 * the integration in Paymob's dashboard. Nothing in the query string is read:
 * the browser's own record of the order it left for Paymob (if any) decides
 * where to go next.
 */

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PaymentReturnPage() {
  return (
    <div className="maison min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-grow">
        <PaymentReturnClient />
      </main>
      <Footer />
    </div>
  );
}
