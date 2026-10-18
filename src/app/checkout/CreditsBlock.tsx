"use client";

import Link from "next/link";
import { useState } from "react";
import type { CheckoutQuote } from "../lib/offers";
import type { FeatureSettings } from "../lib/features";
import { useCurrency } from "../lib/currency";

const HAIRLINE = "rgba(0,0,0,0.12)";

/**
 * Points and gift cards at checkout (Admin → Loyalty points, Gift cards). The
 * figures are the database's (checkout_quote); place_order spends them.
 */
export default function CreditsBlock({
  quote,
  loyalty,
  giftCardsOn,
  signedIn,
  usePoints,
  onUsePoints,
  giftCard,
  onGiftCard,
  credits,
}: {
  quote: CheckoutQuote | null;
  loyalty: FeatureSettings | null;
  giftCardsOn: boolean;
  signedIn: boolean;
  usePoints: boolean;
  onUsePoints: (next: boolean) => void;
  giftCard: string | null;
  onGiftCard: (code: string | null) => void;
  /** The signed-in shopper's own cards and credit, to pick from. */
  credits: { code: string; balance: number; kind: string }[];
}) {
  const { format } = useCurrency();
  const [input, setInput] = useState("");
  const points = quote?.points ?? null;
  const card = quote?.gift_card ?? null;
  const showCards = giftCardsOn || credits.length > 0 || Boolean(giftCard);
  if (!loyalty && !showCards) return null;

  const programme = String(loyalty?.program_name || "Rewards");
  const goods = quote ? Math.max(0, quote.subtotal - quote.offer_saving - quote.code_goods) : 0;
  const earnEvery = Number(loyalty?.earn_per_aed) || 1;
  const earnPoints = Number(loyalty?.earn_points) || 0;
  const willEarn = Math.floor(Math.max(0, goods - (points?.value ?? 0)) / earnEvery) * earnPoints;

  const cardMessage = (() => {
    if (!giftCard || !card) return null;
    switch (card.status) {
      case "ok":
        return `${format(card.amount)} from your gift card${card.balance_after && card.balance_after > 0 ? `; ${format(card.balance_after)} stays on it for next time` : ""}.`;
      case "expired":
        return "That gift card has expired.";
      case "empty":
        return "That gift card has nothing left on it.";
      default:
        return "That gift card code isn't valid. Check it and try again.";
    }
  })();

  return (
    <div className="mt-8 flex flex-col gap-6 pt-6" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      {loyalty ? (
        <div>
          <p className="maison-label">{programme}</p>
          {!signedIn ? (
            <p className="text-[13px] font-light leading-[1.7] text-[#646464]">
              <Link href="/signin?redirect=/checkout" className="maison-link">
                Sign in
              </Link>{" "}
              to earn {willEarn > 0 ? `${willEarn.toLocaleString("en-AE")} points` : "points"} on this order and spend the points you have.
            </p>
          ) : points && points.usable > 0 ? (
            <label className="flex cursor-pointer items-start gap-3 text-[14px] font-light text-black">
              <input type="checkbox" checked={usePoints} onChange={(e) => onUsePoints(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" />
              <span>
                Use {points.usable.toLocaleString("en-AE")} points: −{format(points.usable_value)}
                <span className="mt-0.5 block text-[12px] text-[#646464]">You have {points.available.toLocaleString("en-AE")} points.</span>
              </span>
            </label>
          ) : (
            <p className="text-[13px] font-light leading-[1.7] text-[#646464]">
              {points && points.available > 0
                ? `You have ${points.available.toLocaleString("en-AE")} points. From ${points.min_redeem.toLocaleString("en-AE")} points you can spend them here.`
                : "Points you earn arrive once your order is delivered."}
            </p>
          )}
          {signedIn && willEarn > 0 ? (
            <p className="pt-2 text-[12px] font-light text-[#646464]">This order earns {willEarn.toLocaleString("en-AE")} points once it&rsquo;s delivered.</p>
          ) : null}
        </div>
      ) : null}

      {showCards ? (
        <div>
          <label htmlFor="giftCardCode" className="maison-label">
            Gift card or credit
          </label>
          {giftCard ? (
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[13px] tracking-[0.08em] text-black">{giftCard}</span>
              <button type="button" onClick={() => onGiftCard(null)} className="maison-link cursor-pointer">
                Remove
              </button>
            </div>
          ) : (
            <>
              {credits.length > 0 ? (
                <div className="mb-3 flex flex-col gap-2">
                  {credits.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => onGiftCard(c.code)}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] font-light text-black"
                      style={{ border: `1px solid ${HAIRLINE}` }}
                    >
                      <span>{c.kind === "reward" ? "Your referral credit" : "Your gift card"} · {format(c.balance)}</span>
                      <span className="maison-link">Use</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-stretch gap-3">
                <input
                  id="giftCardCode"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (input.trim()) onGiftCard(input.trim().toUpperCase());
                    }
                  }}
                  placeholder="GC-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  className="maison-input min-w-0 flex-1"
                />
                <button type="button" onClick={() => input.trim() && onGiftCard(input.trim().toUpperCase())} className="maison-btn-outline shrink-0">
                  Apply
                </button>
              </div>
            </>
          )}
          {cardMessage ? (
            <p className="pt-3 text-[12px] font-light leading-[1.7] text-[#646464]" role="status">
              {cardMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
