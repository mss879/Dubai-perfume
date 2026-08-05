"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bookmark,
  ShoppingBag,
  User,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import BrandsDropdown, { type BrandItem } from "./BrandsDropdown";
import { getBrowserSupabase } from "../lib/supabase-browser";
import { useCart } from "../lib/cart";
import { toTitleCase } from "../lib/catalogue";
import { FREE_SHIPPING_NOTE } from "../lib/shipping";

export interface AppHeaderProps {
  activePage?: "home" | "brands" | "shop" | "discover" | "blogs" | "contact" | "wishlist";
}

/* Hairline used across the header — matches --line in globals.css */
const HAIRLINE = "rgba(0,0,0,0.12)";

/* The delivery line comes from lib/shipping so the bar can never promise more
   than checkout charges. */
const ANNOUNCEMENTS = [
  FREE_SHIPPING_NOTE,
  "Two discovery samples with every order",
  "100% authentic Dubai fragrances",
];

type NavKey = NonNullable<AppHeaderProps["activePage"]>;

const NAV_ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "brands", label: "Brands", href: "/collections" },
  { key: "shop", label: "Shop", href: "/shop" },
  { key: "blogs", label: "Blogs", href: "/blogs" },
  { key: "contact", label: "Contact", href: "/contact" },
  // The fragrance finder, last. Two words so it sits level with the rest of the
  // row rather than dominating it.
  { key: "discover", label: "Scent finder", href: "/discover" },
];

/**
 * The monogram shown once a shopper is signed in.
 *
 * A real name wins. Failing that the address is used, split on the separators
 * people actually put in one ("laila.hasan@…" → LH), because signup asks for an
 * email and a password and nothing else — so for most accounts the address is
 * all there is. Returns "" when even that yields nothing, and the caller falls
 * back to the account icon rather than drawing an empty ring.
 */
function initialsFor(fullName: string, email: string | null): string {
  const letters = (value: string) => value.replace(/[^\p{L}]/gu, "");

  const nameParts = fullName.trim().split(/\s+/).map(letters).filter(Boolean);
  if (nameParts.length >= 2) {
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  }
  if (nameParts.length === 1) return nameParts[0].slice(0, 2).toUpperCase();

  const local = (email ?? "").split("@")[0] ?? "";
  const localParts = local.split(/[._\-+\d]+/).map(letters).filter(Boolean);
  if (localParts.length >= 2) return (localParts[0][0] + localParts[1][0]).toUpperCase();
  if (localParts.length === 1) return localParts[0].slice(0, 2).toUpperCase();

  return "";
}

