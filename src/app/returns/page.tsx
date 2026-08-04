import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { SITE_EMAIL } from "../lib/site";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "Gharib delivery and returns in the UAE — cash on delivery, 2 to 5 business day delivery, and a 14-day return window for unopened items.",
  alternates: { canonical: "/returns" },
};

const HAIRLINE = "rgba(0,0,0,0.12)";

function ReturnsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-10" style={{ borderColor: HAIRLINE }}>
      <h2 className="font-display uppercase text-[16px] md:text-[18px] leading-[1.3] tracking-[0.1em] text-black">
        {title}
      </h2>
      <div className="mt-5 space-y-4 maison-body max-w-[65ch]">{children}</div>
    </section>
  );
}

export default function ReturnsPage() {
  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />

      <main className="flex-grow">
        {/* Masthead */}
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">Client Services</p>
          <h1 className="maison-page-title mt-5">Shipping &amp; Returns</h1>
          <p className="maison-eyebrow mt-6">Last updated August 2026</p>
        </section>

        <div className="maison-container pb-16 md:pb-24">
          <div className="mx-auto max-w-[720px]">
            <p className="maison-body max-w-[65ch] pb-10">
              Every parcel leaves our Dubai boutique carefully wrapped and sealed. This page
              explains how delivery works across the United Arab Emirates, how payment on delivery
              is handled, and how to return an item should you change your mind.
            </p>

            <ReturnsSection title="Delivery across the UAE">
              <p>
                We deliver throughout the United Arab Emirates. Orders are typically delivered
                within 2&ndash;5 business days of confirmation. Our courier will contact you on the
                telephone number given at checkout to arrange the handover, so please make sure it
                is reachable.
              </p>
            </ReturnsSection>

            <ReturnsSection title="Payment on delivery">
              <p>
                Payment is made by cash on delivery. The courier collects the order total shown in
                your confirmation, in AED, when the parcel is handed to you. No payment is taken on
                the website and no card details are ever requested.
              </p>
            </ReturnsSection>

            <ReturnsSection title="Inspecting your order">
              <p>
                Please inspect the outer packaging when the parcel arrives. If an item reaches you
                damaged, or the wrong item was delivered, write to us at <a href={`mailto:${SITE_EMAIL}`} className="maison-link">{SITE_EMAIL}</a> within 48
                hours of delivery with your order number and a photograph, and we will arrange a
                replacement or collection at no cost to you.
              </p>
            </ReturnsSection>

            <ReturnsSection title="Returns">
              <p>
                Unopened items may be returned within 14 days of delivery, provided the fragrance is
                unused and remains in its original sealed packaging with the cellophane intact. To
                begin a return, write to <a href={`mailto:${SITE_EMAIL}`} className="maison-link">{SITE_EMAIL}</a> with your order number and the item you
                wish to send back, and a client advisor will guide you through collection.
              </p>
              <p>
                For reasons of hygiene, fragrances that have been opened, unsealed or used cannot be
                returned unless they arrived damaged or faulty.
              </p>
            </ReturnsSection>

            <ReturnsSection title="Refunds">
              <p>
                Because payment is made in cash on delivery, refunds for returned items are made by
                bank transfer to an account in your name. Once the returned parcel has been received
                and inspected, the refund is issued within 14 days. Any collection fee for a
                change-of-mind return may be deducted from the refund; returns of damaged or
                incorrect items are always free.
              </p>
            </ReturnsSection>

            <ReturnsSection title="Questions">
              <p>
                Our client advisors are happy to help with any delivery or return enquiry — write to
                <a href={`mailto:${SITE_EMAIL}`} className="maison-link">{SITE_EMAIL}</a> or use the{" "}
                <Link href="/contact" className="maison-link">
                  contact page
                </Link>
                .
              </p>
            </ReturnsSection>

            <hr className="maison-rule" />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
