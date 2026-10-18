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

type DiscountBody = { code?: unknown; subtotal?: unknown; items?: unknown };

/**
 * The bag's lines, as checkout knows them: product, size and quantity (prices
 * come from the catalogue). The size matters since migration 69: a set can
 * name one, and the code is priced after the offers.
 */
function bagLines(raw: unknown): { product_id: number; size: string; quantity: number }[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return null;
  const lines = raw
    .map((line) => {
      const l = (line ?? {}) as { product_id?: unknown; size?: unknown; quantity?: unknown };
      return {
        product_id: Number(l.product_id),
        size: typeof l.size === "string" ? l.size.slice(0, 50) : "",
        quantity: Number(l.quantity),
      };
    })
    .filter((l) => Number.isSafeInteger(l.product_id) && l.product_id > 0 && Number.isInteger(l.quantity) && l.quantity >= 1 && l.quantity <= 20);
  return lines.length > 0 ? lines : null;
}

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

  // With the bag's lines a code for chosen perfumes, a collection or delivery is
  // priced exactly as the order will be (check_discount, migration 67). Before
  // that migration, fall back to the whole-order check.
  const items = bagLines(parsed.body.items);
  let { data, error } = await supabase.rpc("check_discount", {
    p_code: code,
    p_items: items,
    p_subtotal: subtotal,
  });
  if (error && isMissingFunction(error)) {
    ({ data, error } = await supabase.rpc("validate_discount", {
      p_code: code,
      p_subtotal: subtotal,
    }));
  }

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
    | {
        valid?: boolean;
        discount_amount?: number | null;
        reason?: string;
        minimum?: number;
        applies_to?: string;
        applies_label?: string;
        gift?: { name?: string; brand?: string | null; size?: string } | null;
      }
    | null;
  if (!result || typeof result.valid !== "boolean") {
    return NextResponse.json({ ok: true, valid: null, discountAmount: 0, message: CANNOT_VALIDATE });
  }

  if (!result.valid) {
    return NextResponse.json({
      ok: true,
      valid: false,
      discountAmount: 0,
      message: discountRefusalMessage(result.reason, result.minimum, result.applies_label),
    });
  }

  const appliesTo = result.applies_to ?? "order";
  // Migration 70: a personal code (welcome, cart reminder, referral) is checked
  // against the email and first order when the order is placed, which explains
  // any refusal then; the preview just applies it.
  return NextResponse.json({
    ok: true,
    valid: true,
    discountAmount: Number(result.discount_amount) || 0,
    appliesTo,
    message: result.gift?.name
      ? `Code applied: ${result.gift.name}${result.gift.size ? ` (${result.gift.size})` : ""} joins your order, complimentary.`
      : appliesTo === "delivery"
        ? "Code applied to your delivery."
        : appliesTo !== "order" && result.applies_label
          ? `Code applied to ${result.applies_label}.`
          : "Code applied.",
  });
}
