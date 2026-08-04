/**
 * Shared catalogue helpers. These were previously copy-pasted across the
 * catalogue pages (shop, collections, collection/[id], product/[id], homepage,
 * header); this module is the single source going forward. Plain module — no
 * "use client" — so both server components and client islands can import it.
 */

/**
 * Columns that actually exist on public.products. Four divergent copies of
 * this list used to live in the catalogue pages; this superset replaces them
 * all so no page can silently miss a column it renders.
 */
export const PRODUCT_FIELDS =
  "id, brand, name, price, sizes, image_url, image_urls, description, tagline, olfactory_group, tags, top_notes, heart_notes, base_notes, is_new, is_bestseller, is_featured_large";

/** Normalises a Postgres array column that may arrive as null or with blank entries. */
export const toArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];

/* Title-case a stored brand name ("AL HARAMAIN" → "Al Haramain") */
export const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, prefix: string, letter: string) => prefix + letter.toUpperCase());
