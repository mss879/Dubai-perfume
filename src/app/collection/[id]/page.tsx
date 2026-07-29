"use client";

import React, { useState, useEffect, use, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2, Check, ArrowLeft, ChevronDown, Heart, User, Menu, X } from "lucide-react";
import { clientSafeSupabase } from "../../lib/supabase";
import BrandsDropdown from "../../components/BrandsDropdown";
import AppHeader from "../../components/AppHeader";

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

interface DbProduct {
  id: number;
  brand: string;
  name: string;
  price: number | string;
  sizes: string[] | null;
  image_url: string | null;
  image_urls: string[] | null;
  description: string | null;
  tagline: string | null;
  olfactory_group: string | null;
  tags: string[] | null;
  is_new?: boolean;
  is_bestseller?: boolean;
}

interface DbCollection {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  kind?: string | null;
  parent_id?: string | null;
  brand?: string | null;
  sort_order?: number | null;
  // Editorial fields (migration 31)
  story_eyebrow?: string | null;
  story_subline?: string | null;
  accent_hex?: string | null;
  deep_hex?: string | null;
  hero_image?: string | null;
}

interface LineSection {
  id: string;
  title: string;
  description: string | null;
  products: DbProduct[];
}

const FALLBACK_IMAGE = "/placeholder-bottle.png";

/* The house pages run on a dark espresso ground, so the accents below are the light-on-dark
   tones — each one clears 7:1 against the base. `deep` tints the hero band. */
const DEFAULT_ACCENT = "#E3B573";
const DEFAULT_DEEP = "#17110D";

const BASE = "#150F0B";
const CREAM = "#F4E7D4";
const CREAM_SOFT = "#CDB99E";
const CREAM_MUTED = "#95836D";

/**
 * Art direction shipped with the repo (public/brands/*). Migration 31 writes the same values
 * into `collections` and the database always wins — this keeps the pages correct beforehand.
 */
const HOUSE_ART: Record<string, { accent: string; deep: string }> = {
  rasasi: { accent: "#E3B573", deep: "#141C24" },
  lattafa: { accent: "#E8C07F", deep: "#191309" },
  armaf: { accent: "#CFC6B0", deep: "#121213" },
  "french-avenue": { accent: "#E9A075", deep: "#1A1310" },
  afnan: { accent: "#CDC58D", deep: "#131210" },
  "al-haramain": { accent: "#DDA96F", deep: "#151310" }
};

const CURRENCY_RATES: Record<string, number> = {
  AED: 1, SAR: 1.02, QAR: 0.99, KWD: 0.084, BHD: 0.10,
  OMR: 0.11, USD: 0.272, EUR: 0.25, GBP: 0.21, INR: 22.8
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  AED: "AED", SAR: "SAR", QAR: "QAR", KWD: "KWD", BHD: "BHD",
  OMR: "OMR", USD: "$", EUR: "€", GBP: "£", INR: "₹"
};

const SORT_OPTIONS = [
  { id: "featured", label: "Curated Order" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "name", label: "Alphabetical" }
];

// Offset for the fixed header plus the sticky category bar when jumping to a section.
const SECTION_SCROLL_MARGIN = 138;

