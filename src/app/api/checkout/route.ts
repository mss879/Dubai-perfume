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

/**
 * The only order-placement path. Delegates to the place_order() SECURITY
 * DEFINER function (migration 40), which re-prices every line from the
 * catalogue, validates and decrements stock, applies the discount code and
 * generates the sequential order number — nothing money-bearing is trusted
 * from the client.
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
};

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
  invalid_currency: "Unsupported display currency.",
  invalid_exchange_rate: "Unsupported display currency.",
  unsupported_payment_method: "This payment method is not available.",
  customer_email_conflict: "That email is already registered. Please sign in first.",
};

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

  const provider = getPaymentProvider(body.paymentMethod || "cod");
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

  // The provider declares how the order should be recorded. The database
  // re-validates the (method, payment status) pair, so this cannot be used to
  // mark an order paid.
  const payment = await provider.begin();

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
  });

  if (error) {
    if (isMissingFunction(error)) {
      console.error("place_order is missing — apply migrations 38–42.");
      return NextResponse.json({ error: MIGRATIONS_PENDING_MESSAGE }, { status: 503 });
    }
    const mapped = mapDbError(error.message || "");
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  // Notification email. Deliberately after the order is committed and never
  // allowed to fail the request — the order exists whether or not mail works.
  const result = data as {
    order_id?: string;
    subtotal?: number;
    shipping_fee?: number;
    discount_amount?: number;
    total?: number;
  } | null;

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
      });
    } catch (err) {
      console.error(`[order ${result.order_id}] notification emails failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, ...data });
}

/**
 * Looks up product names for the placed lines, confirms to the customer and
 * notifies the maison. Each send is isolated: one failing must not cost the
 * other, and neither may fail the order.
 */
async function sendOrderEmails(
  supabase: Awaited<ReturnType<typeof createSessionSupabase>>,
  result: { order_id?: string; subtotal?: number; shipping_fee?: number; discount_amount?: number; total?: number },
  items: { product_id: number; size: string; quantity: number }[],
  customer: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    shipping: ShippingAddress | null;
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

  const order = {
    orderId: String(result.order_id),
    customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null,
    lines,
    subtotalAed: Number(result.subtotal) || 0,
    shippingFeeAed: Number(result.shipping_fee) || 0,
    discountAed: Number(result.discount_amount) || 0,
    totalAed: Number(result.total) || 0,
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
  const ownerData: OwnerOrderEmailData = {
    ...order,
    customerEmail: customer.email,
    phone: customer.phone || null,
    shipping: customer.shipping,
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
