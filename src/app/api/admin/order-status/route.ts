import { NextRequest, NextResponse } from "next/server";
import { createSessionSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { getAdminIdentity } from "../../../lib/auth";
import { isSameOrigin, readJsonBody } from "../../../lib/request-guard";
import { SITE_URL } from "../../../lib/site";
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
import { packingFor } from "../../../lib/order-amounts";
import { isMissingFunction } from "../../../lib/rpc-errors";

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
  /** Omit to update tracking details only (no status change). */
  status?: unknown;
  trackingNumber?: unknown;
  trackingUrl?: unknown;
  packingCharges?: unknown;
  /**
   * The status the admin was looking at. If the order has moved on since (a
   * second tab, a second admin), nothing is changed and 409 is returned, so a
   * customer is never emailed twice for one step.
   */
  expectedStatus?: unknown;
  /** Tracking-only updates: also email the customer the new details. */
  notifyCustomer?: unknown;
  /** Cancelling: put the order's bottles back in stock (default true). */
  restock?: unknown;
};

/** Never logged: the admin sees what happened to the email in the response. */
type EmailOutcome = "sent" | "skipped" | "failed" | "not_needed";

function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = value.trim().slice(0, 500);
  return /^https?:\/\//i.test(url) ? url : null;
}

/** Human-readable timeline entries written to order_tracking. */
const TIMELINE: Record<OrderStatus, { status: string; location: string; description: string }> = {
  pending: {
    status: "Order Placed",
    location: "Dubai Headquarters",
    description: "We have received your order.",
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
    description: "Your parcel is with our courier and on its way to you.",
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
  // A same-site JSON request only, so another site cannot drive an admin's
  // browser into changing (and emailing about) an order.
  if (!isSameOrigin(request, SITE_URL)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 415 });
  }

  const parsed = await readJsonBody<Body>(request, 2048);
  if (!parsed.ok || !parsed.body || typeof parsed.body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: parsed.ok ? 400 : parsed.status });
  }
  const body = parsed.body;

  const orderId = String(body.orderId ?? "").trim().slice(0, 100);
  if (!orderId) {
    return NextResponse.json({ error: "Order id is required." }, { status: 422 });
  }

  const trackingOnly = body.status === undefined || body.status === null || body.status === "";
  const requested = String(body.status ?? "").trim().toLowerCase();
  if (!trackingOnly && !(ASSIGNABLE_ORDER_STATUSES as string[]).includes(requested)) {
    return NextResponse.json({ error: "Unsupported order status." }, { status: 422 });
  }

  const trackingNumber =
    typeof body.trackingNumber === "string" && body.trackingNumber.trim()
      ? body.trackingNumber.trim().slice(0, 100)
      : null;
  const trackingUrl = cleanUrl(body.trackingUrl);
  // Tracking-only edits: a field sent as "" (or null) is cleared; a field left
  // out is kept. So a wrong courier link can be removed, not only replaced.
  const clearNumber = "trackingNumber" in body && !trackingNumber;
  const clearUrl = "trackingUrl" in body && !(typeof body.trackingUrl === "string" && body.trackingUrl.trim());
  if (typeof body.trackingUrl === "string" && body.trackingUrl.trim() && !trackingUrl) {
    return NextResponse.json({ error: "The tracking link must start with https://." }, { status: 422 });
  }

  let packingCharges: number | null = null;
  if (body.packingCharges !== undefined && body.packingCharges !== null && body.packingCharges !== "") {
    const value = Number(body.packingCharges);
    if (!Number.isFinite(value) || value < 0 || value > 10000) {
      return NextResponse.json({ error: "The packing charge must be between AED 0 and AED 10,000." }, { status: 422 });
    }
    packingCharges = Math.round(value * 100) / 100;
  }

  const supabase = await createSessionSupabase();

  // Online orders: the sealed payment row (migration 63) — not the editable
  // payment_status copy on orders — decides what may happen next.
  const { data: current, error: readError } = await supabase
    .from("orders")
    .select("payment_method, payment_status, status, tracking_number, tracking_url")
    .eq("id", orderId)
    .maybeSingle();
  if (readError || !current) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  const currentRow = current as {
    payment_method?: string;
    payment_status?: string | null;
    status?: string;
    tracking_number?: string | null;
    tracking_url?: string | null;
  };
  const currentStatus = normalizeOrderStatus(currentRow.status);
  if (typeof body.expectedStatus === "string" && body.expectedStatus.trim()) {
    const expected = normalizeOrderStatus(body.expectedStatus.trim().toLowerCase());
    if (expected !== currentStatus) {
      return NextResponse.json(
        {
          error: "This order changed in the meantime. The page has the latest status now; check it before trying again.",
          currentStatus,
        },
        { status: 409 }
      );
    }
  }

  if (trackingOnly) {
    return updateTrackingOnly(supabase, orderId, currentRow, {
      trackingNumber,
      trackingUrl,
      clearNumber,
      clearUrl,
      notify: body.notifyCustomer === true,
    });
  }

  const status = normalizeOrderStatus(requested);


  // A courier reference is what makes the "out for delivery" note useful.
  if (status === "out_for_delivery" && !(trackingNumber || currentRow.tracking_number)) {
    return NextResponse.json(
      { error: "A tracking number is required to mark an order out for delivery." },
      { status: 422 }
    );
  }

  let paidOnline = false;
  if (currentRow.payment_method === "paymob") {
    const { data: payment } = await supabase
      .from("order_payments")
      .select("state, paid_transaction_id")
      .eq("order_id", orderId)
      .maybeSingle();
    const state = (payment as { state?: string } | null)?.state ?? "awaiting";
    const paid = (payment as { paid_transaction_id?: number | null } | null)?.paid_transaction_id != null;
    const fulfilment: OrderStatus[] = ["accepted", "fulfilled", "out_for_delivery", "delivered"];
    paidOnline = paid;

    if (!paid && fulfilment.includes(status)) {
      return NextResponse.json(
        { error: "This order has not been paid online yet. It can be accepted once Paymob confirms the payment." },
        { status: 409 }
      );
    }
    // A payment that was voided or refunded in full no longer pays for the
    // goods: nothing more of this order may be packed or sent.
    const moneyReturned = currentRow.payment_status === "voided" || currentRow.payment_status === "refunded";
    if (moneyReturned && fulfilment.includes(status)) {
      return NextResponse.json(
        {
          error:
            currentRow.payment_status === "voided"
              ? "This payment was voided, so the order is unpaid. Cancel the order instead of sending it."
              : "This payment was refunded in full, so the order is unpaid. Cancel the order instead of sending it.",
        },
        { status: 409 }
      );
    }
    // Money still held: refund first, so a cancelled order never keeps a payment.
    if (paid && !moneyReturned && status === "cancelled") {
      return NextResponse.json(
        { error: "This order is paid. Refund the payment in full first (Payment section), then cancel it." },
        { status: 409 }
      );
    }
    if (state === "awaiting" && status === "cancelled") {
      return NextResponse.json(
        {
          error:
            "An unpaid online order releases itself — stock and discount included — when its payment window closes. Nothing to do.",
        },
        { status: 409 }
      );
    }
    if ((state === "expired" || state === "cancelled") && !paid && status !== "cancelled") {
      return NextResponse.json(
        { error: "This order was released unpaid and cannot be reopened. Ask the customer to order again." },
        { status: 409 }
      );
    }
  }

  // A cancelled order has had its stock and discount use given back, so it
  // can't quietly come back to life; the customer orders again instead. (An
  // online payment that landed after its order was released is the one
  // exception, handled as before: the owner decides between sending and
  // refunding.)
  if (currentStatus === "cancelled" && status !== "cancelled" && !paidOnline) {
    return NextResponse.json(
      { error: "A cancelled order can't be reopened. Ask the customer to order again." },
      { status: 409 }
    );
  }

  let cancelled: CancelOutcome | null = null;
  if (status === "cancelled" && currentStatus !== "cancelled") {
    // Migration 68: one transaction that cancels the order and gives back what
    // it took — stock, the discount code's use, the customer's spend.
    const outcome = await cancelOrder(supabase, orderId, currentRow.status ?? "", body.restock !== false);
    if (outcome.kind === "changed") {
      return NextResponse.json(
        { error: "This order changed in the meantime. Refresh and check it before trying again." },
        { status: 409 }
      );
    }
    if (outcome.kind === "refused") {
      return NextResponse.json({ error: outcome.error }, { status: 409 });
    }
    if (outcome.kind === "failed") {
      return NextResponse.json({ error: "Could not cancel the order." }, { status: 500 });
    }
    cancelled = outcome.kind === "done" ? outcome : null;
  }

  if (!cancelled) {
    const update: Record<string, unknown> = { status };
    if (trackingNumber) update.tracking_number = trackingNumber;
    if (trackingUrl) update.tracking_url = trackingUrl;
    if (packingCharges !== null) update.packing_charges = packingCharges;

    // Compare-and-set on the status read above: if another tab moved the order
    // in between, nothing changes here (and no second email goes out).
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId)
      .eq("status", currentRow.status ?? "")
      .select("id");
    if (updateError) {
      return NextResponse.json({ error: "Could not update the order." }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "This order changed in the meantime. Refresh and check it before trying again." },
        { status: 409 }
      );
    }
  }

  // Timeline entry. `id` is a SERIAL — let the database assign it (the old
  // client-side code sent `trackingLogs.length + 1`, which collides). The
  // status change already succeeded, so a missing timeline row does not fail
  // the request; the response says whether it was written.
  const entry = TIMELINE[status];
  const reference = trackingNumber ?? (status === "out_for_delivery" ? currentRow.tracking_number : null);
  const { error: trackError } = await supabase.from("order_tracking").insert({
    order_id: orderId,
    status: entry.status,
    location: entry.location,
    description: reference ? `${entry.description} Tracking reference ${reference}.` : entry.description,
  });

  // Notify the customer for the two milestones that matter to them.
  let emailed: string | null = null;
  let email: EmailOutcome = "not_needed";
  if (status === "out_for_delivery" || status === "delivered") {
    const data = await loadOrderEmailData(supabase, orderId, reference ?? null);
    if (data?.recipient) {
      const message =
        status === "out_for_delivery"
          ? outForDeliveryEmail(data.order)
          : orderDeliveredEmail(data.order);
      const result = await sendEmail(
        { to: data.recipient, ...message },
        { quiet: true, idempotencyKey: `order-status/${orderId}/${status}` }
      );
      emailed = result.ok ? data.recipient : null;
      email = result.ok ? "sent" : result.skipped ? "skipped" : "failed";
    } else {
      email = "skipped";
    }
  }

  return NextResponse.json({
    ok: true,
    orderId,
    status,
    trackingNumber: reference ?? null,
    emailed,
    email,
    timelineWritten: !trackError,
    timeline: entry,
    ...(cancelled
      ? {
          restockedUnits: cancelled.restockedUnits,
          discountReturned: cancelled.discountReturned,
          spendReversed: cancelled.spendReversed,
        }
      : {}),
  });
}

