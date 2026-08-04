import { NextRequest, NextResponse } from "next/server";
import { createSessionSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { getAdminIdentity } from "../../../lib/auth";
import {
  ASSIGNABLE_ORDER_STATUSES,
  normalizeOrderStatus,
  type OrderStatus,
} from "../../../lib/orders";
import { sendEmail } from "../../../lib/email/send";
import {
  outForDeliveryEmail,
  orderDeliveredEmail,
  type OrderEmailData,
  type OrderLine,
} from "../../../lib/email/templates";

/**
 * The single path for changing an order's status.
 *
 * Runs server-side because it does three things the browser must not be
 * trusted with together: it verifies the caller is a real admin, it writes the
 * status/tracking number, and it notifies the customer. Doing the email here
 * (rather than in the admin bundle) also keeps RESEND_API_KEY off the client.
 */

type Body = {
  orderId?: unknown;
  status?: unknown;
  trackingNumber?: unknown;
  packingCharges?: unknown;
};

/** Human-readable timeline entries written to order_tracking. */
const TIMELINE: Record<OrderStatus, { status: string; location: string; description: string }> = {
  pending: {
    status: "Order Placed",
    location: "Dubai Headquarters",
    description: "We have received your order. Payment is collected on delivery.",
  },
  processing: {
    status: "Processing",
    location: "Dubai Headquarters",
    description: "Your order is being prepared.",
  },
  accepted: {
    status: "Accepted",
    location: "Dubai Headquarters",
    description: "Your order has been reviewed and accepted by our team.",
  },
  fulfilled: {
    status: "Fulfilled",
    location: "Dubai Distribution Centre",
    description: "Your fragrances have been packed and sealed by hand.",
  },
  shipped: {
    status: "Shipped",
    location: "Carrier Hub",
    description: "Your parcel has been handed to our carrier.",
  },
  out_for_delivery: {
    status: "Out for Delivery",
    location: "Local Carrier Hub",
    description: "Your parcel is out for delivery and arrives today.",
  },
  delivered: {
    status: "Delivered",
    location: "Delivery Address",
    description: "Your order has been delivered.",
  },
  cancelled: {
    status: "Cancelled",
    location: "Dubai Headquarters",
    description: "This order was cancelled.",
  },
};

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Store database is not configured." }, { status: 503 });
  }

  // Admin only. Never trust the browser's word for this.
  const admin = await getAdminIdentity();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();
  const requested = String(body.status ?? "").trim().toLowerCase();
  if (!orderId) {
    return NextResponse.json({ error: "Order id is required." }, { status: 422 });
  }
  if (!(ASSIGNABLE_ORDER_STATUSES as string[]).includes(requested)) {
    return NextResponse.json({ error: "Unsupported order status." }, { status: 422 });
  }
  const status = normalizeOrderStatus(requested);

  const trackingNumber =
    typeof body.trackingNumber === "string" && body.trackingNumber.trim()
      ? body.trackingNumber.trim().slice(0, 100)
      : null;

  // A courier reference is what makes the "out for delivery" note useful.
  if (status === "out_for_delivery" && !trackingNumber) {
    return NextResponse.json(
      { error: "A tracking number is required to mark an order out for delivery." },
      { status: 422 }
    );
  }

  const supabase = await createSessionSupabase();

  const update: Record<string, unknown> = { status };
  if (trackingNumber) update.tracking_number = trackingNumber;
  if (typeof body.packingCharges === "number" && Number.isFinite(body.packingCharges)) {
    update.packing_charges = body.packingCharges;
  }

  const { error: updateError } = await supabase.from("orders").update(update).eq("id", orderId);
  if (updateError) {
    console.error("Order status update failed:", updateError.message);
    return NextResponse.json({ error: "Could not update the order." }, { status: 500 });
  }

  // Timeline entry. `id` is a SERIAL — let the database assign it (the old
  // client-side code sent `trackingLogs.length + 1`, which collides).
  const entry = TIMELINE[status];
  const { error: trackError } = await supabase.from("order_tracking").insert({
    order_id: orderId,
    status: entry.status,
    location: entry.location,
    description: trackingNumber
      ? `${entry.description} Tracking reference ${trackingNumber}.`
      : entry.description,
  });
  if (trackError) {
    // The status change already succeeded; a missing timeline row must not
    // fail the request, but it should be visible in the logs.
    console.error("Order tracking insert failed:", trackError.message);
  }

  // Notify the customer for the two milestones that matter to them.
  let emailed: string | null = null;
  if (status === "out_for_delivery" || status === "delivered") {
    const data = await loadOrderEmailData(supabase, orderId, trackingNumber);
    if (data?.recipient) {
      const message =
        status === "out_for_delivery"
          ? outForDeliveryEmail(data.order)
          : orderDeliveredEmail(data.order);
      const result = await sendEmail({ to: data.recipient, ...message });
      emailed = result.ok ? data.recipient : null;
      if (!result.ok) {
        console.error(`[order ${orderId}] ${status} email not sent: ${result.reason}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    orderId,
    status,
    trackingNumber,
    emailed,
    timeline: entry,
  });
}

/** Reads everything the templates need for one order. */
async function loadOrderEmailData(
  supabase: Awaited<ReturnType<typeof createSessionSupabase>>,
  orderId: string,
  trackingNumber: string | null
): Promise<{ recipient: string; order: OrderEmailData } | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return null;

  const row = order as Record<string, unknown>;
  const recipient = String(row.email ?? "").trim();
  if (!recipient) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, size, quantity, unit_price")
    .eq("order_id", orderId);

  const itemRows = (items ?? []) as {
    product_id: number;
    size: string | null;
    quantity: number;
    unit_price: number | string;
  }[];

  // Resolve product names in one query rather than per line.
  const ids = [...new Set(itemRows.map((i) => i.product_id))];
  const { data: products } = ids.length
    ? await supabase.from("products").select("id, name, brand").in("id", ids)
    : { data: [] };
  const byId = new Map(
    ((products ?? []) as { id: number; name: string; brand: string | null }[]).map((p) => [p.id, p])
  );

  const lines: OrderLine[] = itemRows.map((i) => ({
    name: byId.get(i.product_id)?.name ?? `Product ${i.product_id}`,
    brand: byId.get(i.product_id)?.brand ?? null,
    size: i.size,
    quantity: Number(i.quantity) || 1,
    unitPriceAed: parseFloat(String(i.unit_price)) || 0,
  }));

  const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
  const total = num(row.total_price);
  const shipping = num(row.shipping_fee);
  const discount = num(row.discount_amount);
  const subtotal = lines.reduce((s, l) => s + l.unitPriceAed * l.quantity, 0);

  const shipTo = (row.shipping_address ?? {}) as Record<string, unknown>;

  return {
    recipient,
    order: {
      orderId,
      customerName: typeof shipTo.name === "string" ? shipTo.name : null,
      lines,
      subtotalAed: subtotal || total,
      shippingFeeAed: shipping,
      discountAed: discount,
      totalAed: total,
      trackingNumber: trackingNumber ?? (row.tracking_number as string | null) ?? null,
    },
  };
}
