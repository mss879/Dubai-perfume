import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../../lib/rate-limit";
import { readJsonBody } from "../../../lib/request-guard";

/**
 * The bag priced by the database (bag_quote, migration 69): offers, the free
 * gift, a code if one is applied, delivery and the total, plus the nudges.
 * place_order() uses the same calculation, so this is what the order costs.
 *
 * Read-only and public. Throttled per visitor; when a code is included it also
 * counts against the discount-check limit, so it can't be used to guess codes.
 * Any failure answers { unavailable: true } and the bag falls back to its own
 * simple totals.
 */

export const dynamic = "force-dynamic";

type Body = { items?: unknown; code?: unknown };

function cleanItems(raw: unknown): { product_id: number; size: string; quantity: number }[] | null {
  if (!Array.isArray(raw) || raw.length > 50) return null;
  return raw
    .map((line) => {
      const l = (line ?? {}) as { product_id?: unknown; size?: unknown; quantity?: unknown };
      return {
        product_id: Number(l.product_id),
        size: typeof l.size === "string" ? l.size.slice(0, 50) : "",
        quantity: Number(l.quantity),
      };
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
  if (!isSupabaseConfigured) return unavailable();

  const supabase = createServerSupabase();
  const key = clientKey(request);
  const allowed = await checkRateLimit(supabase, `bag:ip:${key}`, 120, 60);
  const codeAllowed = !code || (await checkRateLimit(supabase, `discount:ip:${key}`, 20, 60));
  if (!allowed || !codeAllowed) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const { data, error } = await supabase.rpc("bag_quote", { p_items: items, p_code: code || null });
  // Before migration 69 the function is missing; either way the bag works without it.
  if (error || !data) return unavailable();
  return NextResponse.json({ ok: true, quote: data }, { headers: { "Cache-Control": "no-store" } });
}
