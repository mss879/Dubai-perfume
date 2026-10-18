import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { requireAdmin } from "../../lib/auth";
import { resolveCheckoutMode } from "../../lib/payments/mode";
import type { AdminCounts } from "../_lib/counts";
import { loadCounts, loadLockState } from "../_lib/queries";
import { cn } from "../_ui/cn";
import { PageHeader } from "../_ui/PageHeader";
import { pathForOldTab } from "./_shell/nav-model";
import TodayExtras from "./_today/TodayExtras";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

type Tile = {
  label: string;
  hint: string;
  count: number;
  href: string;
  /** Colours the number when there is something to do. */
  tone: "amber" | "violet" | "sky" | "neutral" | "red";
};

const TONE_TEXT: Record<Tile["tone"], string> = {
  amber: "text-amber-700",
  violet: "text-violet-700",
  sky: "text-sky-700",
  neutral: "text-neutral-900",
  red: "text-red-700",
};

function tilesFor(counts: AdminCounts): { work: Tile[]; watch: Tile[] } {
  const work: Tile[] = [
    { label: "To accept", hint: "New orders waiting for you", count: counts.accept, href: "/admin/orders?view=accept", tone: "amber" },
    { label: "To pack", hint: "Accepted, not packed yet", count: counts.pack, href: "/admin/orders?view=pack", tone: "violet" },
    { label: "To dispatch", hint: "Packed, waiting for the courier", count: counts.dispatch, href: "/admin/orders?view=dispatch", tone: "sky" },
    { label: "Out for delivery", hint: "With the courier now", count: counts.delivering, href: "/admin/orders?view=delivering", tone: "neutral" },
  ];
  const watch: Tile[] = [
    {
      label: "Awaiting online payment",
      hint: "Released automatically if not paid in time",
      count: counts.awaitingPayment,
      href: "/admin/orders?view=awaiting_payment",
      tone: "neutral",
    },
    ...(counts.paymentIssues > 0
      ? [
          {
            label: "Payment needs attention",
            hint: "Paid twice, paid late, or a different amount",
            count: counts.paymentIssues,
            href: "/admin/orders?view=payment_issues",
            tone: "red" as const,
          },
        ]
      : []),
    {
      label: "Low or out of stock",
      hint: counts.outOfStock > 0 ? `${counts.outOfStock} sold out` : "Sizes at or below their warning level",
      count: counts.stockAlerts,
      href: counts.outOfStock > 0 ? "/admin/products?stock=out" : "/admin/products?stock=low",
      tone: counts.outOfStock > 0 ? "red" : "amber",
    },
    {
      label: "Unanswered messages",
      hint: "From the contact form",
      count: counts.messages,
      href: "/admin/messages",
      tone: "amber",
    },
  ];
  return { work, watch };
}

function TileLink({ tile, large = false }: { tile: Tile; large?: boolean }) {
  const active = tile.count > 0;
  return (
    <Link
      href={tile.href}
      className={cn(
        "group flex flex-col justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors sm:p-5",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
        active ? "border-neutral-200 hover:border-neutral-400" : "border-neutral-200/70 hover:border-neutral-300"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] font-semibold text-neutral-900">{tile.label}</p>
        <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-600" aria-hidden />
      </div>
      <p
        className={cn(
          "font-semibold tabular-nums tracking-tight",
          large ? "text-[32px] leading-none" : "text-[26px] leading-none",
          active ? TONE_TEXT[tile.tone] : "text-neutral-300"
        )}
      >
        {tile.count}
      </p>
      <p className="text-[13px] leading-snug text-neutral-500">{tile.hint}</p>
    </Link>
  );
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Old bookmarks and emails still link to /admin?tab=…
  const params = await searchParams;
  if (typeof params.tab === "string") redirect(pathForOldTab(params.tab));

  await requireAdmin("/admin");
  const [counts, lock, checkout] = await Promise.all([loadCounts(), loadLockState(), resolveCheckoutMode()]);
  const { work, watch } = tilesFor(counts);

  return (
    <>
      <PageHeader title="Today" description="What needs doing, in the order it needs doing." />

      <div className="mb-6 flex flex-col gap-3">
        {checkout === "unavailable" ? (
          <Link
            href="/admin/settings#payments"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-900 hover:border-red-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
            <span>
              <strong className="font-semibold">Checkout is closed.</strong> The store is set to online payment, but
              Paymob is not fully set up on this deployment. Open Settings to fix it.
            </span>
          </Link>
        ) : null}
        {lock?.effectiveLocked ? (
          <Link
            href="/admin/settings#store-status"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900 hover:border-amber-300"
          >
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span>
              <strong className="font-semibold">Your shop is locked.</strong> Customers see the &ldquo;Launching
              soon&rdquo; page. Change it under Settings &rarr; Store status.
            </span>
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="today-orders">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="today-orders" className="text-[16px] font-semibold text-neutral-900">
            Orders
          </h2>
          {counts.needsAction === 0 ? (
            <p className="inline-flex items-center gap-1.5 text-[14px] font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              All caught up
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {work.map((tile) => (
            <TileLink key={tile.label} tile={tile} large />
          ))}
        </div>
      </section>

      <TodayExtras />

      <section aria-labelledby="today-watch" className="mt-8">
        <h2 id="today-watch" className="mb-3 text-[16px] font-semibold text-neutral-900">
          Keep an eye on
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {watch.map((tile) => (
            <TileLink key={tile.label} tile={tile} />
          ))}
        </div>
      </section>
    </>
  );
}
