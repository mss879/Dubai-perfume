import { NextRequest, NextResponse } from "next/server";
import { createSessionSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { getPaymentProvider } from "../../lib/payments";
import { isMissingFunction, MIGRATIONS_PENDING_MESSAGE } from "../../lib/rpc-errors";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";
import { isBot, readJsonBody } from "../../lib/request-guard";
import { getOwnerNotificationAddress, sendEmail } from "../../lib/email/send";
import {
  newOrderOwnerEmail,
  orderConfirmationEmail,
  type OrderLine,
  type OwnerOrderEmailData,
  type ShippingAddress,
} from "../../lib/email/templates";
import { resolveCheckoutMode } from "../../lib/payments/mode";
import { readPaymobConfig } from "../../lib/payments/paymob/config";
import { PAYMENT_TOKEN, paymentPath, startPayment } from "../../lib/payments/paymob/service";

/**
 * The only order-placement path. Delegates to the place_order() SECURITY
 * DEFINER function (migration 40), which re-prices every line from the
 * catalogue, validates and decrements stock, applies the discount code and
 * generates the sequential order number — nothing money-bearing is trusted
 * from the client.
 *
 * How the order is paid is decided HERE, from the owner's switch (migration
 * 63) — never from what the browser asks for. In online mode the order is
 * created awaiting payment and the response carries the shopper's payment page
 * and Paymob's checkout URL; it is marked paid only by Paymob (webhook or
 * inquiry), and only then are the confirmation emails sent.
 */

type CheckoutBody = {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  shipping?: Record<string, unknown>;
  items?: { productId?: number; size?: string; quantity?: number }[];
  discountCode?: string;
  abandonedCartId?: string;
  currency?: string;
  exchangeRate?: number;
  paymentMethod?: string;
  company?: unknown;
  /** Migration 70: gift wrap and message, a recipient, points and a gift card. */
  options?: unknown;
};

/**
 * The shopper's extras (migration 70), cleaned. Null when there are none, so
 * the call to place_order stays the twelve-argument one it always was.
 * place_order re-checks every one against the owner's switches.
 */
function cleanOptions(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const out: Record<string, unknown> = {};
  if (o.gift_wrap === true) out.gift_wrap = true;
  if (o.hide_prices === true) out.hide_prices = true;
  const message = text(o.gift_message, 500);
  if (message) out.gift_message = message;
  if (o.send_to_other === true) {
    out.send_to_other = true;
    out.recipient_name = text(o.recipient_name, 120);
    const phone = text(o.recipient_phone, 50);
    if (phone) out.recipient_phone = phone;
    const date = text(o.delivery_date, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) out.delivery_date = date;
  }
  if (o.use_points === true) out.use_points = true;
  const card = text(o.gift_card, 40).replace(/[^A-Za-z0-9-]/g, "");
  if (card) out.gift_card = card;
  return Object.keys(out).length > 0 ? out : null;
}

/** Orders per IP, and per email address, before the route stops accepting them. */
const MAX_ORDERS_PER_IP = 5;
const ORDERS_PER_IP_WINDOW_SECONDS = 600;
const MAX_ORDERS_PER_EMAIL = 3;
const ORDERS_PER_EMAIL_WINDOW_SECONDS = 3600;

const TOO_MANY_ORDERS =
  "We have received several orders from you already. Please wait a few minutes before placing another, or write to us and a client advisor will help.";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "Please enter a valid email address.",
  invalid_shipping_address: "Please complete your shipping address.",
  invalid_items: "Your bag appears to be empty or invalid.",
  invalid_quantity: "Quantities must be between 1 and 20.",
  invalid_discount_code: "This code is not valid.",
  discount_exhausted: "This code has reached its usage limit.",
  discount_not_applicable: "This code doesn't apply to the items in your bag. Remove it to place your order.",
  discount_covered_by_offers:
    "Your bag's offers already cover these perfumes, so this code has nothing more to take off. Remove it to place your order.",
  invalid_currency: "Unsupported display currency.",
  invalid_exchange_rate: "Unsupported display currency.",
  unsupported_payment_method: "This payment method is not available.",
  customer_email_conflict: "That email is already registered. Please sign in first.",
  phone_required: "Please enter a phone number. Our payment partner needs one to confirm the payment.",
  online_payment_not_needed:
    "Your order comes to AED 0, so there is nothing to pay online. Please write to us and we will complete it for you.",
  // Migration 70
  discount_not_yours: "This code was made for another email address. Use the address it was sent to.",
  discount_first_order_only: "This code is for a first order, and this email address has ordered with us before.",
  referral_own_code: "That's your own referral code: share it with a friend instead.",
  discount_gift_unavailable: "The perfume this code adds is out of stock just now. Remove the code, or write to us.",
  recipient_name_required: "Please enter the name of the person you're sending this to.",
  invalid_delivery_date: "Please choose a delivery date within the dates shown.",
  gift_card_invalid: "That gift card code isn't valid.",
  gift_card_expired: "That gift card has expired.",
  gift_card_empty: "That gift card has nothing left on it.",
};

