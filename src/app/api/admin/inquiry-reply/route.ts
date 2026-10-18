import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply as respond, UUID_PATTERN } from "../../../lib/admin-route";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { sendEmail } from "../../../lib/email/send";
import { inquiryReplyEmail } from "../../../lib/email/templates";

/**
 * Answering a contact enquiry.
 *
 * Server-side for the same three reasons as /api/admin/order-status: the caller
 * is re-verified as a real admin, the customer is emailed, and RESEND_API_KEY
 * stays out of the admin bundle. It also means the inquiry can only be marked
 * answered by the same code path that actually sent the answer.
 *
 * Two modes:
 *   • { inquiryId, reply }  – send the reply, then mark the row answered.
 *   • { inquiryId, status } – just set 'new' | 'answered' with no email
 *                             (the operator answered by phone, say).
 */

export const dynamic = "force-dynamic";

type Body = {
  inquiryId?: unknown;
  reply?: unknown;
  status?: unknown;
};

const MAX_REPLY_LENGTH = 5000;

export async function POST(request: NextRequest) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const admin = gate.admin;

  // 5,000 characters of Arabic is up to 20KB of UTF-8; leave room for the JSON.
  const parsed = await readAdminJson(request, 32 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as Body;

  const inquiryId = String(body.inquiryId ?? "").trim();
  if (!UUID_PATTERN.test(inquiryId)) {
    return respond(422, { error: "Inquiry id is required." });
  }

  const reply =
    typeof body.reply === "string" && body.reply.trim()
      ? body.reply.trim().slice(0, MAX_REPLY_LENGTH)
      : null;

  const requestedStatus =
    typeof body.status === "string" ? body.status.trim().toLowerCase() : null;

  if (!reply && requestedStatus !== "new" && requestedStatus !== "answered") {
    return respond(422, { error: "Write a reply, or choose to mark it answered or unanswered." });
  }

  const supabase = await createSessionSupabase();

  // Read through the caller's own session, so RLS is the thing deciding
  // whether this row is visible rather than a second is_admin check here.
  const { data: inquiry, error: readError } = await supabase
    .from("contact_inquiries")
    .select("id, name, email, subject, message")
    .eq("id", inquiryId)
    .maybeSingle();

  if (readError) {
    return respond(500, { error: "Could not load the message. Try again." });
  }
  if (!inquiry) {
    return respond(404, { error: "That message no longer exists." });
  }

  const row = inquiry as Record<string, unknown>;

  /* ── Status-only change ────────────────────────────────────────────────── */

  if (!reply) {
    const status = requestedStatus as "new" | "answered";
    const answeredAt = status === "answered" ? new Date().toISOString() : null;
    const { data: updated, error } = await supabase
      .from("contact_inquiries")
      .update({
        status,
        answered_at: answeredAt,
        replied_by: status === "answered" ? admin.email : null,
      })
      .eq("id", inquiryId)
      .select("id");

    // Row-level security reports a refused update as "nothing changed", not as
    // an error, so an empty result is a failure too.
    if (error || !updated || updated.length === 0) {
      return respond(500, { error: "Could not update the message. Try again." });
    }
    return respond(200, { ok: true, inquiryId, status, answeredAt, emailed: null });
  }

  /* ── Reply and mark answered ───────────────────────────────────────────── */

  const recipient = String(row.email ?? "").trim();
  if (!recipient) {
    return respond(422, { error: "This message has no email address to reply to." });
  }

  const message = inquiryReplyEmail({
    name: String(row.name ?? ""),
    subject: String(row.subject ?? ""),
    originalMessage: String(row.message ?? ""),
    reply,
  });

  // The same reply to the same message is delivered once, even if the button
  // is pressed twice or the request is retried.
  const digest = createHash("sha256").update(reply).digest("hex").slice(0, 24);
  const result = await sendEmail(
    { to: recipient, ...message },
    { quiet: true, idempotencyKey: `inquiry-reply/${inquiryId}/${digest}` }
  );
  if (!result.ok) {
    // Nothing is marked answered when nothing was sent — a row that claims to
    // be answered when the mail bounced is worse than an unanswered one.
    return respond(502, {
      error: result.skipped
        ? "Email is not set up on this site, so the reply was not sent."
        : "The reply could not be sent. Try again in a minute.",
    });
  }

  const answeredAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("contact_inquiries")
    .update({
      status: "answered",
      answered_at: answeredAt,
      admin_reply: reply,
      replied_by: admin.email,
    })
    .eq("id", inquiryId)
    .select("id");

  if (updateError || !updated || updated.length === 0) {
    // The customer has the reply; only the bookkeeping failed. Say so plainly
    // rather than reporting a failure that would invite a duplicate send.
    return respond(200, {
      ok: true,
      inquiryId,
      status: "new",
      emailed: recipient,
      warning: "The reply was sent, but the message couldn't be marked answered. Mark it answered by hand.",
    });
  }

  return respond(200, {
    ok: true,
    inquiryId,
    status: "answered",
    emailed: recipient,
    answeredAt,
    repliedBy: admin.email,
  });
}
