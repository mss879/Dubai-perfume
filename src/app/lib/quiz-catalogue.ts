import "server-only";
import { createServerSupabase, isSupabaseConfigured } from "./supabase-server";
import { toArray } from "./catalogue";
import { readComposition, subStyleFromDescription } from "./scent-lexicon";
import type { ScoredProduct } from "./quiz";

/**
 * The fragrance finder's catalogue, with each composition's scent profile
 * derived from the 260-note lexicon in lib/scent-lexicon.ts.
 *
 * Lives here rather than in the /discover page because two callers need it and
 * they must agree: the page (which hands the vectors to the browser so scoring
 * resolves on tap) and /api/quiz (which re-derives the recommendation server-side
 * so the results email never repeats prose the request body supplied).
 *
 * server-only on purpose. The point of deriving profiles here is that the
 * lexicon stays out of the client bundle; importing this from a client
 * component would drag it back in.
 */

/* select("*") on purpose — the migration-31 editorial columns must never be
   named in a column list. Same rule the shop page follows. */
interface DbProductRow {
  id: number;
  brand: string;
  name: string;
  price: number | string;
  sizes?: string[] | null;
  image_url?: string | null;
  description?: string | null;
  tagline?: string | null;
  olfactory_group?: string | null;
  tags?: string[] | null;
  top_notes?: string[] | null;
  heart_notes?: string[] | null;
  base_notes?: string[] | null;
  is_bestseller?: boolean | null;
}

/** The gender a product's tags declare. Same reading the shop filters use. */
function genderOf(tags: string[]): "men" | "women" | "unisex" {
  const t = tags.map((v) => v.toLowerCase());
  if (t.some((v) => v === "men" || v === "man" || v === "for men")) return "men";
  if (t.some((v) => v === "women" || v === "woman" || v === "for women")) return "women";
  return "unisex";
}

/**
 * The four `olfactory_group` values are too coarse to recommend on, but the
 * descriptions carry a fourteen-value reading ("resinous amber", "oud-led
 * woody", …). That is what the wheel position comes from; the group is only a
 * fallback for a product whose description was rewritten by hand.
 */
const GROUP_FALLBACK: Record<string, string> = {
  "Fresh & Aquatic": "aromatic-fresh",
  "Floral & Sweet": "floral-gourmand",
  "Woody & Oud": "woody",
  "Amber & Oriental": "resinous amber",
};

function mapProduct(p: DbProductRow): ScoredProduct {
  const pyramid = {
    top: toArray(p.top_notes),
    heart: toArray(p.heart_notes),
    base: toArray(p.base_notes),
  };

  const subStyle =
    subStyleFromDescription(p.description) || GROUP_FALLBACK[p.olfactory_group ?? ""] || "";

  const { profile, axisNotes } = readComposition(pyramid, subStyle);
  const sizes = toArray(p.sizes);

  return {
    id: p.id,
    brand: p.brand,
    name: p.name,
    price: Number(p.price) || 0,
    image: p.image_url || "",
    sizes: sizes.length > 0 ? sizes : ["100ml"],
    gender: genderOf(toArray(p.tags)),
    tagline: p.tagline || "",
    topNotes: pyramid.top,
    heartNotes: pyramid.heart,
    baseNotes: pyramid.base,
    profile,
    axisNotes,
    isBestseller: Boolean(p.is_bestseller),
  };
}

export async function fetchQuizCatalogue(): Promise<ScoredProduct[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.from("products").select("*");
    if (error) {
      console.error("Fragrance finder catalogue load failed:", error.message);
      return [];
    }
    if (!Array.isArray(data)) return [];
    // A composition with no notes recorded cannot be read, and guessing at one
    // is worse than leaving it out of the finder.
    return (data as DbProductRow[])
      .filter(
        (p) =>
          toArray(p.top_notes).length + toArray(p.heart_notes).length + toArray(p.base_notes).length >
          0
      )
      .map(mapProduct);
  } catch (err) {
    console.error("Fragrance finder Supabase load error:", err);
    return [];
  }
}
