import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../../../lib/admin-route";
import { createSessionSupabase } from "../../../../../lib/supabase-server";
import { LONGEVITY_VALUES, OCCASION_VALUES, SEASON_VALUES, STRENGTH_VALUES } from "../../../../../lib/scent-attributes";
import { MIGRATION_70 } from "../../../../../admin/_lib/feature-data";

/**
 * A perfume's filters and "inspired by" line (migration 70's columns). Only
 * the fields sent change; the admin's session writes, so RLS decides.
 */

export const dynamic = "force-dynamic";

const listOf = (v: unknown, allowed: readonly string[]) =>
  Array.isArray(v) && v.every((x) => typeof x === "string" && allowed.includes(x)) ? [...new Set(v as string[])] : null;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const raw = (await params).id;
  if (!/^[0-9]{1,9}$/.test(raw)) return reply(404, { error: "Perfume not found." });
  const parsed = await readAdminJson(request, 2 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  if ("strength" in body) {
    if (body.strength !== null && !STRENGTH_VALUES.includes(String(body.strength))) return reply(422, { error: "Choose a strength." });
    update.strength = body.strength;
  }
  if ("longevity" in body) {
    if (body.longevity !== null && !LONGEVITY_VALUES.includes(String(body.longevity))) return reply(422, { error: "Choose how long it lasts." });
    update.longevity = body.longevity;
  }
  if ("seasons" in body) {
    const seasons = listOf(body.seasons, SEASON_VALUES);
    if (!seasons) return reply(422, { error: "Choose seasons from the list." });
    update.seasons = seasons;
  }
  if ("occasions" in body) {
    const occasions = listOf(body.occasions, OCCASION_VALUES);
    if (!occasions) return reply(422, { error: "Choose occasions from the list." });
    update.occasions = occasions;
  }
  if ("inspired_by" in body) {
    const value = body.inspired_by;
    if (value !== null && (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 120)) {
      return reply(422, { error: "Write the famous scent in up to 120 characters, or leave it empty." });
    }
    update.inspired_by = value === null ? null : (value as string).trim().replace(/\s+/g, " ");
  }
  if (Object.keys(update).length === 0) return reply(422, { error: "Nothing to change." });

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.from("products").update(update).eq("id", Number(raw)).select("id");
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return reply(503, { error: MIGRATION_70 });
    if (error.code === "23514") return reply(422, { error: "Those values aren't accepted. Check each field." });
    return reply(500, { error: "Couldn't save. Try again." });
  }
  if (!data || data.length === 0) return reply(404, { error: "Perfume not found." });
  return reply(200, { ok: true });
}
