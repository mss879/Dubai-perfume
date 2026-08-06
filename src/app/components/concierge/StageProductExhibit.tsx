"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCurrency } from "../../lib/currency";
import type { ConciergeAction, ConciergeCard } from "../../lib/concierge/types";

const HAIRLINE = "rgba(0,0,0,0.12)";

/**
 * The product exhibit — what the stage shows when the concierge presents
 * compositions.
 *
 * One product gets the full vitrine. Two or three become a horizontal rail of
 * strictly aligned cards: every zone (image, house, name, price, button) has
 * a fixed height, so a one-line name and a two-line name still land their
 * price and ADD on the same baselines — misaligned buttons are what makes a
 * small display read as clutter. No boxes, no column rules; on the grey
 * stage, the bottles separate themselves. On narrow screens the rail scrolls
 * with snap points and the peek of the next card says so.
 *
 * Every fact rendered here arrived server-resolved on a ConciergeCard.
 */

type OnAdd = (product: ConciergeAction["product"], size: string) => void;

function stockLine(card: ConciergeCard, size: string): { text: string; out: boolean } | null {
  if (!card.stock) return null;
  const row = card.stock.find((s) => s.size === size) ?? card.stock[0];
  if (!row) return null;
  if (row.level <= 0) return { text: "Out of stock", out: true };
  if (row.low) return { text: `Only ${row.level} left`, out: false };
  return null;
}

function toActionProduct(card: ConciergeCard): ConciergeAction["product"] {
  return { id: card.id, brand: card.brand, name: card.name, priceAed: card.priceAed, image: card.image };
}

function SoloExhibit({ card, onAdd }: { card: ConciergeCard; onAdd: OnAdd }) {
  const { format } = useCurrency();
  const [size, setSize] = useState(card.sizes[0] ?? "");
  const stock = stockLine(card, size);
  const notes = [card.topNotes[0], card.heartNotes[0], card.baseNotes[0]].filter(Boolean);

  return (
    <div className="flex h-full gap-6 px-6 py-6">
      <Link
        href={`/product/${card.id}`}
        className="relative block h-full w-[40%] shrink-0"
        aria-label={`View ${card.name}`}
      >
        <Image src={card.image} alt={card.name} fill sizes="200px" className="object-contain" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-1">
        <span className="maison-eyebrow">{card.brand}</span>
        <Link href={`/product/${card.id}`} className="block">
          <h4 className="font-display text-[16px] leading-[1.25] tracking-[0.06em] uppercase text-black transition-opacity duration-300 hover:opacity-55">
            {card.name}
          </h4>
        </Link>
        {notes.length > 0 && (
          <p className="text-[11px] font-normal uppercase tracking-[0.02em] leading-relaxed text-[#646464]">
            {notes.join(" · ")}
          </p>
        )}

        <div className="flex items-baseline gap-3 pt-1">
          <span className="maison-price">{format(card.priceAed)}</span>
          {stock && (
            <span
              className={`text-[10px] uppercase tracking-[0.1em] ${stock.out ? "text-[#646464]" : "text-black"}`}
            >
              {stock.text}
            </span>
          )}
        </div>

        {card.sizes.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {card.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors duration-300 cursor-pointer ${
                  s === size ? "border-black bg-black text-white" : "text-[#646464] hover:border-black hover:text-black"
                }`}
                style={s === size ? undefined : { borderColor: HAIRLINE }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            disabled={Boolean(stock?.out) || !size}
            onClick={() => onAdd(toActionProduct(card), size)}
            className="maison-btn cursor-pointer"
            style={{ padding: "11px 22px", fontSize: 11 }}
          >
            Add to bag
          </button>
          <Link href={`/product/${card.id}`} className="maison-link">
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

/** One rail card. Fixed zone heights keep every card's rows on shared baselines. */
function RailCard({ card, onAdd }: { card: ConciergeCard; onAdd: OnAdd }) {
  const { format } = useCurrency();
  const size = card.sizes[0] ?? "";
  const stock = stockLine(card, size);

  return (
    <div className="flex h-full w-[46%] min-w-[150px] max-w-[180px] shrink-0 snap-center flex-col text-center sm:w-[31%] sm:min-w-0">
      <Link
        href={`/product/${card.id}`}
        className="relative block h-[104px] w-full shrink-0"
        aria-label={`View ${card.name}`}
      >
        <Image src={card.image} alt={card.name} fill sizes="180px" className="object-contain" />
      </Link>

      <span className="mt-3 block h-[12px] shrink-0 text-[9px] font-normal uppercase tracking-[0.16em] text-[#646464]">
        {card.brand}
      </span>

      {/* Two lines are reserved whether the name needs them or not. */}
      <Link href={`/product/${card.id}`} className="mt-1 block h-[30px] shrink-0 overflow-hidden">
        <h4 className="font-display text-[11px] leading-[1.35] tracking-[0.06em] uppercase text-black transition-opacity duration-300 hover:opacity-55">
          {card.name}
        </h4>
      </Link>

      <span className="maison-price mt-1.5 block h-[16px] shrink-0 text-[12px]">
        {format(card.priceAed)}
      </span>

      <span
        className={`mt-0.5 block h-[12px] shrink-0 text-[9px] uppercase tracking-[0.1em] ${
          stock ? (stock.out ? "text-[#646464]" : "text-black") : "text-transparent"
        }`}
      >
        {stock?.text ?? "."}
      </span>

      <div className="mt-auto pt-2">
        <button
          type="button"
          disabled={Boolean(stock?.out) || !size}
          onClick={() => onAdd(toActionProduct(card), size)}
          className="maison-btn-outline w-full cursor-pointer"
          style={{ padding: "9px 0", fontSize: 10 }}
        >
          Add to bag
        </button>
      </div>
    </div>
  );
}

export default function StageProductExhibit({
  products,
  onAdd,
}: {
  products: ConciergeCard[];
  onAdd: OnAdd;
}) {
  if (products.length === 0) return null;
  if (products.length === 1) return <SoloExhibit card={products[0]} onAdd={onAdd} />;

  return (
    <div
      className={`no-scrollbar flex h-full snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-5 pt-6 sm:gap-3 ${
        products.length === 2 ? "justify-center" : "sm:justify-center"
      }`}
    >
      {products.map((card) => (
        <RailCard key={card.id} card={card} onAdd={onAdd} />
      ))}
    </div>
  );
}
