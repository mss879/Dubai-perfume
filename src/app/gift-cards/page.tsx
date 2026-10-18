import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import { liveFeature } from "../lib/features-server";
import { liveStorefrontPaymentMode } from "../lib/storefront-payment-mode";
import GiftCardClient from "./GiftCardClient";

export const metadata: Metadata = {
  title: "Gift cards",
  description: "A Gharib gift card, emailed to them with your message, to spend on anything in the boutique.",
  alternates: { canonical: "/gift-cards" },
};
export const dynamic = "force-dynamic";

/** Buying a gift card (Admin → Gift cards). Not there at all while the feature is off. */
export default async function GiftCardsPage() {
  const [feature, mode] = await Promise.all([liveFeature("gift_cards"), liveStorefrontPaymentMode()]);
  if (!feature.enabled) notFound();
  const s = feature.settings;

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />
      <CartDrawer />
      <main className="flex-grow">
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">Gift cards</p>
          <h1 className="maison-page-title mt-5">{String(s.headline || "The Gharib gift card")}</h1>
          <p className="maison-body mx-auto mt-6 max-w-[56ch]">{String(s.intro || "")}</p>
        </section>
        <GiftCardClient
          amounts={(Array.isArray(s.amounts) ? s.amounts : []) as number[]}
          allowCustom={s.allow_custom !== false}
          minAmount={Number(s.min_amount) || 50}
          maxAmount={Number(s.max_amount) || 2000}
          allowScheduled={s.allow_scheduled !== false}
          validMonths={Number(s.valid_months) || 12}
          online={mode === "online"}
        />
      </main>
      <Footer />
    </div>
  );
}
