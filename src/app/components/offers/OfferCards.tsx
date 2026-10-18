"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { addToCart } from "../../lib/cart";
import { useCurrency } from "../../lib/currency";
import { scopeWords, tierLine, timeLeft, titleCaseBrand, type OfferCard } from "../../lib/offers";
import { openCartDrawer } from "../CartDrawer";

const HAIRLINE = "rgba(0,0,0,0.12)";

/** The minute, on the client only (null while rendering on the server, so nothing mismatches). */
function subscribeMinute(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}
function useMinute(): number | null {
  return useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null
  );
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Asia/Dubai" });

/**
 * The offers a shopper can act on: sets (with "Add the set"), buy-more steps,
 * and the free gift. On a product page only the ones involving that perfume;
 * on /offers, all of them. The prices shown are the database's; the bag and
 * checkout price the actual order the same way.
 */
export default function OfferCards({
  cards,
  variant,
}: {
  cards: OfferCard[];
  variant: "product" | "page";
}) {
  const sets = cards.filter((c) => c.kind === "bundle" && c.bundle && c.bundle.lines.length > 0);
  const tiers = cards.filter((c) => c.kind === "tiered" && c.tiers.length > 0);
  const gifts = cards.filter((c) => c.kind === "gift" && c.product);
  if (sets.length + tiers.length + gifts.length === 0) return null;

  return (
    <div className={variant === "product" ? "mt-9 flex flex-col gap-4" : "flex flex-col gap-6"}>
      {tiers.map((card) => (
        <TierLine key={card.id} card={card} variant={variant} />
      ))}
      {sets.map((card) => (
        <SetCard key={card.id} card={card} variant={variant} />
      ))}
      {gifts.map((card) => (
        <GiftLine key={card.id} card={card} />
      ))}
    </div>
  );
}

function TierLine({ card, variant }: { card: OfferCard; variant: "product" | "page" }) {
  return (
    <div className="p-5" style={{ border: `1px solid ${HAIRLINE}` }}>
      <span className="maison-eyebrow block">{card.count_by === "same_product" ? "Two of the same" : "Buy more, save more"}</span>
      <p className="mt-2.5 text-[15px] font-normal leading-snug text-black">{card.title}</p>
      <p className="mt-1.5 text-[14px] font-light leading-relaxed text-black">
        {tierLine(card)}
        {card.count_by === "same_product" ? "" : `, on ${scopeWords(card)}`}.
      </p>
      {card.description ? <p className="mt-1.5 text-[13px] font-light leading-relaxed text-[#646464]">{card.description}</p> : null}
      {variant === "product" ? (
        <p className="mt-2 text-[12px] font-light text-[#646464]">Applied automatically in your bag.</p>
      ) : null}
    </div>
  );
}

function GiftLine({ card }: { card: OfferCard }) {
  const { format } = useCurrency();
  const product = card.product!;
  return (
    <div className="bg-[var(--surface-2)] p-5">
      <span className="maison-eyebrow block">A gift with your order</span>
      <p className="mt-2.5 text-[14px] font-light leading-relaxed text-black">
        {card.title}: {titleCaseBrand(product.brand)} {product.name}, with orders of {format(card.min_subtotal)} or more.
      </p>
    </div>
  );
}

function SetCard({ card, variant }: { card: OfferCard; variant: "product" | "page" }) {
  const { format } = useCurrency();
  const now = useMinute();
  const [added, setAdded] = useState(false);
  const set = card.bundle!;
  const saving = Math.max(0, set.base - set.price);
  const available = set.lines.every((l) => l.in_stock !== false);
  const left = now !== null ? timeLeft(card.ends_at, now) : null;
  const eyebrow =
    card.template === "layering"
      ? "Layering duo"
      : card.template === "his_hers"
        ? "His & Hers"
        : card.template === "occasion"
          ? "Gift box"
          : "The set";

  const addSet = () => {
    for (const line of set.lines) {
      addToCart(
        { id: line.product_id, brand: line.brand, name: line.name, price: line.price, image_url: line.image_url || "" },
        line.size,
        line.qty ?? 1
      );
    }
    setAdded(true);
    openCartDrawer();
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <section className="p-5 md:p-6" style={{ border: `1px solid ${HAIRLINE}` }} aria-label={card.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="maison-eyebrow">{eyebrow}</span>
        {card.ends_at ? (
          <span className="text-[12px] font-light text-[#646464]">
            {left ? `Ends in ${left}` : `Until ${dateFormat.format(new Date(card.ends_at))}`}
          </span>
        ) : null}
      </div>
      <h3 className={variant === "page" ? "mt-3 text-[20px] font-light leading-snug text-black" : "mt-2.5 text-[16px] font-normal leading-snug text-black"}>
        {card.title}
      </h3>
      {card.description ? <p className="mt-1.5 text-[14px] font-light leading-relaxed text-[#646464]">{card.description}</p> : null}

      <ul className="mt-4 flex flex-col">
        {set.lines.map((line) => (
          <li key={`${line.product_id}-${line.size}`} className="flex items-center gap-4 py-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
            <Link href={`/product/${line.product_id}`} className="relative h-14 w-14 shrink-0 bg-[#F5F5F5]">
              {line.image_url ? (
                <Image src={line.image_url} alt={`${titleCaseBrand(line.brand)} ${line.name}`} fill sizes="56px" className="object-contain p-1.5" />
              ) : null}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#646464]">{line.brand}</p>
              <Link href={`/product/${line.product_id}`} className="block truncate text-[14px] font-light text-black hover:underline">
                {line.name}
              </Link>
              <p className="text-[12px] font-light text-[#646464]">
                {[line.size, (line.qty ?? 1) > 1 ? `× ${line.qty}` : null].filter(Boolean).join(" ")}
                {line.in_stock === false ? " · back soon" : ""}
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-light text-[#646464] tabular-nums">{format(line.price * (line.qty ?? 1))}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <p className="text-[15px] text-black">
          {saving > 0 ? <span className="mr-2 text-[13px] font-light text-[#646464] line-through">{format(set.base)}</span> : null}
          <span>{format(set.price)}</span>
          {saving > 0 ? <span className="ml-2 text-[13px] font-light">· save {format(saving)}</span> : null}
        </p>
        <button type="button" onClick={addSet} disabled={!available || added} className="maison-btn-outline h-11 px-6 disabled:cursor-not-allowed disabled:opacity-50">
          {!available ? "Back soon" : added ? "Added to bag" : "Add the set to bag"}
        </button>
      </div>
      {card.free_delivery || card.gift_wrap ? (
        <p className="mt-3 text-[12px] font-light text-[#646464]">
          {[card.free_delivery ? "Free delivery" : null, card.gift_wrap ? "Arrives gift-wrapped" : null].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
