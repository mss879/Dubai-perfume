import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { isMissingFunction } from "../../lib/rpc-errors";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";
import { readJsonBody } from "../../lib/request-guard";
import { discountRefusalMessage } from "../../lib/discount-copy";

/**
 * Advisory discount check for the checkout summary. place_order() re-validates
 * and redeems the code when the order is placed, so a stale "valid" answer
 * here can never discount an order — it only sets the shopper's expectation.
 *
 * Being unauthenticated and answering questions about codes makes this an
 * oracle for guessing them, hence the throttle and the single rejection
 * message: brute force should learn nothing faster than a shopper would.
 */

type DiscountBody = { code?: unknown; subtotal?: unknown };

const MAX_CHECKS_PER_IP = 20;
const CHECKS_WINDOW_SECONDS = 60;

const CANNOT_VALIDATE =
  "We could not check this code just now. Enter it anyway — it will be applied when your order is placed if it is valid.";
const TOO_MANY_CHECKS = "Too many codes tried. Please wait a moment before trying another.";

/**
 * A code we cannot honour is refused in the same words every time, with one
 * exception: an unmet minimum, which is the only refusal a shopper can act on.
 * The wording lives in lib/discount-copy.ts so checkout and the concierge say
 * exactly the same thing.
 */

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody<DiscountBody>(request);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: parsed.status });
  }

  const code = String(parsed.body.code ?? "").trim().slice(0, 100);
  const subtotal = Number(parsed.body.subtotal);

  if (!code) {
    return NextResponse.json({
      ok: true,
      valid: false,
      discountAmount: 0,
      message: "Please enter a discount code.",
    });
  }
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return NextResponse.json({ ok: true, valid: null, discountAmount: 0, message: CANNOT_VALIDATE });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, valid: null, discountAmount: 0, message: CANNOT_VALIDATE });
  }

  const supabase = createServerSupabase();
  // Refusals keep the response shape so the checkout summary can show the
  // message without special-casing a status it never expects.
  if (!(await checkRateLimit(supabase, `discount:ip:${clientKey(request)}`, MAX_CHECKS_PER_IP, CHECKS_WINDOW_SECONDS))) {
    return NextResponse.json(
      { ok: true, valid: null, discountAmount: 0, message: TOO_MANY_CHECKS },
      { status: 429 }
    );
  }

  const { data, error } = await supabase.rpc("validate_discount", {
    p_code: code,
    p_subtotal: subtotal,
  });

  if (error) {
    if (isMissingFunction(error)) {
      console.error("validate_discount is missing — apply migration 44.");
    } else {
      console.error("Discount validation failed:", error.message);
    }
    return NextResponse.json({ ok: true, valid: null, discountAmount: 0, message: CANNOT_VALIDATE });
  }

  // validate_discount returns `reason` and `minimum`; it has never returned a
  // `message`. Reading one collapsed every refusal to the same generic line and
  // threw away the only thing a shopper could act on — how far short they were.
  const result = data as
    | { valid?: boolean; discount_amount?: number; reason?: string; minimum?: number }
    | null;
  if (!result || typeof result.valid !== "boolean") {
    return NextResponse.json({ ok: true, valid: null, discountAmount: 0, message: CANNOT_VALIDATE });
  }

  if (!result.valid) {
    return NextResponse.json({
      ok: true,
      valid: false,
      discountAmount: 0,
      message: discountRefusalMessage(result.reason, result.minimum),
    });
  }

  return NextResponse.json({
    ok: true,
    valid: true,
    discountAmount: Number(result.discount_amount) || 0,
    message: "Code applied.",
  });
}
