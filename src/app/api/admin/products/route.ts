import { NextRequest, NextResponse } from "next/server";
import { getAdminIdentity } from "../../../lib/auth";
import { isMissingFunction } from "../../../lib/rpc-errors";
import { isSameOrigin, readJsonBody } from "../../../lib/request-guard";
import { SITE_URL } from "../../../lib/site";
import { createSessionSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { SAVE_ERRORS, productSchema } from "../../../admin/_lib/product-schema";

/**
 * Create or update a product. One call, one transaction in the database
 * (admin_save_product, migration 64): the product, its sizes, the starting
 * stock of new sizes only, and its hand-picked collections. Existing stock
 * counts are never touched here; they change only through /api/admin/stock.
 */

export const dynamic = "force-dynamic";

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return reply(503, { error: "Store database is not configured." });
  if (!(await getAdminIdentity())) return reply(403, { error: "Not authorised." });
  if (!isSameOrigin(request, SITE_URL)) return reply(403, { error: "Not authorised." });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return reply(415, { error: "Invalid request." });
  }

  const parsed = await readJsonBody<unknown>(request, 32 * 1024);
  if (!parsed.ok) return reply(parsed.status, { error: "Invalid request." });

  const result = productSchema.safeParse(parsed.body);
  if (!result.success) {
    const issue = result.error.issues[0];
    return reply(422, { error: issue?.message ?? "Check the product details.", field: issue?.path?.join(".") });
  }

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.rpc("admin_save_product", { p: result.data });
  if (error) {
    if (isMissingFunction(error)) {
      return reply(503, { error: "Saving products needs database migration 64. Run it in Supabase, then try again." });
    }
    if (error.code === "42501") return reply(403, { error: "Not authorised." });
    if (error.code === "P0002") return reply(404, { error: SAVE_ERRORS.product_not_found });
    if (error.code === "22023") {
      return reply(422, { error: SAVE_ERRORS[error.message] ?? "Check the product details." });
    }
    return reply(500, { error: "The product could not be saved. Try again." });
  }

  const saved = data as { ok?: boolean; id?: number; created?: boolean } | null;
  if (!saved?.ok || typeof saved.id !== "number") {
    return reply(500, { error: "The product could not be saved. Try again." });
  }
  return reply(200, { ok: true, id: saved.id, created: Boolean(saved.created) });
}
