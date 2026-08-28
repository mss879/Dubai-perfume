import { cache } from "react";
import type { Metadata } from "next";
import HomeClient, {
  type DbCollectionRow,
  type DbProductRow,
} from "./HomeClient";
import { createServerSupabase, isSupabaseConfigured } from "./lib/supabase-server";
import { PRODUCT_FIELDS } from "./lib/catalogue";
import { SITE_DESCRIPTION } from "./lib/site";

/* The catalogue is live merchant data — never bake it into the build. */
export const dynamic = "force-dynamic";

/* Title falls back to the root layout default ("Gharib | ..."). */
export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

interface HomeData {
  products: DbProductRow[];
  collections: DbCollectionRow[];
}

const EMPTY_HOME_DATA: HomeData = {
  products: [],
  collections: [],
};

/**
 * One round of parallel reads for everything the homepage shows. cache() keeps
 * the fetch deduped should generateMetadata ever need the same data.
 * A failed read renders the storefront's empty states — never mock data.
 */
const getHomeData = cache(async (): Promise<HomeData> => {
  if (!isSupabaseConfigured) return EMPTY_HOME_DATA;
  try {
    const supabase = createServerSupabase();
    const [productsRes, collectionsRes] = await Promise.all([
      /* Named columns, never "*". HomeClient is a client component, so whatever
         lands in this array is serialised into the HTML the browser receives —
         a "*" here would publish products.cost_price, the maison's supplier
         cost sheet, to every visitor. PRODUCT_FIELDS is exactly what
         DbProductRow declares and it does not include cost. */
      supabase.from("products").select(PRODUCT_FIELDS),
      supabase.from("collections").select("*"),
    ]);
    return {
      products: (productsRes.data ?? []) as DbProductRow[],
      collections: (collectionsRes.data ?? []) as DbCollectionRow[],
    };
  } catch (err) {
    console.error("Homepage catalogue fetch failed:", err);
    return EMPTY_HOME_DATA;
  }
});

export default async function Home() {
  const { products, collections } = await getHomeData();

  return <HomeClient initialProducts={products} initialCollections={collections} />;
}
