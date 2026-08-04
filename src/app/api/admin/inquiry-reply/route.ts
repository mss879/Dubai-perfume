import { NextRequest, NextResponse } from "next/server";
import { createSessionSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { getAdminIdentity } from "../../../lib/auth";
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

type Body = {
  inquiryId?: unknown;
  reply?: unknown;
  status?: unknown;
};

const MAX_REPLY_LENGTH = 5000;

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Store database is not configured." }, { status: 503 });
  }

  const admin = await getAdminIdentity();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const inquiryId = String(body.inquiryId ?? "").trim();
  if (!inquiryId) {
    return NextResponse.json({ error: "Inquiry id is required." }, { status: 422 });
  }

  const reply =
    typeof body.reply === "string" && body.reply.trim()
      ? body.reply.trim().slice(0, MAX_REPLY_LENGTH)
      : null;

  const requestedStatus =
    typeof body.status === "string" ? body.status.trim().toLowerCase() : null;

  if (!reply && requestedStatus !== "new" && requestedStatus !== "answered") {
    return NextResponse.json(
      { error: "Provide a reply to send, or a status of 'new' or 'answered'." },
      { status: 422 }
    );
  }

  const supabase = await createSessionSupabase();

  // Read through the caller's own session, so RLS is the thing deciding
  // whether this row is visible rather than a second is_admin check here.
  const { data: inquiry, error: readError } = await supabase
    .from("contact_inquiries")
    .select("*")
    .eq("id", inquiryId)
    .maybeSingle();

  if (readError) {
    console.error("Inquiry read failed:", readError.message);
    return NextResponse.json({ error: "Could not load the inquiry." }, { status: 500 });
  }
  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
  }

  const row = inquiry as Record<string, unknown>;

  /* ── Status-only change ────────────────────────────────────────────────── */

  if (!reply) {
    const status = requestedStatus as "new" | "answered";
    const { error } = await supabase
      .from("contact_inquiries")
      .update({
        status,
        answered_at: status === "answered" ? new Date().toISOString() : null,
        ...(status === "answered" ? { replied_by: admin.email } : { replied_by: null }),
      })
      .eq("id", inquiryId);

    if (error) {
      console.error("Inquiry status update failed:", error.message);
      return NextResponse.json(
        { error: "Could not update the inquiry. Apply migration 48 if this persists." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, inquiryId, status, emailed: null });
  }

  /* ── Reply and mark answered ───────────────────────────────────────────── */

  const recipient = String(row.email ?? "").trim();
  if (!recipient) {
    return NextResponse.json(
      { error: "This inquiry has no email address to reply to." },
      { status: 422 }
    );
  }

  const message = inquiryReplyEmail({
    name: String(row.name ?? ""),
    subject: String(row.subject ?? ""),
    originalMessage: String(row.message ?? ""),
    reply,
  });

  const result = await sendEmail({ to: recipient, ...message });
  if (!result.ok) {
    // Nothing is marked answered when nothing was sent — a row that claims to
    // be answered when the mail bounced is worse than an unanswered one.
    console.error(`[inquiry ${inquiryId}] reply not sent: ${result.reason}`);
    return NextResponse.json(
      {
        error: result.skipped
          ? "Email is not configured on this deployment, so the reply was not sent."
          : "The reply could not be sent.",
      },
      { status: 502 }
    );
  }

  const answeredAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("contact_inquiries")
    .update({
      status: "answered",
      answered_at: answeredAt,
      admin_reply: reply,
      replied_by: admin.email,
    })
    .eq("id", inquiryId);

  if (updateError) {
    // The customer has the reply; only the bookkeeping failed. Say so plainly
    // rather than reporting a failure that would invite a duplicate send.
    console.error("Inquiry answered-flag update failed:", updateError.message);
    return NextResponse.json({
      ok: true,
      inquiryId,
      status: "new",
      emailed: recipient,
      warning:
        "The reply was sent, but the inquiry could not be marked answered. Apply migration 48.",
    });
  }

  return NextResponse.json({
    ok: true,
    inquiryId,
    status: "answered",
    emailed: recipient,
    answeredAt,
    repliedBy: admin.email,
  });
}
