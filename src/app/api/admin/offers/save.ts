import "server-only";
import { reply } from "../../../lib/admin-route";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { OFFER_TEMPLATES, offerRow, offerSchema, type OfferInput } from "../../../admin/_lib/offer-schema";

/**
 * Reads and checks an offer from the admin form: the schema, then against the
 * catalogue (the perfumes exist, sizes are real, a set is cheaper than its
 * perfumes, an add-on is cheaper than its shop price). Returns the table row.
 */
export async function readOffer(
  body: unknown
): Promise<{ ok: true; row: ReturnType<typeof offerRow> } | { ok: false; response: ReturnType<typeof reply> }> {
  const result = offerSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, response: reply(422, { error: issue?.message ?? "Check the offer's details.", field: issue?.path?.[0] }) };
  }
  const input = result.data;
  const problem = await checkAgainstCatalogue(input);
  if (problem) return { ok: false, response: reply(422, problem) };
  return { ok: true, row: offerRow(input) };
}

async function checkAgainstCatalogue(input: OfferInput): Promise<{ error: string; field: string } | null> {
  const kind = OFFER_TEMPLATES[input.template].kind;
  const ids = [
    ...input.bundle_lines.map((l) => l.product_id),
    ...(input.product_id && (kind === "addon" || kind === "gift") ? [input.product_id] : []),
  ];
  if (ids.length === 0) return null;

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.from("products").select("id, name, price, sizes").in("id", [...new Set(ids)]);
  if (error) return { error: "The perfumes couldn't be checked. Try again.", field: "bundle_lines" };
  const byId = new Map(
    ((data ?? []) as { id: number; name: string; price: number | string; sizes: string[] | null }[]).map((p) => [p.id, p])
  );
  const sizeOk = (id: number, size: string) => {
    const sizes = byId.get(id)?.sizes ?? [];
    return !size || sizes.length === 0 || sizes.includes(size);
  };

  if (kind === "bundle") {
    let base = 0;
    for (const line of input.bundle_lines) {
      const product = byId.get(line.product_id);
      if (!product) return { error: "A perfume in the set no longer exists.", field: "bundle_lines" };
      if (!sizeOk(line.product_id, line.size)) return { error: `${product.name.replace(/_/g, " ")} doesn't come in ${line.size}.`, field: "bundle_lines" };
      base += (Number(product.price) || 0) * line.qty;
    }
    if (input.price_mode === "price" && input.bundle_price !== null && input.bundle_price >= base) {
      return {
        error: `The set price must be below the perfumes' total of AED ${base.toFixed(2)}, or there's no saving.`,
        field: "bundle_price",
      };
    }
  }

  if ((kind === "addon" || kind === "gift") && input.product_id) {
    const product = byId.get(input.product_id);
    if (!product) return { error: "That perfume no longer exists.", field: "product_id" };
    if (!sizeOk(input.product_id, input.product_size)) {
      return { error: `${product.name.replace(/_/g, " ")} doesn't come in ${input.product_size}.`, field: "product_size" };
    }
    if (kind === "addon" && input.addon_price !== null && input.addon_price >= (Number(product.price) || 0)) {
      return {
        error: `The add-on price must be below its shop price of AED ${(Number(product.price) || 0).toFixed(2)}.`,
        field: "addon_price",
      };
    }
  }
  return null;
}

/** "Migration 69 hasn't run" from a write's error. */
export function offersTableMissing(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204"));
}

export const MIGRATION_69 =
  "Offers need database migration 69 (69_offers.sql). Run it in the Supabase SQL editor, then try again.";
