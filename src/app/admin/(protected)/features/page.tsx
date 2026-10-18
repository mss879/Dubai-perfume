import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { FEATURE_GROUP_LABELS, FEATURE_LIST, featureHref, type FeatureGroup } from "../../../lib/features";
import { readStoreFeaturesFresh } from "../../../lib/features-server";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { MIGRATION_70, loadGrowthProblems } from "../../_lib/feature-data";
import { dubaiDateTime } from "../../_lib/format";
import { Badge } from "../../_ui/Badge";
import { Card, CardHeader } from "../../_ui/Card";
import { PageHeader } from "../../_ui/PageHeader";
import FeatureToggle from "./_components/FeatureToggle";

export const metadata = { title: "Feature switches" };
export const dynamic = "force-dynamic";

const GROUP_ORDER: FeatureGroup[] = ["checkout", "shop", "rewards", "emails"];

/** Every feature the owner can switch on or off, in one place. */
export default async function FeaturesPage() {
  await requireAdmin("/admin/features");
  const supabase = await createSessionSupabase();
  const [{ features, missing, failed }, problems] = await Promise.all([readStoreFeaturesFresh(supabase), loadGrowthProblems(supabase)]);
  const onCount = FEATURE_LIST.filter((f) => features[f.key].enabled).length;

  return (
    <>
      <PageHeader
        title="Feature switches"
        description="Turn each feature on or off, then open it to set it up. Everything starts off, so the shop only changes when you decide."
        badges={<Badge tone={onCount > 0 ? "emerald" : "neutral"}>{onCount} of {FEATURE_LIST.length} on</Badge>}
      />

      {missing ? (
        <p className="mb-6 max-w-3xl rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          <strong className="font-semibold">Not set up yet.</strong> {MIGRATION_70}
        </p>
      ) : failed ? (
        <p className="mb-6 max-w-3xl rounded-lg bg-red-50 px-4 py-3 text-[14px] text-red-800">The switches couldn&rsquo;t be read just now. Reload to try again.</p>
      ) : null}

      {problems.length > 0 ? (
        <Card className="mb-6 max-w-3xl">
          <CardHeader title="Something needs a look" description="These happened inside an order update. The order itself went through; the credit or points step didn't." />
          <ul className="divide-y divide-neutral-100">
            {problems.map((p, i) => (
              <li key={i} className="px-4 py-3 text-[14px] sm:px-5">
                <span className="font-medium text-neutral-900">{p.orderId ? `Order ${p.orderId}` : p.kind}</span>
                <span className="text-neutral-500"> · {dubaiDateTime(p.at)}</span>
                <p className="mt-0.5 text-[13px] text-neutral-600">{p.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex max-w-4xl flex-col gap-6">
        {GROUP_ORDER.map((group) => (
          <Card key={group}>
            <CardHeader title={FEATURE_GROUP_LABELS[group].title} description={FEATURE_GROUP_LABELS[group].description} />
            <ul className="divide-y divide-neutral-100">
              {FEATURE_LIST.filter((f) => f.group === group).map((f) => {
                const on = features[f.key].enabled;
                return (
                  <li key={f.key} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <Link href={featureHref(f.key)} className="group inline-flex items-center gap-1 text-[15px] font-semibold text-neutral-900 hover:underline">
                        {f.name}
                        <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-700" aria-hidden />
                      </Link>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">{f.summary}</p>
                      <p className="mt-1 text-[12px] text-neutral-400">Shoppers see it: {f.where}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <FeatureToggle featureKey={f.key} name={f.name} enabled={on} disabled={missing} />
                      <span className="text-[12px] text-neutral-500">{on ? "On" : "Off"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
