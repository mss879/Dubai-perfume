import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import Price from "../components/Price";
import { liveFeature } from "../lib/features-server";
import { createServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";

export const metadata: Metadata = {
  title: "If you love…",
  description: "Find a Gharib perfume with a scent profile close to the famous fragrances you already love.",
  alternates: { canonical: "/inspired-by" },
};
export const dynamic = "force-dynamic";

type Row = { id: number; brand: string; name: string; price: number | string; compare_at_price: number | string | null; image_url: string | null; inspired_by: string };

/** "If you love …": the owner's matches (Admin → Inspired-by matches), grouped by the famous scent. */
export default async function InspiredByPage() {
  const feature = await liveFeature("inspired_by");
  if (!feature.enabled || feature.settings.show_page === false || !isSupabaseConfigured) notFound();
  const { data, error } = await createServerSupabase()
    .from("products")
    .select("id, brand, name, price, compare_at_price, image_url, inspired_by")
    .not("inspired_by", "is", null)
    .order("inspired_by");
  const rows = (error ? [] : (data ?? [])) as Row[];
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.inspired_by.trim();
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const lead = String(feature.settings.lead || "If you love");

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader activePage="shop" />
      <CartDrawer />
      <main className="flex-grow">
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">The Maison</p>
          <h1 className="maison-page-title mt-5">{String(feature.settings.page_title || "If you love…")}</h1>
          <p className="maison-body mx-auto mt-6 max-w-[56ch]">Fragrances you already know, and the Gharib perfumes with a scent profile close to them.</p>
        </section>
        <div className="maison-container pb-16 md:pb-24">
          {groups.size === 0 ? (
            <p className="maison-body text-center">Our matches are being prepared. <Link href="/shop" className="maison-link">Explore the collection</Link></p>
          ) : (
            <div className="mx-auto flex max-w-[960px] flex-col gap-14">
              {[...groups.entries()].map(([inspiration, products]) => (
                <section key={inspiration} className="border-t pt-10" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                  <h2 className="font-display text-[16px] uppercase leading-[1.3] tracking-[0.1em] text-black md:text-[18px]">
                    {lead} {inspiration}
                  </h2>
                  <ul className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-4">
                    {products.map((p) => (
                      <li key={p.id}>
                        <Link href={`/product/${p.id}`} className="block">
                          <span className="maison-card-media block">
                            {p.image_url ? <Image src={p.image_url} alt={p.name} fill sizes="(min-width: 768px) 22vw, 45vw" className="object-contain" /> : null}
                          </span>
                          <span className="maison-eyebrow mt-5 block">{p.brand}</span>
                          <span className="maison-card-title mt-2 block">{p.name.replace(/_/g, " ")}</span>
                        </Link>
                        <Price amountAed={Number(p.price) || 0} compareAtAed={p.compare_at_price == null ? null : Number(p.compare_at_price)} className="maison-price mt-2 block" />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {feature.settings.disclaimer ? (
            <p className="mx-auto mt-16 max-w-[70ch] text-center text-[12px] font-light leading-[1.7] text-[#646464]">{String(feature.settings.disclaimer)}</p>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
