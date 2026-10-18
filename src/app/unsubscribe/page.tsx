import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { verifyUnsubscribe } from "../lib/marketing-links";
import UnsubscribeClient from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** The unsubscribe link in the store's marketing emails. One click to confirm, so a link checker can't do it by accident. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e, t } = await searchParams;
  const email = String(e ?? "").trim().toLowerCase();
  const valid = verifyUnsubscribe(email, String(t ?? ""));

  return (
    <div className="maison min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-grow">
        <section className="maison-container maison-section text-center">
          <p className="maison-eyebrow">Your emails</p>
          <h1 className="maison-page-title mt-5">Unsubscribe</h1>
          {valid ? (
            <UnsubscribeClient email={email} token={String(t)} />
          ) : (
            <p className="maison-body mx-auto mt-6 max-w-[52ch]">This link isn&rsquo;t valid. Reply to any of our emails and we&rsquo;ll take you off the list by hand.</p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
