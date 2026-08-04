import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { SITE_EMAIL, TRADE_LICENCE } from "../lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that govern browsing and ordering from the Gharib online boutique — orders, pricing in AED, cash-on-delivery payment and governing law in the UAE.",
  alternates: { canonical: "/terms" },
};

const HAIRLINE = "rgba(0,0,0,0.12)";

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-10" style={{ borderColor: HAIRLINE }}>
      <h2 className="font-display uppercase text-[16px] md:text-[18px] leading-[1.3] tracking-[0.1em] text-black">
        {title}
      </h2>
      <div className="mt-5 space-y-4 maison-body max-w-[65ch]">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />

      <main className="flex-grow">
        {/* Masthead */}
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">Legal</p>
          <h1 className="maison-page-title mt-5">Terms of Use</h1>
          <p className="maison-eyebrow mt-6">Last updated August 2026</p>
        </section>

        <div className="maison-container pb-16 md:pb-24">
          <div className="mx-auto max-w-[720px]">
            <p className="maison-body max-w-[65ch] pb-10">
              These terms govern your use of the Gharib online boutique, operated from Dubai,
              United Arab Emirates
              {TRADE_LICENCE ? ` under trade licence ${TRADE_LICENCE}` : ""}. By browsing the site
              or placing an order you accept these terms. If you do not agree with them, please do
              not use the site.
            </p>

            <TermsSection title="Use of the site">
              <p>
                The site is provided for personal, non-commercial shopping. You agree not to misuse
                it — including attempting to gain unauthorised access, scraping content, or placing
                fraudulent orders. All text, photography and branding on the site belong to Gharib
                or its licensors and may not be reproduced without permission.
              </p>
            </TermsSection>

            <TermsSection title="Orders">
              <p>
                An order placed on the site is an offer to purchase. We confirm acceptance when we
                dispatch the goods. We may decline or cancel an order — for example where an item is
                unavailable, a price was listed in error, or delivery details cannot be verified —
                and will tell you if we do. Availability of every fragrance is subject to stock.
              </p>
            </TermsSection>

            <TermsSection title="Pricing and currency">
              <p>
                Prices are set in United Arab Emirates dirhams (AED). Prices shown in other
                currencies are indicative conversions for convenience; the amount payable on
                delivery is the AED total confirmed at checkout. Prices may change at any time, but
                changes do not affect orders we have already confirmed.
              </p>
            </TermsSection>

            <TermsSection title="Payment">
              <p>
                Payment is made by cash on delivery (COD) only. You pay the courier the order total
                in cash when your parcel is handed over. We do not take card payments on the site
                and we never ask for card numbers, banking details or one-time passcodes.
              </p>
            </TermsSection>

            <TermsSection title="Delivery and returns">
              <p>
                Delivery within the UAE typically takes 2&ndash;5 business days. Unopened items may
                be returned within 14 days of delivery. Full details are set out in our{" "}
                <Link href="/returns" className="maison-link">
                  Shipping &amp; Returns
                </Link>{" "}
                policy, which forms part of these terms.
              </p>
            </TermsSection>

            <TermsSection title="Product information">
              <p>
                We take care to describe and photograph every fragrance accurately, but packaging,
                bottle design and batch presentation may vary slightly from the images shown.
                Fragrance concentrations and note descriptions are provided by the maisons and are
                for guidance.
              </p>
            </TermsSection>

            <TermsSection title="Liability">
              <p>
                Nothing in these terms excludes liability that cannot be excluded under UAE law. To
                the extent permitted by law, we are not liable for indirect losses arising from use
                of the site, and our liability in connection with any order is limited to the amount
                paid for that order.
              </p>
            </TermsSection>

            <TermsSection title="Governing law">
              <p>
                These terms are governed by the laws of the United Arab Emirates, and any dispute is
                subject to the jurisdiction of the courts of Dubai.
              </p>
            </TermsSection>

            <TermsSection title="Contact">
              <p>
                Questions about these terms can be sent to <a href={`mailto:${SITE_EMAIL}`} className="maison-link">{SITE_EMAIL}</a> or through our{" "}
                <Link href="/contact" className="maison-link">
                  contact page
                </Link>
                .
              </p>
            </TermsSection>

            <hr className="maison-rule" />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
