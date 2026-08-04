"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCart } from "../lib/cart";
import { useCurrency } from "../lib/currency";

const OPEN_EVENT = "gharib:cart:open";
const HAIRLINE = "rgba(0,0,0,0.12)";

/** Open the shared cart drawer from anywhere (after an add-to-cart, etc.). */
export function openCartDrawer() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT));
  }
}

/**
 * Shared right-side cart drawer (design-system.md §5.6) — the same panel the
 * homepage has always had, now available on every page. Render once per page;
 * it manages its own open state via the `gharib:cart:open` event.
 */
export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { lines, count, subtotal, setQuantity, remove } = useCart();
  const { format } = useCurrency();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 z-[100] cursor-pointer"
            aria-hidden="true"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white border-l z-[101] flex flex-col font-body text-black outline-none"
            style={{ borderColor: HAIRLINE }}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
            tabIndex={-1}
            ref={panelRef}
          >
            <div
              className="flex items-start justify-between gap-4 px-6 py-6 border-b"
              style={{ borderColor: HAIRLINE }}
            >
              <div className="flex items-baseline gap-3">
                <h3 className="font-display text-[20px] leading-none tracking-[0.07em] uppercase text-black">
                  Your selection
                </h3>
                <span className="text-[12px] font-normal uppercase tracking-[0.1em] text-[#646464]">
                  ({count})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close cart"
                className="text-black transition-opacity duration-300 hover:opacity-60 cursor-pointer"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={1.25} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto px-6 flex flex-col">
              {lines.length === 0 ? (
                <div className="flex flex-grow flex-col items-center justify-center gap-8 py-20 text-center">
                  <p className="font-display text-[20px] leading-none tracking-[0.07em] uppercase text-black">
                    Your cart is empty
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="maison-btn-outline"
                  >
                    Continue shopping
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col">
                  {lines.map((line) => (
                    <li
                      key={`${line.product.id}-${line.selectedSize}`}
                      className="flex gap-5 py-6 border-b last:border-b-0"
                      style={{ borderColor: HAIRLINE }}
                    >
                      <div className="relative w-24 h-24 flex-shrink-0 bg-[#F5F5F5]">
                        {line.product.image_url && (
                          <Image
                            src={line.product.image_url}
                            alt={line.product.name}
                            fill
                            sizes="96px"
                            className="object-contain p-2"
                          />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-grow flex-col">
                        <div className="flex items-start justify-between gap-4">
                          <h4 className="font-display text-[16px] leading-[1.3] tracking-[0.06em] uppercase text-black">
                            {line.product.name}
                          </h4>
                          <span className="maison-price whitespace-nowrap">
                            {format(line.product.price * line.quantity)}
                          </span>
                        </div>

                        <p className="mt-2 text-[12px] font-normal uppercase tracking-[0.02em] text-[#646464]">
                          {line.product.brand} — {line.selectedSize}
                        </p>

                        <div className="mt-auto flex items-center justify-between gap-4 pt-5">
                          <div
                            className="inline-flex items-center border"
                            style={{ borderColor: HAIRLINE }}
                          >
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() =>
                                setQuantity(line.product.id, line.selectedSize, line.quantity - 1)
                              }
                              className="flex h-8 w-8 items-center justify-center text-[14px] font-light text-black transition-colors duration-300 hover:bg-[#F5F5F5] cursor-pointer"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-[13px] font-light text-black">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() =>
                                setQuantity(line.product.id, line.selectedSize, line.quantity + 1)
                              }
                              className="flex h-8 w-8 items-center justify-center text-[14px] font-light text-black transition-colors duration-300 hover:bg-[#F5F5F5] cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => remove(line.product.id, line.selectedSize)}
                            className="text-[12px] uppercase tracking-[0.1em] text-[#646464] transition-colors duration-300 hover:text-black cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <div
                className="border-t px-6 py-6 flex flex-col gap-5"
                style={{ borderColor: HAIRLINE }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-light text-black">Subtotal</span>
                  <span className="text-[14px] font-light text-black text-right">
                    {format(subtotal)}
                  </span>
                </div>

                <p className="text-[12px] font-light leading-relaxed text-[#646464]">
                  Payment is collected on delivery. Complimentary delivery on orders over
                  AED 250.
                </p>

                <Link href="/checkout" className="maison-btn w-full">
                  Proceed to checkout
                </Link>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="maison-link cursor-pointer"
                  >
                    Continue shopping
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
