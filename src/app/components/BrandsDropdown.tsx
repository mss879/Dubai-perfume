"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ArrowRight, Sparkles } from "lucide-react";

export interface BrandItem {
  id: string;
  name: string;
  image: string;
  accent: string;
  href: string;
  tagline: string;
}

export const BRAND_HOUSES: BrandItem[] = [
  {
    id: "rasasi",
    name: "RASASI",
    image: "/brands/rasasi-perfume.png",
    accent: "#E3B573",
    href: "/collection/rasasi",
    tagline: "Royal Oriental & Amber Edition"
  },
  {
    id: "lattafa",
    name: "LATTAFA",
    image: "/brands/lattafa-perfume.png",
    accent: "#E8C07F",
    href: "/collection/lattafa",
    tagline: "Opulent Arabian Masterpieces"
  },
  {
    id: "armaf",
    name: "ARMAF",
    image: "/brands/armaf-perfume.png",
    accent: "#CFC6B0",
    href: "/collection/armaf",
    tagline: "Club De Nuit High Perfumery"
  },
  {
    id: "french-avenue",
    name: "FRENCH AVENUE",
    image: "/brands/french-avenue-perfume.png",
    accent: "#E9A075",
    href: "/collection/french-avenue",
    tagline: "Parisian & Oriental Fusion"
  },
  {
    id: "afnan",
    name: "AFNAN",
    image: "/brands/afnan-perfume.png",
    accent: "#CDC58D",
    href: "/collection/afnan",
    tagline: "Crafted Luxury Blends"
  },
  {
    id: "al-haramain",
    name: "AL HARAMAIN",
    image: "/brands/al-haramain-perfume.png",
    accent: "#DDA96F",
    href: "/collection/al-haramain",
    tagline: "Heritage & Rare Oud"
  }
];

interface BrandsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isDarkTheme?: boolean;
}

export default function BrandsDropdown({
  isOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
  isDarkTheme = false
}: BrandsDropdownProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`absolute top-full left-0 w-full z-50 min-h-[48vh] flex flex-col justify-between shadow-[0_35px_90px_rgba(27,15,10,0.25)] border-b transition-colors duration-300 ${
          isDarkTheme
            ? "bg-[#0E0A07]/98 backdrop-blur-2xl border-white/15 text-white"
            : "bg-[#FAF6F0]/98 backdrop-blur-2xl border-amber-900/15 text-[#3B1F0B]"
        }`}
      >
        {/* Invisible Hover Bridge */}
        <div className="absolute -top-6 left-0 right-0 h-6 bg-transparent pointer-events-auto" />

        <div className="max-w-[1440px] mx-auto w-full px-6 md:px-12 py-8 flex flex-col justify-between flex-grow relative z-10 font-sans-luxury">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between border-b border-amber-900/15 pb-5 mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#4A2C11]/10 border border-[#4A2C11]/30 flex items-center justify-center text-[#4A2C11] shrink-0">
                <Sparkles className="w-4 h-4 text-[#4A2C11] dark:text-[#E8C07F]" />
              </div>
              <div>
                <h3
                  className="text-xs font-black tracking-[0.25em] uppercase"
                  style={{ color: isDarkTheme ? "#E8C07F" : "#4A2C11" }}
                >
                  FEATURED BRANDS
                </h3>
                <p
                  className="text-[11px] font-sans tracking-wider"
                  style={{ color: isDarkTheme ? "#D4A373" : "#6B4423" }}
                >
                  Select a brand to view its perfume collection
                </p>
              </div>
            </div>

            <Link
              href="/collections"
              onClick={onClose}
              className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.2em] uppercase transition-colors group cursor-pointer"
              style={{ color: isDarkTheme ? "#E8C07F" : "#4A2C11" }}
            >
              <span>VIEW ALL BRANDS</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Horizontal Banner Cards featuring actual Perfume Bottle Images */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 my-auto">
            {BRAND_HOUSES.map((brand) => (
              <Link
                key={brand.id}
                href={brand.href}
                onClick={onClose}
                className={`group rounded-2xl border transition-all duration-300 flex items-center justify-between overflow-hidden cursor-pointer h-28 sm:h-32 shadow-md hover:shadow-xl ${
                  isDarkTheme
                    ? "bg-white/[0.04] border-white/15 hover:border-amber-400/60 hover:bg-white/[0.08]"
                    : "bg-white border-amber-900/15 hover:border-amber-800/50 hover:shadow-[0_12px_30px_rgba(180,120,60,0.15)]"
                }`}
              >
                {/* Horizontal Perfume Bottle Showcase Window */}
                <div className="relative w-28 sm:w-36 md:w-40 h-full overflow-hidden shrink-0 bg-gradient-to-b from-neutral-900/10 to-amber-950/20 dark:from-white/5 dark:to-amber-500/10 border-r border-amber-900/10 flex items-center justify-center p-2.5">
                  {/* Backlight Ambient Glow */}
                  <div
                    className="absolute inset-0 opacity-25 group-hover:opacity-50 transition-opacity duration-500 blur-lg pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${brand.accent} 0%, transparent 70%)` }}
                  />

                  {/* Perfume Bottle Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brand.image}
                    alt={brand.name}
                    className="h-24 sm:h-28 w-auto object-contain relative z-10 drop-shadow-[0_8px_18px_rgba(0,0,0,0.25)] group-hover:scale-108 transition-all duration-300 ease-out"
                  />
                </div>

                {/* Content Section */}
                <div className="p-4 sm:p-5 flex-1 flex items-center justify-between gap-3">
                  <div>
                    <h4
                      className="text-sm sm:text-base font-black tracking-[0.2em] uppercase transition-colors"
                      style={{ color: isDarkTheme ? "#FFFFFF" : "#3B1F0B" }}
                    >
                      {brand.name}
                    </h4>
                    <p
                      className="text-[11px] font-medium font-sans mt-1"
                      style={{ color: isDarkTheme ? "#E8C07F" : "#78350F" }}
                    >
                      {brand.tagline}
                    </p>
                  </div>

                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                      isDarkTheme
                        ? "bg-white/10 text-amber-400 group-hover:bg-amber-400 group-hover:text-black"
                        : "bg-[#4A2C11]/10 text-[#3B1F0B] group-hover:bg-[#3B1F0B] group-hover:text-white"
                    }`}
                  >
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Footer Bar */}
          <div className="mt-6 pt-4 border-t border-amber-900/15 flex items-center justify-between">
            <span
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: isDarkTheme ? "#AAAAAA" : "#6B4423" }}
            >
              AUTHENTIC DUBAI & ARABIAN PERFUME BRANDS
            </span>

            <Link
              href="/collections"
              onClick={onClose}
              className="text-[11px] font-black tracking-[0.2em] uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
              style={{ color: isDarkTheme ? "#E8C07F" : "#4A2C11" }}
            >
              <span>VIEW ALL BRANDS</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
