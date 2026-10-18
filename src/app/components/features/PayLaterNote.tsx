"use client";

import { usePaymentMode } from "../PaymentModeProvider";
import { useFeature } from "../StoreFeaturesProvider";
import { useCurrency } from "../../lib/currency";

const PROVIDERS: Record<string, string> = { tabby: "Tabby", tamara: "Tamara", both: "Tabby or Tamara" };

/**
 * "Or 4 payments of AED 62.50 with Tabby" (Admin → Pay later). Only while the
 * store takes payment online, and only between the owner's amounts; Paymob's
 * checkout offers the instalments once the owner has them enabled there.
 */
export default function PayLaterNote({ amountAed, place, className = "" }: { amountAed: number; place: "product" | "checkout"; className?: string }) {
  const settings = useFeature("pay_later");
  const mode = usePaymentMode();
  const { format } = useCurrency();
  if (!settings || mode !== "online" || !(amountAed > 0)) return null;
  if (place === "product" && settings.show_on_product === false) return null;
  if (place === "checkout" && settings.show_on_checkout === false) return null;
  const min = Number(settings.min_amount) || 0;
  const max = Number(settings.max_amount) || Infinity;
  if (amountAed < min || amountAed > max) return null;
  const count = Math.max(2, Number(settings.instalments) || 4);
  const each = Math.ceil((amountAed / count) * 100) / 100;

  return (
    <p className={`text-[13px] font-light text-[#646464] ${className}`}>
      Or {count} payments of <span className="text-black">{format(each)}</span> with {PROVIDERS[String(settings.provider)] ?? "Tabby"}, at checkout.
    </p>
  );
}
