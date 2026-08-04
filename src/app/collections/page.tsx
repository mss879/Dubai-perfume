import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { createServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";

/* Never bake stale catalogue data into the build. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maisons",
  description:
    "Every house we carry, with its complete line-up in one place — from the Rasasi Hawas signature range to Lattafa, Armaf, French Avenue, Afnan and Al Haramain.",
  alternates: { canonical: "/collections" },
};

interface DbCollection {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  kind?: string | null;
  parent_id?: string | null;
  brand?: string | null;
  sort_order?: number | null;
  story_eyebrow?: string | null;
  story_headline?: string | null;
  story_subline?: string | null;
  hero_image?: string | null;
  texture_image?: string | null;
}

/** Row shape of `product_collections`. */
interface CollectionMapping {
  collection_id: string;
  product_id: number;
}

/* "*" rather than a column list — the editorial fields come from
 * supabase/migrations/31_brand_editorial_content.sql, which is not applied
 * everywhere. Naming a missing column fails the whole query with 42703.
 * See the matching note in collection/[id]/page.tsx. */
const COLLECTION_FIELDS = "*";

/** Photography fills the frame; a packshot PNG floats inside it instead of being cropped. */
const isPhotograph = (src: string) => /\.(jpe?g|webp|avif)$/i.test(src.split("?")[0]);

/** Art direction comes from the row only — no hardcoded per-brand image table. */
const tileArt = (c: DbCollection): { src: string; fit: "cover" | "contain" } | null => {
  const editorial = c.hero_image || c.texture_image;
  if (editorial) return { src: editorial, fit: "cover" };
  if (c.cover_image) return { src: c.cover_image, fit: isPhotograph(c.cover_image) ? "cover" : "contain" };
  return null;
};

async function fetchCollections(): Promise<{
  collections: DbCollection[];
  mappings: CollectionMapping[];
}> {
  if (!isSupabaseConfigured) return { collections: [], mappings: [] };
  try {
    const supabase = createServerSupabase();
    const [collectionsRes, mappingsRes] = await Promise.all([
      supabase.from("collections").select(COLLECTION_FIELDS),
      supabase.from("product_collections").select("collection_id, product_id"),
    ]);
    if (collectionsRes.error) throw collectionsRes.error;
    return {
      collections: Array.isArray(collectionsRes.data) ? (collectionsRes.data as DbCollection[]) : [],
      mappings: Array.isArray(mappingsRes.data) ? (mappingsRes.data as CollectionMapping[]) : [],
    };
  } catch (err) {
    console.error("Error loading collections:", err);
    return { collections: [], mappings: [] };
  }
}

export default async function CollectionsIndexPage() {
  const { collections, mappings } = await fetchCollections();

  const counts: Record<string, number> = {};
  mappings.forEach((m) => {
    counts[m.collection_id] = (counts[m.collection_id] || 0) + 1;
  });

  const lineCounts: Record<string, number> = {};
  collections
    .filter((c) => c.kind === "line" && c.parent_id)
    .forEach((c) => {
      lineCounts[c.parent_id as string] = (lineCounts[c.parent_id as string] || 0) + 1;
    });

  const brands = collections
    .filter((c) => c.kind === "brand")
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const curated = collections.filter((c) => !c.kind || c.kind === "curated");

  return (
    <div className="maison min-h-screen">
      <AppHeader activePage="brands" />

      {/* ═══ MASTHEAD ═══ */}
      <section className="maison-section">
        <div className="maison-container text-center">
          <p className="maison-eyebrow">The Houses</p>
          <h1 className="maison-page-title mt-6">Our Brands</h1>
          <p
            className="mt-7 mx-auto max-w-[52ch] text-[15px] font-light leading-[1.75]"
            style={{ color: "var(--muted)" }}
          >
            Every house we carry, with its complete line-up in one place — from the Rasasi Hawas
            signature range to Lattafa, Armaf, French Avenue, Afnan and Al Haramain.
          </p>
        </div>
      </section>

      <div className="maison-container">
        <hr className="maison-rule" />
      </div>

      {/* ═══ HOUSE TILES ═══ */}
      <section className="maison-section">
        <div className="maison-container">
          {brands.length === 0 ? (
            <div className="text-center py-20">
              <h2 className="font-display text-[20px] uppercase tracking-[0.08em]">
                No houses to show
              </h2>
              <p
                className="mt-5 mx-auto max-w-[46ch] text-[14px] font-light leading-[1.75]"
                style={{ color: "var(--muted)" }}
              >
                Our brand pages are not available right now. The full catalogue is still open.
              </p>
              <Link
                href="/shop"
                className="maison-btn-outline h-12 px-10 mt-8 inline-flex items-center"
              >
                Browse all fragrances
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-16">
              {brands.map((brand) => {
                const art = tileArt(brand);
                const line = brand.story_subline || brand.description;
                const productCount = counts[brand.id] || 0;
                const lineCount = lineCounts[brand.id] || 0;

                return (
                  <Link key={brand.id} href={`/collection/${brand.id}`} className="group block text-center">
                    <div className="relative w-full aspect-[4/5] overflow-hidden">
                      {art ? (
                        <Image
                          src={art.src}
                          alt={brand.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className={`${
                            art.fit === "cover" ? "object-cover" : "object-contain"
                          } transition-transform duration-700 ease-out group-hover:scale-[1.04]`}
                        />
                      ) : (
                        <div className="absolute inset-0" style={{ backgroundColor: "var(--surface-2)" }} />
                      )}
                    </div>

                    <h2 className="maison-card-title mt-7">{brand.title}</h2>

                    <p className="maison-card-notes mt-3">
                      {productCount} {productCount === 1 ? "Fragrance" : "Fragrances"}
                      {lineCount > 0 ? ` · ${lineCount} ${lineCount === 1 ? "Line" : "Lines"}` : ""}
                    </p>

                    {line && (
                      <p
                        className="mt-4 mx-auto max-w-[38ch] text-[13px] font-light leading-[1.75]"
                        style={{ color: "var(--muted)" }}
                      >
                        {line}
                      </p>
                    )}

                    <span className="maison-link mt-7 transition-opacity duration-300 group-hover:opacity-60">
                      Discover
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══ CURATED COLLECTIONS ═══ */}
      {curated.length > 0 && (
        <>
          <div className="maison-container">
            <hr className="maison-rule" />
          </div>
          <section className="maison-section">
            <div className="maison-container text-center">
              <p className="maison-eyebrow">Also in store</p>
              <h2 className="font-display text-[20px] md:text-[24px] uppercase tracking-[0.1em] mt-6">
                Curated selections
              </h2>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
                {curated.map((collection) => (
                  <Link
                    key={collection.id}
                    href={`/collection/${collection.id}`}
                    className="text-[12px] font-medium uppercase tracking-[0.2em] transition-opacity duration-300 hover:opacity-55"
                  >
                    {collection.title}
                    <span className="ml-2" style={{ color: "var(--muted)" }}>
                      {counts[collection.id] || 0}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Main App Footer */}
      <Footer />
    </div>
  );
}
