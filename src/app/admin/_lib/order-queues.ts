import { isPaymentSettledForFulfilment } from "../../lib/payments/status";

/**
 * Which "to-do" queue an order sits in. Shared by the badge counts, the Today
 * page and the Orders tabs, so the three can never disagree.
 */

export type OrderQueue = "accept" | "pack" | "dispatch" | "delivering" | "awaiting_payment";

/** Statuses of orders that still need something done (or are on their way). */
export const OPEN_STATUSES = [
  "pending",
  "processing",
  "accepted",
  "fulfilled",
  "shipped",
  "out_for_delivery",
] as const;

export type QueueOrder = {
  status: string | null;
  payment_method: string | null;
  payment_status: string | null;
  /** Migration 70 marks a digital gift card order in its address ({ kind: "gift_card" }): nothing to pack. */
  shipping_address?: unknown;
  gift_card?: boolean;
};

export function isGiftCardOrder(order: Pick<QueueOrder, "shipping_address" | "gift_card">): boolean {
  if (order.gift_card === true) return true;
  const address = order.shipping_address;
  return Boolean(address && typeof address === "object" && (address as { kind?: unknown }).kind === "gift_card");
}

/** An online payment that was voided or refunded in full: the order is no longer paid for. */
export function paymentReturned(order: Pick<QueueOrder, "payment_method" | "payment_status">): boolean {
  return order.payment_method === "paymob" && (order.payment_status === "voided" || order.payment_status === "refunded");
}

export function queueOf(order: QueueOrder): OrderQueue | null {
  const status = (order.status ?? "").toLowerCase();
  // Nothing more to send; the order page offers Cancel instead.
  if (paymentReturned(order)) return null;
  // A gift card is emailed by the store itself, never packed.
  if (isGiftCardOrder(order)) return null;
  switch (status) {
    case "pending":
    case "processing":
      // An online order is only workable once Paymob has confirmed the money.
      return isPaymentSettledForFulfilment(order.payment_method, order.payment_status)
        ? "accept"
        : "awaiting_payment";
    case "accepted":
      return "pack";
    case "fulfilled":
      return "dispatch";
    case "shipped":
    case "out_for_delivery":
      return "delivering";
    default:
      return null;
  }
}

/** The next action for an order, in plain words, or null when none is due. */
export function nextStepFor(order: QueueOrder): { action: NextAction; label: string } | null {
  const queue = queueOf(order);
  switch (queue) {
    case "accept":
      return { action: "accept", label: "Accept order" };
    case "pack":
      return { action: "pack", label: "Mark as packed" };
    case "dispatch":
      return { action: "dispatch", label: "Dispatch" };
    case "delivering":
      return { action: "deliver", label: "Mark as delivered" };
    default:
      return null;
  }
}

export type NextAction = "accept" | "pack" | "dispatch" | "deliver";

/** The status each action moves an order to (as /api/admin/order-status expects). */
export const ACTION_TARGET: Record<NextAction, string> = {
  accept: "accepted",
  pack: "fulfilled",
  dispatch: "out_for_delivery",
  deliver: "delivered",
};
