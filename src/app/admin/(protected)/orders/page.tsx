import Form from "next/form";
import Link from "next/link";
import { CheckCircle2, Phone, Search, SearchX } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { orderStatusBadge, paymentBadge } from "../../_lib/badges";
import { aed, ago, serverNow } from "../../_lib/format";
import { ORDER_SUMMARY_COLUMNS, linesLabel, orderSearchFilter, toSummary, type OrderSummary } from "../../_lib/order-data";
import { OPEN_STATUSES, queueOf, type OrderQueue } from "../../_lib/order-queues";
import { loadCounts } from "../../_lib/queries";
import { Badge } from "../../_ui/Badge";
import { ButtonLink } from "../../_ui/Button";
import { Card } from "../../_ui/Card";
import { EmptyState } from "../../_ui/EmptyState";
import { LinkTabs, type LinkTab } from "../../_ui/LinkTabs";
import { PageHeader } from "../../_ui/PageHeader";
import OrderNextStep from "./_components/OrderNextStep";
import { fetchAll } from "../../_lib/fetch-all";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const VIEWS = [
  "todo",
  "accept",
  "pack",
  "dispatch",
  "delivering",
  "awaiting_payment",
  "payment_issues",
  "delivered",
  "cancelled",
  "all",
] as const;
type View = (typeof VIEWS)[number];

/** Views drawn from the (small) set of open orders, oldest first. */
const QUEUE_VIEWS: Partial<Record<View, OrderQueue[]>> = {
  todo: ["accept", "pack", "dispatch"],
  accept: ["accept"],
  pack: ["pack"],
  dispatch: ["dispatch"],
  delivering: ["delivering"],
  awaiting_payment: ["awaiting_payment"],
};

const PAGE_SIZE = 25;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function hrefFor(view: View, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  if (view !== "todo") params.set("view", view);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "" && value !== 1) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

type Loaded = { orders: OrderSummary[]; total: number; paged: boolean; failed: boolean };

async function loadOrders(view: View, q: string, page: number): Promise<Loaded> {
  const supabase = await createSessionSupabase();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (q) {
    const filter = orderSearchFilter(q);
    if (!filter) return { orders: [], total: 0, paged: true, failed: false };
    const { data, count, error } = await supabase
      .from("orders")
      .select(ORDER_SUMMARY_COLUMNS, { count: "exact" })
      .or(filter)
      .order("created_at", { ascending: false })
      .range(from, to);
    return { orders: (data ?? []).map((row) => toSummary(row as unknown as Record<string, unknown>)), total: count ?? 0, paged: true, failed: Boolean(error) };
  }

  const queues = QUEUE_VIEWS[view];
  if (queues) {
    // Every open order, in pages: a queue that stopped at a fixed number would
    // leave the newest orders out of "To accept".
    const { rows: data, failed: error } = await fetchAll<Record<string, unknown>>((from, to) =>
      supabase
        .from("orders")
        .select(ORDER_SUMMARY_COLUMNS)
        .in("status", [...OPEN_STATUSES])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>
    );
    const orders = data
      .map((row) => toSummary(row))
      .filter((order) => {
        const queue = queueOf({ status: order.status, payment_method: order.paymentMethod, payment_status: order.paymentStatus, gift_card: order.giftCard });
        return queue !== null && queues.includes(queue);
      });
    return { orders, total: orders.length, paged: false, failed: Boolean(error) };
  }

  if (view === "payment_issues") {
    // Named columns only: the payment row also holds the shopper's token hash.
    const { data: payments, error: paymentError } = await supabase
      .from("order_payments")
      .select("order_id, attention")
      .neq("attention", "{}");
    const ids = (payments ?? [])
      .filter((p) => Array.isArray(p.attention) && p.attention.length > 0)
      .map((p) => String(p.order_id))
      .slice(0, 200);
    if (ids.length === 0) return { orders: [], total: 0, paged: false, failed: Boolean(paymentError) };
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SUMMARY_COLUMNS)
      .in("id", ids)
      .order("created_at", { ascending: false });
    const orders = (data ?? []).map((row) => toSummary(row as unknown as Record<string, unknown>));
    return { orders, total: orders.length, paged: false, failed: Boolean(error || paymentError) };
  }

  let query = supabase.from("orders").select(ORDER_SUMMARY_COLUMNS, { count: "exact" });
  if (view === "delivered") query = query.eq("status", "delivered");
  if (view === "cancelled") query = query.eq("status", "cancelled");
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
  return { orders: (data ?? []).map((row) => toSummary(row as unknown as Record<string, unknown>)), total: count ?? 0, paged: true, failed: Boolean(error) };
}