/* Title-case a stored brand name ("AL HARAMAIN" → "Al Haramain") */
export default function AppHeader({ activePage }: AppHeaderProps) {
  const router = useRouter();

  const [isBrandsMenuOpen, setIsBrandsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [announcementIndex, setAnnouncementIndex] = useState(0);

  /* Maisons come only from the `collections` rows with kind = 'brand' — the
     same source the homepage reads. No fallback list: until the fetch settles
     the menu simply shows no maisons. */
  const [brandCollections, setBrandCollections] = useState<BrandItem[]>([]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);

  const handleBrandsMouseEnter = () => setIsBrandsMenuOpen(true);
  const handleBrandsMouseLeave = () => setIsBrandsMenuOpen(false);

  /* ── Bag count — reactive same-tab via useCart() ───────────── */
  const { count: cartCount } = useCart();

  /* ── Is anyone signed in? ──────────────────────────────────────
     The header said "Sign in" to everybody, signed in or not, so a
     shopper had no way to tell the difference without opening the page.
     `null` means "not yet known" — neither state is rendered until the
     session has been read, so the header never flickers the wrong one. */
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [initials, setInitials] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabase();

    /* Reads the session and, when there is one, the name to monogram. */
    const loadIdentity = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (cancelled) return;

        setIsSignedIn(Boolean(user));
        if (!user) {
          setInitials("");
          return;
        }

        // Signup collects only an address, so a name is usually absent —
        // initialsFor falls back to the email rather than showing nothing.
        const meta = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string };
        let fullName = [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim();

        if (!fullName) {
          const { data: profile } = await supabase
            .from("customers")
            .select("first_name, last_name")
            .eq("id", user.id)
            .maybeSingle();
          const row = profile as { first_name?: string | null; last_name?: string | null } | null;
          fullName = [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim();
        }

        if (!cancelled) setInitials(initialsFor(fullName, user.email ?? null));
      } catch {
        if (!cancelled) {
          setIsSignedIn(false);
          setInitials("");
        }
      }
    };

    loadIdentity();

    // Keep the header honest when the shopper signs in or out in another tab.
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = supabase.auth.onAuthStateChange(() => {
        if (!cancelled) loadIdentity();
      });
      unsubscribe = () => data?.subscription?.unsubscribe();
    } catch {
      // The dev-sandbox mock emits no auth events.
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const accountHref = isSignedIn ? "/customer/dashboard" : "/signin";
  const accountLabel = isSignedIn ? "My account" : "Sign in";

  /* ── Maisons, read from Supabase ───────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const loadBrands = async () => {
      try {
        const { data, error } = await getBrowserSupabase()
          .from("collections")
          .select("id, title, description, cover_image, kind, sort_order");
        if (cancelled || error || !data) return;
        setBrandCollections(
          (data as (BrandItem & { kind?: string | null })[])
            .filter((row) => row.kind === "brand")
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        );
      } catch (err) {
        console.error("Error loading brand collections for the header:", err);
      }
    };
    loadBrands();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Announcement bar rotation ─────────────────────────────── */
  useEffect(() => {
    const id = window.setInterval(() => {
      setAnnouncementIndex((index) => (index + 1) % ANNOUNCEMENTS.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const stepAnnouncement = (direction: 1 | -1) => {
    setAnnouncementIndex(
      (index) => (index + direction + ANNOUNCEMENTS.length) % ANNOUNCEMENTS.length
    );
  };

  /* ── Escape closes every open surface ──────────────────────── */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsBrandsMenuOpen(false);
      setIsMobileMenuOpen(false);
      setIsSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (isMobileMenuOpen) mobileDrawerRef.current?.focus();
  }, [isMobileMenuOpen]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchTerm.trim();
    setIsSearchOpen(false);
    setIsMobileMenuOpen(false);
    router.push(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
  };

  const navLinkClass = (key: NavKey) =>
    `font-body text-[15px] font-[350] uppercase tracking-[0.06em] text-black leading-none decoration-1 underline-offset-[6px] transition-opacity duration-300 hover:underline ${
      activePage === key ? "underline" : ""
    }`;

  return (
    <>
      <header
        className="sticky top-0 left-0 right-0 z-50 w-full bg-white text-black font-body border-b"
        style={{ borderColor: HAIRLINE }}
      >
        {/* ── Row 1 — announcement bar ───────────────────────── */}
        <div className="bg-black text-white">
          <div className="maison-container h-[39px] flex items-center justify-center gap-4 sm:gap-8">
            <button
              type="button"
              aria-label="Previous message"
              onClick={() => stepAnnouncement(-1)}
              className="text-white/70 hover:text-white transition-colors duration-300"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.25} />
            </button>

            <p
              key={announcementIndex}
              aria-live="polite"
              className="text-[12px] font-normal uppercase tracking-[0.1em] text-white text-center leading-none truncate"
            >
              {ANNOUNCEMENTS[announcementIndex]}
            </p>

            <button
              type="button"
              aria-label="Next message"
              onClick={() => stepAnnouncement(1)}
              className="text-white/70 hover:text-white transition-colors duration-300"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.25} />
            </button>
          </div>
        </div>

        {/* ── Row 2 — search / wordmark / account ────────────── */}
        <div className="maison-container h-[62px] grid grid-cols-[1fr_auto_1fr] items-center">
          {/* Left: hamburger (mobile) + bare search trigger */}
          <div className="flex items-center justify-start gap-4">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
              className="md:hidden text-black transition-opacity duration-300 hover:opacity-60"
            >
              <Menu className="w-[20px] h-[20px]" strokeWidth={1.25} />
            </button>

            <button
              type="button"
              onClick={() => setIsSearchOpen((open) => !open)}
              aria-expanded={isSearchOpen}
              aria-label="Search"
              className="flex items-center gap-2 text-black transition-opacity duration-300 hover:opacity-60"
            >
              <Search className="w-[18px] h-[18px]" strokeWidth={1.25} />
              <span className="hidden md:inline text-[12px] font-normal uppercase tracking-[0.1em] leading-none">
                Search
              </span>
            </button>
          </div>

          {/* Center: wordmark */}
          <div className="flex items-center justify-center">
            <Link href="/" aria-label="Gharib — home">
              <Image
                src="/logo.png"
                alt="Gharib"
                width={952}
                height={488}
                preload
                className="h-9 md:h-11 w-auto object-contain"
                style={{ mixBlendMode: "multiply" }}
              />
            </Link>
          </div>

          {/* Right: sign in + line icons */}
          <div className="flex items-center justify-end gap-4 md:gap-5">
            {/* Signed out: the words. Signed in: the shopper's monogram, which
                replaces both the words and the account icon so the row does not
                carry two ways into the same page. Nothing is drawn until the
                session is known, so neither state flickers into the other. */}
            {!isSignedIn && (
              <Link
                href={accountHref}
                className="hidden md:inline-block text-[13px] font-[350] uppercase tracking-[0.06em] text-black leading-none transition-opacity duration-300 hover:opacity-60"
              >
                <span className={isSignedIn === null ? "invisible" : undefined}>
                  {accountLabel}
                </span>
              </Link>
            )}

            <span
              aria-hidden="true"
              className="hidden md:block w-px h-4"
              style={{ backgroundColor: HAIRLINE }}
            />

            <Link
              href={accountHref}
              aria-label={accountLabel}
              title={isSignedIn ? accountLabel : undefined}
              className="text-black transition-opacity duration-300 hover:opacity-60"
            >
              {isSignedIn && initials ? (
                <span
                  aria-hidden="true"
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-full border text-[10px] uppercase leading-none tracking-[0.06em]"
                  style={{ borderColor: HAIRLINE, fontWeight: 350 }}
                >
                  {initials}
                </span>
              ) : (
                <User className="w-[18px] h-[18px]" strokeWidth={1.25} />
              )}
            </Link>

            <Link
              href="/wishlist"
              aria-label="Wishlist"
              aria-current={activePage === "wishlist" ? "page" : undefined}
              className="text-black transition-opacity duration-300 hover:opacity-60"
            >
              <Bookmark className="w-[18px] h-[18px]" strokeWidth={1.25} />
            </Link>

            <Link
              href="/checkout"
              aria-label="Shopping bag"
              className="relative text-black transition-opacity duration-300 hover:opacity-60"
            >
              <ShoppingBag className="w-[18px] h-[18px]" strokeWidth={1.25} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[15px] h-[15px] px-[3px] bg-black text-white text-[10px] font-normal leading-[15px] text-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* ── Search panel ───────────────────────────────────── */}
        {isSearchOpen && (
          <div className="border-t bg-white" style={{ borderColor: HAIRLINE }}>
            <form onSubmit={submitSearch} className="maison-container h-[62px] flex items-center gap-4">
              <Search className="w-[18px] h-[18px] shrink-0 text-black" strokeWidth={1.25} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search fragrances, brands, notes"
                className="flex-1 h-10 bg-transparent border-0 border-b outline-none text-[14px] font-light text-black placeholder:text-[#757575] transition-colors duration-300 focus:border-black"
                style={{ borderColor: HAIRLINE }}
              />
              <button
                type="submit"
                className="text-[12px] font-medium uppercase tracking-[0.2em] text-black leading-none transition-opacity duration-300 hover:opacity-60"
              >
                Search
              </button>
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setIsSearchOpen(false)}
                className="text-black transition-opacity duration-300 hover:opacity-60"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={1.25} />
              </button>
            </form>
          </div>
        )}

        {/* ── Row 3 — main navigation + brands mega-menu ─────── */}
        <div
          className="hidden md:block relative"
          onMouseLeave={handleBrandsMouseLeave}
        >
          <nav className="maison-container h-[48px] flex items-center justify-center gap-10 lg:gap-14">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={activePage === item.key ? "page" : undefined}
                aria-expanded={item.key === "brands" ? isBrandsMenuOpen : undefined}
                aria-haspopup={item.key === "brands" ? "true" : undefined}
                onMouseEnter={
                  item.key === "brands" ? handleBrandsMouseEnter : () => setIsBrandsMenuOpen(false)
                }
                onFocus={
                  item.key === "brands" ? handleBrandsMouseEnter : () => setIsBrandsMenuOpen(false)
                }
                onKeyDown={
                  item.key === "brands"
                    ? (event: React.KeyboardEvent<HTMLAnchorElement>) => {
                        if ((event.key === "Enter" || event.key === " ") && !isBrandsMenuOpen) {
                          event.preventDefault();
                          setIsBrandsMenuOpen(true);
                        }
                      }
                    : undefined
                }
                onClick={() => setIsBrandsMenuOpen(false)}
                className={navLinkClass(item.key)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <BrandsDropdown
            isOpen={isBrandsMenuOpen}
            onClose={() => setIsBrandsMenuOpen(false)}
            onMouseEnter={handleBrandsMouseEnter}
            onMouseLeave={handleBrandsMouseLeave}
            brands={brandCollections}
          />
        </div>
      </header>

      {/* ── Mobile drawer ────────────────────────────────────── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[60] bg-white text-black font-body flex flex-col outline-none"
          >
            <div
              className="flex items-center justify-between h-[62px] px-5 border-b"
              style={{ borderColor: HAIRLINE }}
            >
              <span className="maison-eyebrow">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-black transition-opacity duration-300 hover:opacity-60"
              >
                <X className="w-[20px] h-[20px]" strokeWidth={1.25} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto px-5 pb-16">
              <ul>
                {NAV_ITEMS.map((item) => (
                  <li key={item.key} className="border-b" style={{ borderColor: HAIRLINE }}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block py-5 font-display text-[18px] uppercase tracking-[0.08em] text-black"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li className="border-b" style={{ borderColor: HAIRLINE }}>
                  <Link
                    href="/wishlist"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-5 font-display text-[18px] uppercase tracking-[0.08em] text-black"
                  >
                    Wishlist
                  </Link>
                </li>
                <li className="border-b" style={{ borderColor: HAIRLINE }}>
                  <Link
                    href={accountHref}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-5 font-display text-[18px] uppercase tracking-[0.08em] text-black"
                  >
                    {accountLabel}
                  </Link>
                </li>
              </ul>

              {brandCollections.length > 0 && (
                <>
                  <p className="maison-eyebrow mt-10 mb-4">Maisons</p>
                  <ul>
                    {brandCollections.map((brand) => (
                      <li key={brand.id}>
                        <Link
                          href={`/collection/${brand.id}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-3 text-[15px] font-[350] tracking-[0.02em] text-black"
                        >
                          {toTitleCase(brand.title)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
