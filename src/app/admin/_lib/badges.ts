import { paymentStatusLabel } from "../../lib/payments/status";
import type { Tone } from "../_ui/Badge";

/** One label and colour per order status, everywhere in the admin. */
export function orderStatusBadge(status: string): { label: string; tone: Tone } {
  switch ((status || "").toLowerCase()) {
    case "pending":
    case "processing":
      return { label: "New", tone: "amber" };
    case "accepted":
      return { label: "Accepted", tone: "blue" };
    case "fulfilled":
      return { label: "Packed", tone: "violet" };
    case "shipped":
    case "out_for_delivery":
      return { label: "Out for delivery", tone: "sky" };
    case "delivered":
      return { label: "Delivered", tone: "emerald" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return { label: status || "Unknown", tone: "neutral" };
  }
}

export function paymentBadge(method: string, paymentStatus: string): { label: string; tone: Tone } {
  const label = paymentStatusLabel(method, paymentStatus);
  if (method === "credit") return { label, tone: "emerald" };
  if (method !== "paymob") return { label, tone: "neutral" };
  switch (paymentStatus) {
    case "paid":
      return { label, tone: "emerald" };
    case "partially_refunded":
      return { label, tone: "sky" };
    case "awaiting_payment":
      return { label, tone: "amber" };
    default:
      return { label, tone: "neutral" };
  }
}
