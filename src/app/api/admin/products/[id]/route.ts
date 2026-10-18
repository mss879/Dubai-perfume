import { NextRequest, NextResponse } from "next/server";
import { getAdminIdentity } from "../../../../lib/auth";
import { isMissingFunction } from "../../../../lib/rpc-errors";
import { isSameOrigin } from "../../../../lib/request-guard";
import { SITE_URL } from "../../../../lib/site";
import { createSessionSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";

/**
 * Delete a product. Refused when it appears in past orders: an order line
 * keeps only a link to its product, so deleting would blank the perfume's name
 * out of those orders. Hide it from the shop instead.
 */

export const dynamic = "force-dynamic";

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured) return reply(503, { error: "Store database is not configured." });
  if (!(await getAdminIdentity())) return reply(403, { error: "Not authorised." });
  if (!isSameOrigin(request, SITE_URL)) return reply(403, { error: "Not authorised." });

  const { id } = await params;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId <= 0) return reply(404, { error: "Product not found." });

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.rpc("admin_delete_product", { p_id: productId });
  if (error) {
    if (isMissingFunction(error)) {
      return reply(503, { error: "Deleting products needs database migration 64. Run it in Supabase, then try again." });
    }
    if (error.code === "42501") return reply(403, { error: "Not authorised." });
    return reply(500, { error: "The product could not be deleted. Try again." });
  }

  const result = data as { ok?: boolean; reason?: string } | null;
  if (result?.ok) return reply(200, { ok: true });
  if (result?.reason === "has_orders") {
    return reply(409, {
      error: "This perfume is in past orders, so it can't be deleted. Turn off “Show in shop” to hide it instead.",
      reason: "has_orders",
    });
  }
  return reply(404, { error: "Product not found.", reason: result?.reason ?? "not_found" });
}
