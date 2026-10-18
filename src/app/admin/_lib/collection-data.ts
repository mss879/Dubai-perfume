import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ruleTag } from "./collection-schema";
import { fetchAll } from "./fetch-all";

export type CollectionRow = {
  id: string;
  title: string;
  description: string;
  cover: string;
  automated: boolean;
  tag: string;
  kind: "brand" | "line" | "curated";
  /** When set, the shop shows every product of this brand here, linked or not (collection/[id]/page.tsx). */
  brand: string;
  count: number;
};

export type PickableProduct = { id: number; brand: string; name: string; image: string | null; tags: string[] };

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

function toRow(row: Json, counts: Map<string, number>): CollectionRow {
  const kind = str(row.kind);
  const brand = str(row.brand).trim();
  return {
    id: str(row.id),
    title: str(row.title) || str(row.id),
    description: str(row.description),
    cover: str(row.cover_image),
    automated: str(row.type) === "automated",
    tag: ruleTag(row.rules),
    kind: kind === "brand" || kind === "line" ? kind : "curated",
    brand,
    count: counts.get(str(row.id)) ?? 0,
  };
}

const COLUMNS = "id, title, description, cover_image, type, rules, kind, sort_order, brand";

export async function loadCollections(supabase: SupabaseClient) {
  const [collections, links, products] = await Promise.all([
    supabase.from("collections").select(COLUMNS).order("sort_order").order("title"),
    fetchAll<Json>(
      (first, last) =>
        supabase.from("product_collections").select("collection_id, product_id").order("collection_id").order("product_id").range(first, last),
      50000
    ),
    fetchAll<Json>((first, last) => supabase.from("products").select("id, brand").order("id").range(first, last)),
  ]);
  // Members as the shop counts them: linked products, plus (on a brand page) every product of that brand.
  const members = new Map<string, Set<number>>();
  for (const link of links.rows) {
    const id = str(link.collection_id);
    const set = members.get(id) ?? new Set<number>();
    set.add(Number(link.product_id));
    members.set(id, set);
  }
  for (const row of (collections.data ?? []) as Json[]) {
    const brand = str(row.brand).trim().toUpperCase();
    if (!brand) continue;
    const id = str(row.id);
    const set = members.get(id) ?? new Set<number>();
    for (const product of products.rows) if (str(product.brand).toUpperCase() === brand) set.add(Number(product.id));
    members.set(id, set);
  }
  const counts = new Map<string, number>([...members].map(([id, set]) => [id, set.size]));
  return {
    collections: ((collections.data ?? []) as Json[]).map((row) => toRow(row, counts)),
    failed: Boolean(collections.error || links.failed || products.failed),
  };
}

function productImage(row: Json): string | null {
  const urls = Array.isArray(row.image_urls) ? row.image_urls.filter((u): u is string => typeof u === "string") : [];
  const main = str(row.image_url);
  return urls[0] ?? (main && !main.includes("placeholder") ? main : null);
}

/** The collection (null for a new one), every product to pick from, and which are in it. */
export async function loadCollectionEditor(supabase: SupabaseClient, id: string | null) {
  const [collection, products, links] = await Promise.all([
    id ? supabase.from("collections").select(COLUMNS).eq("id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("products").select("id, brand, name, image_url, image_urls, tags").order("brand").order("name").limit(5000),
    id ? supabase.from("product_collections").select("product_id").eq("collection_id", id) : Promise.resolve({ data: [], error: null }),
  ]);

  const pickable: PickableProduct[] = ((products.data ?? []) as Json[]).map((row) => ({
    id: Number(row.id),
    brand: str(row.brand),
    name: str(row.name),
    image: productImage(row),
    tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === "string") : [],
  }));
  const members = ((links.data ?? []) as Json[]).map((row) => Number(row.product_id));
  const brand = collection.data ? str((collection.data as Json).brand).trim().toUpperCase() : "";
  // On a brand page these appear whatever the links say.
  const brandMatched = brand ? pickable.filter((p) => p.brand.toUpperCase() === brand).map((p) => p.id) : [];

  const tagCounts: Record<string, number> = {};
  for (const product of pickable) for (const tag of product.tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;

  return {
    collection: collection.data
      ? toRow(collection.data as Json, new Map([[id ?? "", new Set([...members, ...brandMatched]).size]]))
      : null,
    products: pickable,
    members,
    brandMatched,
    tagCounts,
    failed: Boolean(collection.error || products.error || links.error),
  };
}
