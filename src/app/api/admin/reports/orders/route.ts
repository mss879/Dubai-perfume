import { NextRequest, NextResponse } from "next/server";
import { getAdminIdentity } from "../../../../lib/auth";
import { countsAsRevenue } from "../../../../lib/payments/status";
import { createSessionSupabase, isSupabaseConfigured } from "../../../../lib/supabase-server";
import { loadReport, readRange } from "../../../../admin/_lib/report-data";

/** The orders in a date range as a spreadsheet (CSV), for the accountant. */

export const dynamic = "force-dynamic";

/** Quote every cell, and defuse cells a spreadsheet would run as a formula. */
function cell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured || !(await getAdminIdentity())) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  const { from, to } = readRange(
    request.nextUrl.searchParams.get("from") ?? "",
    request.nextUrl.searchParams.get("to") ?? "",
    Date.now()
  );
  const supabase = await createSessionSupabase();
  const report = await loadReport(supabase, from, to);
  if (report.failed) return NextResponse.json({ error: "Orders couldn't be loaded." }, { status: 500 });
  // A spreadsheet that silently stops part-way would be worse than none.
  if (report.truncated) {
    return NextResponse.json(
      { error: "That range has more than 5,000 orders. Download it in shorter ranges." },
      { status: 422 }
    );
  }

  const header = ["Order", "Placed (Dubai time)", "Status", "Payment", "Payment status", "Counts as sale", "Total (AED)", "Refunded (AED)", "Bottles", "Name", "Email", "Street", "City", "Country", "Postal code"];
  const placed = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", dateStyle: "short", timeStyle: "short" });
  const lines = report.orders.map((order) => {
    const address = order.shipping_address ?? {};
    const bottles = (order.order_items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return [
      order.id,
      placed.format(new Date(order.created_at)),
      order.status,
      order.payment_method ?? "",
      order.payment_status ?? "",
      countsAsRevenue(order.payment_method, order.payment_status, order.status) ? "yes" : "no",
      (Number(order.total_price) || 0).toFixed(2),
      (report.refunded.get(order.id) ?? 0).toFixed(2),
      bottles,
      address.name ?? "",
      order.email ?? "",
      address.street ?? "",
      address.city ?? "",
      address.country ?? "",
      address.postal_code ?? "",
    ]
      .map(cell)
      .join(",");
  });
  // The byte-order mark makes Excel read Arabic names correctly.
  const csv = `﻿${[header.map(cell).join(","), ...lines].join("\r\n")}\r\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gharib-orders-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
