"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import CartDrawer, { openCartDrawer } from "../../components/CartDrawer";
import ConciergeWidget from "../../components/concierge/ConciergeWidget";
import Price from "../../components/Price";
import { useCart } from "../../lib/cart";
import { toArray } from "../../lib/catalogue";

export interface DbProduct {
  id: number;
  brand: string;
  name: string;
  price: number | string;
  compare_at_price?: number | string | null;
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

export interface HouseStat {
  label?: string | null;
  value?: string | null;
}

export interface DbCollection {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  kind?: string | null;
  parent_id?: string | null;
  brand?: string | null;
  sort_order?: number | null;
  // Editorial fields (migration 31 — optional; not applied everywhere)
  story_eyebrow?: string | null;
  story_headline?: string | null;
  story_subline?: string | null;
  story_body?: string[] | null;
  pull_quote?: string | null;
  stats?: HouseStat[] | null;
  hero_image?: string | null;
  texture_image?: string | null;
}

export interface CollectionClientProps {
  collection: DbCollection;
  lines: DbCollection[];
  products: DbProduct[];
  lineMembership: Record<string, number[]>;
}

interface LineSection {
  id: string;
  title: string;
  description: string | null;
  products: DbProduct[];
}

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

export default function CollectionClient({
  collection,
  lines,
  products,
  lineMembership
}: CollectionClientProps) {
  const { add: addLineToCart } = useCart();

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("featured");

  const chipBarRef = useRef<HTMLDivElement>(null);

  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>(() => {
    const defaults: Record<number, string> = {};
    products.forEach((p) => {
      const first = toArray(p.sizes)[0];
      if (first) defaults[p.id] = first;
    });
    return defaults;
  });

  // ── Derived data ─────────────────────────────────────────────────────────────
  // A full-bleed hero only takes photography. A packshot PNG cover would crop badly, so a
  // house without a photograph gets the flat grey masthead with black type instead.
  const heroImage =
    collection.hero_image ||
    (collection.cover_image && /\.(jpe?g|webp|avif)$/i.test(collection.cover_image.split("?")[0])
      ? collection.cover_image
      : null) ||
    collection.texture_image ||
    null;
  const textureImage = collection.texture_image || null;
  const stillImage = HOUSE_STILL[collection.id] || null;
  const isBrand = collection.kind === "brand";

  const storyParagraphs = useMemo(() => {
    const body = (collection.story_body || []).filter(Boolean);
    if (body.length > 0) return body.slice(0, 2);
    return [collection.story_subline, collection.description]
      .filter((p): p is string => Boolean(p))
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .slice(0, 2);
  }, [collection]);

  const statList = useMemo<HouseStat[]>(() => {
    const raw = collection.stats;
    if (!Array.isArray(raw)) return [];
    return raw.filter((s) => s && s.label && s.value).slice(0, 4);
  }, [collection]);

  // Only carried into the "in brief" block when the editorial block above has not used it —
  // a house without the migration-31 copy must not print the same sentence twice.
  const briefText =
    collection.story_subline && !storyParagraphs.includes(collection.story_subline)
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
    if (!hasCategories) return;
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
  }, [hasCategories]);

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
  const scrollToSection = (sectionId: string) => {
    document.getElementById(`line-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToFragrances = () => {
    document.getElementById("fragrances")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAddToCart = (product: DbProduct) => {
    const sizes = toArray(product.sizes);
    const size = selectedSizes[product.id] || sizes[0] || "";
    const image = product.image_url || toArray(product.image_urls)[0] || "";
    addLineToCart(
      {
        id: product.id,
        brand: product.brand,
        name: product.name,
        price: Number(product.price) || 0,
        image_url: image
      },
      size
    );
    openCartDrawer();
  };

  return (
    <div className="maison min-h-screen">
      <AppHeader activePage="brands" />

      {/* Shared bag drawer — opened after every add-to-cart */}
      <CartDrawer />
      <ConciergeWidget />

      {/* ═══ FULL-BLEED HOUSE HERO ═══ */}
      <section
        className={`relative w-full overflow-hidden ${
          heroImage ? "h-[62vh] min-h-[420px] max-h-[680px]" : "py-24 md:py-32"
        }`}
        style={heroImage ? undefined : { backgroundColor: "var(--surface-2)" }}
      >
        {heroImage && (
          <>
            {/* `preload` is the Next 16 prop for LCP/hero images — `priority` is deprecated here. */}
            <Image src={heroImage} alt={collection.title} fill preload sizes="100vw" className="object-cover" />
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
                    // DECIMAL comes back as a string on some clients, and null on any row the
                    // pricing migration has not reached — Price ignores anything non-finite.
                    const listPrice =
                      product.compare_at_price == null ? null : Number(product.compare_at_price);

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
                          <Price
                            amountAed={Number(product.price) || 0}
                            compareAtAed={listPrice}
                            className="maison-price"
                          />

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
                          className="maison-btn-outline w-full h-12 mt-4"
                        >
                          Add to cart
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

      {/* Main App Footer */}
      <Footer />
    </div>
  );
}
