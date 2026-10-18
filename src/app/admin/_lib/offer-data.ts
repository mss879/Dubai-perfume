import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countsAsRevenue } from "../../lib/payments/status";
import { aed } from "./format";
import { fetchAll } from "./fetch-all";
import { OFFER_TEMPLATES, offerDefaults, tierSummary, type OfferInput, type OfferTemplate } from "./offer-schema";

/** Offers as the admin sees them (migration 69). */

export type OfferRow = {
  id: number;
  kind: string;
  template: string;
  title: string;
  description: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  scope: string;
  scope_brands: string[];
  scope_collection_ids: string[];
  scope_product_ids: number[];
  count_by: string;
  tiers: { min_qty: number; percent: number; free_delivery?: boolean }[];
  bundle_lines: { product_id: number; size?: string; qty?: number }[];
  bundle_price: number | string | null;
  bundle_percent: number | string | null;
  free_delivery: boolean;
  gift_wrap: boolean;
  product_id: number | null;
  product_size: string | null;
  addon_price: number | string | null;
  min_subtotal: number | string;
  created_at: string;
};

export type PickProduct = { id: number; brand: string; name: string; price: number; sizes: string[]; published: boolean };
export type PickCollection = { id: string; title: string };

/** True when the error means migration 69 hasn't run (the table isn't there). */
export function offersMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /offers/.test(error.message ?? "") && /does not exist|schema cache/.test(error.message ?? "")));
}

export async function loadOffers(supabase: SupabaseClient): Promise<{ offers: OfferRow[]; ready: boolean; failed: boolean }> {
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { offers: [], ready: !offersMissing(error), failed: !offersMissing(error) };
  return { offers: (data ?? []) as OfferRow[], ready: true, failed: false };
}

export async function loadOfferPicks(supabase: SupabaseClient) {
  const [products, collections] = await Promise.all([
    supabase.from("products").select("id, brand, name, price, sizes, is_published").order("brand").order("name").limit(1000),
    supabase.from("collections").select("id, title").order("title").limit(500),
  ]);
  const picks: PickProduct[] = ((products.data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: Number(p.id),
    brand: String(p.brand ?? ""),
    name: String(p.name ?? "").replace(/_/g, " "),
    price: Number(p.price) || 0,
    sizes: Array.isArray(p.sizes) ? (p.sizes as string[]).filter(Boolean) : [],
    published: p.is_published !== false,
  }));
  const brands = [...new Set(picks.map((p) => p.brand.toUpperCase()).filter(Boolean))].sort();
  return {
    products: picks,
    brands,
    collections: ((collections.data ?? []) as { id: string; title: string | null }[]).map((c) => ({ id: c.id, title: c.title || c.id })),
    failed: Boolean(products.error || collections.error),
  };
}

export type OfferStats = { orders: number; sales: number; given: number; units: number };

/**
 * What each offer did: orders that used it (paid or due on delivery), what
 * those orders came to, and the savings or gift value it gave. Cancelled and
 * unpaid orders don't count, as in Reports.
 */
export async function loadOfferStats(supabase: SupabaseClient): Promise<Map<number, OfferStats>> {
  type Row = {
    offer_id: number | null;
    saving: number | string;
    units: number;
    orders: { status: string | null; total_price: number | string | null; payment_method: string | null; payment_status: string | null } | null;
  };
  const { rows } = await fetchAll<Row>((from, to) =>
    supabase
      .from("order_offers")
      .select("offer_id, saving, units, orders(status, total_price, payment_method, payment_status)")
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: unknown }>
  );
  const stats = new Map<number, OfferStats>();
  for (const row of rows) {
    if (row.offer_id == null || !row.orders) continue;
    if (!countsAsRevenue(row.orders.payment_method, row.orders.payment_status, row.orders.status)) continue;
    const entry = stats.get(row.offer_id) ?? { orders: 0, sales: 0, given: 0, units: 0 };
    entry.orders += 1;
    entry.sales += Number(row.orders.total_price) || 0;
    entry.given += Number(row.saving) || 0;
    entry.units += Number(row.units) || 0;
    stats.set(row.offer_id, entry);
  }
  return stats;
}

/** Live, scheduled, ended or paused, as the shop would treat it right now. */
export function offerState(offer: OfferRow, now: number): { label: string; tone: "emerald" | "sky" | "neutral" } {
  if (!offer.is_active) return { label: "Paused", tone: "neutral" };
  if (offer.ends_at && new Date(offer.ends_at).getTime() < now) return { label: "Ended", tone: "neutral" };
  if (offer.starts_at && new Date(offer.starts_at).getTime() > now) return { label: "Scheduled", tone: "sky" };
  return { label: "Live", tone: "emerald" };
}

