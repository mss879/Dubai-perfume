import { Ticket } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { aed, dubaiDate, serverNow } from "../../_lib/format";
import { Badge, type Tone } from "../../_ui/Badge";
import { Card, CardHeader } from "../../_ui/Card";
import { EmptyState } from "../../_ui/EmptyState";
import { PageHeader } from "../../_ui/PageHeader";
import DiscountActions from "./_components/DiscountActions";
import NewDiscountButton from "./_components/NewDiscountButton";

export const metadata = { title: "Discount codes" };
export const dynamic = "force-dynamic";

type Discount = {
  id: number;
  code: string | null;
  type: string;
  value: number | string;
  min_requirement: number | string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_count: number | null;
  is_active: boolean | null;
  concierge_only: boolean | null;
  created_at: string | null;
  /** Migration 67; absent before it (every code then covers the whole order). */
  applies_to?: string | null;
  product_ids?: number[] | null;
  collection_ids?: string[] | null;
};

const BASE_COLUMNS = "id, code, type, value, min_requirement, ends_at, usage_limit, usage_count, is_active, concierge_only, created_at";

type OfferStat = { code: string; orders_count: number; cancelled_count: number; revenue: number; discount_given: number };

/** "Free delivery", "15% off Lattafa collection", "AED 50 off Khamrah and 2 more". */
function describe(discount: Discount, productNames: Map<number, string>, collectionTitles: Map<string, string>): string {
  const target = discount.applies_to ?? "order";
  const amount = discount.type === "percentage" ? `${Number(discount.value)}% off` : `${aed(discount.value)} off`;
  if (target === "delivery") {
    return discount.type === "percentage" && Number(discount.value) >= 100 ? "Free delivery" : `${amount} delivery`;
  }
  if (target === "products") {
    const names = (discount.product_ids ?? []).map((id) => productNames.get(id) ?? `perfume #${id}`);
    const shown = names.slice(0, 2).join(", ");
    return `${amount} ${shown}${names.length > 2 ? ` and ${names.length - 2} more` : ""}`;
  }
  if (target === "collections") {
    const titles = (discount.collection_ids ?? []).map((id) => collectionTitles.get(id) ?? id);
    return `${amount} ${titles.join(", ")} ${titles.length === 1 ? "collection" : "collections"}`;
  }
  return `${amount} the whole order`;
}

/** What a customer would actually experience: checkout also refuses a code past its date or at its limit. */
function stateOf(discount: Discount, now: number): { label: string; tone: Tone } {
  const used = Number(discount.usage_count) || 0;
  if (!discount.is_active) return { label: "Paused", tone: "neutral" };
  if (discount.ends_at && new Date(discount.ends_at).getTime() < now) return { label: "Expired", tone: "neutral" };
  if (discount.usage_limit != null && used >= Number(discount.usage_limit)) return { label: "Used up", tone: "red" };
  return { label: "Working", tone: "emerald" };
}

