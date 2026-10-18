import { NextRequest } from "next/server";
import { z } from "zod";
import { forgetAgentSettings, shapeAgentSettings } from "../../../lib/agent-settings";
import { guardAdminWrite, readAdminJson, reply } from "../../../lib/admin-route";
import { isMissingFunction } from "../../../lib/rpc-errors";
import { createSessionSupabase } from "../../../lib/supabase-server";

/** Save the Agent's switches (migration 65). Only the keys sent change. */

export const dynamic = "force-dynamic";

const body = z
  .object({
    enabled: z.boolean(),
    greeting: z.string().max(400, { error: "Keep the greeting under 400 characters." }).nullable(),
    photos_enabled: z.boolean(),
    offers_enabled: z.boolean(),
    order_help_enabled: z.boolean(),
    nudges_enabled: z.boolean(),
  })
  .partial()
  .strict();

export async function PATCH(request: NextRequest) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const parsed = await readAdminJson(request, 4 * 1024);
  if (!parsed.ok) return parsed.response;
  const result = body.safeParse(parsed.body);
  if (!result.success) return reply(422, { error: result.error.issues[0]?.message ?? "Invalid settings." });
  if (Object.keys(result.data).length === 0) return reply(422, { error: "Nothing to change." });

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.rpc("admin_set_agent_settings", { p: result.data });
  if (error) {
    if (isMissingFunction(error)) {
      return reply(503, { error: "The Agent's switches need database migration 65. Run it in Supabase, then try again." });
    }
    if (error.code === "42501") return reply(403, { error: "Not authorised." });
    if (error.code === "22023") return reply(422, { error: "Those settings couldn't be saved. Check the greeting." });
    return reply(500, { error: "The settings could not be saved. Try again." });
  }
  const settings = shapeAgentSettings(data);
  if (!settings) return reply(500, { error: "The settings could not be saved. Try again." });
  forgetAgentSettings();
  return reply(200, { ok: true, settings });
}
