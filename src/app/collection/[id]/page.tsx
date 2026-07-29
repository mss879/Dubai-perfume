"use client";

import React, { useState, useEffect, use, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ArrowLeft, ChevronDown } from "lucide-react";
import { clientSafeSupabase } from "../../lib/supabase";
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
  top_notes?: string[] | null;
  heart_notes?: string[] | null;
  base_notes?: string[] | null;
  is_new?: boolean;
  is_bestseller?: boolean;
}

interface HouseStat {
  label?: string | null;
  value?: string | null;
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
  story_headline?: string | null;
  story_subline?: string | null;
  story_body?: string[] | null;
  pull_quote?: string | null;
  stats?: HouseStat[] | null;
  hero_image?: string | null;
  texture_image?: string | null;
}

interface LineSection {
  id: string;
  title: string;
  description: string | null;
  products: DbProduct[];
}

/** Row shape of `product_collections`. */
interface CollectionMapping {
  collection_id: string;
  product_id: number;
}

/** Shape written to `gharib_cart` in localStorage — shared with the checkout page. */
interface CartItem {
  product: {
    id: number;
    brand: string;
    name: string;
    price: string;
    sizes: string[];
    image: string;
    description: string | null;
    tagline: string | null;
    olfactory: string | null;
  };
  quantity: number;
  selectedSize: string;
}

/* Select every column rather than naming them.
 *
 * The editorial fields (story_eyebrow, story_headline, story_subline, story_body,
 * pull_quote, stats, hero_image, texture_image) are added by
 * supabase/migrations/31_brand_editorial_content.sql, which has NOT been applied to
 * every environment yet. Naming a missing column makes PostgREST reject the whole
 * query with 42703 and the page renders nothing. "*" returns whatever the database
 * actually has; the fields are all optional on DbCollection and every read site
 * already falls back to title/description, so the page degrades to a plainer
 * editorial block instead of failing. */
const COLLECTION_FIELDS = "*";

/** Columns that actually exist on public.products. */
const PRODUCT_FIELDS =
  "id, brand, name, price, sizes, image_url, image_urls, description, tagline, olfactory_group, tags, top_notes, heart_notes, base_notes, is_new, is_bestseller";

/** Normalises a Postgres array column that may arrive as null or with blank entries. */
const toArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];

/**
 * Decorative still-life art direction that ships with the repo (public/brands/*-perfume.png).
 * There is no column for it on `collections`; it is page furniture, never product data.
 */
