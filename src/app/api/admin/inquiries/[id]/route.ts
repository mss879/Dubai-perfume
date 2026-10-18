import { NextRequest } from "next/server";
import { guardAdminWrite, reply, UUID_PATTERN } from "../../../../lib/admin-route";
import { createSessionSupabase } from "../../../../lib/supabase-server";

/** Delete one contact-form message for good. */

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return reply(404, { error: "That message no longer exists." });

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.from("contact_inquiries").delete().eq("id", id).select("id");
  if (error) return reply(500, { error: "The message could not be deleted. Try again." });
  if (!data || data.length === 0) return reply(404, { error: "That message no longer exists." });
  return reply(200, { ok: true });
}
