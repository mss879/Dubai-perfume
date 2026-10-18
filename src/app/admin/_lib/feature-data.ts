import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeatureKey } from "../../lib/features";

/** What the admin's feature pages read (migration 70), each part failing soft. */

export const MIGRATION_70 =
  "These switches need database migration 70. Run supabase/migrations/70_growth_features.sql in the Supabase SQL editor, then try again.";

type Supabase = SupabaseClient;
const num = (v: unknown) => Number(v) || 0;

/* ── Gift cards ─────────────────────────────────────────────────────────── */

export type GiftCardRow = {
  code: string;
  kind: string;
  status: string;
  balance: number;
  initialValue: number;
  recipientName: string | null;
  recipientEmail: string | null;
  senderName: string | null;
  orderId: string | null;
  sendOn: string | null;
  sentAt: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  note: string | null;
};

export async function loadGiftCards(supabase: Supabase): Promise<{
  cards: GiftCardRow[];
  outstanding: number;
  sold: number;
  soldValue: number;
  failed: boolean;
}> {
  const { data, error } = await supabase
    .from("gift_cards")
    .select("code, kind, status, balance, initial_value, recipient_name, recipient_email, sender_name, order_id, send_on, sent_at, created_at, expires_at, note")
    .neq("kind", "legacy")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return { cards: [], outstanding: 0, sold: 0, soldValue: 0, failed: true };
  const cards = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    code: String(r.code),
    kind: String(r.kind ?? ""),
    status: String(r.status ?? ""),
    balance: num(r.balance),
    initialValue: num(r.initial_value),
    recipientName: (r.recipient_name as string | null) ?? null,
    recipientEmail: (r.recipient_email as string | null) ?? null,
    senderName: (r.sender_name as string | null) ?? null,
    orderId: (r.order_id as string | null) ?? null,
    sendOn: (r.send_on as string | null) ?? null,
    sentAt: (r.sent_at as string | null) ?? null,
    createdAt: (r.created_at as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    note: (r.note as string | null) ?? null,
  }));
  const now = Date.now();
  const live = cards.filter((c) => c.status === "active" && (!c.expiresAt || new Date(c.expiresAt).getTime() > now));
  const sold = cards.filter((c) => c.kind === "purchased" && c.status !== "pending");
  return {
    cards,
    outstanding: live.reduce((s, c) => s + c.balance, 0),
    sold: sold.length,
    soldValue: sold.reduce((s, c) => s + c.initialValue, 0),
    failed: false,
  };
}

/* ── Loyalty ────────────────────────────────────────────────────────────── */

export type LoyaltyMember = {
  id: string;
  email: string;
  name: string;
  available: number;
  pending: number;
  lifetime: number;
  lastActivity: string | null;
};

export async function loadLoyaltyMembers(supabase: Supabase): Promise<{ members: LoyaltyMember[]; failed: boolean }> {
  const { data, error } = await supabase.rpc("admin_loyalty_members", { p_limit: 200 });
  if (error || !Array.isArray(data)) return { members: [], failed: Boolean(error) };
  return {
    members: (data as Record<string, unknown>[]).map((m) => ({
      id: String(m.id),
      email: String(m.email ?? ""),
      name: [m.first_name, m.last_name].filter((v) => typeof v === "string" && v.trim()).join(" "),
      available: num(m.available),
      pending: num(m.pending),
      lifetime: num(m.lifetime),
      lastActivity: (m.last_activity as string | null) ?? null,
    })),
    failed: false,
  };
}

/* ── Referrals ──────────────────────────────────────────────────────────── */

export type ReferralRow = {
  id: number;
  code: string;
  referrer: string;
  friendEmail: string;
  orderId: string;
  status: string;
  rewardAmount: number | null;
  createdAt: string | null;
};

