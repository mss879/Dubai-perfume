import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { SITE_URL } from "../../lib/site";
import { jsonLdScript } from "../../lib/html";
import { PRODUCT_FIELDS, toArray } from "../../lib/catalogue";
import ProductClient, {
  type ProductDetailProps,
  type RelatedItemProps
} from "./ProductClient";
import { loadOfferCards } from "../../lib/offers-server";
import { liveStoreFeatures } from "../../lib/features-server";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

interface ProductRow {
  id: number;
  brand: string | null;
  name: string | null;
  price: number | string | null;
  compare_at_price: number | string | null;
  sizes: unknown;
  image_url: string | null;
  image_urls: unknown;
  description: string | null;
  tagline: string | null;
  olfactory_group: string | null;
  tags: unknown;
  top_notes: unknown;
  heart_notes: unknown;
  base_notes: unknown;
  is_new: boolean | null;
  is_bestseller: boolean | null;
  is_featured_large: boolean | null;
}

const toAedNumber = (value: unknown): number =>
  parseFloat(String(value ?? "").replace(/[^0-9.]/g, "")) || 0;

// compare_at_price is nullable, so an absent list price has to stay null rather
// than fall back to 0 the way toAedNumber does — no column means no was-price.
const toAedNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidId = (id: string): boolean => /^\d+$/.test(id);

