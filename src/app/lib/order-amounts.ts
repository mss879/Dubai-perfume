import { isOnlinePayment } from "./payments/status";

/**
 * Packing is collected with a cash-on-delivery order, on top of its total; an
 * order paid online was charged its total and nothing more. The same rule as
 * the customer dashboard, so every page and email names the same amount.
 */
export function packingFor(method: string | null | undefined, packing: unknown): number {
  // Paid online, or in full by a gift card and points (migration 70): nothing is collected.
  if (isOnlinePayment(method) || method === "credit") return 0;
  const n = parseFloat(String(packing ?? 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** What the customer pays in all: the order total plus any packing charge. */
export function amountDue(total: unknown, method: string | null | undefined, packing: unknown): number {
  const t = parseFloat(String(total ?? 0));
  return (Number.isFinite(t) ? t : 0) + packingFor(method, packing);
}
