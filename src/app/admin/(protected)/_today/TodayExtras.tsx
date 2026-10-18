import Link from "next/link";
import { countsAsRevenue } from "../../../lib/payments/status";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { orderStatusBadge } from "../../_lib/badges";
import { aed, ago, dubaiMidnightIso, serverNow } from "../../_lib/format";
import { ORDER_SUMMARY_COLUMNS, linesLabel, toSummary } from "../../_lib/order-data";
import { queueOf } from "../../_lib/order-queues";
import { keptOf, partialRefunds } from "../../_lib/refunds";
import { Badge } from "../../_ui/Badge";
import { ButtonLink } from "../../_ui/Button";
import { Card, CardHeader } from "../../_ui/Card";
import OrderNextStep from "../orders/_components/OrderNextStep";

/**
 * Today's second half: the money taken since midnight (Dubai), and the five
 * orders that have waited longest, each with its next step — so most days the
 * owner can work straight from here.
 */
export default async function TodayExtras() {
  const supabase = await createSessionSupabase();
  const now = serverNow();
  const midnight = dubaiMidnightIso(now);

  const [waitingRes, todayRes] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_SUMMARY_COLUMNS)
      .in("status", ["pending", "processing", "accepted", "fulfilled"])
      .order("created_at", { ascending: true })
      .limit(60),
    supabase
      .from("orders")
      .select("id, total_price, status, payment_method, payment_status")
      .gte("created_at", midnight),
  ]);

  const waiting = (waitingRes.data ?? [])
    .map((row) => toSummary(row as unknown as Record<string, unknown>))
    .filter((order) => {
      const queue = queueOf({ status: order.status, payment_method: order.paymentMethod, payment_status: order.paymentStatus, gift_card: order.giftCard });
      return queue === "accept" || queue === "pack" || queue === "dispatch";
    })
    .slice(0, 5);

  const todayRows = (todayRes.data ?? []) as {
    id: string;
    total_price: number | string | null;
    status: string | null;
    payment_method: string | null;
    payment_status: string | null;
  }[];
  const counted = todayRows.filter((row) => countsAsRevenue(row.payment_method, row.payment_status, row.status));
  // A partly refunded order counts at what the shop kept, as in Reports.
  const { refunded } = await partialRefunds(supabase, counted);
  const salesToday = counted.reduce((sum, row) => sum + keptOf(row, refunded), 0);

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Waiting longest"
          description="Oldest first. Work down the list."
          actions={
            <ButtonLink href="/admin/orders" variant="plain" size="sm">
              All to-do
            </ButtonLink>
          }
        />
        {waiting.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-neutral-500">Nothing is waiting. New orders appear here as they come in.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {waiting.map((order) => {
              const status = orderStatusBadge(order.status);
              return (
                <li key={order.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="group min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-neutral-900 group-hover:underline">{order.id}</span>
                      <Badge tone={status.tone} dot>
                        {status.label}
                      </Badge>
                      <span className="text-[13px] text-neutral-500">{ago(order.createdAt, now)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[14px] text-neutral-600">
                      {order.name} · {linesLabel(order.lines)}
                    </span>
                  </Link>
                  <div className="sm:w-48 sm:shrink-0">
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
                      size="sm"
                      fullWidth
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Sales today" description="Since midnight, Dubai time" />
        <div className="px-4 py-5 sm:px-5">
          <p className="text-[32px] font-semibold leading-none tabular-nums tracking-tight text-neutral-900">{aed(salesToday)}</p>
          <p className="mt-2 text-[14px] text-neutral-500">
            {counted.length} {counted.length === 1 ? "order" : "orders"}
            {todayRows.length > counted.length
              ? ` · ${todayRows.length - counted.length} not counted (unpaid online or cancelled)`
              : ""}
          </p>
        </div>
      </Card>
    </div>
  );
}
