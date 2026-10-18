import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import CartDrawer from "../../components/CartDrawer";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";

export const metadata: Metadata = {
  title: "A gift from a friend",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const aed = (n: number) => `AED ${n.toLocaleString("en-AE", { maximumFractionDigits: 2 })}`;

/** Where a referral link lands: what the friend's code is worth. */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code || "").toUpperCase().slice(0, 20);
  let offer: { valid?: boolean; reward?: number; min_order?: number } = {};
  if (isSupabaseConfigured && /^[A-Z]{2,8}-[A-Z0-9]{4}$/.test(code)) {
    const { data } = await createServerSupabase().rpc("referral_offer", { p_code: code });
    offer = (data ?? {}) as typeof offer;
  }
  const reward = Number(offer.reward) || 0;
  const min = Number(offer.min_order) || 0;

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />
      <CartDrawer />
      <main className="flex-grow">
        <section className="maison-container maison-section text-center">
          <p className="maison-eyebrow">A gift from a friend</p>
          {offer.valid ? (
            <>
              <h1 className="maison-page-title mt-5">{aed(reward)} off your first order</h1>
              <p className="maison-body mx-auto mt-6 max-w-[52ch]">
                A friend has invited you to Gharib. Their code{" "}
                <span className="font-mono tracking-[0.08em] text-black">{code}</span> is waiting at checkout
                {min > 0 ? `, on a first order of ${aed(min)} or more` : ""}.
              </p>
            </>
          ) : (
            <>
              <h1 className="maison-page-title mt-5">Welcome to Gharib</h1>
              <p className="maison-body mx-auto mt-6 max-w-[52ch]">This invitation has ended, but the boutique is open.</p>
            </>
          )}
          <Link href="/shop" className="maison-btn mt-10 inline-flex">
            Discover the collection
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
