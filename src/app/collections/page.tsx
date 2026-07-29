"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Heart, User, ShoppingBag, Menu, X } from "lucide-react";
import { clientSafeSupabase } from "../lib/supabase";
import BrandsDropdown from "../components/BrandsDropdown";
import AppHeader from "../components/AppHeader";

interface DbCollection {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  kind?: string | null;
  parent_id?: string | null;
  brand?: string | null;
  sort_order?: number | null;
  story_eyebrow?: string | null;
  story_headline?: string | null;
  story_subline?: string | null;
  hero_image?: string | null;
  accent_hex?: string | null;
}

const BASE = "#150F0B";
const DEEP = "#1B140E";
const CREAM = "#F4E7D4";
const CREAM_SOFT = "#CDB99E";
const CREAM_MUTED = "#95836D";

/** Ships with the repo; migration 31 writes the same values into the database. */
const HOUSE_ACCENT: Record<string, string> = {
  rasasi: "#E3B573",
  lattafa: "#E8C07F",
  armaf: "#CFC6B0",
  "french-avenue": "#E9A075",
  afnan: "#CDC58D",
  "al-haramain": "#DDA96F"
};

const HOUSE_PERFUME_IMAGE: Record<string, string> = {
  rasasi: "/brands/rasasi-perfume.png",
  lattafa: "/brands/lattafa-perfume.png",
  armaf: "/brands/armaf-perfume.png",
  "french-avenue": "/brands/french-avenue-perfume.png",
  afnan: "/brands/afnan-perfume.png",
  "al-haramain": "/brands/al-haramain-perfume.png"
};

const artFor = (c: DbCollection) => ({
  accent: c.accent_hex || HOUSE_ACCENT[c.id] || "#E3B573",
  image: HOUSE_PERFUME_IMAGE[c.id] || c.hero_image || (HOUSE_ACCENT[c.id] ? `/brands/${c.id}-hero.jpg` : c.cover_image)
});

