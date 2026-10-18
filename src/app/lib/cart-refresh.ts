"use client";

import { getBrowserSupabase } from "./supabase-browser";
import { readCart, writeCart, type CartLine } from "./cart";

/**
 * Brings the saved bag up to date with the catalogue.
 *
 * A bag lives in the browser for weeks, with each line's price frozen at the
 * moment it was added. The order is always priced by the database, so a stale
 * line only misleads: checkout would show one total and charge another. This
 * re-reads each perfume and rewrites the bag with today's name, price and
 * photograph, and drops lines the shop no longer sells (hidden, removed, or a
 * size that is no longer offered).
 *
 * Says what changed, for a one-line note; null when nothing did. Any failure
 * leaves the bag exactly as it was.
 */
export async function refreshCartFromCatalogue(): Promise<string | null> {
  const lines = readCart();
  if (lines.length === 0) return null;
  const ids = [...new Set(lines.map((l) => l.product.id))].filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return null;

  try {
    // The shop's public read only returns perfumes on sale (hidden ones are
    // filtered out by the database), so a missing row means "no longer sold".
    const { data, error } = await getBrowserSupabase()
      .from("products")
      .select("id, brand, name, price, image_url, sizes")
      .in("id", ids);
    if (error || !data) return null;

    const byId = new Map(
      (data as { id: number; brand: string | null; name: string; price: number | string; image_url: string | null; sizes: string[] | null }[]).map(
        (p) => [p.id, p]
      )
    );

    let repriced = false;
    const removed: string[] = [];
    const next: CartLine[] = [];
    for (const line of lines) {
      const product = byId.get(line.product.id);
      const sizes = Array.isArray(product?.sizes) ? product.sizes.filter(Boolean) : [];
      if (!product || (sizes.length > 0 && !sizes.includes(line.selectedSize))) {
        removed.push(line.product.name || "A perfume");
        continue;
      }
      const price = Number(product.price) || 0;
      if (price !== line.product.price) repriced = true;
      next.push({
        ...line,
        product: {
          id: product.id,
          brand: String(product.brand ?? ""),
          name: product.name,
          price,
          image_url: product.image_url || line.product.image_url,
        },
      });
    }

    // Same order, so an unchanged bag serialises identically and is left alone.
    if (removed.length === 0 && JSON.stringify(next) === JSON.stringify(lines)) return null;
    writeCart(next);

    if (removed.length > 0) {
      const names = removed.length === 1 ? removed[0] : `${removed.length} perfumes`;
      return `${names} ${removed.length === 1 ? "is" : "are"} no longer available and ${removed.length === 1 ? "was" : "were"} taken out of your selection.`;
    }
    return repriced ? "Prices in your selection have been updated to today's prices." : null;
  } catch {
    return null;
  }
}
