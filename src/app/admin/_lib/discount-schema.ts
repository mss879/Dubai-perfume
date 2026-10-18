import { z } from "zod";
import { FREE_SHIPPING_THRESHOLD_AED, SHIPPING_FEE_AED } from "../../lib/shipping";

/** At most two decimal places (fils), so nothing is rounded silently on save. */
const toFils = (v: number) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

/**
 * A new discount code, shared by the form and the route. The expiry and the
 * usage cap are real limits: checkout refuses a code past its date or at its
 * cap (migration 44), and a concierge-only code must have a cap (migration 55).
 */

export const discountSchema = z
  .object({
    code: z
      .string()
      .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
      .pipe(
        z
          .string()
          .min(3, { error: "Use at least 3 letters or numbers." })
          .max(40, { error: "Keep the code under 40 characters." })
          .regex(/^[A-Z0-9_-]+$/, { error: "Use only letters, numbers, - and _." })
      ),
    type: z.enum(["percentage", "fixed_amount"]),
    value: z.number({ error: "Enter the discount." }).positive({ error: "Enter a discount above zero." }).max(100000),
    min_requirement: z.number({ error: "Enter a number." }).min(0, { error: "Can't be negative." }).max(1000000),
    ends_on: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date." })]),
    usage_limit: z.number().int({ error: "Use a whole number." }).min(1, { error: "At least 1." }).max(1000000).nullable(),
    concierge_only: z.boolean(),
    // Migration 69: a whole-order code also counts items already in an offer.
    combines_with_offers: z.boolean().default(false),
    // What the code covers (migration 67). Existing codes are "order".
    applies_to: z.enum(["order", "products", "collections", "delivery"]),
    product_ids: z.array(z.number().int().positive()).max(500),
    collection_ids: z.array(z.string().min(1).max(100)).max(100),
  })
  .refine((d) => d.type !== "percentage" || d.value <= 100, { error: "A percentage can't be more than 100.", path: ["value"] })
  .refine((d) => toFils(d.value), { error: "Use at most two decimal places.", path: ["value"] })
  .refine((d) => toFils(d.min_requirement), { error: "Use at most two decimal places.", path: ["min_requirement"] })
  // Delivery is AED 25 and free from AED 300, so a delivery code can only ever
  // apply below that, and can't take off more than the fee.
  .refine((d) => d.applies_to !== "delivery" || d.min_requirement < FREE_SHIPPING_THRESHOLD_AED, {
    error: `Orders of AED ${FREE_SHIPPING_THRESHOLD_AED} or more already have free delivery, so this code would never apply. Lower the minimum.`,
    path: ["min_requirement"],
  })
  .refine((d) => d.applies_to !== "delivery" || d.type !== "fixed_amount" || d.value <= SHIPPING_FEE_AED, {
    error: `Delivery costs AED ${SHIPPING_FEE_AED}. Enter AED ${SHIPPING_FEE_AED} or less, or choose free delivery.`,
    path: ["value"],
  })
  .refine((d) => !d.concierge_only || d.usage_limit !== null, {
    error: "A code only the Agent offers needs a usage limit.",
    path: ["usage_limit"],
  })
  .refine((d) => d.applies_to !== "products" || d.product_ids.length > 0, {
    error: "Choose at least one perfume.",
    path: ["product_ids"],
  })
  .refine((d) => d.applies_to !== "collections" || d.collection_ids.length > 0, {
    error: "Choose at least one collection.",
    path: ["collection_ids"],
  });

export const APPLIES_TO_LABELS = {
  order: "Whole order",
  products: "Specific perfumes",
  collections: "Collections",
  delivery: "Delivery",
} as const;

export type DiscountInput = z.infer<typeof discountSchema>;

/** The end of that day in Dubai (UTC+4 all year), when the code stops working. */
export function endOfDubaiDay(date: string): string {
  return new Date(`${date}T23:59:59+04:00`).toISOString();
}
