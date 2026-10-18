import Link from "next/link";
import { Gift, Layers, Package2, PlusCircle, Repeat2, ShoppingBag, Sparkles, Users } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { aed, dubaiDate, serverNow } from "../../_lib/format";
import { describeOffer, loadOfferPicks, loadOffers, loadOfferStats, offerState } from "../../_lib/offer-data";
import { OFFER_TEMPLATES, TEMPLATE_KEYS, type OfferTemplate } from "../../_lib/offer-schema";
import { Badge } from "../../_ui/Badge";
import { ButtonLink } from "../../_ui/Button";
import { Card, CardHeader } from "../../_ui/Card";
import { EmptyState } from "../../_ui/EmptyState";
import { PageHeader } from "../../_ui/PageHeader";
import OfferActions from "./_components/OfferActions";

export const metadata = { title: "Offers & bundles" };
export const dynamic = "force-dynamic";

const ICONS: Record<OfferTemplate, typeof Gift> = {
  buy_more: ShoppingBag,
  backup: Repeat2,
  layering: Layers,
  his_hers: Users,
  house: Package2,
  occasion: Sparkles,
  addon: PlusCircle,
  gift: Gift,
};

export default async function OffersPage() {
  await requireAdmin("/admin/offers");
  const supabase = await createSessionSupabase();
  const [{ offers, ready, failed }, picks, stats] = await Promise.all([
    loadOffers(supabase),
    loadOfferPicks(supabase),
    loadOfferStats(supabase).catch(() => new Map()),
  ]);
  const now = serverNow();
  const products = new Map(picks.products.map((p) => [p.id, p]));
  const collections = new Map(picks.collections.map((c) => [c.id, c.title]));

  return (
    <>
      <PageHeader
        title="Offers & bundles"
        description="Savings the shop applies by itself: no code to type. The bag and checkout show them, and the order is charged exactly that."
      />

      {!ready ? (
        <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-900">
          <strong className="font-semibold">Offers need database migration 69.</strong> Run{" "}
          <code className="rounded bg-amber-100 px-1">69_offers.sql</code> in the Supabase SQL editor, then reload this page.
        </div>
      ) : null}
      {failed ? (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-800">
          The offers couldn&rsquo;t be loaded. Reload the page to try again.
        </div>
      ) : null}

      <Card className="mb-6">
        <CardHeader title="Start a new offer" description="Pick the kind; you can change every detail before it goes live." />
        <ul className="grid grid-cols-1 gap-px bg-neutral-100 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATE_KEYS.map((key) => {
            const Icon = ICONS[key];
            const template = OFFER_TEMPLATES[key];
            return (
              <li key={key} className="bg-white">
                <Link
                  href={`/admin/offers/new?template=${key}`}
                  className="flex h-full flex-col gap-1.5 px-5 py-4 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
                >
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
                    <Icon className="h-4 w-4 text-neutral-500" aria-hidden />
                    {template.label}
                  </span>
                  <span className="text-[13px] leading-relaxed text-neutral-600">{template.blurb}</span>
                  <span className="text-[13px] italic leading-relaxed text-neutral-500">{template.example}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Your offers"
          description="A perfume counts towards one offer at a time. Sets come first, then the best buy-more offer."
        />
        {offers.length === 0 ? (
          <EmptyState
            icon={<Gift className="h-6 w-6" aria-hidden />}
            title="No offers yet"
            description="Start with “Buy more, save more”: it works on every bag."
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {offers.map((offer) => {
              const state = offerState(offer, now);
              const template = OFFER_TEMPLATES[offer.template as OfferTemplate];
              const result = stats.get(offer.id);
              return (
                <li key={offer.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/offers/${offer.id}`}
                        className="text-[15px] font-semibold text-neutral-900 hover:underline"
                      >
                        {offer.title}
                      </Link>
                      <Badge tone={state.tone}>{state.label}</Badge>
                      <span className="text-[13px] text-neutral-500">{template?.label ?? offer.kind}</span>
                    </div>
                    <p className="mt-1 text-[14px] text-neutral-700">{describeOffer(offer, products, collections)}</p>
                    <p className="mt-1 text-[13px] text-neutral-500">
                      {offer.starts_at ? `From ${dubaiDate(offer.starts_at)}` : "From now"}
                      {offer.ends_at ? ` until ${dubaiDate(offer.ends_at)}` : " · no end date"}
                      {result
                        ? ` · ${result.orders} ${result.orders === 1 ? "order" : "orders"}, ${aed(result.sales)} in sales, ${aed(result.given)} ${offer.kind === "gift" ? "in gifts" : "saved"}`
                        : " · not used yet"}
                    </p>
                  </div>
                  <OfferActions offer={{ id: offer.id, title: offer.title, isActive: offer.is_active }} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-[13px] leading-relaxed text-neutral-500">
        Discount codes still work alongside offers: a code only discounts items that aren&rsquo;t already in an offer, unless you
        let a whole-order code stack (Discount codes → the code&rsquo;s settings).{" "}
        <ButtonLink href="/admin/discounts" variant="plain" size="sm">
          Discount codes
        </ButtonLink>
      </p>
    </>
  );
}
