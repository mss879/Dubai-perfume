"use client";

import Image from "next/image";
import { addToCart, type CartLine } from "../../lib/cart";
import { useCurrency } from "../../lib/currency";
import { nudgeText, titleCaseBrand, type AddonOffer, type BagQuote } from "../../lib/offers";

const HAIRLINE = "rgba(0,0,0,0.12)";

/**
 * The bag's offers as summary rows: each saving, and the free gift. Figures
 * are the database's (bag_quote), the same ones the order is charged.
 */
export function OfferRows({ quote }: { quote: BagQuote | null }) {
  const { format } = useCurrency();
  if (!quote) return null;
  return (
    <>
      {quote.applied
        .filter((offer) => offer.saving > 0)
        .map((offer) => (
          <div key={`${offer.kind}-${offer.offer_id}`} className="flex items-baseline justify-between gap-4 py-2">
            <span className="text-[14px] font-light text-black">
              {offer.title}
              {offer.kind === "bundle" && (offer.sets ?? 1) > 1 ? ` × ${offer.sets}` : ""}
            </span>
            <span className="whitespace-nowrap text-[14px] font-light text-black">&minus;{format(offer.saving)}</span>
          </div>
        ))}
      {quote.gift ? (
        <div className="flex items-baseline justify-between gap-4 py-2">
          <span className="text-[14px] font-light text-black">
            Gift: {titleCaseBrand(quote.gift.brand)} {quote.gift.name}
          </span>
          <span className="whitespace-nowrap text-[14px] font-light text-black">Complimentary</span>
        </div>
      ) : null}
    </>
  );
}

/**
 * What one more step would earn ("Add 1 more Lattafa perfume to save 15%"),
 * and, while delivery isn't free yet, a perfume or two that would make it so.
 */
export function OfferNudges({ quote, lines, className = "" }: { quote: BagQuote | null; lines: CartLine[]; className?: string }) {
  const { format } = useCurrency();
  if (!quote) return null;
  const nudges = quote.nudges.slice(0, 2);
  const inBag = new Set(lines.map((l) => l.product.id));
  const picks = quote.to_free_delivery > 0 ? quote.free_delivery_picks.filter((p) => !inBag.has(p.product_id)).slice(0, 2) : [];
  if (nudges.length === 0 && picks.length === 0) return null;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {nudges.map((nudge) => (
        <p key={`${nudge.kind}-${nudge.offer_id}`} className="text-[12px] font-light leading-[1.7] text-black">
          {nudgeText(nudge, format)}
        </p>
      ))}
      {picks.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-light leading-[1.7] text-[#646464]">Any one of these makes your delivery complimentary:</p>
          {picks.map((pick) => (
            <div key={pick.product_id} className="flex items-center gap-3 py-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
              <div className="relative h-12 w-12 shrink-0 bg-[#F5F5F5]">
                {pick.image_url ? (
                  <Image src={pick.image_url} alt={`${titleCaseBrand(pick.brand)} ${pick.name}`} fill sizes="48px" className="object-contain p-1" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-light text-black">{pick.name}</p>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#646464]">{pick.brand}</p>
              </div>
              <span className="shrink-0 text-[13px] font-light text-black">{format(pick.price)}</span>
              <button
                type="button"
                onClick={() =>
                  addToCart(
                    { id: pick.product_id, brand: pick.brand, name: pick.name, price: pick.price, image_url: pick.image_url || "" },
                    pick.size,
                    1
                  )
                }
                className="maison-link shrink-0 cursor-pointer"
              >
                Add
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The checkout add-on: one tick box. Ticking adds the perfume to the bag; the
 * database prices it at the add-on price while the bag still qualifies.
 */
export function AddonOffer({
  offer,
  checked,
  onToggle,
}: {
  offer: AddonOffer;
  checked: boolean;
  onToggle: (next: boolean) => void;
}) {
  const { format } = useCurrency();
  return (
    <label className="flex cursor-pointer items-center gap-4 p-4 md:p-5" style={{ border: `1px solid ${checked ? "#000" : HAIRLINE}` }}>
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 shrink-0 accent-black" />
      <div className="relative h-14 w-14 shrink-0 bg-[#F5F5F5]">
        {offer.image_url ? (
          <Image src={offer.image_url} alt={`${titleCaseBrand(offer.brand)} ${offer.name}`} fill sizes="56px" className="object-contain p-1.5" />
        ) : null}
      </div>
      <span className="min-w-0 flex-1">
        <span className="maison-eyebrow block">{offer.title}</span>
        <span className="mt-1.5 block text-[14px] font-light text-black">
          Add {titleCaseBrand(offer.brand)} {offer.name}
          {offer.size ? ` (${offer.size})` : ""} for {format(offer.addon_price)}
          <span className="ml-1.5 text-[13px] text-[#646464] line-through">{format(offer.price)}</span>
        </span>
        {offer.description ? <span className="mt-1 block text-[12px] font-light text-[#646464]">{offer.description}</span> : null}
      </span>
    </label>
  );
}
