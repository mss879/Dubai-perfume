import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { ordersForCustomers, ordersOf, spendOf } from "../../_lib/customer-data";
import { aed, dubaiDate, plural } from "../../_lib/format";
import { cleanSearch, ilikeAny, pageParam, param, phoneDigits } from "../../_lib/search";
import { Badge } from "../../_ui/Badge";
import { Card } from "../../_ui/Card";
import { EmptyState } from "../../_ui/EmptyState";
import { PageHeader } from "../../_ui/PageHeader";
import { Pager } from "../../_ui/Pager";
import { SearchForm } from "../../_ui/SearchForm";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  is_admin: boolean | null;
  created_at: string | null;
};

function hrefFor(q: string, page = 1): string {
  const search = new URLSearchParams();
  if (q) search.set("q", q);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/admin/customers?${query}` : "/admin/customers";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/customers");
  const params = await searchParams;
  const q = cleanSearch(param(params.q));
  const page = pageParam(params.page);

  const supabase = await createSessionSupabase();
  let query = supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, note, is_admin, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const filters = [ilikeAny(q, ["first_name", "last_name", "email", "phone"])];
  const digits = phoneDigits(q);
  if (digits) filters.push(`phone.ilike."*${digits}*"`);
  const filter = filters.filter(Boolean).join(",");
  if (filter) query = query.or(filter);

  const { data, count, error } = await query;
  const customers = (data ?? []) as Customer[];
  const { orders, refunded } = await ordersForCustomers(supabase, customers);

  return (
    <>
      <PageHeader title="Customers" description="Everyone with an account. Open one to see their orders and keep a note." />

      <SearchForm action="/admin/customers" defaultValue={q} placeholder="Name, email or phone" label="Search customers" />

      <Card>
        {error ? (
          <p role="alert" className="px-5 py-4 text-[14px] text-red-700">
            Customers couldn&rsquo;t be loaded. Refresh the page to try again.
          </p>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" aria-hidden />}
            title={q ? "No customers match" : "No customers yet"}
            description={q ? "Try part of a name, an email address or a phone number." : "Customers appear here when they create an account."}
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {customers.map((customer) => {
              const spend = spendOf(ordersOf(customer, orders), refunded);
              const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "No name given";
              return (
                <li key={customer.id}>
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="group flex items-center gap-4 px-4 py-4 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-neutral-900 group-hover:underline">
                        {name}
                        {customer.is_admin ? <Badge tone="blue">Admin</Badge> : null}
                      </p>
                      <p className="truncate text-[14px] text-neutral-600">
                        {customer.email}
                        {customer.phone ? ` · ${customer.phone}` : ""}
                      </p>
                      {customer.note ? <p className="mt-0.5 line-clamp-1 text-[13px] text-neutral-500">Note: {customer.note}</p> : null}
                    </div>
                    <div className="hidden shrink-0 text-right text-[14px] sm:block">
                      <p className="font-medium tabular-nums text-neutral-900">{aed(spend.spent)}</p>
                      <p className="text-neutral-500">{plural(spend.orders, "order")}</p>
                    </div>
                    <div className="hidden shrink-0 whitespace-nowrap text-right text-[13px] text-neutral-500 md:block">
                      Joined {dubaiDate(customer.created_at)}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Pager page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => hrefFor(q, p)} />
    </>
  );
}
