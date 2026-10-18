"use client";

import { Gift, Lock, MessageCircle, ShieldCheck, Sparkles, Truck, Undo2 } from "lucide-react";
import { useFeature } from "../StoreFeaturesProvider";
import type { TrustIcon, TrustItem } from "../../lib/features";

const ICONS: Record<TrustIcon, typeof Lock> = {
  shield: ShieldCheck,
  lock: Lock,
  return: Undo2,
  truck: Truck,
  gift: Gift,
  sparkle: Sparkles,
  chat: MessageCircle,
};

/** The owner's reassurance lines (Admin → Trust badges), at checkout or on a product page. */
export default function TrustStrip({ place, className = "" }: { place: "checkout" | "product"; className?: string }) {
  const settings = useFeature("trust_strip");
  if (!settings) return null;
  if (place === "checkout" && settings.show_on_checkout === false) return null;
  if (place === "product" && settings.show_on_product !== true) return null;
  const items = (Array.isArray(settings.items) ? settings.items : []) as TrustItem[];
  if (items.length === 0) return null;

  return (
    <ul className={`grid grid-cols-1 gap-x-6 sm:grid-cols-2 ${className}`} aria-label="Why shop with us">
      {items.map((item, i) => {
        const Icon = ICONS[item.icon] ?? ShieldCheck;
        return (
          <li key={i} className="flex items-start gap-3 border-b py-3" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-black" strokeWidth={1.25} aria-hidden />
            <span className="min-w-0">
              <span className="block text-[13px] font-normal leading-snug text-black">{item.title}</span>
              {item.text ? <span className="block text-[12px] font-light leading-snug text-[#646464]">{item.text}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
