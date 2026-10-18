import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "../../../../lib/auth";
import { featureBySlug, type FeatureDefinition } from "../../../../lib/features";
import { readStoreFeaturesFresh } from "../../../../lib/features-server";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import {
  MIGRATION_70,
  loadAttributeProducts,
  loadGiftCards,
  loadIssuedCodes,
  loadLoyaltyMembers,
  loadPopularityPreview,
  loadReferrals,
  loadReorderStats,
  loadStockRequests,
} from "../../../_lib/feature-data";
import { aed, dubaiDate, serverNow } from "../../../_lib/format";
import { Badge } from "../../../_ui/Badge";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { EmptyState } from "../../../_ui/EmptyState";
import { PageHeader } from "../../../_ui/PageHeader";
import FeatureForm, { type PickerProduct } from "../_components/FeatureForm";
import GiftCardsPanel from "../_components/GiftCardsPanel";
import LoyaltyPanel from "../_components/LoyaltyPanel";
import AttributesEditor from "../_components/AttributesEditor";
import JobButton from "../_components/JobButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const def = featureBySlug((await params).slug);
  return { title: def?.name ?? "Feature" };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = featureBySlug(slug);
  if (!def) notFound();
  await requireAdmin(`/admin/features/${slug}`);

  const supabase = await createSessionSupabase();
  const { features, missing, failed } = await readStoreFeaturesFresh(supabase);
  const state = features[def.key];
  const needsProducts = def.key === "welcome_offer";
  const picker: PickerProduct[] = needsProducts
    ? (await loadAttributeProducts(supabase)).products
        .filter((p) => p.published)
        .map((p) => ({ id: p.id, label: `${titleCase(p.brand)} — ${p.name}`, sizes: p.sizes }))
    : [];

  return (
    <>
      <PageHeader
        title={def.name}
        description={def.summary}
        back={{ href: "/admin/features", label: "Feature switches" }}
        badges={state.enabled ? <Badge tone="emerald" dot>On</Badge> : <Badge tone="neutral" dot>Off</Badge>}
      />

      <div className="flex max-w-4xl flex-col gap-4">
        {missing ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
            <strong className="font-semibold">Not set up yet.</strong> {MIGRATION_70}
          </p>
        ) : failed ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-[14px] text-red-800">The settings couldn&rsquo;t be read just now. Reload to try again.</p>
        ) : null}

        <Card>
          <CardBody className="flex flex-col gap-2 text-[14px] text-neutral-700">
            <p>
              <span className="font-medium text-neutral-900">Where shoppers see it:</span> {def.where}
            </p>
            {def.needs && def.needs.length > 0 ? (
              <div>
                <p className="font-medium text-neutral-900">Before switching it on</p>
                <ul className="mt-1 list-disc pl-5 text-neutral-600">
                  {def.needs.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <FeatureForm
          featureKey={def.key}
          name={def.name}
          initialEnabled={state.enabled}
          initialSettings={state.settings}
          groups={def.groups}
          products={picker}
          ready={!missing && !failed}
          onLabel="On: shoppers see it."
          offLabel="Off: shoppers don't see it. Set it up, then switch it on."
        />

        {!missing ? <FeaturePanel def={def} supabase={supabase} /> : null}
      </div>
    </>
  );
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

type Supabase = Awaited<ReturnType<typeof createSessionSupabase>>;

async function FeaturePanel({ def, supabase }: { def: FeatureDefinition; supabase: Supabase }) {
  switch (def.key) {
    case "gift_cards": {
      const data = await loadGiftCards(supabase);
      return <GiftCardsPanel {...data} now={serverNow()} />;
    }
    case "loyalty": {
      const { members, failed } = await loadLoyaltyMembers(supabase);
      return <LoyaltyPanel members={members} failed={failed} />;
    }
    case "referrals": {
      const { rows, codes, failed } = await loadReferrals(supabase);
      const rewarded = rows.filter((r) => r.status === "rewarded");
      return (
        <Card>
          <CardHeader
            title="Referrals"
            description={`${codes} ${codes === 1 ? "customer has" : "customers have"} a referral code. ${rows.length} friends ordered with one; ${rewarded.length} rewards issued (${aed(rewarded.reduce((s, r) => s + (r.rewardAmount ?? 0), 0))}).`}
          />
          {failed ? (
            <CardBody>
              <p className="text-[14px] text-red-700">The referrals couldn&rsquo;t be read just now.</p>
            </CardBody>
          ) : rows.length === 0 ? (
            <EmptyState title="No referrals yet" description="When a friend orders with someone's code, it appears here. The reward is issued once their order is delivered." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead className="border-b border-neutral-100 text-[12px] uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-2 font-medium sm:px-5">Referrer</th>
                    <th className="px-4 py-2 font-medium">Friend</th>
                    <th className="px-4 py-2 font-medium">Order</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="text-neutral-900">{r.referrer}</div>
                        <div className="font-mono text-[12px] text-neutral-500">{r.code}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{r.friendEmail}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${encodeURIComponent(r.orderId)}`} className="text-neutral-900 underline-offset-2 hover:underline">
                          {r.orderId}
                        </Link>
                        <div className="text-[12px] text-neutral-500">{dubaiDate(r.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "rewarded" ? (
                          <Badge tone="emerald">Rewarded {r.rewardAmount != null ? aed(r.rewardAmount) : ""}</Badge>
                        ) : r.status === "pending" ? (
                          <Badge tone="amber">Waiting for delivery</Badge>
                        ) : r.status === "capped" ? (
                          <Badge tone="neutral">Reward limit reached</Badge>
                        ) : (
                          <Badge tone="neutral">Cancelled</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      );
    }
    case "back_in_stock": {
      const { groups, sent30, failed } = await loadStockRequests(supabase);
      const waiting = groups.reduce((s, g) => s + g.waiting, 0);
      return (
        <Card>
          <CardHeader
            title="Waiting for a size"
            description={`${waiting} ${waiting === 1 ? "request" : "requests"} waiting · ${sent30} emails sent in the last 30 days. The store checks every 15 minutes and writes as soon as a size is back.`}
            actions={<JobButton job="back_in_stock" label="Check and send now" />}
          />
          {failed ? (
            <CardBody>
              <p className="text-[14px] text-red-700">The requests couldn&rsquo;t be read just now.</p>
            </CardBody>
          ) : groups.length === 0 ? (
            <EmptyState title="Nobody is waiting" description="When a shopper asks to hear about a sold-out size, it appears here, with how many are waiting." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {groups.map((g) => (
                <li key={`${g.productId}-${g.size}`} className="flex items-center justify-between gap-4 px-4 py-3 text-[14px] sm:px-5">
                  <div className="min-w-0">
                    <Link href={`/admin/products/${g.productId}`} className="font-medium text-neutral-900 hover:underline">
                      {g.name}
                    </Link>
                    <div className="text-[12px] text-neutral-500">
                      {titleCase(g.brand)} · {g.size} · waiting since {dubaiDate(g.oldest)}
                    </div>
                  </div>
                  <Badge tone="amber">{g.waiting} waiting</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      );
    }
    case "welcome_offer": {
      const { issued, used } = await loadIssuedCodes(supabase, "welcome");
      return (
        <Card>
          <CardHeader title="Results" description="Each new subscriber gets a personal code, usable once, on a first order, with their own email." />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Figure label="Codes given" value={String(issued)} />
            <Figure label="Codes used" value={String(used)} />
            <Figure label="Used" value={issued > 0 ? `${Math.round((used / issued) * 100)}%` : "—"} />
          </CardBody>
        </Card>
      );
    }
    case "cart_reminders": {
      const { issued, used } = await loadIssuedCodes(supabase, "recovery");
      return (
        <Card>
          <CardHeader
            title="Reminders and codes"
            description="While this is on, the store sends due reminders every 15 minutes. You can still send them by hand from Abandoned carts."
            actions={
              <Link href="/admin/abandoned-carts" className="text-[14px] font-medium text-neutral-900 underline underline-offset-2">
                Open Abandoned carts
              </Link>
            }
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Figure label="Last-reminder codes given" value={String(issued)} />
            <Figure label="Codes used" value={String(used)} />
          </CardBody>
        </Card>
      );
    }
    case "reorder_reminders": {
      const { sent30, optOuts } = await loadReorderStats(supabase);
      return (
        <Card>
          <CardHeader
            title="Sent"
            description="The store checks every 15 minutes. Each order gets one reminder at most."
            actions={<JobButton job="reorder" label="Check and send now" />}
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Figure label="Reminders in the last 30 days" value={String(sent30)} />
            <Figure label="People who unsubscribed" value={String(optOuts)} />
          </CardBody>
        </Card>
      );
    }
    case "shop_filters": {
      const { products, ready } = await loadAttributeProducts(supabase);
      return <AttributesEditor products={products} ready={ready} mode="filters" />;
    }
    case "inspired_by": {
      const { products, ready } = await loadAttributeProducts(supabase);
      return <AttributesEditor products={products} ready={ready} mode="inspired" />;
    }
    case "demand_signals": {
      const lines = await loadPopularityPreview(supabase);
      return (
        <Card>
          <CardHeader title="What shoppers would see now" description="From orders that count (paid online, or cash on delivery), never cancelled ones. Only while the switch is on." />
          {lines.length === 0 ? (
            <EmptyState title="Nothing to show yet" description="No perfume reaches the minimum yet, or the switch is off." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {lines.map((l) => (
                <li key={l.productId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[14px] sm:px-5">
                  <span className="text-neutral-900">
                    {l.name} <span className="text-neutral-500">· {titleCase(l.brand)}</span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {l.recent != null ? <Badge tone="sky">{l.recent} bought recently</Badge> : null}
                    {l.family ? <Badge tone="violet">Bestseller in {l.family}</Badge> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      );
    }
    case "gift_options":
    case "send_to_someone":
      return (
        <Card>
          <CardBody className="text-[14px] text-neutral-600">
            Orders that use this show it at the top of the order page in Orders, and on the packing slip.
          </CardBody>
        </Card>
      );
    default:
      return null;
  }
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-3">
      <p className="text-[13px] text-neutral-500">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}
