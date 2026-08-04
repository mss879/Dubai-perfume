import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import QuizClient from "./QuizClient";
import { fetchQuizCatalogue } from "../lib/quiz-catalogue";

/**
 * The fragrance finder.
 *
 * A server component, like every page. It reads the catalogue and — this is the
 * important part — derives each composition's scent profile in
 * lib/quiz-catalogue.ts, from the 260-note lexicon in lib/scent-lexicon.ts. The
 * browser receives 138 small vectors instead of the lexicon, which keeps the
 * client bundle honest and the scoring instant: the shopper's answer resolves on
 * tap, with no round trip.
 *
 * The same loader backs /api/quiz, so the results email is scored against
 * exactly the catalogue the shopper was shown.
 */

export const metadata: Metadata = {
  title: "Fragrance finder",
  description:
    "Five questions and we will name three fragrances for you — matched on olfactory family, occasion and Gulf climate across 138 compositions from the great houses of Dubai perfumery.",
  alternates: { canonical: "/discover" },
};

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const products = await fetchQuizCatalogue();

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader activePage="discover" />
      <CartDrawer />

      <main className="flex-grow">
        <QuizClient products={products} />
      </main>

      <Footer />
    </div>
  );
}
