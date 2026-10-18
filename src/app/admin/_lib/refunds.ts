import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How much of each partly refunded online order went back to the customer, in
 * AED. A partly refunded order counts at what the shop kept, so every figure
 * of money taken (reports, Today, a customer's spend) subtracts this.
 */
export async function partialRefunds(
  supabase: SupabaseClient,
  orders: { id: string; payment_status: string | null }[]
): Promise<{ refunded: Map<string, number>; failed: boolean }> {
  const ids = orders.filter((o) => o.payment_status === "partially_refunded").map((o) => o.id);
  const refunded = new Map<string, number>();
  if (ids.length === 0) return { refunded, failed: false };
  let failed = false;
  for (let i = 0; i < ids.length; i += 200) {
    // Named columns only: the payment row also holds the shopper's token hash.
    const { data, error } = await supabase
      .from("order_payments")
      .select("order_id, refunded_fils")
      .in("order_id", ids.slice(i, i + 200));
    if (error) failed = true;
    for (const row of (data ?? []) as { order_id: string; refunded_fils: number | null }[]) {
      refunded.set(row.order_id, (Number(row.refunded_fils) || 0) / 100);
    }
  }
  return { refunded, failed };
}

/** What the shop kept of one order. */
export function keptOf(order: { id: string; total_price: number | string | null }, refunded: Map<string, number>): number {
  return Math.max(0, (Number(order.total_price) || 0) - (refunded.get(order.id) ?? 0));
}
