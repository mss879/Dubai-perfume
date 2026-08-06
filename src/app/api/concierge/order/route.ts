import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../../lib/rate-limit";
import { isBot, readJsonBody } from "../../../lib/request-guard";
import { isMissingFunction } from "../../../lib/rpc-errors";
import type {
  ConciergeOrderLookupRequest,
  ConciergeOrderLookupResponse,
  ConciergeOrderView,
} from "../../../lib/concierge/types";

/**
 * The concierge's order lookup.
 *
 * Separate from /api/concierge on purpose, and this is the whole point of the
 * feature: the order number and the email are posted straight from the form on
 * the stage to here. They never enter the model's context, and they are never
 * filed in concierge_messages — the agent knows only that it offered to look.
 *
 * The real throttle lives inside lookup_order_for_concierge (migration 57),
 * because that function is granted to anon and the anon key ships in the
 * browser bundle: a limit here binds only callers who come through here. The
 * limits below are the cheap first line, not the defence.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_REF = /^[A-Za-z0-9][A-Za-z0-9-]{2,30}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const NOT_FOUND = "No order found for that reference and email.";
const BUSY = "Too many lookups just now. Please try again in a few minutes.";
const AWAY = "Order lookup is unavailable just now. You can also use the tracking page.";

/** A lookup body is tiny; anything larger is not a lookup. */
const MAX_BODY = 2048;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error } satisfies ConciergeOrderLookupResponse, { status });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return fail(503, AWAY);

  const parsed = await readJsonBody<ConciergeOrderLookupRequest>(request, MAX_BODY);
  if (!parsed.ok) return fail(parsed.status, AWAY);

  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(422, NOT_FOUND);
  if (isBot(body.company)) return NextResponse.json({ ok: false, error: NOT_FOUND }, { status: 404 });

  const sessionId = String(body.sessionId ?? "").trim();
  const orderRef = String(body.orderRef ?? "").trim();
  const email = String(body.email ?? "").trim();

  // A malformed reference or address is answered as a miss rather than a
  // validation error: telling a prober which of their two guesses was the
  // wrong SHAPE is already telling them something.
  if (!UUID.test(sessionId) || !ORDER_REF.test(orderRef) || !EMAIL.test(email) || email.length > 255) {
    return fail(404, NOT_FOUND);
  }

  const supabase = createServerSupabase();
  const key = clientKey(request);

  const [ipAllowed, sessionAllowed] = await Promise.all([
    checkRateLimit(supabase, `order_lookup:ip:${key}`, 10, 900),
    checkRateLimit(supabase, `order_lookup:sess:${sessionId}`, 10, 900),
  ]);
  if (!ipAllowed || !sessionAllowed) return fail(429, BUSY);

  const { data, error } = await supabase.rpc("lookup_order_for_concierge", {
    p_order_id: orderRef,
    p_email: email,
    p_session_id: sessionId,
    p_client_key: key,
  });

  if (error) {
    if (isMissingFunction(error)) {
      console.error("lookup_order_for_concierge is missing — apply migration 57.");
      return fail(503, AWAY);
    }
    console.error("Concierge order lookup failed:", error.message);
    return fail(500, AWAY);
  }

  // Throttled and not-found are answered differently on the wire but say the
  // same thing to a prober: nothing about whether the pair was right.
  if (data && typeof data === "object" && (data as { throttled?: boolean }).throttled) {
    return fail(429, BUSY);
  }
  if (!data) return fail(404, NOT_FOUND);

  const order = data as ConciergeOrderView;
  return NextResponse.json({ ok: true, order } satisfies ConciergeOrderLookupResponse);
}
