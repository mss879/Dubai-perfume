"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toTitleCase } from "../lib/catalogue";

/* A maison, exactly as the `collections` table stores it (kind = 'brand').
   Nothing here is invented locally — AppHeader reads the rows and passes them
   down, so the menu can never advertise a house the database does not have. */
export interface BrandItem {
  id: string;
  title: string;
  description?: string | null;
  cover_image?: string | null;
  sort_order?: number | null;
}

interface BrandsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Brand collections (kind = 'brand'), already sorted by sort_order.
   *  Optional so a caller that has not fetched yet renders an empty menu
   *  rather than crashing the page that contains it. */
  brands?: BrandItem[];
}

const HAIRLINE = "rgba(0,0,0,0.12)";

/* "AL HARAMAIN" → "Al Haramain" */
export default function BrandsDropdown({
  isOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
  brands = []
}: BrandsDropdownProps) {
  /* The editorial column shows the first three maisons that actually carry
     cover art. An unfetched or art-less menu simply renders the list alone. */
  const featuredTiles = brands.filter((brand) => Boolean(brand.cover_image)).slice(0, 3);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="absolute top-full left-0 w-full z-50 bg-white text-black font-body border-t border-b"
          style={{ borderColor: HAIRLINE }}
        >
          <div className="maison-container py-12 lg:py-16 grid grid-cols-12 gap-10 lg:gap-16">
            {/* Brand list */}
            <div className={featuredTiles.length > 0 ? "col-span-12 lg:col-span-4" : "col-span-12"}>
              <p className="maison-eyebrow mb-7">Maisons</p>

              <ul role="menu" aria-label="Maisons">
                {brands.map((brand) => (
                  <li key={brand.id} role="none">
                    <Link
                      role="menuitem"
                      href={`/collection/${brand.id}`}
                      onClick={onClose}
                      className="inline-block py-2.5 text-[15px] font-[350] tracking-[0.02em] text-black leading-none decoration-1 underline-offset-[6px] transition-opacity duration-300 hover:underline focus-visible:underline"
                    >
                      {toTitleCase(brand.title)}
                    </Link>
                  </li>
                ))}
              </ul>

              <Link href="/collections" onClick={onClose} className="maison-link mt-8">
                View all brands
              </Link>
            </div>

            {/* Editorial tiles */}
            {featuredTiles.length > 0 && (
              <div className="col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8 lg:gap-10">
                {featuredTiles.map((brand) => (
                  <Link
                    key={brand.id}
                    href={`/collection/${brand.id}`}
                    onClick={onClose}
                    className="group block text-center"
                  >
                    <div className="relative w-full aspect-[4/5] overflow-hidden bg-[#F5F5F5]">
                      <Image
                        src={brand.cover_image as string}
                        alt={toTitleCase(brand.title)}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 300px"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                    </div>

                    <h3 className="maison-card-title mt-5">{brand.title.toUpperCase()}</h3>

                    {brand.description && (
                      <p className="mt-2 text-[13px] font-light leading-relaxed text-[#646464] line-clamp-2">
                        {brand.description}
                      </p>
                    )}

                    <span className="maison-link mt-4">Discover</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
