/**
 * Delivery rules — the single source of truth for the storefront.
 *
 * These MUST stay in step with `place_order()` in the database, which is the
 * authority: the server recomputes the shipping fee on every order and the
 * customer is charged whatever it decides. The values here exist so the shopper
 * is shown the same figure before they commit.
 *
 * Changing the threshold means changing it in BOTH places — here and in the
 * newest migration that redefines `place_order`.
 */

export const FREE_SHIPPING_THRESHOLD_AED = 300;
export const SHIPPING_FEE_AED = 25;

/**
 * The delivery fee for a subtotal, in AED.
 *
 * The comparison is `< threshold`, matching the database exactly. An earlier
 * version used `> threshold` on the client, so a cart of precisely the
 * threshold amount was quoted a fee the server did not charge.
 */
export function shippingFeeForSubtotal(subtotalAed: number): number {
  return subtotalAed < FREE_SHIPPING_THRESHOLD_AED ? SHIPPING_FEE_AED : 0;
}

/** How far a shopper is from free delivery. Zero once they qualify. */
export function amountToFreeShipping(subtotalAed: number): number {
  return Math.max(0, FREE_SHIPPING_THRESHOLD_AED - subtotalAed);
}

/**
 * The one sentence every surface should use to describe the offer, so the
 * announcement bar, cart, product page and checkout can never drift apart
 * again. Free delivery is conditional — never describe it as unconditional.
 */
export const FREE_SHIPPING_NOTE = `Complimentary delivery on orders over AED ${FREE_SHIPPING_THRESHOLD_AED}`;
