import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countsAsRevenue } from "../../lib/payments/status";
import { keptOf, partialRefunds } from "./refunds";

/** A customer's orders and what they actually spent (cancelled and unpaid orders don't count). */

export type CustomerOrder = {
  id: string;
  customer_id: string | null;
  email: string | null;
  created_at: string;
  status: string;
  total_price: number | string | null;
  payment_method: string | null;
  payment_status: string | null;
};

export const CUSTOMER_ORDER_COLUMNS = "id, customer_id, email, created_at, status, total_price, payment_method, payment_status";

export type Spend = { orders: number; spent: number; lastOrderAt: string | null };

/** `refunded`: what went back on partly refunded orders (see refunds.ts), subtracted from the spend. */
export function spendOf(orders: CustomerOrder[], refunded: Map<string, number> = new Map()): Spend {
  let spent = 0;
  let count = 0;
  let lastOrderAt: string | null = null;
  for (const order of orders) {
    if (!lastOrderAt || order.created_at > lastOrderAt) lastOrderAt = order.created_at;
    if (order.status === "cancelled") continue;
    count += 1;
    if (countsAsRevenue(order.payment_method, order.payment_status, order.status)) {
      spent += keptOf(order, refunded);
    }
  }
  return { orders: count, spent: Math.round(spent * 100) / 100, lastOrderAt };
}

/** Orders placed while signed in, plus orders placed as a guest with the same email. */
export async function ordersForCustomers(
  supabase: SupabaseClient,
  customers: { id: string; email: string | null }[]
): Promise<{ orders: CustomerOrder[]; refunded: Map<string, number>; failed: boolean }> {
  if (customers.length === 0) return { orders: [], refunded: new Map(), failed: false };
  const ids = customers.map((c) => c.id);
  const emails = [
    ...new Set(customers.flatMap((c) => (c.email ? [c.email, c.email.toLowerCase()] : []))),
  ];
  const [byId, byEmail] = await Promise.all([
    supabase.from("orders").select(CUSTOMER_ORDER_COLUMNS).in("customer_id", ids).limit(2000),
    emails.length > 0
      ? supabase.from("orders").select(CUSTOMER_ORDER_COLUMNS).in("email", emails).limit(2000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const seen = new Map<string, CustomerOrder>();
  for (const row of [...(byId.data ?? []), ...(byEmail.data ?? [])] as CustomerOrder[]) seen.set(row.id, row);
  const orders = [...seen.values()];
  const { refunded, failed: refundsFailed } = await partialRefunds(supabase, orders);
  return { orders, refunded, failed: Boolean(byId.error || byEmail.error || refundsFailed) };
}

/** Which of `orders` belong to this customer. */
export function ordersOf(customer: { id: string; email: string | null }, orders: CustomerOrder[]): CustomerOrder[] {
  const email = customer.email?.toLowerCase() ?? null;
  return orders.filter((o) => o.customer_id === customer.id || (email !== null && o.email?.toLowerCase() === email));
}
