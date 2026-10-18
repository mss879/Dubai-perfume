import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../lib/admin-route";
import { isMissingFunction } from "../../../lib/rpc-errors";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { MIGRATION_70 } from "../../../admin/_lib/feature-data";

/** Issue a gift card from the owner (migration 70's admin_issue_gift_card). */

export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const parsed = await readAdminJson(request, 4 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as Record<string, unknown>;

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 20000 || Math.round(amount * 100) !== amount * 100) {
    return reply(422, { error: "Enter an amount from AED 1 to AED 20,000." });
  }
  const email = typeof body.recipient_email === "string" ? body.recipient_email.trim() : "";
  if (email && !EMAIL.test(email)) return reply(422, { error: "That email address doesn't look right." });
  const months = Number(body.valid_months);
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.rpc("admin_issue_gift_card", {
    p: {
      amount,
      recipient_name: text(body.recipient_name, 120),
      recipient_email: email,
      message: text(body.message, 300),
      note: text(body.note, 200),
      valid_months: Number.isInteger(months) && months >= 1 && months <= 60 ? months : 12,
    },
  });
  if (error) {
    if (isMissingFunction(error)) return reply(503, { error: MIGRATION_70 });
    if (error.code === "42501") return reply(403, { error: "Not authorised." });
    return reply(422, { error: "The gift card could not be issued. Check the amount and email." });
  }
  const code = (data as { code?: string } | null)?.code;
  if (!code) return reply(500, { error: "The gift card could not be issued. Try again." });
  return reply(200, { ok: true, code });
}