export async function loadReferrals(supabase: Supabase): Promise<{ rows: ReferralRow[]; codes: number; failed: boolean }> {
  const [refs, codes] = await Promise.all([
    supabase.from("referrals").select("id, referrer_id, code, friend_email, order_id, status, reward_amount, created_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("referral_codes").select("customer_id", { count: "exact", head: true }),
  ]);
  if (refs.error) return { rows: [], codes: 0, failed: true };
  const raw = (refs.data ?? []) as Record<string, unknown>[];
  const ids = [...new Set(raw.map((r) => String(r.referrer_id)))];
  const { data: people } = ids.length
    ? await supabase.from("customers").select("id, email, first_name").in("id", ids)
    : { data: [] as Record<string, unknown>[] };
  const byId = new Map(((people ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]));
  return {
    rows: raw.map((r) => {
      const p = byId.get(String(r.referrer_id));
      return {
        id: num(r.id),
        code: String(r.code ?? ""),
        referrer: p ? String(p.email ?? "") : "Account removed",
        friendEmail: String(r.friend_email ?? ""),
        orderId: String(r.order_id ?? ""),
        status: String(r.status ?? ""),
        rewardAmount: r.reward_amount == null ? null : num(r.reward_amount),
        createdAt: (r.created_at as string | null) ?? null,
      };
    }),
    codes: codes.count ?? 0,
    failed: false,
  };
}

/* ── Back-in-stock requests ─────────────────────────────────────────────── */

export type StockRequestGroup = {
  productId: number;
  name: string;
  brand: string;
  size: string;
  waiting: number;
  oldest: string | null;
  ids: number[];
};

export async function loadStockRequests(supabase: Supabase): Promise<{ groups: StockRequestGroup[]; sent30: number; failed: boolean }> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [waiting, sent] = await Promise.all([
    supabase.from("stock_alerts").select("id, product_id, size, created_at, products(name, brand)").is("notified_at", null).order("created_at").limit(2000),
    supabase.from("stock_alerts").select("id", { count: "exact", head: true }).gte("notified_at", since),
  ]);
  if (waiting.error) return { groups: [], sent30: 0, failed: true };
  const groups = new Map<string, StockRequestGroup>();
  for (const r of (waiting.data ?? []) as Record<string, unknown>[]) {
    const product = (Array.isArray(r.products) ? r.products[0] : r.products) as { name?: string; brand?: string } | null;
    const key = `${r.product_id}|${r.size}`;
    const g = groups.get(key) ?? {
      productId: num(r.product_id),
      name: String(product?.name ?? `#${r.product_id}`).replace(/_/g, " "),
      brand: String(product?.brand ?? ""),
      size: String(r.size ?? ""),
      waiting: 0,
      oldest: (r.created_at as string | null) ?? null,
      ids: [],
    };
    g.waiting += 1;
    g.ids.push(num(r.id));
    groups.set(key, g);
  }
  return { groups: [...groups.values()].sort((a, b) => b.waiting - a.waiting), sent30: sent.count ?? 0, failed: false };
}

/* ── Issued codes (welcome, cart reminders) ─────────────────────────────── */

export async function loadIssuedCodes(supabase: Supabase, kind: "welcome" | "recovery"): Promise<{ issued: number; used: number; failed: boolean }> {
  const [issued, used] = await Promise.all([
    supabase.from("discounts").select("id", { count: "exact", head: true }).eq("kind", kind),
    supabase.from("discounts").select("id", { count: "exact", head: true }).eq("kind", kind).gt("usage_count", 0),
  ]);
  if (issued.error) return { issued: 0, used: 0, failed: true };
  return { issued: issued.count ?? 0, used: used.count ?? 0, failed: false };
}

export async function loadReorderStats(supabase: Supabase): Promise<{ sent30: number; optOuts: number; failed: boolean }> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [sent, outs] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("reorder_reminded_at", since),
    supabase.from("marketing_optouts").select("email", { count: "exact", head: true }),
  ]);
  if (sent.error) return { sent30: 0, optOuts: 0, failed: true };
  return { sent30: sent.count ?? 0, optOuts: outs.count ?? 0, failed: false };
}

/* ── Products, for the attribute editors and the welcome gift picker ───── */

export type AttributeProduct = {
  id: number;
  brand: string;
  name: string;
  sizes: string[];
  published: boolean;
  strength: string | null;
  longevity: string | null;
  seasons: string[];
  occasions: string[];
  inspiredBy: string | null;
  notes: string[];
};

