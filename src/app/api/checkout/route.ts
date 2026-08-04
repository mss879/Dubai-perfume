import { NextRequest, NextResponse } from "next/server";
import { createSessionSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { getPaymentProvider } from "../../lib/payments";
import { isMissingFunction, MIGRATIONS_PENDING_MESSAGE } from "../../lib/rpc-errors";
import { sendEmail } from "../../lib/email/send";
import { orderConfirmationEmail, type OrderLine } from "../../lib/email/templates";

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
};

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

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
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

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.rpc("place_order", {
    p_email: String(body.email ?? "").trim(),
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

  // Confirmation email. Deliberately after the order is committed and never
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
      await sendOrderConfirmation(supabase, result, items, String(body.email ?? "").trim(), {
        firstName: String(body.firstName ?? "").trim(),
        lastName: String(body.lastName ?? "").trim(),
      });
    } catch (err) {
      console.error(`[order ${result.order_id}] confirmation email failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, ...data });
}

/** Looks up product names for the placed lines and sends the confirmation. */
async function sendOrderConfirmation(
  supabase: Awaited<ReturnType<typeof createSessionSupabase>>,
  result: { order_id?: string; subtotal?: number; shipping_fee?: number; discount_amount?: number; total?: number },
  items: { product_id: number; size: string; quantity: number }[],
  email: string,
  name: { firstName: string; lastName: string }
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

  const message = orderConfirmationEmail({
    orderId: String(result.order_id),
    customerName: [name.firstName, name.lastName].filter(Boolean).join(" ") || null,
    lines,
    subtotalAed: Number(result.subtotal) || 0,
    shippingFeeAed: Number(result.shipping_fee) || 0,
    discountAed: Number(result.discount_amount) || 0,
    totalAed: Number(result.total) || 0,
  });

  const sent = await sendEmail({ to: email, ...message });
  if (!sent.ok) {
    console.error(`[order ${result.order_id}] confirmation not sent: ${sent.reason}`);
  }
}
