import "server-only";
import { createServerSupabase, isSupabaseConfigured } from "./supabase-server";
import type { OfferCard } from "./offers";

/**
 * The live offers as the shop shows them (live_offer_cards, migration 69).
 * With a product id, only those involving that perfume. An empty list when
 * the database can't answer (or migration 69 hasn't run): the page simply
 * shows no offers.
 */
export async function loadOfferCards(productId: number | null = null): Promise<OfferCard[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await createServerSupabase().rpc("live_offer_cards", { p_product_id: productId });
    if (error || !Array.isArray(data)) return [];
    return (data as OfferCard[]).map(normalise);
  } catch {
    return [];
  }
}

function normalise(card: OfferCard): OfferCard {
  const n = (v: unknown) => Number(v) || 0;
  return {
    ...card,
    tiers: (card.tiers ?? []).map((t) => ({ min_qty: n(t.min_qty), percent: n(t.percent), free_delivery: Boolean(t.free_delivery) })),
    min_subtotal: n(card.min_subtotal),
    addon_price: card.addon_price == null ? null : n(card.addon_price),
    bundle: card.bundle
      ? {
          base: n(card.bundle.base),
          price: n(card.bundle.price),
          lines: (card.bundle.lines ?? []).map((l) => ({ ...l, price: n(l.price), qty: n(l.qty) || 1, name: l.name ?? "" })),
        }
      : null,
    product: card.product ? { ...card.product, price: n(card.product.price) } : null,
  };
}