type CancelOutcome = {
  kind: "done";
  restockedUnits: number;
  discountReturned: boolean;
  spendReversed: boolean;
};

/**
 * Cancels through admin_cancel_order (migration 68). Before that migration
 * runs the function is missing and this answers "legacy", and the caller falls
 * back to the plain status change it always made (which gives nothing back).
 */
async function cancelOrder(
  supabase: Awaited<ReturnType<typeof createSessionSupabase>>,
  orderId: string,
  expectedStatus: string,
  restock: boolean
): Promise<CancelOutcome | { kind: "legacy" } | { kind: "changed" } | { kind: "refused"; error: string } | { kind: "failed" }> {
  const { data, error } = await supabase.rpc("admin_cancel_order", {
    p_order_id: orderId,
    p_expected_status: expectedStatus,
    p_restock: restock,
  });
  if (error) {
    if (isMissingFunction(error)) return { kind: "legacy" };
    return { kind: "failed" };
  }
  const result = (data ?? {}) as {
    ok?: boolean;
    reason?: string;
    restocked_units?: number;
    discount_returned?: boolean;
    spend_reversed?: boolean;
  };
  if (result.ok) {
    return {
      kind: "done",
      restockedUnits: Number(result.restocked_units) || 0,
      discountReturned: result.discount_returned === true,
      spendReversed: result.spend_reversed === true,
    };
  }
  if (result.reason === "changed" || result.reason === "not_found") return { kind: "changed" };
  if (result.reason === "payment_held") {
    return { kind: "refused", error: "This order is paid. Refund the payment in full first (Payment section), then cancel it." };
  }
  if (result.reason === "awaiting_payment") {
    return {
      kind: "refused",
      error: "An unpaid online order releases itself — stock and discount included — when its payment window closes. Nothing to do.",
    };
  }
  return { kind: "failed" };
}

