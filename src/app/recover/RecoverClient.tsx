"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { readCart, writeCart, type CartLine } from "../lib/cart";
import { useCurrency } from "../lib/currency";
import { openCartDrawer } from "../components/CartDrawer";
import { amountToFreeShipping } from "../lib/shipping";

/** One restorable line, already resolved against the live catalogue. */
export type RecoverableLine = {
  productId: number;
  brand: string;
  name: string;
  priceAed: number;
  imageUrl: string;
  size: string;
  quantity: number;
};

const HAIRLINE = "rgba(0,0,0,0.12)";

/**
 * Puts a saved selection back in the bag.
 *
 * MERGES rather than replaces: a shopper who followed the reminder after
 * putting something new in their bag must not lose it. Where the same product
 * and size appear in both, the larger quantity wins — restoring cannot silently
 * reduce what is already there.
 */
function mergeIntoCart(lines: RecoverableLine[]): void {
  const current = [...readCart()];

  for (const line of lines) {
    const index = current.findIndex(
      (c) => c.product.id === line.productId && c.selectedSize === line.size
    );
    const restored: CartLine = {
      product: {
        id: line.productId,
        brand: line.brand,
        name: line.name,
        price: line.priceAed,
        image_url: line.imageUrl,
      },
      selectedSize: line.size,
      quantity: Math.max(1, Math.min(20, line.quantity)),
    };

    if (index > -1) {
      current[index] = {
        ...restored,
        quantity: Math.max(current[index].quantity, restored.quantity),
      };
    } else {
      current.push(restored);
    }
  }

  writeCart(current);
}

export default function RecoverClient({ lines }: { lines: RecoverableLine[] }) {
  const { format } = useCurrency();
  const [restored, setRestored] = useState(false);
  // React runs effects twice in development; the merge is idempotent, but the
  // guard keeps the drawer from opening and closing behind itself.
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    mergeIntoCart(lines);
    setRestored(true);
  }, [lines]);

  const subtotal = lines.reduce((sum, l) => sum + l.priceAed * l.quantity, 0);
  const remaining = amountToFreeShipping(subtotal);

  return (
    <section className="maison-container pb-16 md:pb-24">
      <div className="mx-auto max-w-[560px]">
        <ul className="flex flex-col border-t" style={{ borderColor: HAIRLINE }}>
          {lines.map((line) => (
            <li
              key={`${line.productId}-${line.size}`}
              className="flex gap-5 py-6 border-b"
              style={{ borderColor: HAIRLINE }}
            >
              <div className="relative w-20 h-20 flex-shrink-0 bg-[#F5F5F5]">
                {line.imageUrl && (
                  <Image
                    src={line.imageUrl}
                    alt={line.name}
                    fill
                    sizes="80px"
                    className="object-contain p-2"
                  />
                )}
              </div>

              <div className="flex min-w-0 flex-grow flex-col">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-display text-[15px] leading-[1.3] tracking-[0.06em] uppercase text-black">
                    {line.name}
                  </h2>
                  <span className="maison-price whitespace-nowrap">
                    {format(line.priceAed * line.quantity)}
                  </span>
                </div>
                <p className="mt-2 text-[12px] font-light uppercase tracking-[0.02em] text-[#646464]">
                  {[line.brand, line.size].filter(Boolean).join(" — ")}
                  {line.quantity > 1 ? ` — Qty ${line.quantity}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between pt-6">
          <span className="text-[14px] font-light text-black">Subtotal</span>
          <span className="text-[14px] font-light text-black">{format(subtotal)}</span>
        </div>

        {remaining > 0 && (
          <p className="pt-3 text-[12px] font-light leading-[1.7] text-[#646464]">
            Add {format(remaining)} more and delivery is complimentary.
          </p>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/checkout" className="maison-btn w-full sm:w-auto">
            Complete your order
          </Link>
          <button
            type="button"
            onClick={openCartDrawer}
            className="maison-btn-outline w-full sm:w-auto cursor-pointer"
          >
            View your bag
          </button>
        </div>

        <p className="mt-8 text-center text-[12px] font-light text-[#646464]" role="status">
          {restored ? "Your selection has been returned to your bag." : "Restoring your selection…"}
        </p>
      </div>
    </section>
  );
}
