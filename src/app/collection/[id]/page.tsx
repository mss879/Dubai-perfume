import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CollectionClient, { type DbCollection, type DbProduct } from "./CollectionClient";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { PRODUCT_FIELDS } from "../../lib/catalogue";

/* Never bake stale catalogue data into the build. */
export const dynamic = "force-dynamic";

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

/** Row shape of `product_collections`. */
interface CollectionMapping {
  collection_id: string;
  product_id: number;
}

/* Select every column rather than naming them.
 *
 * The editorial fields (story_eyebrow, story_headline, story_subline, story_body,
 * pull_quote, stats, hero_image, texture_image) are added by
 * supabase/migrations/31_brand_editorial_content.sql, which has NOT been applied to
 * every environment yet. Naming a missing column makes PostgREST reject the whole
 * query with 42703 and the page renders nothing. "*" returns whatever the database
 * actually has; the fields are all optional on DbCollection and every read site
 * already falls back to title/description, so the page degrades to a plainer
 * editorial block instead of failing. */
const COLLECTION_FIELDS = "*";

interface CollectionData {
  collection: DbCollection;
  lines: DbCollection[];
  products: DbProduct[];
  lineMembership: Record<string, number[]>;
}

/** Deduped between generateMetadata and the page render. */
const getCollectionData = cache(async (collectionId: string): Promise<CollectionData | null> => {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createServerSupabase();
    const [collectionRes, linesRes, productsRes, mappingsRes] = await Promise.all([
      supabase.from("collections").select(COLLECTION_FIELDS).eq("id", collectionId).maybeSingle(),
      supabase.from("collections").select(COLLECTION_FIELDS).eq("parent_id", collectionId),
      supabase.from("products").select(PRODUCT_FIELDS),
      supabase.from("product_collections").select("collection_id, product_id"),
    ]);

    if (collectionRes.error) throw collectionRes.error;
    const collection = (collectionRes.data as DbCollection | null) || null;
    if (!collection) return null;

    const lines = (Array.isArray(linesRes.data) ? (linesRes.data as DbCollection[]) : []).sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );
    const mappings: CollectionMapping[] = Array.isArray(mappingsRes.data)
      ? (mappingsRes.data as CollectionMapping[])
      : [];
    const allProducts: DbProduct[] = Array.isArray(productsRes.data)
      ? (productsRes.data as DbProduct[])
      : [];

    const memberIds = mappings
      .filter((m) => m.collection_id === collection.id)
      .map((m) => m.product_id);

    // Brand collections also pick up anything matching the brand directly, so a
    // product added from the admin panel shows up without a manual mapping.
    const products = allProducts.filter(
      (p) =>
        memberIds.includes(p.id) ||
        (collection.brand && p.brand && p.brand.toUpperCase() === collection.brand.toUpperCase())
    );

    const lineMembership: Record<string, number[]> = {};
    lines.forEach((line) => {
      lineMembership[line.id] = mappings
        .filter((m) => m.collection_id === line.id)
        .map((m) => m.product_id);
    });

    return { collection, lines, products, lineMembership };
  } catch (err) {
    console.error("Error loading collection:", err);
    return null;
  }
});

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getCollectionData(id);
  if (!data) {
    return { title: "Collection not found" };
  }
  const { collection } = data;
  const description =
    collection.story_subline ||
    collection.description ||
    `Discover the ${collection.title} collection at Gharib — every composition, gathered in one place.`;
  return {
    title: collection.title,
    description,
    alternates: { canonical: `/collection/${collection.id}` },
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { id } = await params;
  const data = await getCollectionData(id);
  if (!data) notFound();

  return (
    <CollectionClient
      collection={data.collection}
      lines={data.lines}
      products={data.products}
      lineMembership={data.lineMembership}
    />
  );
}
