/**
 * What a shopper is told when a discount code is refused.
 *
 * validate_discount returns a `reason` and, for an unmet minimum, the `minimum`
 * itself. The checkout endpoint used to read `result.message`, which the
 * function has never returned — so every refusal collapsed to one generic line
 * and the shopper was never told they were AED 40 short of qualifying.
 *
 * Only `minimum_not_met` says anything specific, and it does confirm the code
 * exists. That is the deliberate trade: it is the one refusal a shopper can
 * actually act on. Every other case returns the same sentence, so the endpoint
 * stays a poor oracle for anyone guessing at codes.
 */

export const DISCOUNT_REFUSED = "This code is not valid.";

export function discountRefusalMessage(
  reason: string | null | undefined,
  minimum: number | null | undefined,
  appliesLabel?: string | null
): string {
  if (reason === "minimum_not_met" && typeof minimum === "number" && minimum > 0) {
    return `This code applies to orders of AED ${minimum.toFixed(2)} or more.`;
  }
  // A code for chosen perfumes or a collection, with none of them in the bag.
  if (reason === "not_applicable") {
    return appliesLabel ? `This code applies to ${appliesLabel} only.` : "This code doesn't apply to the items in your bag.";
  }
  if (reason === "delivery_already_free") {
    return "Delivery is already free on this order, so this code has nothing to take off.";
  }
  // Migration 69: every item the code would discount is already in a set or offer.
  if (reason === "covered_by_offers") {
    return "Your bag's offers already cover these perfumes, so this code has nothing more to take off.";
  }
  // Migration 70: a welcome code whose free perfume has run out.
  if (reason === "gift_unavailable") {
    return "The perfume this code adds is out of stock just now.";
  }
  return DISCOUNT_REFUSED;
}
