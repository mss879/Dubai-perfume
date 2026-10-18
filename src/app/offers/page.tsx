import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import ConciergeWidget from "../components/concierge/ConciergeWidget";
import OfferCards from "../components/offers/OfferCards";
import { loadOfferCards } from "../lib/offers-server";

export const metadata: Metadata = {
  title: "Sets & Offers",
  description:
    "Gharib sets, layering duos, gift boxes and savings on more than one bottle — applied automatically in your bag.",
  alternates: { canonical: "/offers" },
};

// Offers start and end on their own dates; a minute's lag is fine.
export const revalidate = 60;

const HAIRLINE = "rgba(0,0,0,0.12)";

export default async function OffersPage() {
  const cards = await loadOfferCards(null);
  const boxes = cards.filter((c) => c.kind === "bundle" && c.template === "occasion");
  const sets = cards.filter((c) => c.kind === "bundle" && c.template !== "occasion");
  const savings = cards.filter((c) => c.kind === "tiered" || c.kind === "gift");

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader activePage="offers" />
      <CartDrawer />

      <main className="flex-grow">
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">The Maison</p>
          <h1 className="maison-page-title mt-5">Sets &amp; Offers</h1>
          <p className="maison-body mx-auto mt-6 max-w-[56ch]">
            Compositions chosen to be worn, layered or given together. Every saving here is applied in your bag
            automatically: there is no code to remember.
          </p>
        </section>

        <div className="maison-container pb-16 md:pb-24">
          {cards.length === 0 ? (
            <div className="mx-auto max-w-[560px] border-t py-14 text-center" style={{ borderColor: HAIRLINE }}>
              <p className="maison-body">There are no sets or offers running just now.</p>
              <Link href="/shop" className="maison-link mt-6 inline-block">
                Explore the collection
              </Link>
            </div>
          ) : (
            <div className="mx-auto flex max-w-[860px] flex-col gap-14">
              {boxes.length > 0 ? (
                <Section title="Gift boxes" note="For a limited time, gift-wrapped.">
                  <OfferCards cards={boxes} variant="page" />
                </Section>
              ) : null}
              {savings.length > 0 ? (
                <Section title="More than one bottle" note="Mix as you like; the saving appears in your bag.">
                  <OfferCards cards={savings} variant="page" />
                </Section>
              ) : null}
              {sets.length > 0 ? (
                <Section title="Sets" note="Add the whole set and the set price applies.">
                  <OfferCards cards={sets} variant="page" />
                </Section>
              ) : null}
            </div>
          )}
        </div>
      </main>

      <Footer />
      <ConciergeWidget />
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-10" style={{ borderColor: HAIRLINE }}>
      <h2 className="font-display uppercase text-[16px] md:text-[18px] leading-[1.3] tracking-[0.1em] text-black">{title}</h2>
      <p className="maison-body mt-3">{note}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}
