import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";
import { readJsonBody } from "../../lib/request-guard";

/**
 * Checkout autosave. Replaces the direct browser upsert into abandoned_carts —
 * that table is no longer readable or writable anonymously (migration 39);
 * writes go through the email-guarded capture_abandoned_cart() function.
 */
type AbandonedCartBody = {
  id?: unknown;
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  shipping?: Record<string, unknown>;
  cartItems?: unknown;
  total?: unknown;
  currency?: unknown;
  exchangeRate?: unknown;
};

/**
 * Deliberately loose: the checkout page saves on a two-second debounce, so a
 * shopper filling the form in slowly is expected to save dozens of times.
 * The ceiling is here to stop a script, not to ration a real checkout.
 */
const MAX_SAVES_PER_IP = 60;
const SAVES_WINDOW_SECONDS = 600;

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const parsed = await readJsonBody<AbandonedCartBody>(request);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false }, { status: parsed.status });
  }
  const body = parsed.body;

  if (!body?.id || !body?.email) {
    return NextResponse.json({ ok: false }, { status: 422 });
  }

  const supabase = createServerSupabase();
  if (
    !(await checkRateLimit(
      supabase,
      `abandoned-cart:ip:${clientKey(request)}`,
      MAX_SAVES_PER_IP,
      SAVES_WINDOW_SECONDS
    ))
  ) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const { error } = await supabase.rpc("capture_abandoned_cart", {
    p_id: String(body.id),
    p_email: String(body.email).trim(),
    p_first_name: String(body.firstName ?? ""),
    p_last_name: String(body.lastName ?? ""),
    p_phone: String(body.phone ?? ""),
    p_shipping: body.shipping ?? {},
    p_cart_items: Array.isArray(body.cartItems) ? body.cartItems.slice(0, 50) : [],
    p_total: Number(body.total) || 0,
    p_currency: typeof body.currency === "string" ? body.currency : "AED",
    p_exchange_rate: Number(body.exchangeRate) || 1,
  });

  // Autosave is best-effort; never surface errors to the shopper.
  return NextResponse.json({ ok: !error });
}
