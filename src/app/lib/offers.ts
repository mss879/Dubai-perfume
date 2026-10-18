/**
 * Offers (migration 69) as the shop shows them. Plain module: the product page,
 * the offers page, the bag and checkout all import these shapes and words.
 * The database prices everything (bag_quote / place_order); nothing here does
 * arithmetic that decides what a shopper pays.
 */

export type OfferTier = { min_qty: number; percent: number; free_delivery?: boolean };

export type OfferCardProduct = {
  product_id: number;
  name: string;
  brand: string;
  price: number;
  image_url: string | null;
  size: string;
  qty?: number;
  in_stock?: boolean;
};

/** One live offer, as live_offer_cards() returns it. */
export type OfferCard = {
  id: number;
  kind: "tiered" | "bundle" | "addon" | "gift";
  template: string;
  title: string;
  description: string | null;
  ends_at: string | null;
  free_delivery: boolean;
  gift_wrap: boolean;
  scope: string;
  scope_label: string | null;
  count_by: "items" | "same_product";
  tiers: OfferTier[];
  bundle: { base: number; price: number; lines: OfferCardProduct[] } | null;
  product: OfferCardProduct | null;
  addon_price: number | null;
  min_subtotal: number;
};

export type AppliedOffer = {
  offer_id: number;
  kind: "tiered" | "bundle" | "addon";
  title: string;
  saving: number;
  units: number;
  sets?: number;
  free_delivery?: boolean;
  gift_wrap?: boolean;
};

export type OfferNudge =
  | { kind: "tiered"; offer_id: number; title: string; missing_units: number; percent: number; free_delivery: boolean; scope_label: string | null }
  | { kind: "same_product"; offer_id: number; title: string; product_id: number; size: string; missing_units: number; percent: number; free_delivery: boolean }
  | { kind: "gift"; offer_id: number; title: string; missing_aed: number; gift_name: string; gift_brand: string | null };

export type AddonOffer = {
  offer_id: number;
  title: string;
  description: string | null;
  product_id: number;
  size: string;
  name: string;
  brand: string;
  image_url: string | null;
  price: number;
  addon_price: number;
};

export type GiftLine = {
  offer_id: number;
  title: string;
  product_id: number;
  size: string;
  name: string;
  brand: string;
  image_url: string | null;
  value: number;
  threshold: number;
};

export type FreeDeliveryPick = { product_id: number; name: string; brand: string; price: number; image_url: string | null; size: string };

/** The bag priced by the database: what the shopper will be charged. */
export type BagQuote = {
  subtotal: number;
  offer_saving: number;
  offer_delivery: number;
  applied: AppliedOffer[];
  gift: GiftLine | null;
  nudges: OfferNudge[];
  addons: AddonOffer[];
  code: {
    valid: boolean;
    reason?: string | null;
    discount_amount?: number | null;
    minimum?: number | null;
    applies_label?: string;
    /** Migration 70: a code whose reward is a free perfume (the welcome offer). */
    gift?: { product_id: number; name: string; brand: string | null; size: string; image_url: string | null; value: number } | null;
  } | null;
  code_goods: number;
  code_delivery: number;
  shipping_fee: number;
  total: number;
  to_free_delivery: number;
  free_delivery_picks: FreeDeliveryPick[];
};

/**
 * Migration 70: the checkout's figures (checkout_quote): the bag as above, plus
 * gift wrap, loyalty points and a gift card. place_order() charges the same.
 */
export type CheckoutQuote = BagQuote & {
  gift_wrap_fee: number;
  gift_wrap_included: boolean;
  /** Present for a signed-in shopper while loyalty points are on. */
  points: { available: number; usable: number; usable_value: number; used: number; value: number; min_redeem: number } | null;
  /** Present when a gift card code was sent. */
  gift_card: { status: "ok" | "invalid" | "expired" | "empty"; amount: number; balance: number | null; balance_after: number | null } | null;
  total_before_credits: number;
};

export const titleCaseBrand = (brand: string | null | undefined) =>
  (brand ?? "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** "2+: 10% off + free delivery · 3+: 15% off" for a buy-more offer. */
export function tierLine(card: Pick<OfferCard, "tiers" | "count_by">): string {
  return [...(card.tiers ?? [])]
    .sort((a, b) => a.min_qty - b.min_qty)
    .map((t) => {
      const parts = [t.percent > 0 ? `${pct(t.percent)} off` : null, t.free_delivery ? "free delivery" : null].filter(Boolean);
      return card.count_by === "same_product" ? `${t.min_qty} of the same: ${parts.join(" + ")}` : `${t.min_qty}+: ${parts.join(" + ")}`;
    })
    .join(" · ");
}

/** What counts towards a buy-more offer, in a few words. */
export function scopeWords(card: Pick<OfferCard, "scope" | "scope_label">): string {
  if (card.scope === "all" || !card.scope_label) return "any perfumes";
  if (card.scope === "brands") return `${titleCaseBrand(card.scope_label)} perfumes`;
  if (card.scope === "collections") return `perfumes from ${card.scope_label}`;
  return card.scope_label;
}

/** A nudge in one sentence. `format` renders an AED amount in the shopper's currency. */
export function nudgeText(nudge: OfferNudge, format: (aed: number) => string): string {
  switch (nudge.kind) {
    case "tiered": {
      const what = nudge.scope_label ? `more ${titleCaseBrand(nudge.scope_label)}` : "more";
      const reward = [nudge.percent > 0 ? `save ${pct(nudge.percent)}` : null, nudge.free_delivery ? "get free delivery" : null]
        .filter(Boolean)
        .join(" and ");
      return `Add ${nudge.missing_units} ${what} ${nudge.missing_units === 1 ? "perfume" : "perfumes"} to ${reward}.`;
    }
    case "same_product":
      return `Add a second bottle of the same perfume and save ${pct(nudge.percent)} on both.`;
    case "gift":
      return `Add ${format(nudge.missing_aed)} more and receive ${nudge.gift_name} as a gift.`;
  }
}

/** Days, hours and minutes left, for a countdown. Null once it has ended. */
export function timeLeft(endsAt: string | null, now: number): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"} ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} min`;
  return `${Math.max(1, minutes)} min`;
}
