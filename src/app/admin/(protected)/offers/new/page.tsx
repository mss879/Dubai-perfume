import { requireAdmin } from "../../../../lib/auth";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { loadOfferPicks, loadOffers } from "../../../_lib/offer-data";
import { OFFER_TEMPLATES, offerDefaults, type OfferTemplate } from "../../../_lib/offer-schema";
import { PageHeader } from "../../../_ui/PageHeader";
import OfferForm from "../_components/OfferForm";

export const metadata = { title: "New offer" };
export const dynamic = "force-dynamic";

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/offers");
  const raw = (await searchParams).template;
  const key = (Array.isArray(raw) ? raw[0] : raw) ?? "buy_more";
  const template: OfferTemplate = key in OFFER_TEMPLATES ? (key as OfferTemplate) : "buy_more";

  const supabase = await createSessionSupabase();
  const [picks, { ready }] = await Promise.all([loadOfferPicks(supabase), loadOffers(supabase)]);

  return (
    <>
      <PageHeader title={`New: ${OFFER_TEMPLATES[template].label}`} back={{ href: "/admin/offers", label: "Offers & bundles" }} />
      <OfferForm
        key={template}
        offerId={null}
        initial={offerDefaults(template)}
        products={picks.products}
        brands={picks.brands}
        collections={picks.collections}
        ready={ready}
      />
    </>
  );
}
