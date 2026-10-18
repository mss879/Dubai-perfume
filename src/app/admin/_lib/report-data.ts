import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countsAsRevenue } from "../../lib/payments/status";
import { fetchAll } from "./fetch-all";
import { keptOf, partialRefunds } from "./refunds";

/**
 * Sales for a span of Dubai calendar days. Revenue is money kept: cancelled
 * orders, unpaid online orders and refunded ones don't count
 * (lib/payments/status.ts), and neither do their bottles.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in Dubai, YYYY-MM-DD. */
export function dubaiToday(now: number): string {
  return new Date(now + DUBAI_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function monthStart(date: string, monthsBack = 0): string {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

export function isDate(value: string): boolean {
  return DATE.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && addDays(value, 0) === value;
}

/** A valid from/to pair (inclusive), defaulting to the last 30 days, at most about five years long. */
export function readRange(fromRaw: string, toRaw: string, now: number): { from: string; to: string } {
  const today = dubaiToday(now);
  let to = isDate(toRaw) ? toRaw : today;
  let from = isDate(fromRaw) ? fromRaw : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  if (Date.parse(to) - Date.parse(from) > 1900 * DAY_MS) from = addDays(to, -1900);
  return { from, to };
}

export function presets(now: number): { key: string; label: string; from: string; to: string }[] {
  const today = dubaiToday(now);
  const lastMonthEnd = addDays(monthStart(today), -1);
  return [
    { key: "7", label: "Last 7 days", from: addDays(today, -6), to: today },
    { key: "30", label: "Last 30 days", from: addDays(today, -29), to: today },
    { key: "month", label: "This month", from: monthStart(today), to: today },
    { key: "last-month", label: "Last month", from: monthStart(lastMonthEnd), to: lastMonthEnd },
    { key: "3m", label: "Last 3 months", from: monthStart(today, 2), to: today },
    { key: "year", label: "This year", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
}

/** The span as UTC instants: from Dubai midnight on `from` to Dubai midnight after `to`. */
function bounds(from: string, to: string) {
  return {
    start: new Date(Date.parse(`${from}T00:00:00Z`) - DUBAI_OFFSET_MS).toISOString(),
    end: new Date(Date.parse(`${addDays(to, 1)}T00:00:00Z`) - DUBAI_OFFSET_MS).toISOString(),
  };
}

export type ReportOrder = {
  id: string;
  email: string | null;
  created_at: string;
  status: string;
  total_price: number | string | null;
  payment_method: string | null;
  payment_status: string | null;
  shipping_address: { name?: string; street?: string; city?: string; country?: string; postal_code?: string } | null;
  order_items: { quantity: number | null; product_id: number | null; products: { name: string | null; brand: string | null } | null }[] | null;
};

export const REPORT_LIMIT = 5000;

export async function loadReport(supabase: SupabaseClient, from: string, to: string) {
  const { start, end } = bounds(from, to);
  const { rows, failed, truncated } = await fetchAll<ReportOrder>(
    (first, last) =>
      supabase
        .from("orders")
        .select(
          "id, email, created_at, status, total_price, payment_method, payment_status, shipping_address, order_items(quantity, product_id, products(name, brand))"
        )
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
        .order("id")
        .range(first, last) as unknown as PromiseLike<{ data: ReportOrder[] | null; error: unknown }>,
    REPORT_LIMIT
  );
  const orders = rows;

  // A partly refunded online order counts at what was kept, not its full total.
  const { refunded, failed: refundsFailed } = await partialRefunds(supabase, orders);

  let sales = 0;
  let paidOrders = 0;
  let bottles = 0;
  let cancelled = 0;
  const byProduct = new Map<string, { name: string; brand: string; bottles: number }>();
  for (const order of orders) {
    if (order.status === "cancelled") cancelled += 1;
    if (!countsAsRevenue(order.payment_method, order.payment_status, order.status)) continue;
    paidOrders += 1;
    sales += keptOf(order, refunded);
    for (const item of order.order_items ?? []) {
      const quantity = Number(item.quantity) || 0;
      bottles += quantity;
      const key = String(item.product_id ?? `${item.products?.brand}-${item.products?.name}`);
      const entry = byProduct.get(key) ?? { name: item.products?.name ?? "A deleted product", brand: item.products?.brand ?? "", bottles: 0 };
      entry.bottles += quantity;
      byProduct.set(key, entry);
    }
  }

  return {
    orders,
    failed: failed || refundsFailed,
    truncated,
    refunded,
    sales: Math.round(sales * 100) / 100,
    paidOrders,
    average: paidOrders > 0 ? Math.round((sales / paidOrders) * 100) / 100 : 0,
    bottles,
    cancelled,
    bestSellers: [...byProduct.values()].sort((a, b) => b.bottles - a.bottles).slice(0, 5),
  };
}
