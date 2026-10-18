import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../../lib/admin-route";
import { isMissingFunction } from "../../../../lib/rpc-errors";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { MIGRATION_70 } from "../../../../admin/_lib/feature-data";

/** Cancel a gift card, or send its email again: { action: "void" | "resend" }. */

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const code = decodeURIComponent((await params).code);
  if (!/^[A-Z0-9-]{4,100}$/.test(code)) return reply(404, { error: "Gift card not found." });
  const parsed = await readAdminJson(request, 1024);
  if (!parsed.ok) return parsed.response;
  const action = (parsed.body as { action?: unknown } | null)?.action;
  if (action !== "void" && action !== "resend") return reply(422, { error: "Unknown action." });

  const supabase = await createSessionSupabase();
  const { error } = await supabase.rpc("admin_gift_card_action", { p_code: code, p_action: action });
  if (error) {
    if (isMissingFunction(error)) return reply(503, { error: MIGRATION_70 });
    if (error.code === "42501") return reply(403, { error: "Not authorised." });
    if (/cannot_resend/.test(error.message ?? "")) return reply(422, { error: "Only an active card with an email can be sent again." });
    if (/unknown_gift_card/.test(error.message ?? "")) return reply(404, { error: "Gift card not found." });
    return reply(500, { error: "That didn't work. Try again." });
  }
  return reply(200, { ok: true });
}
