import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SCENT_FAMILIES } from "./product-schema";

/** Products as the admin sees them (the admin read policy shows hidden ones too). */

type Json = Record<string, unknown>;

export type AdminProduct = {
  id: number;
  brand: string;
  name: string;
  olfactoryGroup: string;
  price: number;
  compareAtPrice: number | null;
  costPrice: number;
  tagline: string;
  description: string;
  sizes: string[];
  images: string[];
  tags: string[];
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  isNew: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
  isPublished: boolean;
};

export type StockEntry = { size: string; stock_level: number; low_stock_threshold: number };

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function toAdminProduct(row: Json): AdminProduct {
  const images = arr(row.image_urls);
  const main = str(row.image_url);
  return {
    id: Math.round(num(row.id)),
    brand: str(row.brand),
    name: str(row.name),
    olfactoryGroup: str(row.olfactory_group),
    price: num(row.price),
    compareAtPrice: row.compare_at_price === null || row.compare_at_price === undefined ? null : num(row.compare_at_price),
    costPrice: num(row.cost_price),
    tagline: str(row.tagline),
    description: str(row.description),
    sizes: arr(row.sizes),
    images: images.length > 0 ? images : main && !main.includes("placeholder") ? [main] : [],
    tags: arr(row.tags),
    topNotes: arr(row.top_notes),
    heartNotes: arr(row.heart_notes),
    baseNotes: arr(row.base_notes),
    isNew: row.is_new === true,
    isBestseller: row.is_bestseller === true,
    isFeatured: row.is_featured_large === true,
    // Before migration 64 there is no column: everything is in the shop.
    isPublished: row.is_published !== false,
  };
}

/** Whether migration 64 has run (the column it adds can be read). */
export async function productsMigrationReady(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from("products").select("is_published").limit(1);
  return !error;
}

export async function loadCatalogue(supabase: SupabaseClient) {
  const [products, inventory, ready] = await Promise.all([
    supabase.from("products").select("*").order("brand").order("name"),
    supabase.from("inventory").select("product_id, size, stock_level, low_stock_threshold"),
    productsMigrationReady(supabase),
  ]);
  const stock = new Map<number, StockEntry[]>();
  for (const row of (inventory.data ?? []) as Json[]) {
    const id = Math.round(num(row.product_id));
    const list = stock.get(id) ?? [];
    list.push({ size: str(row.size), stock_level: Math.round(num(row.stock_level)), low_stock_threshold: Math.round(num(row.low_stock_threshold)) });
    stock.set(id, list);
  }
  return {
    products: ((products.data ?? []) as Json[]).map(toAdminProduct),
    stock,
    ready,
    failed: Boolean(products.error || inventory.error),
  };
}

/** Everything the product form needs; `id` null for a new product. */
export async function loadProductForm(supabase: SupabaseClient, id: number | null) {
  const [productRes, costRes, stockRes, collectionsRes, linksRes, brandsRes, ready] = await Promise.all([
    id ? supabase.from("products").select("*").eq("id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    // Migration 68 keeps the cost in an admin-only table, out of the public
    // product rows. Before it runs the read fails and the old column is used.
    id
      ? supabase.from("product_costs").select("cost_price").eq("product_id", id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    id
      ? supabase.from("inventory").select("size, stock_level, low_stock_threshold").eq("product_id", id)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("collections").select("id, title, type").order("title"),
    id ? supabase.from("product_collections").select("collection_id").eq("product_id", id) : Promise.resolve({ data: [], error: null }),
    supabase.from("products").select("brand, olfactory_group"),
    productsMigrationReady(supabase),
  ]);

  const brands = new Set<string>();
  const families = new Set<string>(SCENT_FAMILIES);
  for (const row of (brandsRes.data ?? []) as Json[]) {
    if (str(row.brand)) brands.add(str(row.brand));
    if (str(row.olfactory_group)) families.add(str(row.olfactory_group));
  }

  const product = productRes.data ? toAdminProduct(productRes.data as Json) : null;
  if (product && !costRes.error && costRes.data) product.costPrice = num((costRes.data as Json).cost_price);

  return {
    product,
    stock: ((stockRes.data ?? []) as Json[]).map((row) => ({
      size: str(row.size),
      stock_level: Math.round(num(row.stock_level)),
      low_stock_threshold: Math.round(num(row.low_stock_threshold)),
    })),
    collections: ((collectionsRes.data ?? []) as Json[]).map((row) => ({
      id: str(row.id),
      title: str(row.title) || str(row.id),
      automated: str(row.type) === "automated",
    })),
    links: ((linksRes.data ?? []) as Json[]).map((row) => str(row.collection_id)),
    brands: [...brands].sort((a, b) => a.localeCompare(b)),
    families: [...families],
    ready,
  };
}
