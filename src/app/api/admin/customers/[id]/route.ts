import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply, UUID_PATTERN } from "../../../../lib/admin-route";
import { createSessionSupabase } from "../../../../lib/supabase-server";

/** Save the admin's private note on a customer. Nothing else about a customer is editable here. */

export const dynamic = "force-dynamic";

const MAX_NOTE = 2000;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return reply(404, { error: "Customer not found." });

  const parsed = await readAdminJson(request, 16 * 1024);
  if (!parsed.ok) return parsed.response;
  const raw = (parsed.body as { note?: unknown } | null)?.note;
  if (typeof raw !== "string") return reply(422, { error: "Invalid note." });
  const note = raw.trim().slice(0, MAX_NOTE);

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase
    .from("customers")
    .update({ note, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return reply(500, { error: "The note could not be saved. Try again." });
  if (!data || data.length === 0) return reply(404, { error: "Customer not found." });
  return reply(200, { ok: true, note });
}
