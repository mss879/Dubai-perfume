import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bring a collection's product links in line with what they should be.
 *
 * Adds first, then removes, so a failure part-way leaves a product too many
 * on the page rather than an empty page. Returns false if either write failed.
 */
export async function setCollectionMembers(
  supabase: SupabaseClient,
  collectionId: string,
  productIds: number[]
): Promise<boolean> {
  const { data: current, error: readError } = await supabase
    .from("product_collections")
    .select("product_id")
    .eq("collection_id", collectionId);
  if (readError) return false;

  const want = new Set(productIds);
  const have = new Set(((current ?? []) as { product_id: number }[]).map((row) => row.product_id));
  const add = [...want].filter((id) => !have.has(id));
  const remove = [...have].filter((id) => !want.has(id));

  if (add.length > 0) {
    const { error } = await supabase
      .from("product_collections")
      .upsert(
        add.map((product_id) => ({ product_id, collection_id: collectionId })),
        { onConflict: "product_id,collection_id", ignoreDuplicates: true }
      );
    if (error) return false;
  }
  if (remove.length > 0) {
    const { error } = await supabase
      .from("product_collections")
      .delete()
      .eq("collection_id", collectionId)
      .in("product_id", remove);
    if (error) return false;
  }
  return true;
}

/** Every product carrying the tag, for an automatic collection. */
export async function productsWithTag(supabase: SupabaseClient, tag: string): Promise<number[] | null> {
  const { data, error } = await supabase.from("products").select("id").contains("tags", [tag]).limit(5000);
  if (error) return null;
  return ((data ?? []) as { id: number }[]).map((row) => row.id);
}