export default async function DiscountsPage() {
  await requireAdmin("/admin/discounts");
  const supabase = await createSessionSupabase();
  const [withTargets, offers, productRows, collectionRows, stacking, issued] = await Promise.all([
    supabase
      .from("discounts")
      .select(`${BASE_COLUMNS}, applies_to, product_ids, collection_ids`)
      .order("created_at", { ascending: false }),
    // What codes only the concierge hands out actually sold (migration 55). Optional extra.
    supabase.rpc("admin_concierge_offer_performance", { p_since: null, p_until: null, p_concierge_only: true }),
    supabase.from("products").select("id, brand, name").order("brand").order("name").limit(1000),
    supabase.from("collections").select("id, title").order("title"),
    // Migration 69: codes allowed to stack with offers. Absent before it.
    supabase.from("discounts").select("id").eq("combines_with_offers", true),
    // Migration 70: codes the store issues to one person (welcome, cart reminder, referral)
    // live on their own feature pages, so this list stays the owner's own codes.
    supabase.from("discounts").select("id").neq("kind", "manual"),
  ]);
  const issuedIds = new Set(((issued.error ? [] : issued.data) ?? []).map((r) => (r as { id: number }).id));
  const stacks = new Set(((stacking.error ? [] : stacking.data) ?? []).map((r) => (r as { id: number }).id));
  // Before migration 67 the target columns don't exist: read without them.
  const targetsReady = !withTargets.error;
  const discounts = targetsReady
    ? withTargets
    : await supabase.from("discounts").select(BASE_COLUMNS).order("created_at", { ascending: false });
  const rows = ((discounts.data ?? []) as Discount[]).filter((d) => !issuedIds.has(d.id));
  const products = ((productRows.data ?? []) as { id: number; brand: string; name: string }[]).map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name.replace(/_/g, " "),
  }));
  const collections = ((collectionRows.data ?? []) as { id: string; title: string | null }[]).map((c) => ({ id: c.id, title: c.title || c.id }));
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const collectionTitles = new Map(collections.map((c) => [c.id, c.title]));
  const stats = ((offers.error ? [] : offers.data) ?? []) as OfferStat[];
  const sold = stats.filter((s) => Number(s.orders_count) > 0);
  const now = serverNow();

  return (
    <>
      <PageHeader
        title="Discount codes"
        description="Codes customers type at checkout. Pause one to stop it straight away."
        actions={<NewDiscountButton products={products} collections={collections} targetsReady={targetsReady} />}
      />

      {sold.length > 0 ? (
        <Card className="mb-6">
          <CardHeader title="Sold through the Agent" description="Orders paid with a code only the Agent offers in chat." />
          <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
            {sold.map((s) => (
              <li key={s.code} className="rounded-lg border border-neutral-200 px-4 py-3">
                <p className="font-mono text-[14px] font-semibold text-neutral-900">{s.code}</p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums text-neutral-900">{aed(s.revenue)}</p>
                <p className="text-[13px] text-neutral-500">
                  {Number(s.orders_count)} order{Number(s.orders_count) === 1 ? "" : "s"}
                  {Number(s.cancelled_count) > 0 ? ` · ${Number(s.cancelled_count)} cancelled` : ""} · {aed(s.discount_given)} given
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        {discounts.error ? (
          <p role="alert" className="px-5 py-4 text-[14px] text-red-700">
            Discount codes couldn&rsquo;t be loaded. Refresh the page to try again.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Ticket className="h-8 w-8" aria-hidden />} title="No discount codes yet" description="Create one with “New code”." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((discount) => {
              const state = stateOf(discount, now);
              const used = Number(discount.usage_count) || 0;
              const minimum = Number(discount.min_requirement) || 0;
              const summary = describe(discount, productNames, collectionTitles);
              return (
                <li key={discount.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[16px] font-semibold tracking-wide text-neutral-900">{discount.code ?? "Automatic discount"}</span>
                      <Badge tone={state.tone} dot>
                        {state.label}
                      </Badge>
                      {discount.concierge_only ? <Badge tone="violet">Agent only</Badge> : null}
                      {stacks.has(discount.id) ? <Badge tone="sky">Stacks with offers</Badge> : null}
                    </p>
                    <p className="mt-1 text-[14px] text-neutral-700">
                      {summary}
                      {minimum > 0 ? ` · orders of ${aed(minimum)} or more` : ""}
                    </p>
                    <p className="mt-0.5 text-[13px] text-neutral-500">
                      Used {used}
                      {discount.usage_limit != null ? ` of ${discount.usage_limit}` : ""} time{used === 1 && discount.usage_limit == null ? "" : "s"} ·{" "}
                      {discount.ends_at ? `last day ${dubaiDate(discount.ends_at)}` : "no end date"}
                    </p>
                  </div>
                  <DiscountActions
                    discount={{
                      id: discount.id,
                      code: discount.code ?? "This discount",
                      isActive: Boolean(discount.is_active),
                      conciergeOnly: Boolean(discount.concierge_only),
                      hasLimit: discount.usage_limit != null,
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