function OrderRow({ order, now }: { order: OrderSummary; now: number }) {
  const status = orderStatusBadge(order.status);
  const payment = paymentBadge(order.paymentMethod, order.paymentStatus);
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_auto_auto] lg:items-center lg:gap-6">
      <Link
        href={`/admin/orders/${encodeURIComponent(order.id)}`}
        className="group flex min-w-0 flex-col gap-1 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-neutral-900 group-hover:underline">{order.id}</span>
          <span className="text-[13px] text-neutral-500">{ago(order.createdAt, now)}</span>
        </span>
        <span className="truncate text-[14px] text-neutral-700">
          {order.name}
          {order.city ? <span className="text-neutral-500"> · {order.city}</span> : null}
        </span>
      </Link>

      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="truncate text-[14px] text-neutral-700">{linesLabel(order.lines)}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          <Badge tone={payment.tone}>{payment.label}</Badge>
          {order.phone ? (
            <a
              href={`tel:${order.phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50"
            >
              <Phone className="h-3 w-3" aria-hidden />
              Call
            </a>
          ) : null}
        </div>
      </div>

      <p className="text-[15px] font-semibold tabular-nums text-neutral-900 lg:text-right">{aed(order.total)}</p>

      <div className="lg:w-48 lg:text-right">
        <OrderNextStep
          order={{
            id: order.id,
            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            total: order.total,
            packingCharges: order.packingCharges,
            name: order.name,
            giftCard: order.giftCard,
          }}
          fullWidth
        />
      </div>
    </li>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/orders");
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 80);
  const requestedView = one(params.view);
  const view: View = (VIEWS as readonly string[]).includes(requestedView) ? (requestedView as View) : "todo";
  const page = Math.max(1, Math.min(1000, parseInt(one(params.page), 10) || 1));

  const [counts, loaded] = await Promise.all([loadCounts(), loadOrders(view, q, page)]);
  const now = serverNow();

  const tabs: LinkTab[] = [
    { key: "todo", label: "To do", href: hrefFor("todo"), count: counts.needsAction, urgent: true },
    { key: "accept", label: "To accept", href: hrefFor("accept"), count: counts.accept, urgent: true },
    { key: "pack", label: "To pack", href: hrefFor("pack"), count: counts.pack, urgent: true },
    { key: "dispatch", label: "To dispatch", href: hrefFor("dispatch"), count: counts.dispatch, urgent: true },
    { key: "delivering", label: "Out for delivery", href: hrefFor("delivering"), count: counts.delivering },
    { key: "awaiting_payment", label: "Awaiting payment", href: hrefFor("awaiting_payment"), count: counts.awaitingPayment },
    ...(counts.paymentIssues > 0 || view === "payment_issues"
      ? [{ key: "payment_issues", label: "Payment issues", href: hrefFor("payment_issues"), count: counts.paymentIssues, urgent: true }]
      : []),
    { key: "delivered", label: "Delivered", href: hrefFor("delivered") },
    { key: "cancelled", label: "Cancelled", href: hrefFor("cancelled") },
    { key: "all", label: "All", href: hrefFor("all") },
  ];

  const lastPage = Math.max(1, Math.ceil(loaded.total / PAGE_SIZE));
  const firstShown = loaded.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, loaded.total);

  return (
    <>
      <PageHeader title="Orders" description="Work through them left to right: accept, pack, dispatch, deliver." />

      <Form action="/admin/orders" role="search" className="mb-4">
        <label htmlFor="orders-search" className="sr-only">
          Search orders
        </label>
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            id="orders-search"
            name="q"
            type="search"
            defaultValue={q}
            autoComplete="off"
            placeholder="Order number, name, phone or email"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-[16px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 sm:h-10 sm:text-[14px]"
          />
        </div>
      </Form>

      {q ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-[14px] text-neutral-600">
          <span>
            {loaded.total} {loaded.total === 1 ? "order matches" : "orders match"} &ldquo;{q}&rdquo;
          </span>
          <Link href="/admin/orders" className="font-medium text-neutral-900 underline underline-offset-2">
            Clear search
          </Link>
        </div>
      ) : (
        <div className="mb-4">
          <LinkTabs tabs={tabs} active={view} label="Order views" />
        </div>
      )}

      <Card>
        {loaded.failed ? (
          <p role="alert" className="px-5 py-4 text-[14px] text-red-700">
            Some orders couldn&rsquo;t be loaded. Refresh the page to try again.
          </p>
        ) : null}
        {loaded.orders.length === 0 ? (
          q ? (
            <EmptyState
              icon={<SearchX className="h-8 w-8" aria-hidden />}
              title="No orders match"
              description="Try the order number (like ORD-10500), the customer's email, or part of their name or phone number."
            />
          ) : view === "todo" ? (
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden />}
              title="All caught up"
              description="No orders are waiting to be accepted, packed or dispatched."
              action={
                <ButtonLink href={hrefFor("all")} variant="secondary">
                  See all orders
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState title="Nothing here" description="No orders in this list right now." />
          )
        ) : (
          <ul className="divide-y divide-neutral-100">
            {loaded.orders.map((order) => (
              <OrderRow key={order.id} order={order} now={now} />
            ))}
          </ul>
        )}
      </Card>

      {loaded.paged && loaded.total > PAGE_SIZE ? (
        <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[14px] text-neutral-600">
          <span>
            Showing {firstShown}–{lastShown} of {loaded.total}
          </span>
          <span className="flex gap-2">
            {page > 1 ? (
              <ButtonLink href={hrefFor(view, { q, page: page - 1 })} variant="secondary" size="sm">
                Previous
              </ButtonLink>
            ) : null}
            {page < lastPage ? (
              <ButtonLink href={hrefFor(view, { q, page: page + 1 })} variant="secondary" size="sm">
                Next
              </ButtonLink>
            ) : null}
          </span>
        </nav>
      ) : null}
    </>
  );
}
