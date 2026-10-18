import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../../lib/admin-route";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { MIGRATION_69, offersTableMissing, readOffer } from "../save";

/**
 * Change an offer: { is_active } alone pauses or resumes it; a full form
 * replaces it. DELETE removes it (orders that used it keep their record).
 */

export const dynamic = "force-dynamic";

function idFrom(raw: string): number | null {
  return /^[0-9]{1,9}$/.test(raw) ? Number(raw) : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const id = idFrom((await params).id);
  if (!id) return reply(404, { error: "Offer not found." });

  // A pause / resume is a tiny body; anything else is the whole form.
  const parsed = await readAdminJson(request, 16 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as Record<string, unknown> | null;

  let update: Record<string, unknown>;
  if (body && typeof body === "object" && Object.keys(body).length === 1 && typeof body.is_active === "boolean") {
    update = { is_active: body.is_active, updated_at: new Date().toISOString() };
  } else {
    const offer = await readOffer(body);
    if (!offer.ok) return offer.response;
    update = offer.row;
  }

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.from("offers").update(update).eq("id", id).select("id");
  if (error) {
    if (offersTableMissing(error)) return reply(503, { error: MIGRATION_69 });
    if (error.code === "23514") return reply(422, { error: "Something about this offer doesn't add up. Check each field and try again." });
    return reply(500, { error: "The offer could not be saved. Try again." });
  }
  if (!data || data.length === 0) return reply(404, { error: "Offer not found. It may have been deleted." });
  return reply(200, { ok: true, id });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const id = idFrom((await params).id);
  if (!id) return reply(404, { error: "Offer not found." });

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.from("offers").delete().eq("id", id).select("id");
  if (error) {
    if (offersTableMissing(error)) return reply(503, { error: MIGRATION_69 });
    return reply(500, { error: "The offer could not be deleted. Try again." });
  }
  if (!data || data.length === 0) return reply(404, { error: "Offer not found. It may have been deleted already." });
  return reply(200, { ok: true });
}
