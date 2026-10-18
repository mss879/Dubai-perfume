import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { orderStatusBadge, paymentBadge } from "../../../_lib/badges";
import { ordersForCustomers, spendOf } from "../../../_lib/customer-data";
import { aed, dubaiDate, dubaiDateTime } from "../../../_lib/format";
import { Badge } from "../../../_ui/Badge";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { ContactLinks } from "../../../_ui/ContactLinks";
import { PageHeader } from "../../../_ui/PageHeader";
import CustomerNote from "../_components/CustomerNote";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
};

// Shared by the page and its title, so the customer is read once per request.
const loadCustomer = cache(async (id: string) => {
  const supabase = await createSessionSupabase();
  const { data } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, note, is_admin, created_at, street, city, country, postal_code")
    .eq("id", id)
    .maybeSingle();
  return { supabase, customer: data as Customer | null };
});

function nameOf(customer: Customer): string {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email || "Customer";
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Customer" };
  const { customer } = await loadCustomer(id);
  return { title: customer ? nameOf(customer) : "Customer" };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await requireAdmin(`/admin/customers/${id}`);

  const { supabase, customer } = await loadCustomer(id);
  if (!customer) notFound();

  const { orders, refunded, failed } = await ordersForCustomers(supabase, [customer]);
  orders.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const spend = spendOf(orders, refunded);
  const address = [customer.street, customer.city, customer.postal_code, customer.country].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        title={nameOf(customer)}
        description={`Customer since ${dubaiDate(customer.created_at)}`}
        back={{ href: "/admin/customers", label: "Customers" }}
        badges={customer.is_admin ? <Badge tone="blue">Admin</Badge> : null}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: "Spent", value: aed(spend.spent) },
              { label: "Orders", value: String(spend.orders) },
              { label: "Last order", value: spend.lastOrderAt ? dubaiDate(spend.lastOrderAt) : "—" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                <dt className="text-[13px] text-neutral-500">{stat.label}</dt>
                <dd className="mt-1 text-[17px] font-semibold tabular-nums text-neutral-900 sm:text-[20px]">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <Card>
            <CardHeader title="Orders" description="Signed-in orders and guest orders with the same email. Cancelled and unpaid orders don't count towards “Spent”." />
            {failed ? (
              <p role="alert" className="px-5 py-4 text-[14px] text-red-700">
                Some orders couldn&rsquo;t be loaded. Refresh the page to try again.
              </p>
            ) : null}
            {orders.length === 0 ? (
              <p className="px-5 py-6 text-[14px] text-neutral-500">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {orders.map((order) => {
                  const status = orderStatusBadge(order.status);
                  const payment = paymentBadge(order.payment_method ?? "", order.payment_status ?? "");
                  return (
                    <li key={order.id}>
                      <Link
                        href={`/admin/orders/${encodeURIComponent(order.id)}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium text-neutral-900">Order {order.id}</p>
                          <p className="text-[13px] text-neutral-500">{dubaiDateTime(order.created_at)}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Badge tone={status.tone}>{status.label}</Badge>
                          <Badge tone={payment.tone}>{payment.label}</Badge>
                        </div>
                        <span className="w-24 shrink-0 text-right text-[14px] font-medium tabular-nums text-neutral-900">{aed(order.total_price)}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Contact" />
            <CardBody className="flex flex-col gap-3">
              <ContactLinks email={customer.email} phone={customer.phone} />
              {address ? <p className="text-[14px] leading-relaxed text-neutral-600">{address}</p> : null}
            </CardBody>
          </Card>
          <CustomerNote customerId={customer.id} initial={customer.note ?? ""} />
        </div>
      </div>
    </>
  );
}
