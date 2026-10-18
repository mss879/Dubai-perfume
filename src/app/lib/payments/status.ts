/**
 * The payment vocabulary, shared by the admin panel, the order and tracking
 * pages and the customer dashboard. Client-safe: labels only, no secrets.
 *
 * orders.payment_method is 'cod', 'paymob' or (migration 70) 'credit': an order
 * a gift card and loyalty points paid in full, recorded as 'paid'. For paymob orders
 * orders.payment_status mirrors the sealed state in order_payments
 * (migration 63): awaiting_payment, paid, partially_refunded, refunded,
 * voided, expired (window closed unpaid) or cancelled (shopper cancelled).
 */

export function isOnlinePayment(method?: string | null): boolean {
  return method === "paymob";
}

/** An online order that has not been paid (yet). */
export function isAwaitingOnlinePayment(method?: string | null, status?: string | null): boolean {
  return isOnlinePayment(method) && status === "awaiting_payment";
}

/** Money received and (at least partly) kept. COD counts as settled on delivery. */
export function isOnlinePaid(method?: string | null, status?: string | null): boolean {
  return isOnlinePayment(method) && (status === "paid" || status === "partially_refunded");
}

/** Whether an order may be accepted, packed and shipped. */
export function isPaymentSettledForFulfilment(method?: string | null, status?: string | null): boolean {
  return !isOnlinePayment(method) || isOnlinePaid(method, status);
}

/** Whether an order counts towards revenue figures. */
export function countsAsRevenue(method?: string | null, paymentStatus?: string | null, orderStatus?: string | null): boolean {
  if ((orderStatus || "").toLowerCase() === "cancelled") return false;
  return !isOnlinePayment(method) || isOnlinePaid(method, paymentStatus);
}

/** Paid in full by a gift card and points (migration 70): nothing to collect, nothing online. */
export function isCreditPaid(method?: string | null): boolean {
  return method === "credit";
}

/** Operator-facing label. */
export function paymentStatusLabel(method?: string | null, status?: string | null): string {
  if (isCreditPaid(method)) return "Paid with gift card / points";
  if (!isOnlinePayment(method)) return "Cash on delivery";
  switch (status) {
    case "awaiting_payment":
      return "Awaiting payment";
    case "paid":
      return "Paid online";
    case "partially_refunded":
      return "Partially refunded";
    case "refunded":
      return "Refunded";
    case "voided":
      return "Payment cancelled";
    case "expired":
      return "Payment window closed";
    case "cancelled":
      return "Cancelled before payment";
    default:
      return "Online payment";
  }
}

/** Shopper-facing line under an order's total. */
export function paymentLineForShopper(method?: string | null, status?: string | null): {
  totalLabel: string;
  note: string;
} {
  if (isCreditPaid(method)) {
    return { totalLabel: "Left to pay", note: "Paid in full with your gift card and points. There is nothing to pay on delivery." };
  }
  if (!isOnlinePayment(method)) {
    return {
      totalLabel: "Total due on delivery",
      note: "Nothing has been charged. This order is paid in cash or by card to the courier when your parcel arrives — please have the amount ready.",
    };
  }
  switch (status) {
    case "paid":
      return { totalLabel: "Total paid", note: "Paid in full online. There is nothing to pay on delivery." };
    case "partially_refunded":
      return { totalLabel: "Total paid", note: "Paid online. Part of this payment has been refunded to your original payment method." };
    case "refunded":
      return { totalLabel: "Total refunded", note: "This payment has been refunded to your original payment method." };
    case "voided":
      return { totalLabel: "Order total", note: "The payment was cancelled before it settled. You have not been charged." };
    case "expired":
    case "cancelled":
      return { totalLabel: "Order total", note: "This order was not paid, and nothing was charged." };
    default:
      return { totalLabel: "Order total", note: "We are waiting for confirmation of your payment." };
  }
}
