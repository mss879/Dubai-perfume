import { NextRequest } from "next/server";
import { guardAdminWrite, isUniqueViolation, readAdminJson, reply } from "../../../lib/admin-route";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { discountSchema, endOfDubaiDay } from "../../../admin/_lib/discount-schema";

/** Create a discount code. The id comes from the database's own sequence. */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const parsed = await readAdminJson(request, 4 * 1024);
  if (!parsed.ok) return parsed.response;

  const result = discountSchema.safeParse(parsed.body);
  if (!result.success) {
    const issue = result.error.issues[0];
    return reply(422, { error: issue?.message ?? "Check the code's details.", field: issue?.path?.join(".") });
  }
  const input = result.data;
  const endsAt = input.ends_on ? endOfDubaiDay(input.ends_on) : null;
  if (endsAt && new Date(endsAt).getTime() < Date.now()) {
    return reply(422, { error: "That date has already passed.", field: "ends_on" });
  }

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase
    .from("discounts")
    .insert({
      code: input.code,
      title: `${input.code} Campaign`,
      type: input.type,
      value: input.value,
      min_requirement: input.min_requirement,
      ends_at: endsAt,
      usage_limit: input.usage_limit,
      usage_count: 0,
      is_active: true,
      concierge_only: input.concierge_only,
      // Only sent when on, so a code still saves before migration 69.
      ...(input.combines_with_offers ? { combines_with_offers: true } : {}),
      // Whole-order codes leave these to their defaults, so they also save before migration 67.
      ...(input.applies_to === "order"
        ? {}
        : {
            applies_to: input.applies_to,
            product_ids: input.applies_to === "products" ? [...new Set(input.product_ids)] : [],
            collection_ids: input.applies_to === "collections" ? [...new Set(input.collection_ids)] : [],
          }),
    })
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) return reply(409, { error: `The code ${input.code} already exists.`, field: "code" });
    // A column PostgREST doesn't know yet: migration 67 hasn't run.
    if (error.code === "PGRST204" || error.code === "42703") {
      return reply(503, {
        error: input.combines_with_offers
          ? "Letting a code stack with offers needs database migration 69. Run it in Supabase, then try again."
          : "Codes for perfumes, collections or delivery need database migration 67. Run it in Supabase, then try again.",
      });
    }
    return reply(500, { error: "The code could not be created. Try again." });
  }
  return reply(200, { ok: true, id: (data as { id: number }).id, code: input.code });
}
