import { z } from "zod";

/**
 * A collection as the admin edits it, shared by the form and the routes.
 * "Automatic" collections follow one tag: every product carrying it belongs,
 * and the database keeps that true as products change (migration 14).
 */

export const COVER_PRESETS = [
  { value: "/campaign-gold.png", label: "Gold" },
  { value: "/campaign-purple.png", label: "Purple" },
  { value: "/campaign-red-black.png", label: "Red and black" },
  { value: "/campaign-silver.png", label: "Silver" },
  { value: "/campaign-blue.png", label: "Blue" },
] as const;

export const DEFAULT_COVER = "/campaign-gold.png";

const cover = z
  .string()
  .trim()
  .max(512, { error: "That picture link is too long." })
  .refine((v) => v === "" || /^https:\/\/\S+$/.test(v) || /^\/[A-Za-z0-9._\-/]+$/.test(v), {
    error: "Use an uploaded picture or one of the house pictures.",
  });

export const collectionSchema = z
  .object({
    title: z.string().trim().min(1, { error: "Give the collection a name." }).max(120, { error: "Keep the name under 120 characters." }),
    description: z.string().trim().max(1000, { error: "Keep the description under 1,000 characters." }),
    cover_image: cover,
    type: z.enum(["manual", "automated"]),
    tag: z.string().trim().toLowerCase().max(50, { error: "Keep the tag under 50 characters." }),
  })
  .refine((c) => c.type === "manual" || c.tag.length > 0, {
    error: "Choose the tag that puts products in this collection.",
    path: ["tag"],
  });

export type CollectionInput = z.infer<typeof collectionSchema>;

/** "Royal Oud Vault" → "royal-oud-vault": the collection's address in the shop. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** The tag an automatic collection follows (the form only ever writes one rule). */
export function ruleTag(rules: unknown): string {
  if (!Array.isArray(rules)) return "";
  const first = rules[0] as { value?: unknown } | undefined;
  return typeof first?.value === "string" ? first.value : "";
}

export function rulesFor(input: CollectionInput) {
  return input.type === "automated" ? [{ field: "tag", relation: "equals", value: input.tag }] : [];
}

/** Collection ids are short slugs; anything else in the URL is not one of ours. */
export function collectionIdFrom(raw: string): string | null {
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return id.length > 0 && id.length <= 100 && !/[/\\\s]/.test(id) ? id : null;
}
