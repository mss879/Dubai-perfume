import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { normalizeRecoveryItems } from "../../../lib/cart-recovery";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { aed, ago, dubaiDateTime, serverNow } from "../../_lib/format";
import { cleanSearch, ilikeAny, pageParam, param, phoneDigits } from "../../_lib/search";
import { Badge } from "../../_ui/Badge";
import { Card } from "../../_ui/Card";
import { ContactLinks } from "../../_ui/ContactLinks";
import { EmptyState } from "../../_ui/EmptyState";
import { LinkTabs } from "../../_ui/LinkTabs";
import { PageHeader } from "../../_ui/PageHeader";
import { Pager } from "../../_ui/Pager";
import { SearchForm } from "../../_ui/SearchForm";
import SendRemindersButton from "./_components/SendRemindersButton";

export const metadata = { title: "Abandoned carts" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const VIEWS = ["open", "recovered", "all"] as const;
type View = (typeof VIEWS)[number];

// Named columns: the row also holds the customer's private reminder link token.
const COLUMNS =
  "id, email, first_name, last_name, phone, shipping_address, cart_items, total_price, currency, converted_total, converted, converted_order_id, created_at, recovery_stage, last_recovery_at, recovery_opted_out";

type Cart = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  shipping_address: { street?: string; city?: string; country?: string } | null;
  cart_items: unknown;
  total_price: number | string | null;
  currency: string | null;
  converted_total: string | null;
  converted: boolean | null;
  converted_order_id: string | null;
  created_at: string;
  recovery_stage: number | null;
  last_recovery_at: string | null;
  recovery_opted_out: boolean | null;
};

function hrefFor(view: View, q: string, page = 1): string {
  const search = new URLSearchParams();
  if (view !== "open") search.set("view", view);
  if (q) search.set("q", q);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/admin/abandoned-carts?${query}` : "/admin/abandoned-carts";
}

function reminderBadge(cart: Cart) {
  if (cart.converted) return <Badge tone="emerald">Bought</Badge>;
  if (cart.recovery_opted_out) return <Badge tone="neutral">Reminders off</Badge>;
  const stage = Number(cart.recovery_stage) || 0;
  if (stage > 0) return <Badge tone="sky">{`${stage} of 3 reminders sent`}</Badge>;
  return <Badge tone="amber">No reminder yet</Badge>;
}

export default async function AbandonedCartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/abandoned-carts");
  const params = await searchParams;
  const requested = param(params.view);
  const view: View = (VIEWS as readonly string[]).includes(requested) ? (requested as View) : "open";
  const q = cleanSearch(param(params.q));
  const page = pageParam(params.page);

  const filters = [ilikeAny(q, ["email", "first_name", "last_name", "phone"])];
  const digits = phoneDigits(q);
  if (digits) filters.push(`phone.ilike."*${digits}*"`);
  const filter = filters.filter(Boolean).join(",");

  const supabase = await createSessionSupabase();
  const count = (which: View) => {
    let query = supabase.from("abandoned_carts").select("id", { count: "exact", head: true });
    if (which === "open") query = query.eq("converted", false);
    if (which === "recovered") query = query.eq("converted", true);
    if (filter) query = query.or(filter);
    return query;
  };
  let list = supabase
    .from("abandoned_carts")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (view === "open") list = list.eq("converted", false);
  if (view === "recovered") list = list.eq("converted", true);
  if (filter) list = list.or(filter);

  const [rows, open, recovered, all] = await Promise.all([list, count("open"), count("recovered"), count("all")]);
  const carts = (rows.data ?? []) as unknown as Cart[];
  const now = serverNow();

  return (
    <>
      <PageHeader
        title="Abandoned carts"
        description="Checkouts that were started but not finished. Up to three reminder emails go out on their own, every hour."
        actions={<SendRemindersButton />}
      />

      <SearchForm
        action="/admin/abandoned-carts"
        defaultValue={q}
        placeholder="Name, email or phone"
        label="Search abandoned carts"
        keep={{ view: view === "open" ? undefined : view }}
      />

      <div className="mb-4">
        <LinkTabs
          label="Cart views"
          active={view}
          tabs={[
            { key: "open", label: "Not bought", href: hrefFor("open", q), count: open.count ?? 0 },
            { key: "recovered", label: "Bought later", href: hrefFor("recovered", q), count: recovered.count ?? 0 },
            { key: "all", label: "All", href: hrefFor("all", q), count: all.count ?? 0 },
          ]}
        />
      </div>

      <Card>
        {rows.error ? (
          <p role="alert" className="px-5 py-4 text-[14px] text-red-700">
            Abandoned carts couldn&rsquo;t be loaded. Refresh the page to try again.
          </p>
        ) : carts.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-8 w-8" aria-hidden />}
            title={q ? "No carts match" : "No abandoned carts"}
            description={q ? "Try a name, an email address or a phone number." : undefined}
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {carts.map((cart) => {
              const items = normalizeRecoveryItems(cart.cart_items);
              const name = [cart.first_name, cart.last_name].filter(Boolean).join(" ") || "No name given";
              const place = [cart.shipping_address?.city, cart.shipping_address?.country].filter(Boolean).join(", ");
              return (
                <li key={cart.id} className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-neutral-900">{name}</p>
                    <ContactLinks email={cart.email} phone={cart.phone} className="mt-1" />
                    {place ? <p className="mt-1 text-[13px] text-neutral-500">{place}</p> : null}
                  </div>
                  <div className="min-w-0">
                    {items.length === 0 ? (
                      <p className="text-[14px] text-neutral-500">No items saved</p>
                    ) : (
                      <ul className="flex flex-col gap-1 text-[14px] text-neutral-800">
                        {items.map((item, index) => (
                          <li key={`${item.productId}-${item.size}-${index}`}>
                            {item.quantity} × {item.brand ? `${item.brand} ` : ""}
                            {item.name}
                            {item.size ? <span className="text-neutral-500"> · {item.size}</span> : null}
                            <span className="text-neutral-500"> · {aed(item.unitPriceAed)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-[15px] font-semibold tabular-nums text-neutral-900">
                      {aed(cart.total_price)}
                      {cart.currency && cart.currency !== "AED" && cart.converted_total ? (
                        <span className="ml-2 text-[13px] font-normal text-neutral-500">shown to them as {cart.converted_total}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-1.5 text-[13px] text-neutral-500 md:items-end md:text-right">
                    {reminderBadge(cart)}
                    {cart.converted && cart.converted_order_id ? (
                      <Link href={`/admin/orders/${encodeURIComponent(cart.converted_order_id)}`} className="text-[14px] text-blue-700 hover:underline">
                        Order {cart.converted_order_id}
                      </Link>
                    ) : null}
                    <time dateTime={cart.created_at} title={dubaiDateTime(cart.created_at)}>
                      Left {ago(cart.created_at, now)}
                    </time>
                    {cart.last_recovery_at ? <span>Last reminder {dubaiDateTime(cart.last_recovery_at)}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Pager page={page} pageSize={PAGE_SIZE} total={rows.count ?? 0} hrefFor={(p) => hrefFor(view, q, p)} />
    </>
  );
}
