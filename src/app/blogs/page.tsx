import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import ConciergeWidget from "../components/concierge/ConciergeWidget";
import BlogsIndexClient from "./BlogsIndexClient";
import { getAllPosts } from "./posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Editorial guides on buying authentic perfume online in Dubai, longevity in desert heat, brand spotlights, and the heritage of Middle Eastern perfumery.",
  alternates: { canonical: "/blogs" },
};

export default async function BlogsPage() {
  const posts = await getAllPosts();

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Shared Unified White Navbar */}
      <AppHeader activePage="blogs" />

      <main className="flex-grow">
        <BlogsIndexClient posts={posts} />
      </main>

      <Footer />
      <ConciergeWidget />
    </div>
  );
}
