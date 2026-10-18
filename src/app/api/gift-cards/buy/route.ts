import { NextRequest, NextResponse } from "next/server";
import { createSessionSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../../lib/rate-limit";
import { isMissingFunction } from "../../../lib/rpc-errors";
import { isBot, readJsonBody } from "../../../lib/request-guard";
import { resolveCheckoutMode } from "../../../lib/payments/mode";
import { readPaymobConfig } from "../../../lib/payments/paymob/config";
import { PAYMENT_TOKEN, paymentPath, startPayment } from "../../../lib/payments/paymob/service";

/**
 * Buying a gift card (Admin → Gift cards). The card is an order of its own,
 * created by place_gift_card_order (migration 70) awaiting payment, and paid
 * through exactly the same Paymob path as any online order: the payment page,
 * the signed webhook, the reconcile job. The card comes alive when Paymob
 * confirms the payment, and is emailed to the recipient by the store's job.
 */

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  gift_cards_off: "Gift cards aren't available just now.",
  gift_cards_need_online_payment: "Gift cards are paid online, and online payment is switched off just now.",
  invalid_email: "Please enter a valid email address for yourself.",
  phone_required: "Please enter a phone number. Our payment partner needs one to confirm the payment.",
  invalid_gift_card: "Please choose an amount.",
  invalid_gift_card_amount: "Please choose one of the amounts, or a whole amount within the limits shown.",
  invalid_recipient_email: "Please enter a valid email address for the recipient.",
  recipient_name_required: "Please enter the recipient's name.",
  invalid_send_date: "Please choose a delivery date within the next 90 days.",
};

const UNAVAILABLE = "Secure online payment is unavailable for a moment. Please try again shortly.";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  const parsed = await readJsonBody<Record<string, unknown>>(request, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid request." }, { status: parsed.status });
  const body = parsed.body;
  if (isBot(body.company)) return NextResponse.json({ error: MESSAGES.invalid_gift_card }, { status: 422 });

  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const email = text(body.email, 255);
  const supabase = await createSessionSupabase();
  const key = clientKey(request);
  const allowed =
    (await checkRateLimit(supabase, `checkout:ip:${key}`, 5, 600)) &&
    (!email || (await checkRateLimit(supabase, `checkout:email:${email.toLowerCase()}`, 3, 3600)));
  if (!allowed) {
    return NextResponse.json({ error: "We have received several orders from you already. Please wait a few minutes." }, { status: 429 });
  }
  if ((await resolveCheckoutMode()) !== "online") {
    return NextResponse.json({ error: MESSAGES.gift_cards_need_online_payment }, { status: 422 });
  }

  const amount = Number(body.amount);
  const { data, error } = await supabase.rpc("place_gift_card_order", {
    p_email: email,
    p_first_name: text(body.firstName, 100),
    p_last_name: text(body.lastName, 100),
    p_phone: text(body.phone, 50),
    p_card: {
      amount: Number.isFinite(amount) ? amount : null,
      recipient_name: text(body.recipientName, 120),
      recipient_email: text(body.recipientEmail, 255),
      sender_name: text(body.senderName, 120),
      message: text(body.message, 300),
      send_on: /^\d{4}-\d{2}-\d{2}$/.test(text(body.sendOn, 10)) ? text(body.sendOn, 10) : null,
    },
  });
  if (error) {
    if (isMissingFunction(error)) return NextResponse.json({ error: MESSAGES.gift_cards_off }, { status: 503 });
    const code = (error.message || "").split(":")[0];
    return NextResponse.json({ error: MESSAGES[code] ?? "We could not place your order. Please try again." }, { status: MESSAGES[code] ? 422 : 500 });
  }

  const result = (data ?? {}) as { order_id?: string; total?: number; payment_token?: string };
  const token = result.payment_token ?? "";
  if (!result.order_id || !PAYMENT_TOKEN.test(token)) return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  const config = readPaymobConfig();
  const started = config.ok ? await startPayment(config.config, token) : null;
  return NextResponse.json(
    {
      ok: true,
      order_id: result.order_id,
      total: Number(result.total) || 0,
      payment: { returnPath: paymentPath(token), redirectUrl: started?.ok ? started.redirectUrl : null },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
