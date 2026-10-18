import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../lib/admin-route";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { MIGRATION_69, offersTableMissing, readOffer } from "./save";

/** Create an offer (migration 69). The database prices it; this stores it. */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const parsed = await readAdminJson(request, 16 * 1024);
  if (!parsed.ok) return parsed.response;
  const offer = await readOffer(parsed.body);
  if (!offer.ok) return offer.response;

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.from("offers").insert(offer.row).select("id").single();
  if (error) {
    if (offersTableMissing(error)) return reply(503, { error: MIGRATION_69 });
    if (error.code === "23514") return reply(422, { error: "Something about this offer doesn't add up. Check each field and try again." });
    return reply(500, { error: "The offer could not be saved. Try again." });
  }
  return reply(200, { ok: true, id: (data as { id: number }).id });
}