export default function CollectionPage({ params }: CollectionPageProps) {
  const collectionId = use(params).id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<DbCollection | null>(null);
  const [lines, setLines] = useState<DbCollection[]>([]);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [lineMembership, setLineMembership] = useState<Record<string, number[]>>({});

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("featured");
  const [isSortOpen, setIsSortOpen] = useState(false);

  const chipBarRef = useRef<HTMLDivElement>(null);

  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [cartCount, setCartCount] = useState(0);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeCurrency, setActiveCurrency] = useState("AED");
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

  // ── Data load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: dbCollections } = await clientSafeSupabase.from("collections").select("*");
        const { data: dbMappings } = await clientSafeSupabase.from("product_collections").select("*");
        const { data: dbProducts } = await clientSafeSupabase.from("products").select("*");

        const allCollections: DbCollection[] = dbCollections || [];
        const current = allCollections.find((c) => c.id === collectionId) || null;
        setCollection(current);

        if (current) {
          const childLines = allCollections
            .filter((c) => c.parent_id === current.id)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          setLines(childLines);

          const mappings = dbMappings || [];
          const memberIds = mappings
            .filter((m: any) => m.collection_id === current.id)
            .map((m: any) => m.product_id);

          const all: DbProduct[] = dbProducts || [];
          // Brand collections also pick up anything matching the brand directly, so a
          // product added from the admin panel shows up without a manual mapping.
          const matched = all.filter(
            (p) =>
              memberIds.includes(p.id) ||
              (current.brand && p.brand && p.brand.toUpperCase() === current.brand.toUpperCase())
          );
          setProducts(matched);

          const membership: Record<string, number[]> = {};
          childLines.forEach((line) => {
            membership[line.id] = mappings
              .filter((m: any) => m.collection_id === line.id)
              .map((m: any) => m.product_id);
          });
          setLineMembership(membership);

          const defaults: Record<number, string> = {};
          matched.forEach((p) => {
            defaults[p.id] = (p.sizes && p.sizes[0]) || "100ml";
          });
          setSelectedSizes(defaults);
        }
      } catch (err) {
        console.error("Error loading collection:", err);
      } finally {
        setLoading(false);
      }
    };

    load();

    if (typeof window !== "undefined") {
      setActiveCurrency(localStorage.getItem("gharib_active_currency") || "AED");
      try {
        const cart = JSON.parse(localStorage.getItem("gharib_cart") || "[]");
        setCartCount(cart.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0));
      } catch (_) {}
    }
  }, [collectionId]);

  // Client-rendered page, so the tab title is set here rather than via metadata.
  useEffect(() => {
    if (collection) document.title = `${collection.title} | Gharib`;
  }, [collection]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const houseArt = collection ? HOUSE_ART[collection.id] : undefined;
  const accent = collection?.accent_hex || houseArt?.accent || DEFAULT_ACCENT;
  const deep = collection?.deep_hex || houseArt?.deep || DEFAULT_DEEP;
  const heroImage =
    (collection ? `/brands/${collection.id}-perfume.png` : null) ||
    collection?.hero_image ||
    (houseArt ? `/brands/${collection!.id}-hero.jpg` : null) ||
    collection?.cover_image ||
    null;
  const isBrand = collection?.kind === "brand";

  const sortProducts = useCallback(
    (list: DbProduct[]) => {
      const sorted = [...list];
      if (sortBy === "price-asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
      else if (sortBy === "price-desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
      else if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
      else sorted.sort((a, b) => a.id - b.id);
      return sorted;
    },
    [sortBy]
  );

  /**
   * The page is organised by category: one section per line, in the house's order, plus a
   * closing section for anything not mapped to a line. A product mapped to several lines
   * appears only under the first, so nothing shows up twice.
   */
  const sections = useMemo<LineSection[]>(() => {
    if (!collection) return [];
    const assigned = new Set<number>();
    const result: LineSection[] = [];

    lines.forEach((line) => {
      const ids = lineMembership[line.id] || [];
      const members = sortProducts(products.filter((p) => ids.includes(p.id) && !assigned.has(p.id)));
      members.forEach((p) => assigned.add(p.id));
      if (members.length > 0) {
        result.push({ id: line.id, title: line.title, description: line.description, products: members });
      }
    });

    const rest = sortProducts(products.filter((p) => !assigned.has(p.id)));
    if (rest.length > 0) {
      result.push({
        id: "more",
        title: result.length > 0 ? `More from ${collection.title}` : "The Fragrances",
        description: null,
        products: rest
      });
    }
    return result;
  }, [collection, lines, lineMembership, products, sortProducts]);

  const hasCategories = sections.length > 1;

  // Highlight the category chip for the section currently in view.
  useEffect(() => {
    if (loading || !hasCategories) return;
    const onScroll = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-line-section]"));
      let current: string | null = null;
      nodes.forEach((node) => {
        if (node.getBoundingClientRect().top <= SECTION_SCROLL_MARGIN + 40) {
          current = node.dataset.lineSection || null;
        }
      });
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, hasCategories]);

  // Keep the highlighted chip visible inside the horizontally scrollable bar.
  useEffect(() => {
    const bar = chipBarRef.current;
    if (!activeSection || !bar) return;
    const chip = bar.querySelector<HTMLElement>(`[data-chip="${activeSection}"]`);
    if (!chip) return;
    // Scroll the bar only — never the page — so section scrolling is left untouched.
    bar.scrollTo({ left: chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [activeSection]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const formatCurrency = useCallback(
    (aedAmount: number) => {
      const rate = CURRENCY_RATES[activeCurrency] || 1;
      const symbol = CURRENCY_SYMBOLS[activeCurrency] || "AED";
      return `${symbol} ${(aedAmount * rate).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    },
    [activeCurrency]
  );

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(`line-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAddToCart = (product: DbProduct) => {
    if (typeof window === "undefined") return;
    setAddingId(product.id);

    const size = selectedSizes[product.id] || (product.sizes && product.sizes[0]) || "100ml";
    const image = product.image_url || (product.image_urls && product.image_urls[0]) || FALLBACK_IMAGE;

    let cart: any[] = [];
    try {
      cart = JSON.parse(localStorage.getItem("gharib_cart") || "[]");
    } catch (_) {}

    const existingIdx = cart.findIndex(
      (item: any) => item.product?.id === product.id && item.selectedSize === size
    );

    if (existingIdx > -1) {
      cart[existingIdx].quantity += 1;
    } else {
      cart.push({
        product: {
          id: product.id,
          brand: product.brand,
          name: product.name,
          price: String(product.price),
          sizes: product.sizes || [size],
          image,
          description: product.description,
          tagline: product.tagline,
          olfactory: product.olfactory_group
        },
        quantity: 1,
        selectedSize: size
      });
    }

    localStorage.setItem("gharib_cart", JSON.stringify(cart));
    setCartCount(cart.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0));
    triggerToast(`Added ${product.name} (${size}) to your selection.`);
    setTimeout(() => setAddingId(null), 700);
  };

  // ── Loading / not found ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4" style={{ backgroundColor: BASE }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: DEFAULT_ACCENT }} />
        <span className="text-[9px] tracking-[0.3em] uppercase font-black" style={{ color: CREAM_MUTED }}>
          Opening the vault...
        </span>
      </div>
    );
  }

  if (!collection) {
    return (
      <div
        className="min-h-screen flex flex-col justify-center items-center gap-6 p-6 font-sans-luxury"
        style={{ backgroundColor: BASE, color: CREAM }}
      >
        <h1 className="text-2xl font-serif-luxury tracking-widest" style={{ color: CREAM_SOFT }}>
          Collection Not Found
        </h1>
        <p className="text-xs tracking-widest uppercase text-center max-w-md" style={{ color: CREAM_MUTED }}>
          This collection does not exist yet. If you have just added it, run the catalogue
          migrations against your Supabase project.
        </p>
        <Link
          href="/collections"
          className="text-[10px] tracking-widest uppercase py-3.5 px-8 rounded-full transition-all hover:opacity-80"
          style={{ border: `1px solid ${DEFAULT_ACCENT}59`, color: DEFAULT_ACCENT }}
        >
          Browse All Houses
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans-luxury relative" style={{ backgroundColor: BASE, color: CREAM }}>
      {/* Toast */}
      {toastMessage && (
        <div
          className="fixed top-24 right-6 text-[9.5px] tracking-[0.22em] uppercase py-4 px-6 z-50 flex items-center gap-3 rounded-full backdrop-blur-md"
          style={{ backgroundColor: "rgba(30,22,16,0.92)", border: `1px solid ${accent}44`, color: CREAM }}
        >
          <Check className="w-3.5 h-3.5" style={{ color: accent }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Shared Unified White Navbar */}
      <AppHeader activePage="brands" />

      {/* ═══ HERO — compact brand masthead ═══ */}
      <section className="relative w-full overflow-hidden pt-[72px]" style={{ backgroundColor: deep }}>
        {heroImage && (
          <div className="absolute inset-0">
            <Image src={heroImage} alt="" fill preload sizes="100vw" className="object-cover" style={{ opacity: 0.38 }} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${BASE}F2 0%, ${BASE}B3 45%, ${BASE}66 100%)` }} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${BASE}99 0%, transparent 40%, ${BASE} 100%)` }} />
          </div>
        )}

        <div className="relative max-w-[1520px] mx-auto px-6 md:px-10 py-14 md:py-20">
          <Link
            href="/collections"
            className="inline-flex items-center gap-2.5 text-[9px] tracking-[0.3em] uppercase rounded-full px-4 py-2 mb-8 transition-colors hover:opacity-75"
            style={{ border: `1px solid ${accent}33`, color: CREAM_SOFT }}
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={1.4} /> All Houses
          </Link>

          <div className="mb-4">
            <span className="text-[9.5px] tracking-[0.42em] uppercase" style={{ color: accent }}>
              {collection.story_eyebrow || (isBrand ? "Maison Collection" : "Curated Collection")}
            </span>
          </div>

          <h1
            className="font-serif-luxury font-normal leading-[1.02] tracking-[-0.02em] max-w-[16ch]"
            style={{ fontSize: "clamp(2.6rem,5.4vw,4.6rem)", color: CREAM }}
          >
            {collection.title}
          </h1>

          {(collection.story_subline || collection.description) && (
            <p className="mt-6 text-[13.5px] md:text-[15px] leading-[1.85] max-w-[52ch] font-light" style={{ color: CREAM_SOFT }}>
              {collection.story_subline || collection.description}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[9px] tracking-[0.26em] uppercase" style={{ color: CREAM_MUTED }}>
            <span>{products.length} {products.length === 1 ? "Fragrance" : "Fragrances"}</span>
            {hasCategories && (
              <>
                <span style={{ color: `${accent}80` }}>·</span>
                <span>{sections.length} {sections.length === 1 ? "Category" : "Categories"}</span>
              </>
            )}
            <span style={{ color: `${accent}80` }}>·</span>
            <span>Ships from Dubai in 1–2 days</span>
          </div>
        </div>
      </section>

      {/* ═══ CATEGORY BAR — jumps to each section ═══ */}
      <div
        className="w-full sticky top-[72px] z-30 backdrop-blur-xl"
        style={{ backgroundColor: "rgba(21,15,11,0.9)", borderTop: `1px solid ${accent}1A`, borderBottom: `1px solid ${accent}1A` }}
      >
        <div className="max-w-[1520px] mx-auto px-6 md:px-10 py-3 flex items-center justify-between gap-6">
          {hasCategories ? (
            <div ref={chipBarRef} className="flex items-center gap-2.5 overflow-x-auto no-scrollbar min-w-0">
              {sections.map((section) => {
                const on = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    data-chip={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="whitespace-nowrap text-[9.5px] tracking-[0.24em] uppercase px-4 py-2 rounded-full cursor-pointer transition-all duration-300"
                    style={on ? { backgroundColor: accent, color: "#1B130D" } : { border: `1px solid ${accent}26`, color: CREAM_SOFT }}
                  >
                    {section.title} <span className="opacity-70">{section.products.length}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-[9px] tracking-[0.26em] uppercase" style={{ color: CREAM_MUTED }}>
              {products.length} {products.length === 1 ? "Fragrance" : "Fragrances"}
            </span>
          )}

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 text-[9px] tracking-[0.2em] uppercase px-4 py-2 rounded-full cursor-pointer whitespace-nowrap transition-colors"
              style={{ border: `1px solid ${accent}26`, color: CREAM_SOFT }}
            >
              {SORT_OPTIONS.find((o) => o.id === sortBy)?.label}
              <ChevronDown className={`w-3 h-3 transition-transform ${isSortOpen ? "rotate-180" : ""}`} strokeWidth={1.4} />
            </button>
            {isSortOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-40 min-w-[200px] py-2 rounded-2xl backdrop-blur-xl overflow-hidden"
                style={{ backgroundColor: "rgba(28,20,14,0.97)", border: `1px solid ${accent}26` }}
              >
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setSortBy(option.id);
                      setIsSortOpen(false);
                    }}
                    className="w-full text-left text-[9.5px] tracking-[0.2em] uppercase px-5 py-3 transition-colors cursor-pointer hover:bg-white/[0.04]"
                    style={{ color: sortBy === option.id ? accent : CREAM_SOFT }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CATEGORY SECTIONS ═══ */}
      <main className="w-full px-6 md:px-10 pb-24 md:pb-32 min-h-[50vh]">
        <div className="max-w-[1520px] mx-auto">
          {sections.length === 0 ? (
            <div className="w-full text-center py-28 flex flex-col items-center justify-center gap-4">
              <span className="text-3xl" style={{ color: `${accent}66` }}>✦</span>
              <h3 className="font-serif-luxury text-[22px]" style={{ color: CREAM }}>Nothing here yet</h3>
              <p className="text-[10px] tracking-[0.24em] uppercase" style={{ color: CREAM_MUTED }}>
                Fragrances for this collection are on their way
              </p>
            </div>
          ) : (
            sections.map((section) => (
              <section
                key={section.id}
                id={`line-${section.id}`}
                data-line-section={section.id}
                className="pt-16 md:pt-20"
                style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}
              >
                {/* Section header */}
                <div className="flex items-end gap-5 mb-3 flex-wrap">
                  <h2 className="font-serif-luxury text-[26px] md:text-[34px] leading-[1.08] tracking-[-0.015em]" style={{ color: CREAM }}>
                    {section.title}
                  </h2>
                  <span className="flex-1 h-[1px] mb-3 min-w-[40px]" style={{ background: `linear-gradient(to right, ${accent}3D, transparent)` }} />
                  <span className="text-[9px] tracking-[0.26em] uppercase pb-2.5" style={{ color: CREAM_MUTED }}>
                    {section.products.length} {section.products.length === 1 ? "Fragrance" : "Fragrances"}
                  </span>
                </div>
                {section.description && (
                  <p className="text-[12px] md:text-[13px] leading-[1.8] font-light max-w-[62ch] mb-8" style={{ color: CREAM_MUTED }}>
                    {section.description}
                  </p>
                )}
                {!section.description && <div className="mb-8" />}

                {/* Product grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {section.products.map((product) => {
                    const image =
                      product.image_url || (product.image_urls && product.image_urls[0]) || FALLBACK_IMAGE;
                    const awaitingArt = image === FALLBACK_IMAGE;
                    const displayName = product.name ? product.name.replace(/_/g, " ") : "";

                    return (
                      <div
                        key={product.id}
                        className="group relative flex flex-col justify-between min-w-0 p-0 rounded-none transition-all duration-300 text-center bg-transparent"
                      >
                        {/* 1. Seamless Product Image Stage (No background container box, no border) */}
                        <Link
                          href={`/product/${product.id}`}
                          className="relative w-full aspect-[4/5] overflow-hidden cursor-pointer block mb-3 bg-transparent border-none"
                        >
                          {awaitingArt ? (
                            <span className="relative flex flex-col items-center justify-center h-full">
                              <span
                                className="block w-12 h-12 rotate-45 transition-transform duration-[1200ms] ease-out group-hover:rotate-[135deg]"
                                style={{ border: `1px solid ${accent}59` }}
                              />
                            </span>
                          ) : (
                            <Image
                              src={image}
                              alt={displayName}
                              width={340}
                              height={425}
                              className="relative object-contain w-auto h-full mx-auto transition-transform duration-[900ms] ease-out group-hover:scale-[1.04] p-4"
                            />
                          )}
                        </Link>

                        {/* 2. Details directly under image */}
                        <div className="flex flex-col items-center flex-grow justify-between w-full px-1">
                          <Link
                            href={`/product/${product.id}`}
                            className="font-serif-luxury text-[14px] md:text-[15px] font-medium uppercase tracking-[0.04em] leading-[1.35] block hover:opacity-75 transition-opacity line-clamp-2 break-words text-center w-full"
                            style={{ color: CREAM }}
                          >
                            {displayName}
                          </Link>

                          <div className="flex flex-col items-center gap-2.5 w-full mt-2">
                            <span className="font-serif-luxury text-[14px] md:text-[15px] font-semibold tracking-widest" style={{ color: CREAM }}>
                              {formatCurrency(Number(product.price) || 0)}
                            </span>

                            <button
                              onClick={() => handleAddToCart(product)}
                              disabled={addingId === product.id}
                              className="w-full text-center py-2.5 px-3 text-[9px] font-medium tracking-[0.22em] uppercase transition-all duration-300 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5 rounded-none active:scale-95 border"
                              style={{ backgroundColor: accent, color: "#1B130D", borderColor: accent }}
                            >
                              {addingId === product.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5" strokeWidth={2} /> Added to Basket
                                </>
                              ) : (
                                "Add to Basket"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {/* ═══ FOOTER BAND ═══ */}
      <section className="w-full py-16 md:py-20" style={{ backgroundColor: deep, borderTop: `1px solid ${accent}1A` }}>
        <div className="max-w-[1520px] mx-auto px-6 md:px-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          <div>
            <span className="text-[9px] tracking-[0.42em] uppercase" style={{ color: accent }}>
              {collection.title}
            </span>
            <p className="font-serif-luxury text-[19px] md:text-[22px] mt-3" style={{ color: CREAM }}>
              Every composition, gathered in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/collections"
              className="rounded-full px-7 py-3 text-[9.5px] tracking-[0.28em] uppercase transition-all duration-400 hover:opacity-85"
              style={{ backgroundColor: accent, color: "#1B130D" }}
            >
              Other Houses
            </Link>
            <Link
              href="/"
              className="rounded-full px-7 py-3 text-[9.5px] tracking-[0.28em] uppercase transition-all duration-400"
              style={{ border: `1px solid ${accent}44`, color: CREAM_SOFT }}
            >
              Back Home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
