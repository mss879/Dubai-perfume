import type { Metadata } from "next";
import AppHeader from "../../../components/AppHeader";
import Footer from "../../../components/Footer";
import { readPaymobConfig } from "../../../lib/payments/paymob/config";
import { PAYMENT_TOKEN, shopperView } from "../../../lib/payments/paymob/service";
import PaymentStatusClient from "./PaymentStatusClient";

/**
 * The shopper's payment page — where Paymob sends them back, and where they can
 * pay, try again, or change the order.
 *
 * The 256-bit token in the path is the only credential, and it shows nothing
 * personal: order number, state, items, total. Paymob appends the transaction
 * to the query string on the way back; none of it is read or trusted — its
 * presence only means "they have just come back", so the island keeps checking
 * with the server (which asks Paymob) rather than offering to pay again.
 */

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const returning = Object.keys(query).length > 0;

  const config = readPaymobConfig();
  const view =
    config.ok && PAYMENT_TOKEN.test(token) ? await shopperView(config.config, token, { sync: false }) : null;

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />
      <main className="flex-grow">
        <PaymentStatusClient token={PAYMENT_TOKEN.test(token) ? token : ""} initial={view} returning={returning} />
      </main>
      <Footer />
    </div>
  );
}
