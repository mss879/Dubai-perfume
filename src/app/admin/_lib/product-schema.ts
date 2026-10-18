import { z } from "zod";

/**
 * One description of a product, shared by the form (instant, friendly errors)
 * and the server route (the real check, before the database checks again in
 * admin_save_product, migration 64).
 */

export const SCENT_FAMILIES = ["Woody & Oud", "Floral & Sweet", "Fresh & Aquatic", "Amber & Oriental"] as const;
export const SIZE_PRESETS = ["30ml", "50ml", "75ml", "90ml", "100ml", "250ml"] as const;
export const MAX_IMAGES = 5;

/** Money in AED: positive amounts with at most two decimals (fils). */
const money = (label: string) =>
  z
    .number({ error: `Enter the ${label}` })
    .min(0, `The ${label} can't be negative`)
    .max(1_000_000, `The ${label} is too large`)
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, `Use at most two decimals for the ${label}`);

const text = (max: number) => z.string().trim().max(max);
const list = (maxItems: number, maxLength: number) => z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);

const imageUrl = z
  .string()
  .max(512)
  .refine((url) => url.startsWith("https://") || (url.startsWith("/") && !url.startsWith("//")), "Each photo must be an uploaded image");

export const productSchema = z
  .object({
    id: z.number().int().positive().optional(),
    brand: z.string().trim().min(1, "Enter the brand").max(255),
    name: z.string().trim().min(1, "Enter the perfume's name").max(255),
    olfactory_group: z.string().trim().min(1, "Choose a scent family").max(255),
    price: money("price").refine((v) => v > 0, "The price must be above zero"),
    compare_at_price: money("“was” price").nullable(),
    cost_price: money("cost"),
    tagline: text(255),
    description: text(5000),
    sizes: list(12, 50).min(1, "Add at least one size"),
    images: z.array(imageUrl).max(MAX_IMAGES, `Up to ${MAX_IMAGES} photos`),
    tags: list(40, 50),
    top_notes: list(30, 80),
    heart_notes: list(30, 80),
    base_notes: list(30, 80),
    is_new: z.boolean(),
    is_bestseller: z.boolean(),
    is_featured_large: z.boolean(),
    is_published: z.boolean(),
    /** Starting counts for sizes that are not tracked yet, and warning levels. */
    stock: z.record(
      z.string(),
      z.object({
        initial: z.number().int().min(0, "Stock can't be negative").max(100_000).optional(),
        threshold: z.number().int().min(0).max(100_000).optional(),
      })
    ),
    collections: z.array(z.string().max(100)).max(100),
  })
  .refine((p) => p.compare_at_price === null || p.compare_at_price > p.price, {
    message: "The “was” price must be higher than the price, or empty",
    path: ["compare_at_price"],
  });

export type ProductInput = z.infer<typeof productSchema>;

/** The database's refusal codes (migration 64), in plain words. */
export const SAVE_ERRORS: Record<string, string> = {
  missing_brand: "Enter the brand.",
  missing_name: "Enter the perfume's name.",
  missing_olfactory_group: "Choose a scent family.",
  missing_sizes: "Add at least one size.",
  invalid_price: "Check the price.",
  invalid_compare_at_price: "Check the “was” price.",
  invalid_cost_price: "Check the cost.",
  invalid_images: "One of the photos isn't an uploaded image.",
  too_many_images: "Up to 5 photos.",
  invalid_stock: "Check the stock counts.",
  invalid_initial: "Check the starting stock counts.",
  invalid_threshold: "Check the low-stock levels.",
  product_not_found: "This product no longer exists.",
};
