import type { Metadata } from "next";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import StopRecoveryClient from "./StopRecoveryClient";

/**
 * "Stop these reminders", from the footer of every recovery email.
 *
 * The link is a GET, so it only ASKS. Mail scanners and link pre-fetchers
 * follow links in email without a person ever seeing them; a one-click GET
 * unsubscribe would silently opt people out on their behalf. The button here
 * posts to /api/cart-recovery/unsubscribe.
 */

export const metadata: Metadata = {
  title: "Stop reminders",
  robots: { index: false, follow: false },
};

export default async function StopRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />

      <main className="flex-grow">
        <section className="maison-container pt-14 md:pt-20 pb-16 md:pb-24 text-center">
          <p className="maison-eyebrow">Reminders</p>
          <h1 className="maison-page-title mt-5">Stop reminders about a saved selection</h1>
          <p className="maison-body mt-6 mx-auto max-w-[52ch]">
            We will stop writing to you about selections left in your bag. This does not affect
            order confirmations or delivery notices, and it does not remove you from the newsletter.
          </p>

          <StopRecoveryClient token={(token ?? "").trim()} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