const HOUSE_STILL: Record<string, string> = {
  rasasi: "/brands/rasasi-perfume.png",
  lattafa: "/brands/lattafa-perfume.png",
  armaf: "/brands/armaf-perfume.png",
  "french-avenue": "/brands/french-avenue-perfume.png",
  afnan: "/brands/afnan-perfume.png",
  "al-haramain": "/brands/al-haramain-perfume.png"
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

// Sticky header (149px on desktop) plus the sticky category bar (48px). Used by the
// scroll-spy; the matching CSS offsets live on the section elements themselves.
const SECTION_SCROLL_MARGIN = 197;

/** The card note row: the olfactive family, or the opening notes if the family is missing. */
const notesLine = (product: DbProduct) => {
  const group = (product.olfactory_group || "").replace(/\s*&\s*/g, " ").trim();
  if (group) return group;
  return [...toArray(product.top_notes), ...toArray(product.heart_notes)].slice(0, 3).join(" ");
};

export default function CollectionPage({ params }: CollectionPageProps) {
  const collectionId = use(params).id;

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<DbCollection | null>(null);
  const [lines, setLines] = useState<DbCollection[]>([]);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [lineMembership, setLineMembership] = useState<Record<string, number[]>>({});

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("featured");

  const chipBarRef = useRef<HTMLDivElement>(null);

  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [addingId, setAddingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeCurrency, setActiveCurrency] = useState("AED");

  // ── Data load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (typeof window !== "undefined") {
        setActiveCurrency(localStorage.getItem("gharib_active_currency") || "AED");
      }
      try {
        const [
          { data: dbCollections, error: collectionsError },
          { data: dbMappings },
          { data: dbProducts, error: productsError }
        ] = await Promise.all([
          clientSafeSupabase.from("collections").select(COLLECTION_FIELDS),
          clientSafeSupabase.from("product_collections").select("collection_id, product_id"),
          clientSafeSupabase.from("products").select(PRODUCT_FIELDS)
        ]);

        if (collectionsError) throw collectionsError;
        if (productsError) throw productsError;

        const allCollections: DbCollection[] = Array.isArray(dbCollections) ? dbCollections : [];
        const current = allCollections.find((c) => c.id === collectionId) || null;
        setCollection(current);

        if (current) {
          const childLines = allCollections
            .filter((c) => c.parent_id === current.id)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          setLines(childLines);

          const mappings: CollectionMapping[] = Array.isArray(dbMappings) ? dbMappings : [];
          const memberIds = mappings
            .filter((m) => m.collection_id === current.id)
            .map((m) => m.product_id);

          const all: DbProduct[] = Array.isArray(dbProducts) ? dbProducts : [];
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
              .filter((m) => m.collection_id === line.id)
              .map((m) => m.product_id);
          });
          setLineMembership(membership);

          const defaults: Record<number, string> = {};
          matched.forEach((p) => {
            const first = toArray(p.sizes)[0];
            if (first) defaults[p.id] = first;
          });
          setSelectedSizes(defaults);
        }
      } catch (err) {
        console.error("Error loading collection:", err);
        setCollection(null);
        setLines([]);
        setProducts([]);
        setLineMembership({});
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [collectionId]);

  // Client-rendered page, so the tab title is set here rather than via metadata.
  useEffect(() => {
    if (collection) document.title = `${collection.title} | Gharib`;
  }, [collection]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  // A full-bleed hero only takes photography. A packshot PNG cover would crop badly, so a
  // house without a photograph gets the flat grey masthead with black type instead.
  const heroImage = collection
    ? collection.hero_image ||
      (collection.cover_image && /\.(jpe?g|webp|avif)$/i.test(collection.cover_image.split("?")[0])
        ? collection.cover_image
        : null) ||
      collection.texture_image ||
      null
    : null;
  const textureImage = collection ? collection.texture_image || null : null;
  const stillImage = collection ? HOUSE_STILL[collection.id] || null : null;
  const isBrand = collection?.kind === "brand";

  const storyParagraphs = useMemo(() => {
    if (!collection) return [];
    const body = (collection.story_body || []).filter(Boolean);
    if (body.length > 0) return body.slice(0, 2);
    return [collection.story_subline, collection.description]
      .filter((p): p is string => Boolean(p))
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .slice(0, 2);
  }, [collection]);

  const statList = useMemo<HouseStat[]>(() => {
    const raw = collection?.stats;
    if (!Array.isArray(raw)) return [];
    return raw.filter((s) => s && s.label && s.value).slice(0, 4);
  }, [collection]);

  // Only carried into the "in brief" block when the editorial block above has not used it —
  // a house without the migration-31 copy must not print the same sentence twice.
  const briefText =
    collection?.story_subline && !storyParagraphs.includes(collection.story_subline)
      ? collection.story_subline
      : null;
  const hasBrief = Boolean(briefText) || statList.length > 0;

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

  // Highlight the category tab for the section currently in view.
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

  // Keep the highlighted tab visible inside the horizontally scrollable bar.
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

  const scrollToFragrances = () => {
    document.getElementById("fragrances")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAddToCart = (product: DbProduct) => {
    if (typeof window === "undefined") return;
    setAddingId(product.id);

    const sizes = toArray(product.sizes);
    const size = selectedSizes[product.id] || sizes[0] || "";
    const image = product.image_url || toArray(product.image_urls)[0] || "";

    let cart: CartItem[] = [];
    try {
      cart = JSON.parse(localStorage.getItem("gharib_cart_v2") || "[]");
    } catch {
      cart = [];
    }

    const existingIdx = cart.findIndex(
      (item) => item.product?.id === product.id && item.selectedSize === size
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
          sizes,
          image,
          description: product.description,
          tagline: product.tagline,
          olfactory: product.olfactory_group
        },
        quantity: 1,
        selectedSize: size
      });
    }

    localStorage.setItem("gharib_cart_v2", JSON.stringify(cart));
    triggerToast(
      size ? `Added ${product.name} (${size}) to your selection.` : `Added ${product.name} to your selection.`
    );
    setTimeout(() => setAddingId(null), 700);
  };

  // ── Loading / not found ──────────────────────────────────────────────────────
  // Quiet skeleton — flat #F5F5F5 blocks at the real aspect ratios, no motion.
  if (loading) {
    return (
      <div className="maison min-h-screen">
        <AppHeader activePage="brands" />
        <div
          className="w-full h-[62vh] min-h-[420px] max-h-[680px]"
          style={{ backgroundColor: "var(--surface-2)" }}
        />
        <div style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="maison-container h-14 flex items-center justify-between gap-6">
            <div className="h-3 w-28" style={{ backgroundColor: "var(--surface-2)" }} />
            <div className="h-3 w-24" style={{ backgroundColor: "var(--surface-2)" }} />
          </div>
        </div>
        <div className="maison-container pt-16 md:pt-24 pb-20 md:pb-28">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-14">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col">
                <div className="w-full aspect-square" style={{ backgroundColor: "var(--surface-2)" }} />
                <div className="h-4 w-3/4 mt-6 mx-auto" style={{ backgroundColor: "var(--surface-2)" }} />
                <div className="h-3 w-1/2 mt-3 mx-auto" style={{ backgroundColor: "var(--surface-2)" }} />
                <div className="h-12 w-full mt-6" style={{ backgroundColor: "var(--surface-2)" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="maison min-h-screen">
        <AppHeader activePage="brands" />
        <div className="maison-container py-32 md:py-44 text-center">
          <h1 className="maison-page-title">Collection not found</h1>
          <p
            className="mt-7 mx-auto max-w-[46ch] text-[14px] font-light leading-[1.75]"
            style={{ color: "var(--muted)" }}
          >
            This collection is no longer available, or the link you followed is out of date.
          </p>
          <Link
            href="/collections"
            className="maison-btn-outline h-12 px-10 mt-10 inline-flex items-center"
          >
            Browse all houses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="maison min-h-screen">
      <AppHeader activePage="brands" />

      {/* Toast */}
      {toastMessage && (
        <div
          className="fixed top-[115px] md:top-[165px] right-5 z-50 flex items-center gap-3 px-5 py-4 max-w-[86vw]"
          style={{ backgroundColor: "var(--ink-soft)", color: "#ffffff" }}
        >
          <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          <span className="text-[12px] font-light tracking-[0.04em]">{toastMessage}</span>
        </div>
      )}

      {/* ═══ FULL-BLEED HOUSE HERO ═══ */}
      <section
        className={`relative w-full overflow-hidden ${
          heroImage ? "h-[62vh] min-h-[420px] max-h-[680px]" : "py-24 md:py-32"
        }`}
        style={heroImage ? undefined : { backgroundColor: "var(--surface-2)" }}
      >
        {heroImage && (
          <>
            <Image src={heroImage} alt="" fill preload sizes="100vw" className="object-cover" />
            {/* Flat veil — the house imagery is dark and moody, so the type needs it. */}
            <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.28)" }} />
          </>
        )}

        <div className="relative h-full flex flex-col items-center justify-center text-center px-5">
          <p
            className="maison-eyebrow"
            style={{ color: heroImage ? "rgba(255,255,255,0.78)" : "var(--muted)" }}
          >
            {collection.story_eyebrow || (isBrand ? "Maison Collection" : "Curated Collection")}
          </p>

          <h1
            className="font-display uppercase text-[28px] md:text-[44px] tracking-[0.1em] leading-[1.15] mt-6 max-w-[18ch]"
            style={{ color: heroImage ? "#ffffff" : "var(--ink)" }}
          >
            {collection.title}
          </h1>

          <button
            onClick={scrollToFragrances}
            className="maison-link mt-9 cursor-pointer"
            style={{ color: heroImage ? "#ffffff" : "var(--ink)" }}
          >
            Discover the fragrances
          </button>
        </div>
      </section>

      {/* ═══ BREADCRUMB RAIL ═══ */}
      <div style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="maison-container h-14 flex items-center justify-between gap-6">
          <Link
            href="/collections"
            className="flex items-center gap-2.5 text-[12px] uppercase tracking-[0.1em] transition-opacity duration-300 hover:opacity-55"
            style={{ color: "var(--muted)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.25} />
            All houses
          </Link>
          <span className="maison-eyebrow whitespace-nowrap">
            {products.length} {products.length === 1 ? "Fragrance" : "Fragrances"}
          </span>
        </div>
      </div>

      {/* ═══ EDITORIAL — THE HOUSE ═══ */}
      {(storyParagraphs.length > 0 || collection.story_headline) && (
        <section className="maison-section">
          <div className="maison-container text-center">
            <p className="maison-eyebrow">The House</p>
            <h2 className="font-display uppercase text-[22px] md:text-[28px] tracking-[0.1em] leading-[1.3] mt-6 mx-auto max-w-[26ch]">
              {collection.story_headline || collection.title}
            </h2>
            <div className="mt-9 mx-auto max-w-[46ch] flex flex-col gap-6">
              {storyParagraphs.map((paragraph, i) => (
                <p
                  key={i}
                  className="text-[15px] font-light leading-[1.8]"
                  style={{ color: "rgba(0,0,0,0.75)" }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ SPLIT 50/50 — IN BRIEF (image left) ═══ */}
      {hasBrief && (
        <section className="maison-section" style={{ backgroundColor: "var(--surface-3)" }}>
          <div className="maison-container grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            {textureImage && (
              <div className="relative w-full aspect-[4/5] md:aspect-square overflow-hidden">
                <Image
                  src={textureImage}
                  alt={`${collection.title} materials`}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            )}

            <div>
              <p className="maison-eyebrow">In brief</p>
              <h2 className="font-display uppercase text-[22px] md:text-[28px] tracking-[0.1em] leading-[1.3] mt-5">
                {collection.title}
              </h2>

              {briefText && (
                <p
                  className="mt-6 max-w-[46ch] text-[15px] font-light leading-[1.8]"
                  style={{ color: "rgba(0,0,0,0.75)" }}
                >
                  {briefText}
                </p>
              )}

              {statList.length > 0 && (
                <dl className="mt-9 max-w-[46ch]">
                  {statList.map((stat, i) => (
                    <div
                      key={i}
                      className="flex items-baseline justify-between gap-6 py-4"
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <dt className="text-[12px] uppercase tracking-[0.1em]" style={{ color: "var(--muted)" }}>
                        {stat.label}
                      </dt>
                      <dd className="maison-price">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <button onClick={scrollToFragrances} className="maison-link mt-10 cursor-pointer">
                View the fragrances
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ═══ THE FRAGRANCES ═══ */}
      <div id="fragrances" className="scroll-mt-[101px] md:scroll-mt-[149px]">
        {/* Category sub-nav */}
        {hasCategories && (
          <div
            className="sticky top-[101px] md:top-[149px] z-30"
            style={{
              backgroundColor: "var(--surface)",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)"
            }}
          >
            <div className="maison-container">
              <div
                ref={chipBarRef}
                className="flex items-center gap-8 md:justify-center overflow-x-auto no-scrollbar h-12"
              >
                {sections.map((section) => {
                  const on = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      data-chip={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className="whitespace-nowrap text-[15px] uppercase tracking-[0.06em] pb-1.5 cursor-pointer transition-colors duration-300"
                      style={{
                        fontWeight: 350,
                        color: on ? "var(--ink)" : "var(--muted)",
                        borderBottom: `1px solid ${on ? "var(--ink)" : "transparent"}`
                      }}
                    >
                      {section.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Count + sort rail */}
        <div style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="maison-container h-14 grid grid-cols-3 items-center gap-4">
            <span className="maison-eyebrow hidden sm:block">
              {hasCategories
                ? `${sections.length} ${sections.length === 1 ? "Category" : "Categories"}`
                : collection.title}
            </span>
            <span
              className="col-span-2 sm:col-span-1 text-[14px] text-left sm:text-center whitespace-nowrap"
              style={{ fontWeight: 350 }}
            >
              {products.length} {products.length === 1 ? "product" : "products"}
            </span>
            <div className="relative flex items-center justify-end">
              <label htmlFor="collection-sort" className="sr-only">
                Sort fragrances
              </label>
              <select
                id="collection-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-transparent cursor-pointer text-[14px] pb-1.5 pr-6 outline-none"
                style={{ fontWeight: 350, borderBottom: "1px solid var(--line)" }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-0 bottom-2 w-3.5 h-3.5 pointer-events-none"
                strokeWidth={1.25}
              />
            </div>
          </div>
        </div>

        {/* Product sections */}
        <main className="maison-container pb-20 md:pb-28 min-h-[40vh]">
          {sections.length === 0 ? (
            <div className="text-center py-28">
              <h2 className="font-display uppercase text-[20px] tracking-[0.1em]">
                No fragrances in this collection
              </h2>
              <p
                className="mt-5 mx-auto max-w-[46ch] text-[14px] font-light leading-[1.75]"
                style={{ color: "var(--muted)" }}
              >
                Nothing is listed here at the moment. The rest of the catalogue is still open.
              </p>
              <Link
                href="/shop"
                className="maison-btn-outline h-12 px-10 mt-8 inline-flex items-center"
              >
                Browse all fragrances
              </Link>
            </div>
          ) : (
            sections.map((section) => (
              <section
                key={section.id}
                id={`line-${section.id}`}
                data-line-section={section.id}
                className="pt-16 md:pt-24 scroll-mt-[149px] md:scroll-mt-[197px]"
              >
                {/* Section header */}
                <div className="text-center">
                  <p className="maison-eyebrow">
                    {section.products.length}{" "}
                    {section.products.length === 1 ? "Fragrance" : "Fragrances"}
                  </p>
                  <h2 className="font-display uppercase text-[22px] md:text-[28px] tracking-[0.1em] leading-[1.3] mt-5">
                    {section.title}
                  </h2>
                  {section.description && (
                    <p
                      className="mt-6 mx-auto max-w-[46ch] text-[15px] font-light leading-[1.8]"
                      style={{ color: "var(--muted)" }}
                    >
                      {section.description}
                    </p>
                  )}
                </div>

                {/* Product grid — 4 / 3 / 2 */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-14 mt-12 md:mt-16">
                  {section.products.map((product) => {
                    const image = product.image_url || toArray(product.image_urls)[0] || "";
                    const awaitingArt = !image;
                    const displayName = product.name ? product.name.replace(/_/g, " ") : "";
                    const notes = notesLine(product);
                    const sizes = toArray(product.sizes);
                    const activeSize = selectedSizes[product.id] || sizes[0] || "";

                    return (
                      <div key={product.id} className="group flex flex-col">
                        <Link href={`/product/${product.id}`} className="maison-card-media block">
                          {awaitingArt ? (
                            <span
                              className="absolute inset-0 flex items-center justify-center"
                              style={{ backgroundColor: "var(--surface-2)" }}
                            >
                              <span
                                className="block w-10 h-10"
                                style={{ border: "1px solid var(--line-strong)" }}
                              />
                            </span>
                          ) : (
                            <Image
                              src={image}
                              alt={displayName}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                              className="object-contain"
                            />
                          )}
                        </Link>

                        <Link
                          href={`/product/${product.id}`}
                          className="block mt-6 transition-opacity duration-300 hover:opacity-60"
                        >
                          <h3 className="maison-card-title">{displayName}</h3>
                        </Link>

                        {notes && <p className="maison-card-notes mt-2.5">{notes}</p>}

                        <div
                          className="mt-auto pt-5 flex items-center justify-between gap-3"
                          style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}
                        >
                          <span className="maison-price">{formatCurrency(Number(product.price) || 0)}</span>

                          {sizes.length > 1 ? (
                            <div className="relative flex items-center">
                              <label htmlFor={`size-${product.id}`} className="sr-only">
                                Size for {displayName}
                              </label>
                              <select
                                id={`size-${product.id}`}
                                value={activeSize}
                                onChange={(e) =>
                                  setSelectedSizes((prev) => ({ ...prev, [product.id]: e.target.value }))
                                }
                                className="appearance-none bg-transparent cursor-pointer text-[14px] pr-5 outline-none text-right"
                                style={{ fontWeight: 350, letterSpacing: "0.07em" }}
                              >
                                {sizes.map((size) => (
                                  <option key={size} value={size}>
                                    {size}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                className="absolute right-0 w-3 h-3 pointer-events-none"
                                strokeWidth={1.25}
                              />
                            </div>
                          ) : activeSize ? (
                            <span className="maison-price" style={{ color: "var(--muted)" }}>
                              {activeSize}
                            </span>
                          ) : null}
                        </div>

                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={addingId === product.id}
                          className="maison-btn-outline w-full h-12 mt-4 gap-2"
                        >
                          {addingId === product.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> Added
                            </>
                          ) : (
                            "Add to cart"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </main>
      </div>

      {/* ═══ SPLIT 50/50 — THE SIGNATURE (image right) ═══ */}
      {(collection.pull_quote || stillImage) && (
        <section className="maison-section" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="maison-container grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="md:order-1 order-2">
              <p className="maison-eyebrow">The signature</p>
              {collection.pull_quote ? (
                <>
                  <p className="font-display italic text-[20px] md:text-[24px] leading-[1.5] tracking-[0.02em] mt-6 max-w-[30ch]">
                    {collection.pull_quote}
                  </p>
                  <p className="maison-eyebrow mt-7">{collection.title}</p>
                </>
              ) : (
                <h2 className="font-display uppercase text-[22px] md:text-[28px] tracking-[0.1em] leading-[1.3] mt-6 max-w-[20ch]">
                  {collection.title}
                </h2>
              )}
              <Link href="/shop" className="maison-link mt-10">
                Shop all fragrances
              </Link>
            </div>

            {stillImage && (
              <div className="relative w-full aspect-square overflow-hidden md:order-2 order-1">
                <Image
                  src={stillImage}
                  alt={`${collection.title} still life`}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══ CLOSING BAND ═══ */}
      <section className="maison-section" style={{ backgroundColor: "var(--surface-3)" }}>
        <div className="maison-container text-center">
          <p className="maison-eyebrow">{collection.title}</p>
          <p className="font-display uppercase text-[20px] md:text-[26px] tracking-[0.08em] leading-[1.35] mt-6 mx-auto max-w-[24ch]">
            Every composition, gathered in one place
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            <Link href="/collections" className="maison-link">
              Other houses
            </Link>
            <Link href="/" className="maison-link">
              Back home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
