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
  minimum: number | null | undefined
): string {
  if (reason === "minimum_not_met" && typeof minimum === "number" && minimum > 0) {
    return `This code applies to orders of AED ${minimum.toFixed(2)} or more.`;
  }
  return DISCOUNT_REFUSED;
}