const ONLINE_UNAVAILABLE =
  "Secure online payment is unavailable for a moment. Please try again shortly, or write to us and a client advisor will help.";

function mapDbError(message: string): { status: number; error: string } {
  const [code, detail] = message.split(":");
  if (code === "out_of_stock") {
    return { status: 409, error: `“${detail}” is out of stock in the selected size.` };
  }
  if (code === "unknown_product") {
    return { status: 409, error: "An item in your bag is no longer available." };
  }
  if (code === "invalid_size") {
    return { status: 409, error: `The selected size for “${detail}” is unavailable.` };
  }
  if (code === "discount_minimum_not_met") {
    return { status: 422, error: `This code requires a minimum order of AED ${detail}.` };
  }
  if (ERROR_MESSAGES[code]) {
    return { status: 422, error: ERROR_MESSAGES[code] };
  }
  return { status: 500, error: "We could not place your order. Please try again." };
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Ordering is unavailable: the store database is not configured." },
      { status: 503 }
    );
  }

  const parsed = await readJsonBody<CheckoutBody>(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid request." }, { status: parsed.status });
  }
  const body = parsed.body;

  const email = String(body.email ?? "").trim();

  // Honeypot. Answered exactly like an ordinary validation failure so a bot
  // cannot tell which field gave it away.
  if (isBot(body.company)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalid_items }, { status: 422 });
  }

  // Throttle before any database work: placing orders decrements stock and
  // redeems discount codes, so a flood is expensive in more than CPU.
  const supabase = await createSessionSupabase();
  const allowed =
    (await checkRateLimit(
      supabase,
      `checkout:ip:${clientKey(request)}`,
      MAX_ORDERS_PER_IP,
      ORDERS_PER_IP_WINDOW_SECONDS
    )) &&
    (!email ||
      (await checkRateLimit(
        supabase,
        `checkout:email:${email.toLowerCase()}`,
        MAX_ORDERS_PER_EMAIL,
        ORDERS_PER_EMAIL_WINDOW_SECONDS
      )));
  if (!allowed) {
    return NextResponse.json({ error: TOO_MANY_ORDERS }, { status: 429 });
  }

  // The store's mode, not the browser, picks the method. A page left open from
  // before a switch simply gets the current method.
  const mode = await resolveCheckoutMode();
  if (mode === "unavailable") {
    return NextResponse.json({ error: ONLINE_UNAVAILABLE }, { status: 503 });
  }
  const provider = getPaymentProvider(mode === "online" ? "paymob" : "cod");
  if (!provider) {
    return NextResponse.json(
      { error: "This payment method is not available." },
      { status: 422 }
    );
  }

  const items = Array.isArray(body.items)
    ? body.items
        .filter((i) => i && i.productId != null)
        .map((i) => ({
          product_id: Number(i.productId),
          size: String(i.size ?? ""),
          quantity: Number(i.quantity) || 1,
        }))
    : [];

  if (items.length === 0) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalid_items }, { status: 422 });
  }

  // Hidden perfumes are not for sale. The shop's public read leaves them out,
  // so a perfume the catalogue doesn't return here can't be ordered (a bag
  // saved before it was hidden, or an old tab). A failed read is left to
  // place_order, which checks every line again.
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const { data: onSale, error: onSaleError } = await supabase.from("products").select("id").in("id", productIds);
  if (!onSaleError && (onSale ?? []).length < productIds.length) {
    return NextResponse.json({ error: "An item in your bag is no longer available." }, { status: 409 });
  }

  // The provider declares how the order should be recorded. The database
  // re-validates the (method, payment status) pair, so this cannot be used to
  // mark an order paid.
  const payment = await provider.begin();
  const options = cleanOptions(body.options);

  const { data, error } = await supabase.rpc("place_order", {
    p_email: email,
    p_first_name: String(body.firstName ?? "").slice(0, 255),
    p_last_name: String(body.lastName ?? "").slice(0, 255),
    p_phone: String(body.phone ?? "").slice(0, 50),
    p_shipping: body.shipping ?? {},
    p_items: items,
    p_discount_code: body.discountCode?.trim() || null,
    p_abandoned_cart_id: body.abandonedCartId || null,
    p_currency: body.currency || "AED",
    p_exchange_rate: body.exchangeRate ?? 1,
    p_payment_method: provider.method,
    p_payment_status: payment.paymentStatus,
    ...(options ? { p_options: options } : {}),
  });

  if (error) {
    if (isMissingFunction(error)) {
      console.error("place_order is missing — apply migrations 38–42.");
      return NextResponse.json({ error: MIGRATIONS_PENDING_MESSAGE }, { status: 503 });
    }
    const mapped = mapDbError(error.message || "");
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const result = data as {
    order_id?: string;
    subtotal?: number;
    shipping_fee?: number;
    discount_amount?: number;
    /** Migration 69: the automatic offers' saving, and the free gift. */
    offer_saving?: number;
    gift?: { product_id: number; size: string; name: string; brand: string | null } | null;
    total?: number;
    currency?: string;
    payment_method?: string;
    payment_status?: string;
    payment_token?: string | null;
    /** Migration 70 */
    code_gift?: { product_id: number; size: string; name: string; brand: string | null } | null;
    gift_wrap?: boolean;
    gift_wrap_fee?: number;
    points_redeemed?: number;
    points_value?: number;
    points_earned?: number;
    gift_card_amount?: number;
    paid_by_credit?: boolean;
  } | null;

  const summary = {
    order_id: result?.order_id,
    subtotal: result?.subtotal,
    shipping_fee: result?.shipping_fee,
    discount_amount: result?.discount_amount,
    offer_saving: result?.offer_saving ?? 0,
    gift: result?.gift ? { name: result.gift.name, brand: result.gift.brand, size: result.gift.size } : null,
    code_gift: result?.code_gift ? { name: result.code_gift.name, brand: result.code_gift.brand, size: result.code_gift.size } : null,
    gift_wrap_fee: result?.gift_wrap_fee ?? 0,
    points_redeemed: result?.points_redeemed ?? 0,
    points_value: result?.points_value ?? 0,
    points_earned: result?.points_earned ?? 0,
    gift_card_amount: result?.gift_card_amount ?? 0,
    paid_by_credit: result?.paid_by_credit === true,
    total: result?.total,
    currency: result?.currency,
    payment_method: result?.payment_method,
    payment_status: result?.payment_status,
  };

  // An order a gift card and points paid in full (migration 70) has nothing to
  // pay online: it is confirmed here, like a cash-on-delivery order.
  if (provider.method === "paymob" && result?.payment_method !== "credit") {
    // Online: no emails yet (they go when Paymob confirms the payment). The
    // shopper's payment page works even if opening the Paymob checkout failed
    // just now — it offers to try again.
    const token = result?.payment_token ?? "";
    if (!result?.order_id || !PAYMENT_TOKEN.test(token)) {
      return NextResponse.json({ error: ONLINE_UNAVAILABLE }, { status: 503 });
    }
    const config = readPaymobConfig();
    const started = config.ok ? await startPayment(config.config, token) : null;
    return NextResponse.json(
      {
        ok: true,
        ...summary,
        payment: {
          returnPath: paymentPath(token),
          redirectUrl: started?.ok ? started.redirectUrl : null,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Notification email. Deliberately after the order is committed and never
  // allowed to fail the request — the order exists whether or not mail works.
  if (result?.order_id) {
    try {
      await sendOrderEmails(supabase, result, items, {
        email,
        phone: String(body.phone ?? "").trim(),
        firstName: String(body.firstName ?? "").trim(),
        lastName: String(body.lastName ?? "").trim(),
        // The owner's alert is the dispatch note for a cash-on-delivery order,
        // so it needs somewhere to deliver to, not just who ordered.
        shipping: (body.shipping ?? null) as ShippingAddress | null,
        options,
      });
    } catch (err) {
      console.error(`[order ${result.order_id}] notification emails failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}

/**
 * Looks up product names for the placed lines, confirms to the customer and
 * notifies the maison. Each send is isolated: one failing must not cost the
 * other, and neither may fail the order.
 */
async function sendOrderEmails(
  supabase: Awaited<ReturnType<typeof createSessionSupabase>>,
  result: {
    order_id?: string;
    subtotal?: number;
    shipping_fee?: number;
    discount_amount?: number;
    offer_saving?: number;
    gift?: { product_id: number; size: string; name: string; brand: string | null } | null;
    code_gift?: { product_id: number; size: string; name: string; brand: string | null } | null;
    gift_wrap?: boolean;
    gift_wrap_fee?: number;
    points_value?: number;
    gift_card_amount?: number;
    payment_method?: string;
    total?: number;
  },
  items: { product_id: number; size: string; quantity: number }[],
  customer: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    shipping: ShippingAddress | null;
    options: Record<string, unknown> | null;
  }
) {
  const ids = [...new Set(items.map((i) => i.product_id))];
  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, price")
    .in("id", ids);

  const byId = new Map(
    ((products ?? []) as { id: number; name: string; brand: string | null; price: number | string }[]).map(
      (p) => [p.id, p]
    )
  );

  const lines: OrderLine[] = items.map((i) => ({
    name: byId.get(i.product_id)?.name ?? `Product ${i.product_id}`,
    brand: byId.get(i.product_id)?.brand ?? null,
    size: i.size || null,
    quantity: i.quantity,
    // Priced from the catalogue, matching what place_order charged.
    unitPriceAed: parseFloat(String(byId.get(i.product_id)?.price ?? 0)) || 0,
  }));
  // The free gift (migration 69) rides along at no charge.
  if (result.gift) {
    lines.push({ name: result.gift.name, brand: result.gift.brand, size: result.gift.size || null, quantity: 1, unitPriceAed: 0 });
  }
  // Migration 70: a code's free perfume (the welcome offer) too.
  if (result.code_gift) {
    lines.push({ name: result.code_gift.name, brand: result.code_gift.brand, size: result.code_gift.size || null, quantity: 1, unitPriceAed: 0 });
  }

  const order = {
    orderId: String(result.order_id),
    customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null,
    lines,
    subtotalAed: Number(result.subtotal) || 0,
    shippingFeeAed: Number(result.shipping_fee) || 0,
    // The code's saving and the offers' (sets, buy-more, free delivery), together.
    discountAed: (Number(result.discount_amount) || 0) + (Number(result.offer_saving) || 0),
    totalAed: Number(result.total) || 0,
    giftWrapAed: Number(result.gift_wrap_fee) || 0,
    pointsAed: Number(result.points_value) || 0,
    giftCardAed: Number(result.gift_card_amount) || 0,
    payment: result.payment_method === "credit" ? { method: "credit" as const } : null,
  };

  try {
    const sent = await sendEmail({ to: customer.email, ...orderConfirmationEmail(order) });
    if (!sent.ok) {
      console.error(`[order ${order.orderId}] confirmation not sent: ${sent.reason}`);
    }
  } catch (err) {
    console.error(`[order ${order.orderId}] confirmation email failed:`, err);
  }

  // Owner notification: COD orders are picked and delivered by hand, so the
  // maison learning about them only by opening the admin is how one gets missed.
  // It carries the phone number because the first step is usually a call.
  const owner = getOwnerNotificationAddress();
  if (!owner) return;

  // The keys here MUST be `phone` and `shipping` — those are what
  // OwnerOrderEmailData declares and what newOrderOwnerEmail reads. An earlier
  // version sent `customerPhone`, which type-checked (both fields are optional,
  // and excess-property checking does not fire on a variable) and silently
  // dropped the number from every alert.
  const opts = customer.options ?? {};
  const ownerData: OwnerOrderEmailData = {
    ...order,
    customerEmail: customer.email,
    phone: customer.phone || null,
    shipping: customer.shipping,
    giftNote:
      result.gift_wrap || opts.gift_message || opts.hide_prices
        ? { wrap: result.gift_wrap === true, message: typeof opts.gift_message === "string" ? opts.gift_message : null, hidePrices: opts.hide_prices === true }
        : null,
    recipient:
      opts.send_to_other === true && typeof opts.recipient_name === "string"
        ? {
            name: opts.recipient_name,
            phone: typeof opts.recipient_phone === "string" ? opts.recipient_phone : null,
            deliveryDate: typeof opts.delivery_date === "string" ? opts.delivery_date : null,
          }
        : null,
  };
  try {
    const sent = await sendEmail({ to: owner, ...newOrderOwnerEmail(ownerData) });
    if (!sent.ok) {
      console.error(`[order ${order.orderId}] owner notification not sent: ${sent.reason}`);
    }
  } catch (err) {
    console.error(`[order ${order.orderId}] owner notification failed:`, err);
  }
}
