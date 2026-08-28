import type { Metadata } from "next";
import ShopClient, {
  type CatalogProduct,
  type DbCollectionRow,
  type DbProductCollectionRow,
} from "./ShopClient";
import { createServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";

/* Never bake stale catalogue data into the build. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Fragrances",
  description:
    "Explore the complete Gharib catalogue — niche and designer fragrances from the great houses of Dubai perfumery, with cash-on-delivery across the UAE.",
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
  };
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

  return (
    <ShopClient
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
      }}
    />
  );
}
