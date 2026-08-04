import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { SITE_EMAIL } from "../lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Gharib collects, uses and protects your personal information — account details, orders and newsletter preferences — when you shop with us in the UAE.",
  alternates: { canonical: "/privacy" },
};

const HAIRLINE = "rgba(0,0,0,0.12)";

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-10" style={{ borderColor: HAIRLINE }}>
      <h2 className="font-display uppercase text-[16px] md:text-[18px] leading-[1.3] tracking-[0.1em] text-black">
        {title}
      </h2>
      <div className="mt-5 space-y-4 maison-body max-w-[65ch]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />

      <main className="flex-grow">
        {/* Masthead */}
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">Legal</p>
          <h1 className="maison-page-title mt-5">Privacy Policy</h1>
          <p className="maison-eyebrow mt-6">Last updated August 2026</p>
        </section>

        <div className="maison-container pb-16 md:pb-24">
          <div className="mx-auto max-w-[720px]">
            <p className="maison-body max-w-[65ch] pb-10">
              Gharib (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates this online boutique from Dubai,
              United Arab Emirates. This policy explains what personal information we collect when
              you browse and shop with us, how we use it, and the choices you have. By using the
              site you agree to the practices described here.
            </p>

            <PolicySection title="Information we collect">
              <p>
                <strong className="font-normal text-black">Account details.</strong> When you create
                an account we collect your name, email address and, where you provide it, your
                telephone number.
              </p>
              <p>
                <strong className="font-normal text-black">Order and delivery details.</strong> When
                you place an order we collect the recipient&rsquo;s name, delivery address, contact
                telephone number and email address so that we can prepare, dispatch and deliver your
                parcel. As payment is made in cash on delivery, we do not collect card numbers or
                other payment credentials on this site.
              </p>
              <p>
                <strong className="font-normal text-black">Newsletter.</strong> If you subscribe to
                our newsletter we store your email address and the page from which you subscribed.
              </p>
              <p>
                <strong className="font-normal text-black">Enquiries.</strong> When you write to us
                through the contact form we keep your name, email address and message so that a
                client advisor can reply.
              </p>
            </PolicySection>

            <PolicySection title="How we use your information">
              <p>
                We use your information to fulfil and deliver orders, to keep you informed about the
                status of an order, to answer your enquiries, and — only where you have subscribed —
                to send occasional newsletters about the maison. We do not sell your personal
                information.
              </p>
            </PolicySection>

            <PolicySection title="Sharing">
              <p>
                We share delivery details with the courier companies who carry your parcel within
                the UAE, and we use trusted service providers to host the site and store its data.
                These parties receive only the information needed to perform their service.
              </p>
            </PolicySection>

            <PolicySection title="Cookies">
              <p>
                The site uses essential cookies and similar browser storage to keep your cart,
                sign-in session and currency preference working. We do not use these for advertising.
              </p>
            </PolicySection>

            <PolicySection title="Retention and your rights">
              <p>
                We keep order records for as long as required for accounting and legal purposes, and
                other information only for as long as it is needed. You may ask us at any time to
                access, correct or delete the personal information we hold about you, or to
                unsubscribe from the newsletter, by writing to <a href={`mailto:${SITE_EMAIL}`} className="maison-link">{SITE_EMAIL}</a>.
              </p>
            </PolicySection>

            <PolicySection title="Contact">
              <p>
                Questions about this policy can be sent to <a href={`mailto:${SITE_EMAIL}`} className="maison-link">{SITE_EMAIL}</a> or through our{" "}
                <Link href="/contact" className="maison-link">
                  contact page
                </Link>
                . Gharib, Dubai, United Arab Emirates.
              </p>
            </PolicySection>

            <hr className="maison-rule" />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
