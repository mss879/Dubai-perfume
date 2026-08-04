import "server-only";
import { Resend } from "resend";

/**
 * Transactional email via Resend.
 *
 * Deliberately fail-soft: a shopper's order must never be lost because the
 * mail provider is down or unconfigured. Every send returns a result the
 * caller can log, and no send ever throws into a request path.
 *
 * Required env:
 *   RESEND_API_KEY      – from resend.com/api-keys
 *   RESEND_FROM_EMAIL   – e.g. "Gharib <orders@gharibperfumes.com>"
 *                         The domain must be verified in Resend, otherwise
 *                         delivery is rejected.
 * Optional:
 *   RESEND_REPLY_TO     – where customer replies should land
 *   ORDER_NOTIFICATION_EMAIL
 *                       – the inbox that is alerted when an order arrives.
 *                         Falls back to RESEND_REPLY_TO, then to the address
 *                         in RESEND_FROM_EMAIL.
 */

const apiKey = process.env.RESEND_API_KEY || "";
const fromAddress = process.env.RESEND_FROM_EMAIL || "";
const replyTo = process.env.RESEND_REPLY_TO || "";
const ownerAddress = process.env.ORDER_NOTIFICATION_EMAIL || "";

export const isEmailConfigured = Boolean(apiKey && fromAddress);

/** "Gharib <orders@example.com>" → "orders@example.com". */
function bareAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  return (angled ? angled[1] : value).trim();
}

/**
 * Where operational alerts go. A cash-on-delivery order nobody is told about
 * simply sits there, so this falls back through the addresses the store has
 * already been given rather than resolving to nothing.
 */
export function getOwnerNotificationAddress(): string {
  return bareAddress(ownerAddress || replyTo || fromAddress);
}

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; reason: string };

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const to = params.to?.trim();

  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { ok: false, skipped: true, reason: "no valid recipient" };
  }
  if (!isEmailConfigured) {
    // Not an error: the store runs fine without email configured, it just
    // does not notify. Logged loudly so this is never a silent surprise.
    console.warn(
      `[email] RESEND_API_KEY / RESEND_FROM_EMAIL not set — skipped "${params.subject}" to ${to}`
    );
    return { ok: false, skipped: true, reason: "email not configured" };
  }

  try {
    const resend = getClient();
    if (!resend) return { ok: false, skipped: true, reason: "no client" };

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      console.error(`[email] send failed for "${params.subject}":`, error.message);
      return { ok: false, skipped: false, reason: error.message };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    console.error(`[email] threw for "${params.subject}":`, reason);
    return { ok: false, skipped: false, reason };
  }
}