function scopeText(offer: OfferRow, products: Map<number, PickProduct>, collections: Map<string, string>): string {
  switch (offer.scope) {
    case "brands":
      return offer.scope_brands.map((b) => b.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())).join(" or ");
    case "collections":
      return offer.scope_collection_ids.map((id) => collections.get(id) ?? id).join(" or ");
    case "products": {
      const names = offer.scope_product_ids.map((id) => products.get(id)?.name ?? `#${id}`);
      return names.slice(0, 2).join(", ") + (names.length > 2 ? ` and ${names.length - 2} more` : "");
    }
    default:
      return "any perfume";
  }
}

/** The offer in one line, for the admin list. */
export function describeOffer(offer: OfferRow, products: Map<number, PickProduct>, collections: Map<string, string>): string {
  switch (offer.kind) {
    case "tiered":
      return `${scopeText(offer, products, collections)} · ${tierSummary(offer.tiers ?? [], offer.count_by === "same_product")}`;
    case "bundle": {
      const names = (offer.bundle_lines ?? []).map((l) => {
        const name = products.get(Number(l.product_id))?.name ?? `#${l.product_id}`;
        return (l.qty ?? 1) > 1 ? `${l.qty}× ${name}` : name;
      });
      const base = (offer.bundle_lines ?? []).reduce(
        (sum, l) => sum + (products.get(Number(l.product_id))?.price ?? 0) * (Number(l.qty) || 1),
        0
      );
      const price = offer.bundle_price != null ? Number(offer.bundle_price) : Math.round(base * (100 - Number(offer.bundle_percent ?? 0))) / 100;
      const extras = [offer.free_delivery ? "free delivery" : null, offer.gift_wrap ? "gift-wrapped" : null].filter(Boolean);
      return `${names.join(" + ")} · ${aed(price)} instead of ${aed(base)}${extras.length ? ` · ${extras.join(", ")}` : ""}`;
    }
    case "addon": {
      const product = offer.product_id ? products.get(offer.product_id) : undefined;
      return `${product?.name ?? "A perfume"} for ${aed(offer.addon_price)}${product ? ` (usually ${aed(product.price)})` : ""} · bags of ${aed(offer.min_subtotal)} or more`;
    }
    case "gift": {
      const product = offer.product_id ? products.get(offer.product_id) : undefined;
      return `Free ${product?.name ?? "gift"} with bags of ${aed(offer.min_subtotal)} or more`;
    }
    default:
      return "";
  }
}

const dayOf = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date(iso)) : "";

/** A saved offer back into the form's shape. */
export function offerToInput(offer: OfferRow): OfferInput {
  const template = (offer.template in OFFER_TEMPLATES ? offer.template : templateFor(offer)) as OfferTemplate;
  const defaults = offerDefaults(template);
  return {
    ...defaults,
    template,
    title: offer.title,
    description: offer.description ?? "",
    is_active: offer.is_active,
    starts_on: dayOf(offer.starts_at),
    ends_on: dayOf(offer.ends_at),
    priority: offer.priority ?? 0,
    scope: (offer.scope as OfferInput["scope"]) ?? "all",
    scope_brands: offer.scope_brands ?? [],
    scope_collection_ids: offer.scope_collection_ids ?? [],
    scope_product_ids: offer.scope_product_ids ?? [],
    tiers: (offer.tiers ?? []).map((t) => ({
      min_qty: Number(t.min_qty),
      percent: Number(t.percent),
      free_delivery: Boolean(t.free_delivery),
    })),
    bundle_lines: (offer.bundle_lines ?? []).map((l) => ({
      product_id: Number(l.product_id),
      size: l.size ?? "",
      qty: Number(l.qty) || 1,
    })),
    price_mode: offer.bundle_price != null ? "price" : "percent",
    bundle_price: offer.bundle_price != null ? Number(offer.bundle_price) : null,
    bundle_percent: offer.bundle_percent != null ? Number(offer.bundle_percent) : defaults.bundle_percent,
    free_delivery: offer.free_delivery,
    gift_wrap: offer.gift_wrap,
    product_id: offer.product_id,
    product_size: offer.product_size ?? "",
    addon_price: offer.addon_price != null ? Number(offer.addon_price) : null,
    min_subtotal: Number(offer.min_subtotal) || 0,
  };
}

function templateFor(offer: OfferRow): OfferTemplate {
  if (offer.kind === "tiered") return offer.count_by === "same_product" ? "backup" : "buy_more";
  if (offer.kind === "addon") return "addon";
  if (offer.kind === "gift") return "gift";
  return offer.gift_wrap ? "occasion" : "house";
}
