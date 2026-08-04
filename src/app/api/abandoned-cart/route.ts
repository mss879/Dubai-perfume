import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";

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

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let body: AbandonedCartBody;
  try {
    body = (await request.json()) as AbandonedCartBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!body?.id || !body?.email) {
    return NextResponse.json({ ok: false }, { status: 422 });
  }

  const supabase = createServerSupabase();
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
