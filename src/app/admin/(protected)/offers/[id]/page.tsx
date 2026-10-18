import { notFound } from "next/navigation";
import { requireAdmin } from "../../../../lib/auth";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { loadOfferPicks, offerToInput, type OfferRow } from "../../../_lib/offer-data";
import { OFFER_TEMPLATES, type OfferTemplate } from "../../../_lib/offer-schema";
import { PageHeader } from "../../../_ui/PageHeader";
import OfferForm from "../_components/OfferForm";

export const metadata = { title: "Edit offer" };
export const dynamic = "force-dynamic";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  await requireAdmin(`/admin/offers/${encodeURIComponent(raw)}`);
  if (!/^[0-9]{1,9}$/.test(raw)) notFound();

  const supabase = await createSessionSupabase();
  const [{ data, error }, picks] = await Promise.all([
    supabase.from("offers").select("*").eq("id", Number(raw)).maybeSingle(),
    loadOfferPicks(supabase),
  ]);
  if (error || !data) notFound();
  const offer = data as OfferRow;
  const input = offerToInput(offer);

  return (
    <>
      <PageHeader
        title={offer.title}
        description={OFFER_TEMPLATES[input.template as OfferTemplate].label}
        back={{ href: "/admin/offers", label: "Offers & bundles" }}
      />
      <OfferForm
        offerId={offer.id}
        initial={input}
        products={picks.products}
        brands={picks.brands}
        collections={picks.collections}
        ready
      />
    </>
  );
}
