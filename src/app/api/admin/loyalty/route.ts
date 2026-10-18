import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../lib/admin-route";
import { isMissingFunction } from "../../../lib/rpc-errors";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { MIGRATION_70 } from "../../../admin/_lib/feature-data";

/** Add or take away a customer's points by hand: { email, points, note }. */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const parsed = await readAdminJson(request, 2 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const points = Number(body.points);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply(422, { error: "Enter the customer's account email." });
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 1_000_000) {
    return reply(422, { error: "Enter a whole number of points: 200 to add, -200 to take away." });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.rpc("admin_adjust_points", { p_email: email, p_points: points, p_note: note });
  if (error) {
    if (isMissingFunction(error)) return reply(503, { error: MIGRATION_70 });
    if (error.code === "42501") return reply(403, { error: "Not authorised." });
    if (/no_account/.test(error.message ?? "")) return reply(422, { error: "No customer account uses that email. Points need an account." });
    if (/not_enough_points/.test(error.message ?? "")) return reply(422, { error: "That would take them below zero points." });
    return reply(500, { error: "The points could not be changed. Try again." });
  }
  return reply(200, { ok: true, available: Number((data as { available?: number } | null)?.available) || 0 });
}
