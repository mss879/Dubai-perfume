/**
 * The single order-status vocabulary, shared by the checkout API, the admin
 * registry and the customer tracking stepper.
 *
 * Before this existed the three disagreed: `place_order` wrote a status the
 * admin dropdown did not offer, and the dashboard stepper only recognised
 * "shipped"/"delivered" — so an order marked "out for delivery" still showed
 * as freshly placed, and "shipped" was never written by any live code path.
 */

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "accepted",
  "fulfilled",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** What `place_order` writes for a new cash-on-delivery order. */
export const INITIAL_ORDER_STATUS: OrderStatus = "pending";

/** Operator-facing labels for the admin status dropdown. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending (order placed)",
  processing: "Processing",
  accepted: "Accepted",
  fulfilled: "Fulfilled (packed)",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Statuses an operator may set by hand, in lifecycle order. */
export const ASSIGNABLE_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "fulfilled",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

/** Shopper-facing tracking stepper. */
export const ORDER_STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "preparing", label: "Preparing" },
  { key: "in_transit", label: "In transit" },
  { key: "delivered", label: "Delivered" },
] as const;

const STEP_BY_STATUS: Record<OrderStatus, number> = {
  pending: 0,
  processing: 0,
  accepted: 1,
  fulfilled: 1,
  shipped: 2,
  out_for_delivery: 2,
  delivered: 3,
  cancelled: 0,
};

export function normalizeOrderStatus(status?: string | null): OrderStatus {
  const value = (status || "").toLowerCase().trim();
  return (ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as OrderStatus)
    : "pending";
}

/** Index into ORDER_STEPS for a stored status. Unknown values read as placed. */
export function stepIndexForStatus(status?: string | null): number {
  return STEP_BY_STATUS[normalizeOrderStatus(status)];
}

export function isCancelledOrder(status?: string | null): boolean {
  return normalizeOrderStatus(status) === "cancelled";
}

/** Still owed to the customer — drives the admin "open orders" figures. */
export function isOpenOrder(status?: string | null): boolean {
  const s = normalizeOrderStatus(status);
  return s !== "delivered" && s !== "cancelled";
}

/** Fulfilled and countable as completed revenue. */
export function isCompletedOrder(status?: string | null): boolean {
  return normalizeOrderStatus(status) === "delivered";
}

export function orderStatusLabel(status?: string | null): string {
  return ORDER_STATUS_LABELS[normalizeOrderStatus(status)];
}
