import type { SupabaseClient } from "@supabase/supabase-js";
import { OPEN_STATUSES, queueOf, type QueueOrder } from "./order-queues";
import { fetchAll } from "./fetch-all";

/**
 * The numbers behind the navigation badges and the Today cards.
 *
 * Four small reads with the admin's own session (RLS applies): the open
 * orders, the payment rows' state, the stock table and the count of new
 * messages. Each fails soft to zero, so a missing table never takes the admin
 * down with it.
 */

export type AdminCounts = {
  accept: number;
  pack: number;
  dispatch: number;
  delivering: number;
  awaitingPayment: number;
  paymentIssues: number;
  lowStock: number;
  outOfStock: number;
  messages: number;
  /** accept + pack + dispatch: the Orders badge. */
  needsAction: number;
  /** lowStock + outOfStock: the Products badge. */
  stockAlerts: number;
  /** When these were read (server clock, ms). Newer readings win on the client. */
  at: number;
};

type InventoryRow = { stock_level: number | null; low_stock_threshold: number | null };
type PaymentRow = { attention: string[] | null };

export function computeCounts(
  orders: QueueOrder[],
  payments: PaymentRow[],
  inventory: InventoryRow[],
  messages: number,
  at: number
): AdminCounts {
  const counts = {
    accept: 0,
    pack: 0,
    dispatch: 0,
    delivering: 0,
    awaitingPayment: 0,
    paymentIssues: 0,
    lowStock: 0,
    outOfStock: 0,
  };

  for (const order of orders) {
    switch (queueOf(order)) {
      case "accept":
        counts.accept += 1;
        break;
      case "pack":
        counts.pack += 1;
        break;
      case "dispatch":
        counts.dispatch += 1;
        break;
      case "delivering":
        counts.delivering += 1;
        break;
      case "awaiting_payment":
        counts.awaitingPayment += 1;
        break;
    }
  }

  for (const payment of payments) {
    if (Array.isArray(payment.attention) && payment.attention.length > 0) counts.paymentIssues += 1;
  }

  for (const row of inventory) {
    const level = Number(row.stock_level ?? 0);
    const threshold = Number(row.low_stock_threshold ?? 5);
    if (level <= 0) counts.outOfStock += 1;
    else if (level <= threshold) counts.lowStock += 1;
  }

  return {
    ...counts,
    messages,
    needsAction: counts.accept + counts.pack + counts.dispatch,
    stockAlerts: counts.lowStock + counts.outOfStock,
    at,
  };
}

export async function readCounts(supabase: SupabaseClient): Promise<AdminCounts> {
  // Paged reads: Supabase returns at most 1,000 rows a request, and a count
  // that silently stops at 1,000 would hide newer orders or stock alerts.
  const [orders, payments, inventory, messages] = await Promise.all([
    fetchAll<QueueOrder>((from, to) =>
      supabase
        .from("orders")
        .select("status, payment_method, payment_status, shipping_address")
        .in("status", [...OPEN_STATUSES])
        .order("id")
        .range(from, to)
    ),
    // Only the rows that need attention. Named columns only: the row also
    // holds the shopper's token hash.
    fetchAll<PaymentRow>((from, to) =>
      supabase.from("order_payments").select("attention").neq("attention", "{}").order("order_id").range(from, to)
    ),
    fetchAll<InventoryRow>((from, to) =>
      supabase
        .from("inventory")
        .select("stock_level, low_stock_threshold")
        .order("product_id")
        .order("size")
        .range(from, to)
    ),
    supabase.from("contact_inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  return computeCounts(orders.rows, payments.rows, inventory.rows, messages.count ?? 0, readingTime());
}

/** Kept out of any component body: reading the clock is not a render concern. */
function readingTime(): number {
  return Date.now();
}
