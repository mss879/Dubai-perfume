import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import ConciergeWidget from "../components/concierge/ConciergeWidget";
import TrackClient from "./TrackClient";

export const metadata: Metadata = {
  title: "Track your order",
  description:
    "Follow your Gharib order with your order reference and the email address you ordered with — no account required.",
  alternates: { canonical: "/track" },
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  // Next 16: searchParams is async. The confirmation screen links here with
  // ?order=ORD-… so the reference is pre-filled; the email is always typed.
  const { order } = await searchParams;

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />

      <main className="flex-grow">
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">Order</p>
          <h1 className="maison-page-title mt-5">Track your order</h1>
          <p className="maison-body mt-6 mx-auto max-w-[52ch]">
            Enter your order reference and the email address you ordered with. Both are
            required — your order details are never public.
          </p>
        </section>

        <TrackClient initialOrderId={order ?? ""} />
      </main>

      <Footer />
      <ConciergeWidget />
    </div>
  );
}
