import { NextRequest, NextResponse } from "next/server";
import { createSessionSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../../lib/rate-limit";
import { isMissingFunction } from "../../../lib/rpc-errors";
import { readJsonBody } from "../../../lib/request-guard";

/**
 * The checkout's figures (checkout_quote, migration 70): the bag with its
 * offers and code, plus gift wrap, the shopper's points and a gift card.
 * place_order() charges exactly this. The shopper's own session is used, so
 * their points can be read; nothing is written.
 *
 * Throttled per visitor, with tighter limits while a code or a gift card is
 * included, so it can't be used to guess either. Before migration 70 it
 * answers with the plain bag (bag_quote).
 */

export const dynamic = "force-dynamic";

type Body = { items?: unknown; code?: unknown; options?: unknown };

function cleanItems(raw: unknown): { product_id: number; size: string; quantity: number }[] | null {
  if (!Array.isArray(raw) || raw.length > 50) return null;
  return raw
    .map((line) => {
      const l = (line ?? {}) as { product_id?: unknown; size?: unknown; quantity?: unknown };
      return { product_id: Number(l.product_id), size: typeof l.size === "string" ? l.size.slice(0, 50) : "", quantity: Number(l.quantity) };
    })
    .filter((l) => Number.isSafeInteger(l.product_id) && l.product_id > 0 && Number.isInteger(l.quantity) && l.quantity >= 1 && l.quantity <= 20);
}

const unavailable = () => NextResponse.json({ ok: false, unavailable: true }, { headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody<Body>(request, 8 * 1024);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: parsed.status });
  const items = cleanItems(parsed.body.items);
  if (!items) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  const code = typeof parsed.body.code === "string" ? parsed.body.code.trim().slice(0, 40) : "";
  const raw = (parsed.body.options && typeof parsed.body.options === "object" ? parsed.body.options : {}) as Record<string, unknown>;
  const giftCard = typeof raw.gift_card === "string" ? raw.gift_card.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) : "";
  const options = { gift_wrap: raw.gift_wrap === true, use_points: raw.use_points === true, gift_card: giftCard || undefined };
  if (!isSupabaseConfigured) return unavailable();

  const supabase = await createSessionSupabase();
  const key = clientKey(request);
  const allowed = await checkRateLimit(supabase, `bag:ip:${key}`, 120, 60);
  const codeAllowed = !code || (await checkRateLimit(supabase, `discount:ip:${key}`, 20, 60));
  const cardAllowed = !giftCard || (await checkRateLimit(supabase, `giftcard:ip:${key}`, 60, 600));
  if (!allowed || !codeAllowed || !cardAllowed) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const { data, error } = await supabase.rpc("checkout_quote", { p_items: items, p_code: code || null, p_options: options });
  if (error && isMissingFunction(error)) {
    // Before migration 70: the bag alone.
    const plain = await supabase.rpc("bag_quote", { p_items: items, p_code: code || null });
    if (plain.error || !plain.data) return unavailable();
    return NextResponse.json({ ok: true, quote: plain.data }, { headers: { "Cache-Control": "no-store" } });
  }
  if (error || !data) return unavailable();
  return NextResponse.json({ ok: true, quote: data }, { headers: { "Cache-Control": "no-store" } });
}