export async function loadAttributeProducts(supabase: Supabase): Promise<{ products: AttributeProduct[]; ready: boolean }> {
  const { data, error } = await supabase
    .from("products")
    .select("id, brand, name, sizes, is_published, strength, longevity, seasons, occasions, inspired_by, top_notes, heart_notes, base_notes")
    .order("brand")
    .order("name")
    .limit(1000);
  if (error) {
    // Before migration 70 the new columns don't exist: offer the names alone.
    const { data: plain } = await supabase.from("products").select("id, brand, name, sizes, is_published").order("brand").order("name").limit(1000);
    return {
      ready: false,
      products: ((plain ?? []) as Record<string, unknown>[]).map((p) => toAttributeProduct(p)),
    };
  }
  return { ready: true, products: ((data ?? []) as Record<string, unknown>[]).map((p) => toAttributeProduct(p)) };
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

function toAttributeProduct(p: Record<string, unknown>): AttributeProduct {
  return {
    id: num(p.id),
    brand: String(p.brand ?? ""),
    name: String(p.name ?? "").replace(/_/g, " "),
    sizes: list(p.sizes),
    published: p.is_published !== false,
    strength: typeof p.strength === "string" ? p.strength : null,
    longevity: typeof p.longevity === "string" ? p.longevity : null,
    seasons: list(p.seasons),
    occasions: list(p.occasions),
    inspiredBy: typeof p.inspired_by === "string" ? p.inspired_by : null,
    notes: [...list(p.top_notes), ...list(p.heart_notes), ...list(p.base_notes)],
  };
}

/* ── Popularity preview ─────────────────────────────────────────────────── */

export type PopularityLine = { productId: number; name: string; brand: string; recent: number | null; family: string | null; rank: number | null };

export async function loadPopularityPreview(supabase: Supabase): Promise<PopularityLine[]> {
  const { data: products } = await supabase.from("products").select("id, name, brand").limit(200);
  const rows = (products ?? []) as { id: number; name: string; brand: string }[];
  if (rows.length === 0) return [];
  const { data, error } = await supabase.rpc("demand_signals", { p_product_ids: rows.map((p) => p.id) });
  if (error || !Array.isArray(data)) return [];
  const byId = new Map(rows.map((p) => [p.id, p]));
  return (data as Record<string, unknown>[])
    .filter((s) => s.recent_orders != null || s.family != null)
    .map((s) => {
      const p = byId.get(num(s.product_id));
      return {
        productId: num(s.product_id),
        name: String(p?.name ?? "").replace(/_/g, " "),
        brand: String(p?.brand ?? ""),
        recent: s.recent_orders == null ? null : num(s.recent_orders),
        family: typeof s.family === "string" ? s.family : null,
        rank: s.family_rank == null ? null : num(s.family_rank),
      };
    })
    .sort((a, b) => (b.recent ?? 0) - (a.recent ?? 0))
    .slice(0, 20);
}

/** Recent problems inside the triggers (an order cancel that couldn't give credit back, say). */
export async function loadGrowthProblems(supabase: Supabase): Promise<{ kind: string; orderId: string | null; detail: string; at: string }[]> {
  const { data, error } = await supabase.from("growth_events").select("kind, order_id, detail, created_at").order("created_at", { ascending: false }).limit(10);
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((e) => ({
    kind: String(e.kind ?? ""),
    orderId: (e.order_id as string | null) ?? null,
    detail: String(e.detail ?? ""),
    at: String(e.created_at ?? ""),
  }));
}

/** Which extra panel a feature page shows under its settings. */
export const FEATURE_PANELS: Partial<Record<FeatureKey, string>> = {
  gift_cards: "gift_cards",
  loyalty: "loyalty",
  referrals: "referrals",
  back_in_stock: "back_in_stock",
  welcome_offer: "welcome_offer",
  cart_reminders: "cart_reminders",
  reorder_reminders: "reorder_reminders",
  shop_filters: "shop_filters",
  inspired_by: "inspired_by",
  demand_signals: "demand_signals",
};
