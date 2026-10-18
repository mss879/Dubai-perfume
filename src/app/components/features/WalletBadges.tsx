"use client";

import { usePaymentMode } from "../PaymentModeProvider";
import { useFeature } from "../StoreFeaturesProvider";

/**
 * "Apple Pay · Google Pay · Visa · Mastercard", shown up front (Admin → Apple
 * Pay & Google Pay badges). Only while the store takes payment online; how
 * payment works doesn't change.
 */
export default function WalletBadges({ place, className = "" }: { place: "product" | "bag" | "checkout"; className?: string }) {
  const settings = useFeature("wallet_badges");
  const mode = usePaymentMode();
  if (!settings || mode !== "online") return null;
  const where = { product: "show_on_product", bag: "show_in_bag", checkout: "show_on_checkout" }[place];
  if (settings[where] === false) return null;
  const marks = [
    settings.apple_pay ? "Apple Pay" : null,
    settings.google_pay ? "Google Pay" : null,
    settings.cards ? "Visa" : null,
    settings.cards ? "Mastercard" : null,
  ].filter((m): m is string => Boolean(m));
  if (marks.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} aria-label={`Pay with ${marks.join(", ")}`}>
      {marks.map((mark) => (
        <span
          key={mark}
          className="inline-flex h-7 items-center px-2.5 text-[11px] font-normal tracking-[0.04em] text-black"
          style={{ border: "1px solid rgba(0,0,0,0.18)" }}
        >
          {mark}
        </span>
      ))}
    </div>
  );
}
