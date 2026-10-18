import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Orders as the admin pages show them: read with the admin's own session
 * (RLS decides), shaped once here so the list, the order page and Today agree.
 */

export const ORDER_SUMMARY_COLUMNS =
  "id, created_at, status, payment_method, payment_status, total_price, packing_charges, email, phone, shipping_address, " +
  "order_items(quantity, size, products(name, brand))";

type Json = Record<string, unknown>;

export type OrderLineSummary = { name: string; brand: string | null; size: string; quantity: number };

export type OrderSummary = {
  id: string;
  createdAt: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  packingCharges: number;
  email: string;
  phone: string | null;
  name: string;
  city: string;
  lines: OrderLineSummary[];
  itemCount: number;
  /** Migration 70: a digital gift card order (nothing to pack). */
  giftCard: boolean;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function productOf(item: Json): { name: string; brand: string | null } {
  const raw = item.products;
  const product = (Array.isArray(raw) ? raw[0] : raw) as Json | null | undefined;
  if (!product) return { name: "Removed product", brand: null };
  return { name: text(product.name) || "Unnamed product", brand: text(product.brand) || null };
}

export function toSummary(row: Json): OrderSummary {
  const address = (row.shipping_address && typeof row.shipping_address === "object" ? row.shipping_address : {}) as Json;
  const items = (Array.isArray(row.order_items) ? row.order_items : []) as Json[];
  const lines = items.map((item) => {
    const product = productOf(item);
    return { ...product, size: text(item.size), quantity: Math.max(1, Math.round(num(item.quantity))) };
  });
  return {
    id: text(row.id),
    createdAt: text(row.created_at),
    status: text(row.status) || "pending",
    paymentMethod: text(row.payment_method) || "cod",
    paymentStatus: text(row.payment_status),
    total: num(row.total_price),
    packingCharges: num(row.packing_charges),
    email: text(row.email),
    phone: text(row.phone) || null,
    name: text(address.name) || text(row.email) || "Customer",
    city: text(address.city),
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    giftCard: address.kind === "gift_card",
  };
}

/** "Hawas Ice 100ml + 2 more" */
export function linesLabel(lines: OrderLineSummary[]): string {
  if (lines.length === 0) return "No items";
  const first = lines[0];
  const head = `${first.name}${first.size ? ` ${first.size}` : ""}${first.quantity > 1 ? ` × ${first.quantity}` : ""}`;
  return lines.length > 1 ? `${head} + ${lines.length - 1} more` : head;
}

export type OrderDetail = OrderSummary & {
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  discountCode: string | null;
  convertedTotal: string | null;
  currency: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  updatedAt: string | null;
  customerId: string | null;
  address: { name: string; street: string; city: string; country: string; postalCode: string };
  items: { name: string; brand: string | null; size: string; quantity: number; unitPrice: number; imageUrl: string | null; gift: boolean }[];
  timeline: { id: number; status: string; location: string; description: string; at: string }[];
  /** Migration 69: the automatic offers the order used (empty before it). */
  offers: { kind: string; title: string; saving: number; units: number; giftWrap: boolean; freeDelivery: boolean }[];
  /** What the offers took off, delivery included; the rest of discountAmount is the code. */
  offerSaving: number;
  giftWrap: boolean;
  /** Migration 70: gift options, a recipient, credits; null before it runs. */
  growth: OrderGrowth | null;
};

export type OrderGrowth = {
  kind: "goods" | "gift_card";
  giftWrapChosen: boolean;
  giftWrapFee: number;
  giftMessage: string | null;
  hidePrices: boolean;
  sendToOther: boolean;
  recipientName: string | null;
  recipientPhone: string | null;
  deliveryDate: string | null;
  pointsRedeemed: number;
  pointsValue: number;
  pointsEarned: number;
  giftCardCode: string | null;
  giftCardAmount: number;
  /** A gift card order: the card(s) it bought. */
  cards: { code: string; amount: number; recipientName: string | null; recipientEmail: string | null; status: string; sendOn: string | null; sentAt: string | null }[];
  referral: { code: string; status: string } | null;
};

/** One order with its lines and timeline, or null when it doesn't exist. */
export async function loadOrderDetail(supabase: SupabaseClient, id: string): Promise<OrderDetail | null> {
  const [orderRes, itemsRes, timelineRes, offersRes, offerSavingRes, growthRes, cardsRes, referralRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, created_at, updated_at, status, payment_method, payment_status, total_price, shipping_fee, discount_amount, discount_code, " +
          "converted_total, currency, packing_charges, email, phone, shipping_address, tracking_number, tracking_url, customer_id"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("quantity, size, unit_price, products(name, brand, image_url)")
      .eq("order_id", id)
      .order("id"),
    supabase
      .from("order_tracking")
      .select("id, status, location, description, updated_at")
      .eq("order_id", id)
      .order("id", { ascending: true }),
    // Migration 69 (each read simply fails before it, and the page goes on).
    supabase.from("order_offers").select("kind, title, saving, units, gift_wrap, free_delivery").eq("order_id", id).order("id"),
    supabase.from("orders").select("offer_saving").eq("id", id).maybeSingle(),
    // Migration 70, the same way.
    supabase
      .from("orders")
      .select(
        "order_kind, gift_wrap, gift_wrap_fee, gift_message, hide_prices, send_to_other, recipient_name, recipient_phone, delivery_date, " +
          "points_redeemed, points_value, points_earned, gift_card_code, gift_card_amount"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("gift_cards").select("code, initial_value, recipient_name, recipient_email, status, send_on, sent_at").eq("order_id", id),
    supabase.from("referrals").select("code, status").eq("order_id", id).maybeSingle(),
  ]);

  if (orderRes.error || !orderRes.data) return null;
  const row = orderRes.data as unknown as Json;
  const summary = toSummary({ ...row, order_items: itemsRes.data ?? [] });
  const address = (row.shipping_address && typeof row.shipping_address === "object" ? row.shipping_address : {}) as Json;

  const items = ((itemsRes.data ?? []) as unknown as Json[]).map((item) => {
    const raw = item.products;
    const product = (Array.isArray(raw) ? raw[0] : raw) as Json | null | undefined;
    return {
      name: product ? text(product.name) || "Unnamed product" : "Removed product",
      brand: product ? text(product.brand) || null : null,
      size: text(item.size),
      quantity: Math.max(1, Math.round(num(item.quantity))),
      unitPrice: num(item.unit_price),
      imageUrl: product ? text(product.image_url) || null : null,
      // Only an offer's free gift is recorded at no charge.
      gift: num(item.unit_price) === 0,
    };
  });
  const offers = ((offersRes.error ? [] : offersRes.data) ?? []).map((o) => {
    const r = o as Json;
    return {
      kind: text(r.kind),
      title: text(r.title),
      saving: num(r.saving),
      units: Math.round(num(r.units)),
      giftWrap: r.gift_wrap === true,
      freeDelivery: r.free_delivery === true,
    };
  });

  const g = growthRes.error || !growthRes.data ? null : (growthRes.data as unknown as Json);
  const growth: OrderGrowth | null = g
    ? {
        kind: g.order_kind === "gift_card" ? "gift_card" : "goods",
        giftWrapChosen: g.gift_wrap === true,
        giftWrapFee: num(g.gift_wrap_fee),
        giftMessage: text(g.gift_message) || null,
        hidePrices: g.hide_prices === true,
        sendToOther: g.send_to_other === true,
        recipientName: text(g.recipient_name) || null,
        recipientPhone: text(g.recipient_phone) || null,
        deliveryDate: text(g.delivery_date) || null,
        pointsRedeemed: Math.round(num(g.points_redeemed)),
        pointsValue: num(g.points_value),
        pointsEarned: Math.round(num(g.points_earned)),
        giftCardCode: text(g.gift_card_code) || null,
        giftCardAmount: num(g.gift_card_amount),
        cards: ((cardsRes.error ? [] : cardsRes.data) ?? []).map((c) => {
          const r = c as Json;
          return {
            code: text(r.code),
            amount: num(r.initial_value),
            recipientName: text(r.recipient_name) || null,
            recipientEmail: text(r.recipient_email) || null,
            status: text(r.status),
            sendOn: text(r.send_on) || null,
            sentAt: text(r.sent_at) || null,
          };
        }),
        referral:
          !referralRes.error && referralRes.data
            ? { code: text((referralRes.data as Json).code), status: text((referralRes.data as Json).status) }
            : null,
      }
    : null;

  return {
    ...summary,
    growth,
    subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    shippingFee: num(row.shipping_fee),
    discountAmount: num(row.discount_amount),
    offers,
    offerSaving: offerSavingRes.error ? 0 : num((offerSavingRes.data as Json | null)?.offer_saving),
    giftWrap: offers.some((o) => o.giftWrap) || growth?.giftWrapChosen === true,
    discountCode: text(row.discount_code) || null,
    convertedTotal: text(row.converted_total) || null,
    currency: text(row.currency) || "AED",
    trackingNumber: text(row.tracking_number) || null,
    trackingUrl: text(row.tracking_url) || null,
    updatedAt: text(row.updated_at) || null,
    customerId: text(row.customer_id) || null,
    address: {
      name: text(address.name),
      street: text(address.street),
      city: text(address.city),
      country: text(address.country),
      postalCode: text(address.postal_code),
    },
    items,
    timeline: ((timelineRes.data ?? []) as unknown as Json[]).map((entry) => ({
      id: Math.round(num(entry.id)),
      status: text(entry.status),
      location: text(entry.location),
      description: text(entry.description),
      at: text(entry.updated_at),
    })),
  };
}

/**
 * The search box: order number, email, phone or the name on the address.
 * PostgREST's filter syntax treats , . : ( ) " as structure, so the text is
 * stripped of them and capped; values are quoted.
 */
export function orderSearchFilter(raw: string): string | null {
  const q = raw.replace(/[,()*%\\":'`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!q) return null;
  const like = `"*${q}*"`;
  const parts = [`id.ilike.${like}`, `email.ilike.${like}`, `phone.ilike.${like}`, `shipping_address->>name.ilike.${like}`];
  // Phone numbers are typed every which way (+971 50…, 050…): match on the last nine digits.
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 5) parts.push(`phone.ilike."*${digits.slice(-9)}*"`);
  return parts.join(",");
}
