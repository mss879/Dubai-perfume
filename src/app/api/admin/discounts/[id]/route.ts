import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../../lib/admin-route";
import { createSessionSupabase } from "../../../../lib/supabase-server";

/**
 * Pause or resume a code, hand it to the concierge (or take it back), or
 * delete it. Checkout reads is_active on every use, so a pause is immediate.
 */

export const dynamic = "force-dynamic";

function discountId(raw: string): number | null {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const id = discountId((await params).id);
  if (!id) return reply(404, { error: "Code not found." });

  const parsed = await readAdminJson(request, 1024);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as { is_active?: unknown; concierge_only?: unknown };
  const changes: { is_active?: boolean; concierge_only?: boolean } = {};
  if (typeof body.is_active === "boolean") changes.is_active = body.is_active;
  if (typeof body.concierge_only === "boolean") changes.concierge_only = body.concierge_only;
  if (Object.keys(changes).length !== 1) return reply(422, { error: "Invalid change." });

  const supabase = await createSessionSupabase();
  if (changes.concierge_only) {
    const { data: current } = await supabase.from("discounts").select("usage_limit").eq("id", id).maybeSingle();
    if (current && current.usage_limit == null) {
      return reply(422, { error: "Only a code with a usage limit can be given to the concierge." });
    }
  }
  const { data, error } = await supabase.from("discounts").update(changes).eq("id", id).select("id");
  if (error) {
    // The database's own rule (migration 55), should the check above be raced.
    if (error.code === "23514") return reply(422, { error: "Only a code with a usage limit can be given to the concierge." });
    return reply(500, { error: "The code could not be updated. Try again." });
  }
  if (!data || data.length === 0) return reply(404, { error: "Code not found." });
  return reply(200, { ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const id = discountId((await params).id);
  if (!id) return reply(404, { error: "Code not found." });

  // Past orders keep the code's text and the amount taken off; nothing links back here.
  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.from("discounts").delete().eq("id", id).select("id");
  if (error) return reply(500, { error: "The code could not be deleted. Try again." });
  if (!data || data.length === 0) return reply(404, { error: "Code not found." });
  return reply(200, { ok: true });
}