export default function CollectionsIndexPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<DbCollection[]>([]);
  const [curated, setCurated] = useState<DbCollection[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lineCounts, setLineCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBrandsMenuOpen, setIsBrandsMenuOpen] = useState(false);
  const brandsLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBrandsMouseEnter = () => {
    if (brandsLeaveTimeoutRef.current) {
      clearTimeout(brandsLeaveTimeoutRef.current);
      brandsLeaveTimeoutRef.current = null;
    }
    setIsBrandsMenuOpen(true);
  };

  const handleBrandsMouseLeave = () => {
    if (brandsLeaveTimeoutRef.current) {
      clearTimeout(brandsLeaveTimeoutRef.current);
    }
    brandsLeaveTimeoutRef.current = setTimeout(() => {
      setIsBrandsMenuOpen(false);
    }, 250);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: dbCollections } = await clientSafeSupabase.from("collections").select("*");
        const { data: dbMappings } = await clientSafeSupabase.from("product_collections").select("*");

        const all: DbCollection[] = dbCollections || [];
        const mappings = dbMappings || [];

        const tally: Record<string, number> = {};
        mappings.forEach((m: any) => {
          tally[m.collection_id] = (tally[m.collection_id] || 0) + 1;
        });
        setCounts(tally);

        const linesPerBrand: Record<string, number> = {};
        all
          .filter((c) => c.kind === "line" && c.parent_id)
          .forEach((c) => {
            linesPerBrand[c.parent_id as string] = (linesPerBrand[c.parent_id as string] || 0) + 1;
          });
        setLineCounts(linesPerBrand);

        setBrands(
          all.filter((c) => c.kind === "brand").sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        );
        setCurated(all.filter((c) => !c.kind || c.kind === "curated"));
      } catch (err) {
        console.error("Error loading collections:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div
      className="min-h-screen font-sans-luxury pt-[72px] relative overflow-x-hidden"
      style={{ backgroundColor: BASE, color: CREAM }}
    >
      {/* Mobile drawer navigation overlay */}
      <AppHeader activePage="brands" />

      {/* Masthead */}
      <section className="relative w-full px-6 md:px-10 pt-20 pb-16 md:pt-28 md:pb-20 overflow-hidden">
        {/* Glow ambient background effects */}
        <div
          className="absolute -top-[20%] right-[4%] w-[52vw] h-[52vw] max-w-[700px] max-h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(227,181,115,0.18) 0%, transparent 68%)", filter: "blur(54px)" }}
        />
        <div
          className="absolute bottom-0 right-[25%] w-[35vw] h-[35vw] max-w-[450px] max-h-[450px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(233,160,117,0.12) 0%, transparent 70%)", filter: "blur(60px)" }}
        />

        <div className="relative max-w-[1520px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Eyebrow, Single-Row Heading, Description */}
          <div className="lg:col-span-7 flex flex-col items-start text-left z-10">
            <span className="text-[9px] md:text-[10px] tracking-[0.44em] uppercase" style={{ color: "#E3B573" }}>
              The Houses
            </span>
            <h1
              className="font-serif-luxury leading-[1.05] tracking-[-0.02em] mt-5 whitespace-nowrap"
              style={{ fontSize: "clamp(2.2rem, 5.2vw, 4.8rem)", color: CREAM }}
            >
              Brand Collections
            </h1>
            <p className="text-[14px] md:text-[15.5px] leading-[1.9] font-light max-w-[54ch] mt-6" style={{ color: CREAM_SOFT }}>
              Every house we carry, with its complete line-up in one place — from the Rasasi Hawas
              signature range to Lattafa, Armaf, French Avenue, Afnan and Al Haramain.
            </p>
          </div>

          {/* Right Column: High-Fashion Floating Perfume Bottles Animation */}
          <div className="lg:col-span-5 relative flex items-center justify-center min-h-[260px] md:min-h-[320px] lg:min-h-[360px] z-10">
            {/* Floating Bottle 1: Amber Nectar */}
            <motion.div
              animate={{
                y: [-14, 14, -14],
                rotate: [-2, 2, -2],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative z-20 w-[170px] md:w-[210px] drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
            >
              <Image
                src="/brands/floating_amber.png"
                alt="Floating Amber Perfume"
                width={220}
                height={260}
                className="w-full h-auto object-contain filter drop-shadow-[0_15px_30px_rgba(227,181,115,0.25)]"
                priority
              />
            </motion.div>

            {/* Floating Bottle 2: Sapphire Eau De Parfum */}
            <motion.div
              animate={{
                y: [12, -12, 12],
                rotate: [3, -3, 3],
              }}
              transition={{
                duration: 7.5,
                delay: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute right-2 top-4 z-10 w-[130px] md:w-[160px] opacity-90 drop-shadow-[0_20px_35px_rgba(0,0,0,0.7)]"
            >
              <Image
                src="/brands/floating_sapphire.png"
                alt="Floating Sapphire Perfume"
                width={170}
                height={200}
                className="w-full h-auto object-contain filter drop-shadow-[0_15px_25px_rgba(40,80,180,0.25)]"
                priority
              />
            </motion.div>

            {/* Ambient luxury sparkles */}
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-8 left-12 text-[#E3B573] text-xs pointer-events-none"
            >
              ✦
            </motion.span>
            <motion.span
              animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.9, 1.3, 0.9] }}
              transition={{ duration: 4, delay: 1, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-10 right-8 text-[#E3B573] text-sm pointer-events-none"
            >
              ✧
            </motion.span>
          </div>
        </div>
      </section>

      {/* Houses */}
      <section className="relative w-full px-6 md:px-10 pb-28 min-h-[40vh]">
        <div className="max-w-[1520px] mx-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-4 py-24">
              <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.4} style={{ color: CREAM_MUTED }} />
              <span className="text-[9px] tracking-[0.3em] uppercase" style={{ color: CREAM_MUTED }}>Loading houses</span>
            </div>
          ) : brands.length === 0 ? (
            <div className="w-full text-center py-24 flex flex-col items-center gap-4">
              <span className="text-3xl" style={{ color: "#E3B57366" }}>✦</span>
              <h3 className="font-serif-luxury text-[22px]" style={{ color: CREAM }}>No brand collections yet</h3>
              <p className="text-[10px] tracking-[0.24em] uppercase max-w-md" style={{ color: CREAM_MUTED }}>
                Run the catalogue migrations to publish the brand pages
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {brands.map((brand, i) => {
                const { accent, image } = artFor(brand);
                return (
                  <Link
                    key={brand.id}
                    href={`/collection/${brand.id}`}
                    className="group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-700"
                    style={{ backgroundColor: DEEP, border: `1px solid ${accent}1F` }}
                  >
                    <div className="relative w-full aspect-[4/3] overflow-hidden">
                      {image ? (
                        <Image
                          src={image}
                          alt={brand.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.06]"
                        />
                      ) : (
                        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 35%, ${accent}44, ${DEEP})` }} />
                      )}
                      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${DEEP} 2%, ${DEEP}66 34%, transparent 72%)` }} />
                      <span
                        className="absolute top-4 left-4 text-[8px] tracking-[0.28em] uppercase px-3 py-1.5 rounded-full backdrop-blur-md"
                        style={{ backgroundColor: "rgba(21,15,11,0.55)", border: `1px solid ${accent}33`, color: accent }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="relative px-7 pb-8 pt-2 flex flex-col gap-3">
                      <span className="text-[8.5px] tracking-[0.3em] uppercase" style={{ color: accent }}>
                        {counts[brand.id] || 0} Fragrances
                        {lineCounts[brand.id] ? ` · ${lineCounts[brand.id]} Lines` : ""}
                      </span>
                      <h2 className="font-serif-luxury text-[28px] md:text-[32px] leading-[1.12] tracking-[-0.015em]" style={{ color: CREAM }}>
                        {brand.title}
                      </h2>
                      {brand.story_headline && (
                        <p className="font-serif-luxury italic text-[15px] leading-snug" style={{ color: `${accent}D9` }}>
                          {brand.story_headline}
                        </p>
                      )}
                      {(brand.story_subline || brand.description) && (
                        <p className="text-[12px] leading-[1.85] font-light line-clamp-2" style={{ color: CREAM_MUTED }}>
                          {brand.story_subline || brand.description}
                        </p>
                      )}
                      <span
                        className="flex items-center gap-2 text-[9px] tracking-[0.28em] uppercase mt-2 transition-all duration-500 group-hover:gap-3.5"
                        style={{ color: accent }}
                      >
                        Enter Collection <ArrowRight className="w-3 h-3" strokeWidth={1.4} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* House curations */}
          {!loading && curated.length > 0 && (
            <div className="mt-20 pt-14" style={{ borderTop: "1px solid rgba(227,181,115,0.14)" }}>
              <span className="text-[9px] tracking-[0.42em] uppercase" style={{ color: "#E3B573" }}>Also in store</span>
              <div className="flex flex-wrap gap-3 mt-7">
                {curated.map((collection) => (
                  <Link
                    key={collection.id}
                    href={`/collection/${collection.id}`}
                    className="text-[9.5px] tracking-[0.24em] uppercase px-5 py-2.5 rounded-full transition-all duration-400 hover:opacity-80"
                    style={{ border: "1px solid rgba(227,181,115,0.22)", color: CREAM_SOFT }}
                  >
                    {collection.title}
                    <span className="ml-2 opacity-60">{counts[collection.id] || 0}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
