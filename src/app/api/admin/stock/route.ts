import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentity } from "../../../lib/auth";
import { isMissingFunction } from "../../../lib/rpc-errors";
import { isSameOrigin, readJsonBody } from "../../../lib/request-guard";
import { SITE_URL } from "../../../lib/site";
import { createSessionSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

/**
 * Stock for one size (admin_adjust_stock, migration 64):
 *   add        stock received: count + N. Never conflicts with a sale.
 *   set        a stocktake: count = N, only if the count is still what the
 *              admin was looking at; otherwise nothing changes and the current
 *              count comes back.
 *   threshold  the low-stock warning level.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  productId: z.number().int().positive(),
  size: z.string().trim().min(1).max(50),
  mode: z.enum(["add", "set", "threshold"]),
  value: z.number().int().min(0).max(100_000),
  expected: z.number().int().min(0).max(1_000_000).optional(),
});

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

  const parsed = await readJsonBody<unknown>(request, 1024);
  if (!parsed.ok) return reply(parsed.status, { error: "Invalid request." });
  const body = bodySchema.safeParse(parsed.body);
  if (!body.success) return reply(422, { error: "Enter a whole number of bottles." });
  if (body.data.mode === "add" && body.data.value === 0) return reply(422, { error: "Enter how many arrived." });

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.rpc("admin_adjust_stock", {
    p_product_id: body.data.productId,
    p_size: body.data.size,
    p_mode: body.data.mode,
    p_value: body.data.value,
    p_expected: body.data.expected ?? null,
  });
  if (error) {
    if (isMissingFunction(error)) {
      return reply(503, { error: "Changing stock here needs database migration 64. Run it in Supabase, then try again." });
    }
    if (error.code === "42501") return reply(403, { error: "Not authorised." });
    return reply(500, { error: "The stock could not be updated. Try again." });
  }

  const result = data as { ok?: boolean; reason?: string; stock_level?: number; low_stock_threshold?: number } | null;
  if (result?.ok) {
    return reply(200, { ok: true, stockLevel: result.stock_level, threshold: result.low_stock_threshold });
  }
  switch (result?.reason) {
    case "changed":
      return reply(409, {
        error: `The count changed to ${result.stock_level ?? "a new number"} while you were editing (an order, or another admin). Check it and try again.`,
        stockLevel: result.stock_level,
      });
    case "untracked":
      return reply(409, { error: "This size isn't tracked yet. Set a count first." });
    case "unknown_size":
      return reply(404, { error: "This size isn't on the product any more." });
    default:
      return reply(404, { error: "Product not found." });
  }
}
