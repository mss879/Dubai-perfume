import type { Metadata } from "next";
import ShopClient, {
  type CatalogProduct,
  type DbCollectionRow,
  type DbProductCollectionRow,
} from "./ShopClient";
import { createServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";
import { liveStoreFeatures } from "../lib/features-server";

/* Never bake stale catalogue data into the build. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Fragrances",
  description:
    "Explore the complete Gharib catalogue — niche and designer fragrances from the great houses of Dubai perfumery, delivered across the UAE.",
  alternates: { canonical: "/shop" },
};

/* Shape returned by the Supabase products table. select("*") on purpose — the
 * migration-31 editorial columns must never be named in a column list. */
interface DbProductRow {
  id: number;
  brand: string;
  name: string;
  price: number | string;
  compare_at_price?: number | string | null;
  sizes?: string[] | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  is_new?: boolean;
  is_bestseller?: boolean;
  is_featured_large?: boolean;
  description?: string | null;
  olfactory_group?: string | null;
  tags?: string[] | null;
  top_notes?: string[] | null;
  heart_notes?: string[] | null;
  base_notes?: string[] | null;
  /* Migration 70: filters and "inspired by" (absent before it runs). */
  strength?: string | null;
  longevity?: string | null;
  seasons?: string[] | null;
  occasions?: string[] | null;
  inspired_by?: string | null;
}

/** Maps a DB row to the shape the grid renders. Same logic the client used. */
function mapProduct(p: DbProductRow): CatalogProduct {
  let gender = "unisex";
  if (p.tags) {
    if (p.tags.includes("men") || p.tags.includes("man") || p.tags.includes("for men")) {
      gender = "men";
    } else if (p.tags.includes("women") || p.tags.includes("woman") || p.tags.includes("for women")) {
      gender = "women";
    }
  }
  return {
    id: p.id,
    brand: p.brand,
    name: p.name,
    price: String(p.price),
    /* The list price the house quotes. Kept null unless the column carries one,
     * so the grid strikes it through only where there is a real saving. */
    compareAtPrice: p.compare_at_price == null ? null : String(p.compare_at_price),
    sizes: p.sizes || ["50ml", "100ml"],
    image: p.image_url || "/placeholder-bottle.png",
    images: p.image_urls || (p.image_url ? [p.image_url] : []),
    isNew: p.is_new,
    isBestSeller: p.is_bestseller,
    isFeaturedLarge: p.is_featured_large,
    description: p.description ?? undefined,
    olfactory: p.olfactory_group || "Woody & Oud",
    gender,
    // Search reads the pyramid, so "oud" finds what wears it without naming it.
    topNotes: p.top_notes ?? null,
    heartNotes: p.heart_notes ?? null,
    baseNotes: p.base_notes ?? null,
    strength: p.strength ?? null,
    longevity: p.longevity ?? null,
    seasons: p.seasons ?? null,
    occasions: p.occasions ?? null,
    inspiredBy: p.inspired_by ?? null,
  };
}

/** Migration 70: "Bestseller" labels from real orders, while Popularity badges are on. */
async function fetchPopular(productIds: number[]): Promise<number[]> {
  if (!isSupabaseConfigured || productIds.length === 0) return [];
  const features = await liveStoreFeatures();
  if (!features.demand_signals.enabled || features.demand_signals.settings.show_family === false) return [];
  const { data, error } = await createServerSupabase().rpc("demand_signals", { p_product_ids: productIds.slice(0, 200) });
  if (error || !Array.isArray(data)) return [];
  return (data as { product_id: number; family: string | null }[]).filter((r) => r.family).map((r) => Number(r.product_id));
}

async function fetchCatalogue(): Promise<{
  products: CatalogProduct[];
  collections: DbCollectionRow[];
  productCollections: DbProductCollectionRow[];
}> {
  if (!isSupabaseConfigured) {
    return { products: [], collections: [], productCollections: [] };
  }
  try {
    const supabase = createServerSupabase();
    const [productsRes, collectionsRes, mappingsRes] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("collections").select("*"),
      supabase.from("product_collections").select("collection_id, product_id"),
    ]);
    const products = Array.isArray(productsRes.data)
      ? (productsRes.data as DbProductRow[]).map(mapProduct)
      : [];
    const collections = Array.isArray(collectionsRes.data)
      ? (collectionsRes.data as DbCollectionRow[])
      : [];
    const productCollections = Array.isArray(mappingsRes.data)
      ? (mappingsRes.data as DbProductCollectionRow[])
      : [];
    return { products, collections, productCollections };
  } catch (err) {
    console.error("Shop page Supabase load error:", err);
    return { products: [], collections: [], productCollections: [] };
  }
}

interface ShopPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const first = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const [params, catalogue] = await Promise.all([searchParams, fetchCatalogue()]);
  const popular = await fetchPopular(catalogue.products.map((p) => p.id));

  return (
    <ShopClient
      popularIds={popular}
      products={catalogue.products}
      collections={catalogue.collections}
      productCollections={catalogue.productCollections}
      initialFilters={{
        olfactory: first(params.olfactory),
        gender: first(params.gender),
        brand: first(params.brand),
        collection: first(params.collection),
        search: first(params.search) ?? "",
        sort: first(params.sort) ?? "featured",
        note: first(params.note),
        occasion: first(params.occasion),
        season: first(params.season),
        strength: first(params.strength),
        lasts: first(params.lasts),
      }}
    />
  );
}
