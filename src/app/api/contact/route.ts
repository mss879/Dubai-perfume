import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { isMissingFunction } from "../../lib/rpc-errors";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";
import { isBot, readJsonBody } from "../../lib/request-guard";

/**
 * Contact form submissions. Replaces the direct browser insert into
 * contact_inquiries, which trusted the client for every field and could be
 * driven straight from the anon key without ever loading the page.
 */

type ContactBody = {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  company?: unknown;
};

const MAX_INQUIRIES_PER_IP = 3;
const INQUIRIES_WINDOW_SECONDS = 3600;
const MAX_MESSAGE_LENGTH = 5000;

const TOO_MANY_INQUIRIES =
  "We already have your messages and a client advisor is reading them. Please give us a little time before writing again.";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: "Please tell us your name.",
  invalid_email: "Please enter a valid email address.",
  invalid_subject: "Please choose a subject.",
  invalid_message: "Please write your message.",
};

function mapDbError(message: string): { status: number; error: string } {
  const [code] = message.split(":");
  if (ERROR_MESSAGES[code]) {
    return { status: 422, error: ERROR_MESSAGES[code] };
  }
  return { status: 500, error: "We could not send your message. Please try again." };
}

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody<ContactBody>(request);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: parsed.status });
  }
  const body = parsed.body;

  // Honeypot: answered as a success and dropped, so the bot has no signal to
  // adapt to and no reason to retry.
  if (isBot(body.company)) {
    return NextResponse.json({ ok: true });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { ok: false, error: "Messages cannot be received just now. Please write to us by email." },
      { status: 503 }
    );
  }

  const supabase = createServerSupabase();
  if (
    !(await checkRateLimit(
      supabase,
      `contact:ip:${clientKey(request)}`,
      MAX_INQUIRIES_PER_IP,
      INQUIRIES_WINDOW_SECONDS
    ))
  ) {
    return NextResponse.json({ ok: false, error: TOO_MANY_INQUIRIES }, { status: 429 });
  }

  const name = String(body.name ?? "").trim().slice(0, 255);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 255);
  const subject = String(body.subject ?? "").trim().slice(0, 255);
  const message = String(body.message ?? "").trim();

  if (!name) {
    return NextResponse.json({ ok: false, error: ERROR_MESSAGES.invalid_name }, { status: 422 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: ERROR_MESSAGES.invalid_email }, { status: 422 });
  }
  if (!subject) {
    return NextResponse.json({ ok: false, error: ERROR_MESSAGES.invalid_subject }, { status: 422 });
  }
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ ok: false, error: ERROR_MESSAGES.invalid_message }, { status: 422 });
  }

  const { error } = await supabase.rpc("submit_contact_inquiry", {
    p_name: name,
    p_email: email,
    p_subject: subject,
    p_message: message,
  });

  if (error) {
    if (isMissingFunction(error)) {
      // Transitional: until migration 44 is applied the function does not
      // exist, and the contact page going silent would lose real enquiries.
      // contact_inquiries still carries its public INSERT policy (migration
      // 18), so the anon key can write the row directly. Remove this fallback
      // once 44 is deployed everywhere.
      const insert = await supabase.from("contact_inquiries").insert({ name, email, subject, message });
      if (insert.error) {
        console.error("Contact inquiry fallback insert failed:", insert.error.message);
        return NextResponse.json(
          { ok: false, error: "We could not send your message. Please try again." },
          { status: 503 }
        );
      }
      return NextResponse.json({ ok: true });
    }
    const mapped = mapDbError(error.message || "");
    if (mapped.status === 500) {
      console.error("Contact inquiry failed:", error.message);
    }
    return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
  }

  return NextResponse.json({ ok: true });
}