/** Tracking details only: no status change; emails only when asked to. */
async function updateTrackingOnly(
  supabase: Awaited<ReturnType<typeof createSessionSupabase>>,
  orderId: string,
  current: { status?: string; tracking_number?: string | null; tracking_url?: string | null },
  input: {
    trackingNumber: string | null;
    trackingUrl: string | null;
    clearNumber: boolean;
    clearUrl: boolean;
    notify: boolean;
  }
) {
  const update: Record<string, unknown> = {};
  if (input.trackingNumber) update.tracking_number = input.trackingNumber;
  else if (input.clearNumber) update.tracking_number = null;
  if (input.trackingUrl) update.tracking_url = input.trackingUrl;
  else if (input.clearUrl) update.tracking_url = null;

  const nextNumber = "tracking_number" in update ? (update.tracking_number as string | null) : current.tracking_number ?? null;
  const nextUrl = "tracking_url" in update ? (update.tracking_url as string | null) : current.tracking_url ?? null;
  if (nextNumber === (current.tracking_number ?? null) && nextUrl === (current.tracking_url ?? null)) {
    return NextResponse.json({ error: "Nothing changed. Edit the tracking number or link first." }, { status: 422 });
  }
  const status = normalizeOrderStatus(current.status);
  if (!nextNumber && (status === "out_for_delivery" || status === "shipped")) {
    return NextResponse.json(
      { error: "An order on its way needs a tracking number. Correct it rather than removing it." },
      { status: 422 }
    );
  }

  // Compare-and-set on the status, with a row check: an update the database
  // refused, or an order that moved on meanwhile, is reported, not "saved".
  const { data: updated, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .eq("status", current.status ?? "")
    .select("id");
  if (error) {
    return NextResponse.json({ error: "Could not update the tracking details." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "This order changed in the meantime. Refresh and check it before trying again." },
      { status: 409 }
    );
  }

  const reference = nextNumber;
  const { error: trackError } = await supabase.from("order_tracking").insert({
    order_id: orderId,
    status: "Tracking Updated",
    location: "Local Carrier Hub",
    description: reference ? `Tracking reference ${reference}.` : "Tracking details updated.",
  });

  let email: EmailOutcome = "not_needed";
  let emailed: string | null = null;
  if (input.notify && (status === "out_for_delivery" || status === "shipped")) {
    const data = await loadOrderEmailData(supabase, orderId, reference);
    if (data?.recipient) {
      const result = await sendEmail(
        { to: data.recipient, ...outForDeliveryEmail(data.order) },
        // Keyed on the details: a correction is sent once; the same details are not re-sent.
        { quiet: true, idempotencyKey: `order-tracking/${orderId}/${reference ?? "none"}/${nextUrl ?? "nolink"}` }
      );
      emailed = result.ok ? data.recipient : null;
      email = result.ok ? "sent" : result.skipped ? "skipped" : "failed";
    } else {
      email = "skipped";
    }
  }

  return NextResponse.json({
    ok: true,
    orderId,
    status,
    trackingNumber: reference,
    emailed,
    email,
    timelineWritten: !trackError,
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
      // Migration 70: points and a gift card are shown on their own lines, not as savings.
      discountAed: Math.max(0, discount - num(row.points_value) - num(row.gift_card_amount)),
      totalAed: total,
      packingAed: packingFor(row.payment_method as string | null, row.packing_charges),
      trackingNumber: trackingNumber ?? (row.tracking_number as string | null) ?? null,
      trackingUrl: (row.tracking_url as string | null) ?? null,
      payment: row.payment_method === "paymob" ? { method: "paymob" } : row.payment_method === "credit" ? { method: "credit" } : null,
      giftWrapAed: num(row.gift_wrap_fee),
      pointsAed: num(row.points_value),
      giftCardAed: num(row.gift_card_amount),
    },
  };
}