const truncate = (text: string, max = 155): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trimEnd()}…`;
};

// cache() dedupes the row fetch between generateMetadata and the page render.
const getProduct = cache(async (productId: number): Promise<ProductRow | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("id", productId)
    .maybeSingle();
  if (error) {
    console.error("Error loading product detail:", error);
    return null;
  }
  return (data as ProductRow | null) ?? null;
});

/**
 * Sizes that have run out. Read through the same public stock lookup the
 * concierge uses, so exact counts never reach the browser. A size with no
 * stock row is untracked and always available, as checkout treats it.
 */
async function getSoldOutSizes(productId: number): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createServerSupabase().rpc("get_product_availability", {
    p_product_ids: [productId],
  });
  if (error || !Array.isArray(data)) return [];
  return (data as { size: string; stock_level: number | null }[])
    .filter((row) => (Number(row.stock_level) || 0) <= 0)
    .map((row) => row.size);
}

/**
 * Migration 70: the "inspired by" line and the popularity counts, each only
 * while its switch is on. Read separately and tolerantly, so the page never
 * depends on the new columns existing.
 */
async function getGrowthExtras(productId: number): Promise<{
  inspiredBy: string | null;
  demand: { recentOrders: number | null; windowDays: number; family: string | null } | null;
}> {
  if (!isSupabaseConfigured) return { inspiredBy: null, demand: null };
  const features = await liveStoreFeatures();
  const supabase = createServerSupabase();
  const wantInspired = features.inspired_by.enabled && features.inspired_by.settings.show_on_product !== false;
  const [inspired, signals] = await Promise.all([
    wantInspired ? supabase.from("products").select("inspired_by").eq("id", productId).maybeSingle() : Promise.resolve(null),
    features.demand_signals.enabled ? supabase.rpc("demand_signals", { p_product_ids: [productId] }) : Promise.resolve(null),
  ]);
  const inspiredBy =
    inspired && !inspired.error && typeof (inspired.data as { inspired_by?: unknown } | null)?.inspired_by === "string"
      ? String((inspired.data as { inspired_by: string }).inspired_by)
      : null;
  const row = signals && !signals.error && Array.isArray(signals.data) ? (signals.data[0] as Record<string, unknown> | undefined) : undefined;
  const demand =
    row && (row.recent_orders != null || row.family != null)
      ? {
          recentOrders: row.recent_orders == null ? null : Number(row.recent_orders),
          windowDays: Number(row.window_days) || 7,
          family: typeof row.family === "string" ? row.family : null,
        }
      : null;
  return { inspiredBy, demand };
}

function normalizeProduct(row: ProductRow): ProductDetailProps {
  const galleryImages = (() => {
    const fromArray = toArray(row.image_urls);
    if (fromArray.length > 0) return fromArray;
    return row.image_url ? [row.image_url] : [];
  })();

  return {
    id: Number(row.id),
    brand: row.brand || "",
    name: row.name || "",
    priceAed: toAedNumber(row.price),
    compareAtAed: toAedNumberOrNull(row.compare_at_price),
    sizes: toArray(row.sizes),
    image: row.image_url || galleryImages[0] || "",
    images: galleryImages,
    description: row.description || "",
    tagline: row.tagline || "",
    olfactory: row.olfactory_group || "",
    tags: toArray(row.tags),
    top_notes: toArray(row.top_notes),
    heart_notes: toArray(row.heart_notes),
    base_notes: toArray(row.base_notes),
    is_new: Boolean(row.is_new),
    is_bestseller: Boolean(row.is_bestseller),
    is_featured_large: Boolean(row.is_featured_large)
  };
}

function toRelated(row: ProductRow): RelatedItemProps {
  return {
    id: Number(row.id),
    brand: row.brand || "",
    name: row.name || "",
    priceAed: toAedNumber(row.price),
    compareAtAed: toAedNumberOrNull(row.compare_at_price),
    sizes: toArray(row.sizes),
    image: row.image_url || toArray(row.image_urls)[0] || "",
    olfactory: row.olfactory_group || ""
  };
}

// Up to 4 pieces from the same maison; falls back to the wider catalogue when
// the brand has nothing else, so the rail never sits empty for lone pieces.
async function getRelated(product: ProductDetailProps): Promise<RelatedItemProps[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createServerSupabase();

  if (product.brand) {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_FIELDS)
      .eq("brand", product.brand)
      .neq("id", product.id)
      .limit(4);
    if (error) {
      console.error("Error loading related products:", error);
      return [];
    }
    const rows = (data as ProductRow[] | null) ?? [];
    if (rows.length > 0) return rows.map(toRelated);
  }

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .neq("id", product.id)
    .limit(4);
  if (error) {
    console.error("Error loading related products:", error);
    return [];
  }
  return (((data as ProductRow[] | null) ?? [])).map(toRelated);
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  if (!isValidId(id)) {
    return { title: "Fragrance not found" };
  }
  const row = await getProduct(Number(id));
  if (!row) {
    return { title: "Fragrance not found" };
  }
  const product = normalizeProduct(row);
  const title = `${product.brand} ${product.name}`.trim();
  const description = truncate(
    product.description ||
      product.tagline ||
      `${title} — part of the Gharib curation of luxury fragrance in Dubai.`
  );

  return {
    title,
    description,
    alternates: { canonical: `/product/${product.id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/product/${product.id}`,
      ...(product.image ? { images: [{ url: product.image }] } : {})
    }
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  if (!isValidId(id)) notFound();

  const row = await getProduct(Number(id));
  if (!row) notFound();

  const product = normalizeProduct(row);
  const [related, soldOutSizes, offers, extras] = await Promise.all([
    getRelated(product),
    getSoldOutSizes(product.id),
    loadOfferCards(product.id),
    getGrowthExtras(product.id),
  ]);
  const allSoldOut = product.sizes.length > 0 && product.sizes.every((size) => soldOutSizes.includes(size));

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: product.brand },
    ...(product.images.length > 0 ? { image: product.images } : {}),
    ...(product.description || product.tagline
      ? { description: product.description || product.tagline }
      : {}),
    offers: {
      "@type": "Offer",
      price: product.priceAed,
      priceCurrency: "AED",
      availability: allSoldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${SITE_URL}/product/${product.id}`
    }
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop` },
      { "@type": "ListItem", position: 3, name: product.name }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />
      <ProductClient
        product={product}
        related={related}
        soldOutSizes={soldOutSizes}
        offers={offers}
        inspiredBy={extras.inspiredBy}
        demand={extras.demand}
      />
    </>
  );
}
