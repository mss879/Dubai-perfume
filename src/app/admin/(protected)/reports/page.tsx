import Form from "next/form";
import Link from "next/link";
import { Download, LineChart } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { orderStatusBadge, paymentBadge } from "../../_lib/badges";
import { aed, dubaiDate, dubaiDateTime, plural, serverNow } from "../../_lib/format";
import { REPORT_LIMIT, loadReport, presets, readRange } from "../../_lib/report-data";
import { param } from "../../_lib/search";
import { Badge } from "../../_ui/Badge";
import { Card, CardHeader } from "../../_ui/Card";
import { EmptyState } from "../../_ui/EmptyState";
import { PageHeader } from "../../_ui/PageHeader";
import { cn } from "../../_ui/cn";
import PrintButton from "../orders/_components/PrintButton";

export const metadata = { title: "Sales reports" };
export const dynamic = "force-dynamic";

function rangeLabel(from: string, to: string): string {
  const day = (d: string) => dubaiDate(`${d}T12:00:00+04:00`);
  return from === to ? day(from) : `${day(from)} – ${day(to)}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/reports");
  const params = await searchParams;
  const now = serverNow();
  const { from, to } = readRange(param(params.from), param(params.to), now);
  const supabase = await createSessionSupabase();
  const report = await loadReport(supabase, from, to);
  const shortcuts = presets(now);
  const query = `from=${from}&to=${to}`;

  const figures = [
    { label: "Sales", value: aed(report.sales), note: "Online orders once paid (less refunds) and cash-on-delivery orders once placed. Not cancelled ones. Packing charges not included." },
    { label: "Orders", value: String(report.paidOrders), note: report.cancelled > 0 ? `${report.cancelled} cancelled, not counted` : "None cancelled" },
    { label: "Average order", value: aed(report.average), note: "Sales ÷ orders" },
    { label: "Bottles sold", value: String(report.bottles), note: "From the orders counted" },
  ];

  return (
    <>
      <PageHeader
        title="Sales reports"
        description={`${rangeLabel(from, to)} · Dubai time`}
        actions={
          <>
            <a
              href={`/api/admin/reports/orders?${query}`}
              download
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-[15px] font-medium text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 sm:h-10 sm:text-[14px]"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download CSV
            </a>
            <PrintButton label="Print" />
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3 print:hidden">
        <nav aria-label="Date ranges" className="flex flex-wrap gap-2">
          {shortcuts.map((preset) => {
            const active = preset.from === from && preset.to === to;
            return (
              <Link
                key={preset.key}
                href={`/admin/reports?from=${preset.from}&to=${preset.to}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium ring-1 ring-inset",
                  active ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50"
                )}
              >
                {preset.label}
              </Link>
            );
          })}
        </nav>
        <Form action="/admin/reports" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-neutral-700">
            From
            <input type="date" name="from" defaultValue={from} className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-[16px] text-neutral-900 sm:text-[14px]" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-neutral-700">
            To
            <input type="date" name="to" defaultValue={to} className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-[16px] text-neutral-900 sm:text-[14px]" />
          </label>
          <button type="submit" className="h-10 rounded-lg bg-white px-4 text-[14px] font-medium text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50">
            Show
          </button>
        </Form>
      </div>

      {report.failed ? (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
          Orders couldn&rsquo;t be loaded. Refresh the page to try again.
        </p>
      ) : null}
      {report.truncated ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          Only the newest {REPORT_LIMIT.toLocaleString("en")} orders are included. Choose a shorter range for exact figures.
        </p>
      ) : null}

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
            <dt className="text-[14px] text-neutral-500">{figure.label}</dt>
            <dd className="mt-1 text-[22px] font-semibold tabular-nums text-neutral-900 sm:text-[28px]">{figure.value}</dd>
            <dd className="mt-1 text-[12px] leading-snug text-neutral-500">{figure.note}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Best sellers" description="By bottles sold in this range." />
          {report.bestSellers.length === 0 ? (
            <p className="px-5 py-6 text-[14px] text-neutral-500">Nothing sold in this range.</p>
          ) : (
            <ol className="divide-y divide-neutral-100">
              {report.bestSellers.map((product, index) => (
                <li key={`${product.brand}-${product.name}`} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="w-5 text-[14px] font-semibold text-neutral-400">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium uppercase tracking-wide text-neutral-500">{product.brand}</span>
                    <span className="block truncate text-[14px] text-neutral-900">{product.name}</span>
                  </span>
                  <span className="text-[14px] font-medium tabular-nums text-neutral-900">{plural(product.bottles, "bottle")}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Orders" description={`${plural(report.orders.length, "order")} placed in this range, including cancelled ones.`} />
          {report.orders.length === 0 ? (
            <EmptyState icon={<LineChart className="h-8 w-8" aria-hidden />} title="No orders in this range" />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {report.orders.map((order) => {
                const status = orderStatusBadge(order.status);
                const payment = paymentBadge(order.payment_method ?? "", order.payment_status ?? "");
                const place = [order.shipping_address?.city, order.shipping_address?.country].filter(Boolean).join(", ");
                return (
                  <li key={order.id}>
                    <Link
                      href={`/admin/orders/${encodeURIComponent(order.id)}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-neutral-50 sm:px-5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-neutral-900">
                          {order.shipping_address?.name || order.email} <span className="font-normal text-neutral-500">· {order.id}</span>
                        </span>
                        <span className="block text-[13px] text-neutral-500">
                          {dubaiDateTime(order.created_at)}
                          {place ? ` · ${place}` : ""}
                        </span>
                      </span>
                      <span className="flex gap-1.5">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <Badge tone={payment.tone}>{payment.label}</Badge>
                      </span>
                      <span className="w-24 text-right text-[14px] font-medium tabular-nums text-neutral-900">{aed(order.total_price)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
