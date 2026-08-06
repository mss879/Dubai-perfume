import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FREE_SHIPPING_THRESHOLD_AED,
  amountToFreeShipping,
  shippingFeeForSubtotal,
} from "../shipping";

/**
 * What the concierge is allowed to know about offers.
 *
 * Everything here reads through migration 55's list_live_offers and the
 * existing validate_discount, so the agent can never name a code that checkout
 * would then refuse — the single worst thing a shop assistant can do.
 *
 * The split between public and exclusive is enforced by what this module
 * RETURNS, not by asking the model nicely. A public code comes back with its
 * name and its minimum basket and nothing else; only a code the owner marked
 * concierge_only comes back priced. A model cannot volunteer arithmetic it was
 * never given.
 */

export type LiveOffer = {
  code: string;
  title: string;
  kind: "percentage" | "fixed";
  value: number;
  minimumAed: number;
  endsOn: string | null;
  exclusive: boolean;
};

type OfferRow = {
  code: string;
  title: string;
  kind: string;
  value: number | string;
  min_requirement: number | string;
  ends_at: string | null;
  exclusive: boolean;
};

/** Live codes, exclusive ones only if this session has earned them. */
export async function fetchLiveOffers(
  supabase: SupabaseClient,
  sessionId: string
): Promise<LiveOffer[]> {
  try {
    const { data, error } = await supabase.rpc("list_live_offers", {
      p_session_id: sessionId,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as OfferRow[]).map((r) => ({
      code: String(r.code),
      title: String(r.title || ""),
      kind: r.kind === "percentage" ? "percentage" : "fixed",
      value: Number(r.value) || 0,
      minimumAed: Number(r.min_requirement) || 0,
      endsOn: r.ends_at ? String(r.ends_at).slice(0, 10) : null,
      exclusive: Boolean(r.exclusive),
    }));
  } catch {
    // The concierge must still be able to talk about perfume.
    return [];
  }
}

export type PricedCode =
  | { valid: true; code: string; discountAed: number }
  | { valid: false; reason: "invalid" | "expired" | "exhausted" | "minimum_not_met"; minimumAed: number | null };

/** Prices one code against a subtotal, through the same function checkout uses. */
export async function priceCode(
  supabase: SupabaseClient,
  code: string,
  subtotalAed: number
): Promise<PricedCode> {
  try {
    const { data, error } = await supabase.rpc("validate_discount", {
      p_code: code,
      p_subtotal: subtotalAed,
    });
    if (error || !data || typeof data !== "object") {
      return { valid: false, reason: "invalid", minimumAed: null };
    }
    const result = data as { valid?: boolean; discount_amount?: number; reason?: string; minimum?: number };
    if (result.valid) {
      return { valid: true, code: code.toUpperCase(), discountAed: Number(result.discount_amount) || 0 };
    }
    const reason =
      result.reason === "expired" || result.reason === "exhausted" || result.reason === "minimum_not_met"
        ? result.reason
        : "invalid";
    return { valid: false, reason, minimumAed: result.minimum != null ? Number(result.minimum) : null };
  } catch {
    return { valid: false, reason: "invalid", minimumAed: null };
  }
}

export type BagWithOffer = {
  subtotalAed: number;
  discountAed: number;
  deliveryAed: number;
  totalAed: number;
  toFreeDeliveryAed: number;
  /** True when the discount did NOT cost them free delivery. Worth saying. */
  deliveryUnaffected: boolean;
};

/**
 * The bag as checkout would price it.
 *
 * The delivery fee is computed on the subtotal BEFORE the discount, because
 * that is exactly what place_order does (44_launch_hardening.sql: the shipping
 * branch runs above the discount block, on v_subtotal). Getting this backwards
 * would have the agent warn someone that a code costs them free delivery when
 * it does not — a small lie that loses a sale for no reason.
 */
export function bagWithOffer(subtotalAed: number, discountAed: number): BagWithOffer {
  const subtotal = Math.max(0, subtotalAed);
  const discount = Math.min(Math.max(0, discountAed), subtotal);
  const delivery = shippingFeeForSubtotal(subtotal);
  return {
    subtotalAed: subtotal,
    discountAed: discount,
    deliveryAed: delivery,
    totalAed: Math.max(0, subtotal - discount) + delivery,
    toFreeDeliveryAed: amountToFreeShipping(subtotal),
    deliveryUnaffected: subtotal >= FREE_SHIPPING_THRESHOLD_AED,
  };
}
