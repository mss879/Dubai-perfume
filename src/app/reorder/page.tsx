import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import RecoverClient, { type RecoverableLine } from "../recover/RecoverClient";
import { createServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";
import { jobSecret, verifyReorder } from "../lib/marketing-links";

/**
 * "Reorder in one tap" (Admin → Reorder reminders): the link in the email is
 * signed for that order, so it refills the bag with the same perfumes and
 * sizes, at today's prices. No personal details are read or shown.
 */

export const metadata: Metadata = {
  title: "Reorder",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

async function linesFor(orderId: string, token: string): Promise<RecoverableLine[] | null> {
  if (!/^ORD-\d{1,12}$/.test(orderId) || !verifyReorder(orderId, token) || !isSupabaseConfigured) return null;
  const { data, error } = await createServerSupabase().rpc("get_reorder_lines", { p_secret: jobSecret(), p_order_id: orderId });
  if (error || !Array.isArray(data)) return null;
  return (data as Record<string, unknown>[]).map((l) => ({
    productId: Number(l.product_id),
    brand: String(l.brand ?? ""),
    name: String(l.name ?? ""),
    priceAed: Number(l.price) || 0,
    imageUrl: String(l.image_url ?? ""),
    size: String(l.size ?? ""),
    quantity: Math.max(1, Math.min(20, Number(l.quantity) || 1)),
  }));
}

export default async function ReorderPage({ searchParams }: { searchParams: Promise<{ o?: string; t?: string }> }) {
  const { o, t } = await searchParams;
  const lines = await linesFor(String(o ?? ""), String(t ?? ""));

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />
      <CartDrawer />
      <main className="flex-grow">
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">Your fragrance</p>
          {lines && lines.length > 0 ? (
            <>
              <h1 className="maison-page-title mt-5">Ready for another bottle</h1>
              <p className="maison-body mx-auto mt-6 max-w-[52ch]">Your perfumes are in your bag, in the same sizes, at today&rsquo;s prices.</p>
            </>
          ) : (
            <>
              <h1 className="maison-page-title mt-5">This link has ended</h1>
              <p className="maison-body mx-auto mt-6 max-w-[52ch]">The perfumes may no longer be available. The boutique is open, though.</p>
              <Link href="/shop" className="maison-btn mt-10 inline-flex">
                Discover the collection
              </Link>
            </>
          )}
        </section>
        {lines && lines.length > 0 ? <RecoverClient lines={lines} /> : null}
      </main>
      <Footer />
    </div>
  );
}
