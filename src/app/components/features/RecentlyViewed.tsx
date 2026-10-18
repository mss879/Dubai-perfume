"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFeature } from "../StoreFeaturesProvider";
import { useCurrency } from "../../lib/currency";
import { recordView, useRecentlyViewed, type ViewedProduct } from "../../lib/recently-viewed";

/** Remembers this product page in the shopper's browser (only while the feature is on). */
export function RecordView({ product }: { product: Omit<ViewedProduct, "at"> }) {
  const on = Boolean(useFeature("recently_viewed"));
  const { id, brand, name, price, image } = product;
  useEffect(() => {
    if (on) recordView({ id, brand, name, price, image });
  }, [on, id, brand, name, price, image]);
  return null;
}

/** "Recently viewed": the perfumes this browser looked at, most recent first. */
export default function RecentlyViewed({
  place,
  excludeId,
  className = "",
}: {
  place: "product" | "shop" | "bag";
  excludeId?: number;
  className?: string;
}) {
  const settings = useFeature("recently_viewed");
  const viewed = useRecentlyViewed();
  const { format } = useCurrency();
  if (!settings) return null;
  if (place === "product" && settings.show_on_product === false) return null;
  if (place === "shop" && settings.show_on_shop === false) return null;
  const items = viewed.filter((p) => p.id !== excludeId).slice(0, Number(settings.count) || 8);
  if (items.length === 0) return null;

  if (place === "bag") {
    return (
      <div className={className}>
        <p className="maison-eyebrow">Recently viewed</p>
        <ul className="mt-3 flex flex-col">
          {items.slice(0, 3).map((p) => (
            <li key={p.id} className="border-t py-3" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
              <Link href={`/product/${p.id}`} className="flex items-center gap-3">
                <span className="relative h-12 w-12 shrink-0 bg-[#F5F5F5]">
                  {p.image ? <Image src={p.image} alt={p.name} fill sizes="48px" className="object-contain p-1" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-light text-black">{p.name}</span>
                  <span className="block text-[11px] uppercase tracking-[0.08em] text-[#646464]">{p.brand}</span>
                </span>
                <span className="text-[13px] font-light text-black">{format(p.price)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className={className} aria-label="Recently viewed">
      <h2 className="font-display text-[16px] uppercase tracking-[0.1em] text-black md:text-[18px]">Recently viewed</h2>
      <ul className="no-scrollbar mt-6 flex gap-5 overflow-x-auto pb-2">
        {items.map((p) => (
          <li key={p.id} className="w-[140px] shrink-0 md:w-[170px]">
            <Link href={`/product/${p.id}`} className="block">
              <span className="relative block aspect-square bg-[var(--surface-2)]">
                {p.image ? <Image src={p.image} alt={p.name} fill sizes="170px" className="object-contain p-4" /> : null}
              </span>
              <span className="mt-3 block text-[11px] uppercase tracking-[0.1em] text-[#646464]">{p.brand}</span>
              <span className="mt-1 block truncate text-[13px] font-light text-black">{p.name}</span>
              <span className="mt-1 block text-[13px] font-light text-black">{format(p.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
