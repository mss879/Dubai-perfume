"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Search,
  Bookmark,
  ShoppingBag,
  User,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import BrandsDropdown from "./components/BrandsDropdown";

/* Hairline used across the maison header — matches --line in globals.css */
const HAIRLINE = "rgba(0,0,0,0.12)";

/* Rotating announcement bar copy (row 1 of the sticky maison header) */
const ANNOUNCEMENTS = [
  "Complimentary delivery on every UAE order",
  "Two discovery samples with every order",
  "100% authentic Dubai fragrances",
];

/* Plain link used through the mega menu columns and the drawer sub-lists */
const MEGA_LINK_CLASS =
  "inline-block w-full text-left py-2.5 text-[15px] font-[350] tracking-[0.02em] leading-none text-black cursor-pointer decoration-1 underline-offset-[6px] transition-opacity duration-300 hover:underline";

/* "AL HARAMAIN" → "Al Haramain" */
const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, prefix: string, letter: string) => prefix + letter.toUpperCase());

/* Sub-headline under the hero wordmark. Previously supplied by the admin-driven
   hero slider (is_hero products); now a fixed maison line. */
const HERO_TAGLINE = "Aurum Noble Edition";

/* 
  ==============================================
  PreloaderMistReveal: High-End Custom Preloader
  ==============================================
  Simulates swirling luxury perfume mist clouds that 
  melt/disperse to reveal "World-Class Luxury Perfume Collective Gharib"
*/
const PreloaderMistReveal: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    interface MistParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      color: string;
    }

    const particles: MistParticle[] = [];
    const colors = [
      "rgba(253, 244, 230, 0.08)", // Elegant warm silk
      "rgba(224, 184, 107, 0.06)", // Luxury gold shimmer
      "rgba(255, 255, 255, 0.05)", // Fine mist
      "rgba(82, 42, 22, 0.07)",    // Deep amber haze
    ];

    // Seed mist particles centered in the middle of the screen
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * 260,
        y: height / 2 + (Math.random() - 0.5) * 200,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 55 + 40,
        alpha: Math.random() * 0.45 + 0.45,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const startTime = Date.now();
    let dispersing = false;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const elapsed = Date.now() - startTime;

      // Start mist dispersion after 1.1s
      if (elapsed > 1100 && !dispersing) {
        dispersing = true;
        setRevealed(true);
      }

      particles.forEach((p) => {
        if (!dispersing) {
          // Ambient swirling drift
          p.x += p.vx;
          p.y += p.vy;
        } else {
          // Melt phase: expand particles rapidly and dissolve opacity
          p.radius += 3.0;
          p.alpha -= 0.013;

          const dx = p.x - width / 2;
          const dy = p.y - height / 2;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          p.x += (dx / dist) * 2.2;
          p.y += (dy / dist) * 2.2;
        }

        if (p.alpha > 0) {
          ctx.beginPath();
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          grad.addColorStop(0, p.color.replace(/[\d.]+\)$/, `${p.alpha})`));
          grad.addColorStop(0.5, p.color.replace(/[\d.]+\)$/, `${p.alpha * 0.45})`));
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      if (!dispersing || particles.some((p) => p.alpha > 0)) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#070200] overflow-hidden font-sans-luxury">
      {/* Subtle warm glow vignette */}
      <div className="absolute inset-0 bg-radial from-[#3a1a0b]/35 via-transparent to-transparent blur-3xl scale-125 pointer-events-none"></div>

      {/* Swirling/Dispersing Mist Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-20 pointer-events-none w-full h-full mix-blend-screen filter blur-[3px]"
      />

      {/* Headline text revealed beautifully */}
      <div
        className="relative z-10 text-center transition-all duration-[1500ms] ease-[cubic-bezier(0.16,1,0.3,1)] px-6"
        style={{
          filter: revealed ? "blur(0px)" : "blur(22px)",
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0) scale(1)" : "translateY(15px) scale(0.96)",
        }}
      >
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif-luxury text-white font-medium leading-[1.2] tracking-wide max-w-2xl mx-auto">
          World-Class Luxury<br />
          Perfume Collective <br />
          Gharib
        </h2>
        <span className="text-[10px] tracking-[0.25em] uppercase text-white/30 block mt-5 font-sans-luxury pl-[0.25em]">
          SINCE 1993
        </span>
      </div>
    </div>
  );
};

interface CatalogProduct {
  id: number;
  brand: string;
  name: string;
  price: string;
  sizes: string[];
  image: string;
  images?: string[];
  isNew?: boolean;
  isBestSeller?: boolean;
  isFeaturedLarge?: boolean;
  description?: string;
  olfactory?: string;
  gender?: string;
}

/* Shapes returned by the Supabase tables this page reads. */
interface DbProductRow {
  id: number;
  brand: string;
  name: string;
  price: number | string;
  sizes?: string[] | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  is_new?: boolean;
  is_bestseller?: boolean;
  is_featured_large?: boolean;
  description?: string | null;
  tagline?: string | null;
  olfactory_group?: string | null;
  tags?: string[] | null;
}

interface DbCollectionRow {
  id: string;
  title: string;
  description?: string | null;
  cover_image?: string | null;
  kind?: string | null;
  sort_order?: number | null;
}

interface DbProductCollectionRow {
  collection_id: string;
  product_id: number;
}

interface DbWishlistRow {
  customer_id: string;
  product_id: number;
  wishlist_type: "favorite" | "buy_later";
}

/* Collection entries rendered in the mega menu / in-page filter list. */
interface CollectionEntry {
  id: string;
  title: string;
  desc: string;
}

const megaMenuContainerVariants: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: [0.16, 1, 0.3, 1], // Premium luxury easeOut
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.18,
      ease: [0.7, 0, 0.84, 0], // Premium luxury easeIn
    },
  },
};

const megaMenuColumnVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
  },
  exit: {
    opacity: 1,
  },
};


/* House copy for the four standard curated collection ids. These are labels
   only — an entry is rendered exclusively when a row with the same id actually
   exists in the `collections` table. Nothing here invents a collection. */
const STANDARD_COLLECTION_LABELS: Record<string, { title: string; desc: string }> = {
  new: { title: "New Arrivals", desc: "Freshly decanted summer releases" },
  bestsellers: { title: "Bestsellers", desc: "Our most coveted scent signatures" },
  favorites: { title: "Exclusive Offers", desc: "Hand-selected custom vaults" },
  trending: { title: "Trending", desc: "Most wanted scent creations" },
};

/* The standard ids lead the menu, in this order; everything else follows by
   the sort_order stored on the row. */
const STANDARD_COLLECTION_ORDER = ["new", "bestsellers", "favorites", "trending"];

/* Olfactive families listed in the mega menu. Label only — the maison menu
   renders bare text links (design-system.md §1: no gradients, no colour accents,
   no decorative glyphs). */
const MEGA_MENU_OLFACTORY = [
  { label: "Woody & Oud" },
  { label: "Amber & Oriental" },
  { label: "Floral & Sweet" },
  { label: "Fresh & Aquatic" },
];

interface GenderSelectorProps {
  onSelect: (genderId: string) => void;
}

const GENDER_TILES: { id: string; label: string; image: string }[] = [
  { id: "men", label: "Men", image: "/men-perfume.jpg" },
  { id: "women", label: "Women", image: "/women-perfume.jpg" },
];

const GenderSelector: React.FC<GenderSelectorProps> = ({ onSelect }) => {
  return (
    <div className="w-full font-body grid grid-cols-1 sm:grid-cols-2">
      {GENDER_TILES.map((tile, index) => (
        <button
          key={tile.id}
          type="button"
          onClick={() => onSelect(tile.id)}
          aria-label={`${tile.label} fragrances`}
          className={`group relative block w-full cursor-pointer text-left ${index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""
            }`}
          style={index > 0 ? { borderColor: HAIRLINE } : undefined}
        >
          <div className="relative w-full aspect-[16/10] overflow-hidden bg-[#F5F5F5]">
            <Image
              src={tile.image}
              alt={tile.label}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
            <span className="absolute inset-0 bg-black/20 pointer-events-none" />
            <span className="absolute inset-0 flex items-center justify-center font-display text-[20px] md:text-[24px] uppercase tracking-[0.12em] text-white leading-none">
              {tile.label}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};

const ProductCard: React.FC<{
  prod: CatalogProduct;
  isFav: boolean;
  isBuyLater: boolean;
  isLoggedIn: boolean;
  activeSize: string;
  onToggleFavorite: (id: number) => void;
  onToggleBuyLater: (id: number) => void;
  onSelectSize: (id: number, size: string) => void;
  onAddToCart: (id: number) => void;
  badgeText?: string;
  formatCurrency: (aedAmount: number) => string;
}> = ({ prod, isFav, activeSize, onToggleFavorite, onSelectSize, onAddToCart, badgeText, formatCurrency }) => {

  const [isHovered, setIsHovered] = useState(false);

  // Clean long perfume names (replace underscores with spaces for elegant wrapping)
  const displayName = prod.name ? prod.name.replace(/_/g, " ") : "";
  const hoverImage = prod.images && prod.images.length > 1 ? prod.images[1] : null;
  const sizes = prod.sizes && prod.sizes.length > 0 ? prod.sizes : [];
  const currentSize = activeSize || sizes[0] || "";

  /* Inline so the cross-fade and the 700ms hover scale share one transition
     declaration (globals.css sets `transition: transform` on card images). */
  const mediaTransition = { transition: "opacity 700ms ease-out, transform 700ms ease-out" };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex h-full min-w-0 flex-col bg-transparent font-body"
    >
      {/* Optional catalogue label — flat, top-left, no pill, no colour */}
      {badgeText && (
        <span className="maison-card-label pointer-events-none absolute left-0 top-0 z-10">
          {badgeText}
        </span>
      )}

      {/* Wishlist toggle — bare line icon, no background, no glow */}
      <button
        type="button"
        onClick={() => onToggleFavorite(prod.id)}
        aria-pressed={isFav}
        aria-label={isFav ? `Remove ${displayName} from wishlist` : `Add ${displayName} to wishlist`}
        className="absolute right-0 top-0 z-10 cursor-pointer p-1 text-black transition-opacity duration-300 hover:opacity-50"
      >
        <svg
          width="13"
          height="16"
          viewBox="0 0 14 18"
          fill={isFav ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1.5 1h11v16l-5.5-4-5.5 4V1Z" />
        </svg>
      </button>

      {/* 1. Product image — 1:1, object-contain, floating on white */}
      <Link
        href={`/product/${prod.id}`}
        className={`maison-card-media block cursor-pointer ${prod.image ? "" : "bg-[#F5F5F5]"}`}
      >
        {prod.image && (
          <Image
            src={prod.image}
            alt={displayName}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
            style={mediaTransition}
            className={`object-contain ${isHovered && hoverImage ? "opacity-0" : "opacity-100"}`}
          />
        )}
        {hoverImage && (
          <Image
            src={hoverImage}
            alt={displayName}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
            style={mediaTransition}
            className={`object-contain ${isHovered ? "opacity-100" : "opacity-0"}`}
          />
        )}
      </Link>

      {/* 2. Maison / name / notes / price row / add to cart */}
      <div className="flex flex-1 flex-col">
        {prod.brand && <p className="maison-card-notes mt-6">{prod.brand}</p>}

        <Link href={`/product/${prod.id}`} className="mt-2 block cursor-pointer">
          <h3 className="maison-card-title transition-opacity duration-300 group-hover:opacity-70">
            {displayName}
          </h3>
        </Link>

        {prod.olfactory && <p className="maison-card-notes mt-2">{prod.olfactory}</p>}

        <div className="mt-auto w-full">
          <div
            className="flex items-center justify-between gap-3 border-b pb-3 pt-5"
            style={{ borderColor: HAIRLINE }}
          >
            <span className="maison-price">
              {formatCurrency(parseFloat(prod.price.replace("$", "")) || 0)}
            </span>

            {sizes.length > 1 ? (
              <select
                value={currentSize}
                onChange={(e) => onSelectSize(prod.id, e.target.value)}
                aria-label={`Size for ${displayName}`}
                className="cursor-pointer appearance-none border-0 bg-transparent p-0 text-right text-[14px] font-[350] tracking-[0.07em] text-black outline-none"
              >
                {sizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            ) : (
              currentSize && (
                <span className="text-[14px] font-[350] tracking-[0.07em] text-black">{currentSize}</span>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => onAddToCart(prod.id)}
            className="maison-btn-outline mt-4 h-12 w-full"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
};

/* Stand-in shown while the catalogue is still being read from Supabase. Plain
   #F5F5F5 blocks on the card's own 1:1 media ratio — no shimmer, no pulse, no
   spinner (design-system.md: nothing animates for its own sake). */
const ProductGridPlaceholder: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div
    aria-hidden="true"
    className="mt-14 grid grid-cols-2 gap-x-8 gap-y-14 md:grid-cols-3 lg:grid-cols-4"
  >
    {Array.from({ length: count }).map((_, index) => (
      <div key={index}>
        <div className="w-full aspect-square bg-[#F5F5F5]" />
        <div className="mt-6 h-[10px] w-1/2 bg-[#F5F5F5]" />
        <div className="mt-4 h-[14px] w-4/5 bg-[#F5F5F5]" />
        <div className="mt-4 h-[10px] w-1/4 bg-[#F5F5F5]" />
      </div>
    ))}
  </div>
);

import { clientSafeSupabase } from "./lib/supabase";

interface CartItem {
  product: CatalogProduct;
  quantity: number;
  selectedSize: string;
}

// Reads the persisted bag out of localStorage. A shopper who has never added
// anything starts with an empty bag — the drawer and /checkout both render an
// empty state for it.
const readStoredCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("gharib_cart_v2");
  if (!stored) return [];
  try {
    return JSON.parse(stored) as CartItem[];
  } catch (e) {
    console.error("Failed to parse cart storage", e);
    return [];
  }
};

export default function Home() {
  const router = useRouter();

  // The catalogue is owned by Supabase. Nothing renders until the fetch settles,
  // so the storefront never shows a product that is not in the database.
  const [productsList, setProductsList] = useState<CatalogProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [collectionsList, setCollectionsList] = useState<CollectionEntry[]>([]);
  const [productCollectionsList, setProductCollectionsList] = useState<DbProductCollectionRow[]>([]);
  // Brand collections (kind = 'brand'), each of which owns a /collection/<id> page
  const [brandCollections, setBrandCollections] = useState<DbCollectionRow[]>([]);

  // Preloader Visibility State (Only displayed once on first visit)
  const [showIntro, setShowIntro] = useState(false);

  // Main Storefront UI Staggered Entrance Reveal State
  const [revealInterface, setRevealInterface] = useState(false);

  // Scroll visibility state for sticky light navbar
  const [isScrolled, setIsScrolled] = useState(false);

  // Rotating announcement bar (row 1 of the sticky maison header)
  const [announcementIndex, setAnnouncementIndex] = useState(0);

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

  // Catalog e-commerce states
  const [activeCatalogTab, setActiveCatalogTab] = useState<"all" | "new" | "bestsellers" | "favorites">("all");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [buyLater, setBuyLater] = useState<number[]>([]);
  // Only holds sizes the shopper has actively picked. A product with no entry
  // falls back to its own first size (`selectedSizes[id] ?? prod.sizes[0]`).
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});

  // Luxury Reactive Cart State.
  //
  // These four values live in localStorage, which the server cannot see. Reading
  // them in a useState initialiser makes the client's first render disagree with
  // the server HTML, and React throws a hydration mismatch (the bag badge is the
  // usual casualty). So they start at their server-safe defaults and are filled
  // in once, on mount.
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [activeCurrency, setActiveCurrency] = useState("AED");

  // True once the browser-only values above have been read, so the persist
  // effect below cannot write its empty placeholder over a real stored bag.
  const [isHydrated, setIsHydrated] = useState(false);

  // Save cart to localStorage whenever it changes — but never before hydration.
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem("gharib_cart_v2", JSON.stringify(cartItems));
  }, [cartItems, isHydrated]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFooterCurrencyOpen, setIsFooterCurrencyOpen] = useState(false);

  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    AED: 1.0,
    USD: 0.2722,
    EUR: 0.2514,
    GBP: 0.2154,
    SAR: 1.0208,
    QAR: 0.9912,
    KWD: 0.0838,
    BHD: 0.1027,
    OMR: 0.1048,
    INR: 22.68
  });

  // Currency Geolocation & Live API Sync
  useEffect(() => {
    // 1. With no stored preference, infer one from the shopper's location.
    const storedCurrency = localStorage.getItem("gharib_active_currency");
    if (!storedCurrency) {
      // Geolocate user based on IP
      const geolocateUser = async () => {
        try {
          const res = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          if (data && data.currency) {
            const supported = ["AED", "SAR", "QAR", "KWD", "BHD", "OMR", "USD", "EUR", "GBP", "INR"];
            if (supported.includes(data.currency)) {
              setActiveCurrency(data.currency);
              localStorage.setItem("gharib_active_currency", data.currency);
            }
          }
        } catch (e) {
          console.error("Auto-geolocation query failed. Defaulting to AED.", e);
        }
      };
      geolocateUser();
    }

    // 2. Fetch live market-accurate exchange rates
    const fetchLiveRates = async () => {
      try {
        const cachedRates = sessionStorage.getItem("gharib_exchange_rates");
        if (cachedRates) {
          setExchangeRates(JSON.parse(cachedRates));
          return;
        }

        const res = await fetch("https://open.er-api.com/v6/latest/AED");
        const data = await res.json();
        if (data && data.result === "success" && data.rates) {
          const rates = {
            AED: 1.0,
            USD: data.rates.USD || 0.2722,
            EUR: data.rates.EUR || 0.2514,
            GBP: data.rates.GBP || 0.2154,
            SAR: data.rates.SAR || 1.0208,
            QAR: data.rates.QAR || 0.9912,
            KWD: data.rates.KWD || 0.0838,
            BHD: data.rates.BHD || 0.1027,
            OMR: data.rates.OMR || 0.1048,
            INR: data.rates.INR || 22.68
          };
          setExchangeRates(rates);
          sessionStorage.setItem("gharib_exchange_rates", JSON.stringify(rates));
        }
      } catch (e) {
        console.error("Live exchange rates retrieval failed. Relying on baseline coefficients.", e);
      }
    };
    fetchLiveRates();
  }, []);

  // Global Price Formatter Utility
  const formatCurrency = (aedAmount: number, targetCurrency: string = activeCurrency) => {
    const rate = exchangeRates[targetCurrency] || 1.0;
    const converted = aedAmount * rate;

    const symbols: Record<string, string> = {
      AED: "AED",
      USD: "$",
      EUR: "€",
      GBP: "£",
      SAR: "SAR",
      QAR: "QAR",
      KWD: "KWD",
      BHD: "BHD",
      OMR: "OMR",
      INR: "₹"
    };

    const symbol = symbols[targetCurrency] || "$";
    const decimals = ["AED", "SAR", "QAR", "OMR", "BHD", "KWD"].includes(targetCurrency) ? 0 : 2;
    const formattedVal = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(converted);

    if (["AED", "SAR", "QAR", "OMR", "BHD", "KWD"].includes(targetCurrency)) {
      return `${formattedVal} ${symbol}`;
    }
    return `${symbol}${formattedVal}`;
  };

  // Compute cartCount dynamically
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Unified Animated Typing Search Placeholder State
  const [searchPlaceholder, setSearchPlaceholder] = useState("SEARCH SCENT...");

  useEffect(() => {
    const searchPhrases = [
      "SEARCH SCENT...",
      "TRY 'GOLD MEMOIR'...",
      "TRY 'MYSTIC OUD'...",
      "TRY 'ENCHANTED BLOOMS'...",
      "TRY 'OCEAN BREEZE'...",
      "SEARCH FOR VANILLA...",
      "SEARCH OUD INGREDIENT...",
    ];

    let currentPhraseIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    let typingTimer: NodeJS.Timeout;
    let caretTimer: NodeJS.Timeout;
    let caretVisible = true;

    // Helper to render placeholder with cursor, maintaining uniform spacing to prevent layout shifting
    const updatePlaceholder = (text: string, showCaret: boolean) => {
      setSearchPlaceholder(text + (showCaret ? "|" : " "));
    };

    // Caret blinking loop that simulates realistic human typing delays
    const blinkCaret = (text: string, count: number, callback: () => void) => {
      if (count <= 0) {
        callback();
        return;
      }
      caretVisible = !caretVisible;
      updatePlaceholder(text, caretVisible);
      caretTimer = setTimeout(() => blinkCaret(text, count - 1, callback), 450);
    };

    const tick = () => {
      const currentFullPhrase = searchPhrases[currentPhraseIndex];

      if (!isDeleting) {
        // Typing characters
        currentCharIndex++;
        const typedText = currentFullPhrase.substring(0, currentCharIndex);
        updatePlaceholder(typedText, true);

        if (currentCharIndex === currentFullPhrase.length) {
          isDeleting = true;
          // Hold the term on the screen and blink the caret 4 times (~1.8 seconds)
          blinkCaret(currentFullPhrase, 4, () => {
            typingTimer = setTimeout(tick, 300);
          });
          return;
        }
      } else {
        // Deleting characters
        currentCharIndex--;
        const typedText = currentFullPhrase.substring(0, currentCharIndex);
        updatePlaceholder(typedText, true);

        if (currentCharIndex === 0) {
          isDeleting = false;
          currentPhraseIndex = (currentPhraseIndex + 1) % searchPhrases.length;
          // Pause and let the empty bar breathe with a blinking caret 2 times (~900ms)
          blinkCaret("", 2, () => {
            typingTimer = setTimeout(tick, 200);
          });
          return;
        }
      }

      // Dynamic typing speeds: slow deliberate luxury typing (100ms) vs fast sweep-deleting (35ms)
      const delta = isDeleting ? 35 : 100;
      typingTimer = setTimeout(tick, delta);
    };

    // Kickoff the loop after an initial short delay
    typingTimer = setTimeout(tick, 800);

    return () => {
      clearTimeout(typingTimer);
      clearTimeout(caretTimer);
    };
  }, []);

  // One-shot cross-page message (e.g. "you are now signed in"), handed over via
  // localStorage. Filled in by the hydration effect above, then consumed by the
  // effect below so it does not replay.
  const [showNotification, setShowNotification] = useState<string | null>(null);

  // The single hydration point for every browser-only value. Runs once, after
  // the first client render has already matched the server HTML.
  useEffect(() => {
    setCartItems(readStoredCart());
    setUserEmail(localStorage.getItem("userEmail"));
    setActiveCurrency(localStorage.getItem("gharib_active_currency") || "AED");
    setShowNotification(localStorage.getItem("authNotification"));
    setIsHydrated(true);
  }, []);

  const [selectedOlfactory, setSelectedOlfactory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  // Holds either one of the built-in collection keys ("new", "bestsellers", …)
  // or the id of a DB-backed collection, so it is a plain string.
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [selectedMenuGender, setSelectedMenuGender] = useState<string | null>(null);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [isBrandsMenuOpen, setIsBrandsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const brandsLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBrandsMouseEnter = () => {
    if (brandsLeaveTimeoutRef.current) {
      clearTimeout(brandsLeaveTimeoutRef.current);
      brandsLeaveTimeoutRef.current = null;
    }
    setIsBrandsMenuOpen(true);
    setIsMegaMenuOpen(false);
  };

  const handleBrandsMouseLeave = () => {
    if (brandsLeaveTimeoutRef.current) {
      clearTimeout(brandsLeaveTimeoutRef.current);
    }
    brandsLeaveTimeoutRef.current = setTimeout(() => {
      setIsBrandsMenuOpen(false);
    }, 250);
  };

  /* Mega-menu open/close with the same forgiving 250ms leave delay, so the
     cursor can travel from the SHOP trigger down into the panel. */
  const megaLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearMegaLeaveTimeout = () => {
    if (megaLeaveTimeoutRef.current) {
      clearTimeout(megaLeaveTimeoutRef.current);
      megaLeaveTimeoutRef.current = null;
    }
  };

  const openMegaMenu = () => {
    clearMegaLeaveTimeout();
    setIsBrandsMenuOpen(false);
    setIsMegaMenuOpen(true);
  };

  const closeMegaMenuNow = () => {
    clearMegaLeaveTimeout();
    setIsMegaMenuOpen(false);
  };

  const closeMegaMenuSoon = () => {
    clearMegaLeaveTimeout();
    megaLeaveTimeoutRef.current = setTimeout(() => {
      setIsMegaMenuOpen(false);
    }, 250);
  };

  // The mega menu always reopens on its root panel, so drop the previously
  // chosen gender as soon as it closes. Adjusted during render rather than in an
  // effect so the menu never paints its closing frame with a stale selection.
  const [megaMenuWasOpen, setMegaMenuWasOpen] = useState(isMegaMenuOpen);
  if (megaMenuWasOpen !== isMegaMenuOpen) {
    setMegaMenuWasOpen(isMegaMenuOpen);
    if (!isMegaMenuOpen) {
      setSelectedMenuGender(null);
    }
  }

  const renderMegaMenuContent = () => {
    if (!selectedMenuGender) {
      return (
        <div className="maison-container py-12 lg:py-16 font-body text-black">
          <div
            className="flex items-end justify-between gap-6 border-b pb-5 mb-10"
            style={{ borderColor: HAIRLINE }}
          >
            <p className="maison-eyebrow">Select a collection</p>
            <button
              type="button"
              onClick={() => {
                setSelectedGender(null);
                setIsMegaMenuOpen(false);
                // The full catalogue lives on /shop — the homepage grid only
                // ever shows a curated slice.
                router.push(
                  selectedMenuGender ? `/shop?gender=${selectedMenuGender}` : "/shop"
                );
              }}
              className="maison-link cursor-pointer"
            >
              All fragrances
            </button>
          </div>

          <GenderSelector onSelect={(id) => setSelectedMenuGender(id)} />
        </div>
      );
    }

    const genderLabel =
      selectedMenuGender === "unisex"
        ? "Unisex fragrances"
        : selectedMenuGender === "women"
          ? "Women's fragrances"
          : "Men's fragrances";

    const genderImage =
      selectedMenuGender === "unisex"
        ? "/unisex-perfume.jpg"
        : selectedMenuGender === "women"
          ? "/women-perfume.jpg"
          : "/men-perfume.jpg";

    /* The second editorial tile spotlights a real catalogue row — the flagged
       featured product, else a bestseller, else whatever the shop holds. It is
       omitted entirely until the products have loaded. */
    const withArt = productsList.filter((p) => p.image);
    const menuHighlight =
      withArt.find((p) => p.isFeaturedLarge) ??
      withArt.find((p) => p.isBestSeller) ??
      withArt[0];

    return (
      <div className="maison-container py-12 lg:py-16 font-body text-black">
        <div
          className="flex items-center gap-5 border-b pb-5 mb-10"
          style={{ borderColor: HAIRLINE }}
        >
          <button
            type="button"
            onClick={() => setSelectedMenuGender(null)}
            className="maison-eyebrow cursor-pointer transition-colors duration-300 hover:text-black"
          >
            Back
          </button>
          <span aria-hidden="true" className="w-px h-3" style={{ backgroundColor: HAIRLINE }} />
          <p className="maison-eyebrow" style={{ color: "var(--ink)" }}>
            {genderLabel}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-10 lg:gap-16">
          {/* Collections */}
          <motion.div
            variants={megaMenuColumnVariants}
            className="col-span-12 sm:col-span-6 lg:col-span-2 flex flex-col"
          >
            <p className="maison-eyebrow mb-6">Collections</p>
            <ul>
              {collectionsList.map((col) => (
                <li key={col.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMegaMenuOpen(false);
                      const qParams = new URLSearchParams();
                      if (selectedMenuGender) qParams.set("gender", selectedMenuGender);
                      qParams.set("collection", col.id);
                      router.push(`/shop?${qParams.toString()}`);
                    }}
                    className={MEGA_LINK_CLASS}
                  >
                    {col.title}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setIsMegaMenuOpen(false);
                    const qParams = new URLSearchParams();
                    if (selectedMenuGender) qParams.set("gender", selectedMenuGender);
                    router.push(qParams.toString() ? `/shop?${qParams.toString()}` : `/shop`);
                  }}
                  className={MEGA_LINK_CLASS}
                >
                  All fragrances
                </button>
              </li>
            </ul>
          </motion.div>

          {/* Olfactive families */}
          <motion.div
            variants={megaMenuColumnVariants}
            className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col"
          >
            <p className="maison-eyebrow mb-6">Olfactive families</p>
            <ul>
              {MEGA_MENU_OLFACTORY.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMegaMenuOpen(false);
                      const qParams = new URLSearchParams();
                      if (selectedMenuGender) qParams.set("gender", selectedMenuGender);
                      qParams.set("olfactory", item.label);
                      router.push(`/shop?${qParams.toString()}`);
                    }}
                    className={MEGA_LINK_CLASS}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Maisons */}
          <motion.div
            variants={megaMenuColumnVariants}
            className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col"
          >
            <p className="maison-eyebrow mb-6">Maisons</p>
            {/* Maisons come only from the `collections` rows with kind = 'brand'.
                No fallback list — an unfetched menu simply shows no maisons. */}
            <ul>
              {brandCollections.map((brand) => (
                <li key={brand.id}>
                  <Link
                    href={`/collection/${brand.id}`}
                    onClick={() => setIsMegaMenuOpen(false)}
                    className={MEGA_LINK_CLASS}
                  >
                    {toTitleCase(brand.title)}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/collections"
              onClick={() => setIsMegaMenuOpen(false)}
              className="maison-link mt-7 self-start"
            >
              All brands
            </Link>
          </motion.div>

          {/* Editorial tiles */}
          <motion.div
            variants={megaMenuColumnVariants}
            className="col-span-12 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-10"
          >
            <button
              type="button"
              onClick={() => {
                setIsMegaMenuOpen(false);
                const qParams = new URLSearchParams();
                qParams.set("gender", selectedMenuGender);
                router.push(`/shop?${qParams.toString()}`);
              }}
              className="group block text-center cursor-pointer"
            >
              <div className="relative w-full aspect-[4/5] overflow-hidden bg-[#F5F5F5]">
                <Image
                  src={genderImage}
                  alt={genderLabel}
                  fill
                  sizes="(max-width: 640px) 100vw, 220px"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </div>
              <h4 className="maison-card-title mt-5">{genderLabel}</h4>
              <span className="maison-link mt-4">Discover</span>
            </button>

            {menuHighlight && (
              <button
                type="button"
                onClick={() => {
                  setIsMegaMenuOpen(false);
                  router.push(`/product/${menuHighlight.id}`);
                }}
                className="group block text-center cursor-pointer"
              >
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-[#F5F5F5]">
                  <Image
                    src={menuHighlight.image}
                    alt={`${menuHighlight.name} — ${menuHighlight.brand}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 220px"
                    className="object-contain p-6 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <h4 className="maison-card-title mt-5">{menuHighlight.name}</h4>
                <p className="maison-card-notes mt-2">{toTitleCase(menuHighlight.brand)}</p>
                <span className="maison-link mt-4">Discover</span>
              </button>
            )}
          </motion.div>
        </div>
      </div>
    );
  };

  /* ── Shared maison header rows ──────────────────────────────────────────
     One renderer drives BOTH headers: the sticky light bar and the hero bar
     that floats over the background video. Only colour tokens differ — every
     behaviour (search, currency, cart, wishlist, mega menu timers, mobile
     drawer) is literally the same markup.

     Row 1 (announcement) is identical in both themes.
     Drop panels — mega menu, BrandsDropdown, currency list, live suggestions —
     stay WHITE with black text in both themes: they are opaque panels, not
     part of the bar. */
  const renderHeaderRows = (theme: "light" | "dark") => {
    const isDark = theme === "dark";

    const line = isDark ? "rgba(255,255,255,0.18)" : HAIRLINE;
    const lineStyle = { borderColor: line };

    /* Bar-level interactive element: icon buttons, currency trigger, sign in */
    const control = isDark
      ? "text-white/75 transition-colors duration-300 hover:text-white cursor-pointer"
      : "text-black transition-opacity duration-300 hover:opacity-60 cursor-pointer";

    const inputText = isDark
      ? "text-white placeholder:text-white/50"
      : "text-black placeholder:text-[#757575]";

    const searchIconTone = isDark ? "text-white/75" : "text-black";
    const clearTone = isDark
      ? "text-white/50 transition-colors duration-300 hover:text-white cursor-pointer"
      : "text-[#757575] transition-colors duration-300 hover:text-black cursor-pointer";

    const focusLine = isDark ? "focus-within:border-white" : "focus-within:border-black";
    const focusLineSelf = isDark ? "focus:border-white" : "focus:border-black";

    const navLink = `font-body text-[15px] font-[350] uppercase tracking-[0.06em] leading-none decoration-1 underline-offset-[6px] transition-colors duration-300 hover:underline cursor-pointer ${
      isDark ? "text-white/80 hover:text-white" : "text-black"
    }`;

    const badge = `absolute -top-2 -right-2 min-w-[15px] h-[15px] px-[3px] text-[10px] font-normal leading-[15px] text-center ${
      isDark ? "bg-white text-black" : "bg-black text-white"
    }`;

    return (
      <>
        {/* ── Row 1 — announcement bar (identical in both themes) ───── */}
        <div className="bg-black text-white">
          <div className="maison-container h-[39px] flex items-center justify-center gap-4 sm:gap-8">
            <button
              type="button"
              aria-label="Previous message"
              onClick={() => stepAnnouncement(-1)}
              className="text-white/70 hover:text-white transition-colors duration-300 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.25} />
            </button>

            <p
              aria-live="polite"
              className="text-[12px] font-normal uppercase tracking-[0.1em] text-white text-center leading-none truncate"
            >
              {ANNOUNCEMENTS[announcementIndex]}
            </p>

            <button
              type="button"
              aria-label="Next message"
              onClick={() => stepAnnouncement(1)}
              className="text-white/70 hover:text-white transition-colors duration-300 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.25} />
            </button>
          </div>
        </div>

        {/* ── Row 2 — locale + search / wordmark / account ───── */}
        <div className="maison-container h-[62px] grid grid-cols-[1fr_auto_1fr] items-center">
          {/* Left: hamburger (mobile) + currency + bare search */}
          <div className="flex items-center justify-start gap-3 md:gap-5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
              className={`md:hidden ${control}`}
            >
              <Menu className="w-[20px] h-[20px]" strokeWidth={1.25} />
            </button>

            {/* Currency / locale selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                aria-expanded={isCurrencyDropdownOpen}
                aria-label="Select currency"
                className={`flex items-center gap-1.5 text-[12px] font-normal uppercase tracking-[0.1em] leading-none ${control}`}
              >
                <span>{activeCurrency}</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-300 ${isCurrencyDropdownOpen ? "rotate-180" : ""}`}
                  strokeWidth={1.25}
                />
              </button>

              <AnimatePresence>
                {isCurrencyDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute left-0 top-full mt-3 w-[240px] bg-white text-black border z-50 flex flex-col"
                    style={{ borderColor: HAIRLINE }}
                  >
                    {[
                      { code: "AED", label: "AED — UAE Dirham" },
                      { code: "SAR", label: "SAR — Saudi Riyal" },
                      { code: "QAR", label: "QAR — Qatari Riyal" },
                      { code: "KWD", label: "KWD — Kuwaiti Dinar" },
                      { code: "BHD", label: "BHD — Bahraini Dinar" },
                      { code: "OMR", label: "OMR — Omani Rial" },
                      { code: "USD", label: "USD — US Dollar" },
                      { code: "EUR", label: "EUR — Euro" },
                      { code: "GBP", label: "GBP — British Pound" },
                      { code: "INR", label: "INR — Indian Rupee" }
                    ].map((curr) => (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => {
                          setActiveCurrency(curr.code);
                          localStorage.setItem("gharib_active_currency", curr.code);
                          setIsCurrencyDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-[13px] font-light text-black flex items-center justify-between transition-colors duration-300 hover:bg-[#F5F5F5] cursor-pointer"
                      >
                        <span>{curr.label}</span>
                        {activeCurrency === curr.code && (
                          <span className="text-[12px] leading-none">✓</span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile search trigger — opens the panel row below */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              aria-expanded={isSearchOpen}
              aria-label="Search"
              className={`md:hidden ${control}`}
            >
              <Search className="w-[18px] h-[18px]" strokeWidth={1.25} />
            </button>

            {/* Desktop bare search + live suggestions */}
            <div className="relative hidden md:flex items-center min-w-0">
              <div
                className={`flex items-center gap-2 w-[190px] lg:w-[230px] h-9 border-b transition-colors duration-300 ${focusLine}`}
                style={lineStyle}
              >
                <Search
                  className={`w-[16px] h-[16px] flex-shrink-0 ${searchIconTone}`}
                  strokeWidth={1.25}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label="Search fragrances"
                  className={`flex-1 min-w-0 bg-transparent border-0 outline-none text-[12px] font-normal uppercase tracking-[0.1em] ${inputText}`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search"
                    className={`flex-shrink-0 ${clearTone}`}
                  >
                    <X className="w-[14px] h-[14px]" strokeWidth={1.25} />
                  </button>
                )}
              </div>

              {/* Live suggestions */}
              <AnimatePresence>
                {searchTerm.trim() !== "" && searchSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute top-full left-0 mt-3 w-[300px] md:w-[380px] bg-white border z-50 flex flex-col text-black"
                    style={{ borderColor: HAIRLINE }}
                  >
                    <div className="px-4 pt-4 pb-3">
                      <p className="maison-eyebrow">Suggestions</p>
                    </div>

                    <div className="flex flex-col max-h-[340px] overflow-y-auto">
                      {searchSuggestions.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => {
                            setSearchTerm("");
                            router.push(`/product/${prod.id}`);
                          }}
                          className="group px-4 py-3 flex items-center gap-4 text-left transition-colors duration-300 hover:bg-[#F8F8F8] cursor-pointer border-t"
                          style={{ borderColor: HAIRLINE }}
                        >
                          <div className="relative w-12 h-14 flex-shrink-0 bg-[#F5F5F5] overflow-hidden">
                            {prod.image && (
                              <Image
                                src={prod.image}
                                alt={prod.name}
                                fill
                                sizes="48px"
                                className="object-contain p-1.5 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                              />
                            )}
                          </div>
                          <div className="flex-grow flex flex-col min-w-0">
                            <span className="maison-eyebrow truncate">{prod.brand}</span>
                            <span className="font-display text-[13px] uppercase tracking-[0.06em] text-black truncate mt-1">
                              {prod.name.replace(/_/g, " ")}
                            </span>
                            <span className="maison-card-notes text-left mt-1 truncate">
                              {prod.olfactory}
                            </span>
                          </div>
                          <span className="maison-price flex-shrink-0">
                            {formatCurrency(parseFloat(prod.price.replace("$", "")) || 0)}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div
                      className="px-4 py-4 border-t flex items-center justify-end"
                      style={{ borderColor: HAIRLINE }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const term = searchTerm.trim();
                          setSearchTerm("");
                          router.push(term ? `/shop?search=${encodeURIComponent(term)}` : "/shop");
                        }}
                        className="maison-link cursor-pointer"
                      >
                        View all
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center: wordmark */}
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isDark ? "/white-logo.png" : "/logo.png"}
              alt="Gharib"
              className="h-9 md:h-11 w-auto object-contain cursor-pointer"
              style={isDark ? undefined : ({ mixBlendMode: "multiply" } as React.CSSProperties)}
              onClick={() => {
                setSearchTerm("");
                setSelectedOlfactory(null);
                setSelectedBrand(null);
                setSelectedCollection(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>

          {/* Right: sign in + line icons */}
          <div className="flex items-center justify-end gap-4 md:gap-5">
            <button
              type="button"
              onClick={() => router.push(userEmail ? "/customer/dashboard" : "/signin")}
              className={`hidden md:inline-block text-[13px] font-[350] uppercase tracking-[0.06em] leading-none ${control}`}
            >
              {userEmail ? "My account" : "Sign in"}
            </button>

            <span
              aria-hidden="true"
              className="hidden md:block w-px h-4"
              style={{ backgroundColor: line }}
            />

            <button
              type="button"
              onClick={() => router.push(userEmail ? "/customer/dashboard" : "/signin")}
              aria-label="Account"
              className={control}
            >
              <User className="w-[18px] h-[18px]" strokeWidth={1.25} />
            </button>

            <button
              type="button"
              onClick={() => router.push("/wishlist")}
              aria-label="Wishlist"
              className={`relative ${control}`}
            >
              <Bookmark className="w-[18px] h-[18px]" strokeWidth={1.25} />
              {favorites.length > 0 && (
                <span className={badge}>
                  {favorites.length > 9 ? "9+" : favorites.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label="Shopping bag"
              className={`relative ${control}`}
            >
              <ShoppingBag className="w-[18px] h-[18px]" strokeWidth={1.25} />
              {cartCount > 0 && (
                <span className={badge}>{cartCount > 9 ? "9+" : cartCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* ── Mobile search panel ────────────────────────────── */}
        {isSearchOpen && (
          <div
            className={`md:hidden border-t ${isDark ? "bg-transparent" : "bg-white"}`}
            style={lineStyle}
          >
            <div className="maison-container h-[56px] flex items-center gap-3">
              <Search
                className={`w-[18px] h-[18px] flex-shrink-0 ${searchIconTone}`}
                strokeWidth={1.25}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search fragrances"
                className={`flex-1 min-w-0 h-9 bg-transparent border-0 border-b outline-none text-[12px] font-normal uppercase tracking-[0.1em] transition-colors duration-300 ${inputText} ${focusLineSelf}`}
                style={lineStyle}
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => {
                  setSearchTerm("");
                  setIsSearchOpen(false);
                }}
                className={`flex-shrink-0 ${control}`}
              >
                <X className="w-[18px] h-[18px]" strokeWidth={1.25} />
              </button>
            </div>
          </div>
        )}

        {/* ── Row 3 — main navigation + drop panels ──────────── */}
        <div
          className="hidden md:block relative"
          onMouseLeave={() => {
            handleBrandsMouseLeave();
            closeMegaMenuSoon();
          }}
        >
          <nav className="maison-container h-[48px] flex items-center justify-center gap-10 lg:gap-14">
            <button
              type="button"
              onMouseEnter={() => {
                setIsBrandsMenuOpen(false);
                closeMegaMenuNow();
              }}
              onClick={() => {
                setSearchTerm("");
                setSelectedOlfactory(null);
                setSelectedBrand(null);
                setSelectedCollection(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={navLink}
            >
              Home
            </button>

            <Link
              href="/collections"
              onMouseEnter={handleBrandsMouseEnter}
              onClick={() => setIsBrandsMenuOpen(false)}
              className={navLink}
            >
              Brands
            </Link>

            <button
              type="button"
              onMouseEnter={openMegaMenu}
              onClick={() => (isMegaMenuOpen ? closeMegaMenuNow() : openMegaMenu())}
              aria-expanded={isMegaMenuOpen}
              className={navLink}
            >
              Shop
            </button>

            <Link
              href="/blogs"
              onMouseEnter={() => {
                setIsBrandsMenuOpen(false);
                closeMegaMenuNow();
              }}
              className={navLink}
            >
              Blogs
            </Link>

            <Link
              href="/contact"
              onMouseEnter={() => {
                setIsBrandsMenuOpen(false);
                closeMegaMenuNow();
              }}
              className={navLink}
            >
              Contact
            </Link>
          </nav>

          {/* Shop mega menu — always the white maison panel */}
          <AnimatePresence>
            {isMegaMenuOpen && (
              <motion.div
                variants={megaMenuContainerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onMouseEnter={openMegaMenu}
                onMouseLeave={closeMegaMenuSoon}
                className="absolute top-full left-0 w-full z-50 bg-white text-black font-body border-t border-b"
                style={{ borderColor: HAIRLINE }}
              >
                {renderMegaMenuContent()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Brands dropdown — always the white maison panel */}
          <BrandsDropdown
            isOpen={isBrandsMenuOpen}
            onClose={() => setIsBrandsMenuOpen(false)}
            onMouseEnter={handleBrandsMouseEnter}
            onMouseLeave={handleBrandsMouseLeave}
            brands={brandCollections}
          />
        </div>
      </>
    );
  };

  // The pending notification was read during state init above; clear it here so
  // it is shown exactly once.
  useEffect(() => {
    localStorage.removeItem("authNotification");
  }, []);

  // Fetch wishlist when user email is loaded / changed
  useEffect(() => {
    const loadWishlist = async () => {
      if (!userEmail) {
        setFavorites([]);
        setBuyLater([]);
        return;
      }
      try {
        const { data, error } = await clientSafeSupabase
          .from("wishlists")
          .select("*");

        if (data && !error) {
          const userId = localStorage.getItem("userId") || "";
          const userWishlist = (data as DbWishlistRow[]).filter((item) => item.customer_id === userId);

          const favs = userWishlist.filter((item) => item.wishlist_type === "favorite").map((item) => item.product_id);
          const laters = userWishlist.filter((item) => item.wishlist_type === "buy_later").map((item) => item.product_id);
          setFavorites(favs);
          setBuyLater(laters);
        }
      } catch (err) {
        console.error("Error loading wishlist:", err);
      }
    };
    loadWishlist();
  }, [userEmail]);

  // Fetch products, collections, and mappings from Supabase on component mount
  useEffect(() => {
    const fetchDbData = async () => {
      try {
        const { data: dbProducts, error: pErr } = await clientSafeSupabase
          .from("products")
          .select("*");

        const { data: dbCollections, error: cErr } = await clientSafeSupabase
          .from("collections")
          .select("*");

        const { data: dbMappings, error: mErr } = await clientSafeSupabase
          .from("product_collections")
          .select("*");

        if (dbProducts && !pErr) {
          const mapped = (dbProducts as DbProductRow[]).map((dbProd) => {
            let gender = "unisex";
            if (dbProd.tags) {
              if (dbProd.tags.includes("men") || dbProd.tags.includes("man") || dbProd.tags.includes("for men")) {
                gender = "men";
              } else if (dbProd.tags.includes("women") || dbProd.tags.includes("woman") || dbProd.tags.includes("for women")) {
                gender = "women";
              }
            }
            return {
              id: dbProd.id,
              brand: dbProd.brand,
              name: dbProd.name,
              price: String(dbProd.price),
              sizes: dbProd.sizes || ["50ml", "100ml"],
              // No stand-in bottle — a row without art renders a plain grey block.
              image: dbProd.image_url || "",
              images: dbProd.image_urls || (dbProd.image_url ? [dbProd.image_url] : []),
              isNew: dbProd.is_new,
              isBestSeller: dbProd.is_bestseller,
              isFeaturedLarge: dbProd.is_featured_large,
              description: dbProd.description ?? undefined,
              olfactory: dbProd.olfactory_group || "Woody & Oud",
              gender: gender
            };
          });
          setProductsList(mapped);
        }

        if (dbCollections && !cErr) {
          const collectionRows = dbCollections as DbCollectionRow[];
          // Brand and line collections live on their own pages, so they stay out of the
          // in-page collection filter list. Everything else comes through exactly as
          // the database has it — the standard ids only borrow house copy for their label.
          const rank = (id: string) => {
            const index = STANDARD_COLLECTION_ORDER.indexOf(id);
            return index === -1 ? STANDARD_COLLECTION_ORDER.length : index;
          };
          const mappedCollections: CollectionEntry[] = collectionRows
            .filter((c) => c.kind !== "brand" && c.kind !== "line")
            .slice()
            .sort(
              (a, b) => rank(a.id) - rank(b.id) || (a.sort_order || 0) - (b.sort_order || 0)
            )
            .map((c) => {
              const label = STANDARD_COLLECTION_LABELS[c.id];
              return {
                id: c.id,
                title: label?.title || c.title,
                desc: label?.desc || c.description || "Exclusive Scent Curation"
              };
            });
          setCollectionsList(mappedCollections);

          setBrandCollections(
            collectionRows
              .filter((c) => c.kind === "brand")
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          );
        }

        if (dbMappings && !mErr) {
          setProductCollectionsList(dbMappings);
        }
      } catch (err) {
        console.error("Error loading products/collections from Supabase:", err);
      } finally {
        // Settled either way — a failed fetch shows the empty state, never mock data.
        setIsLoadingProducts(false);
      }
    };
    fetchDbData();
  }, []);

  const isFiltered = searchTerm.trim() !== "" || selectedOlfactory !== null || selectedBrand !== null || selectedCollection !== null || selectedGender !== null;

  // Search suggestions are derived straight from the query and the catalogue —
  // no state to keep in sync.
  const searchSuggestions = useMemo(() => {
    if (searchTerm.trim() === "") return [];
    const searchLower = searchTerm.toLowerCase();
    return productsList
      .filter(prod =>
        prod.brand.toLowerCase().includes(searchLower) ||
        prod.name.toLowerCase().includes(searchLower)
      )
      .slice(0, 4);
  }, [searchTerm, productsList]);

  // Newsletter subscription states
  const [subscribedEmail, setSubscribedEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const toggleFavorite = async (id: number) => {
    if (!userEmail) {
      router.push("/signin");
      return;
    }

    const isAdding = !favorites.includes(id);
    const userId = localStorage.getItem("userId") || "";
    const prod = productsList.find(p => p.id === id);

    if (isAdding) {
      const { error } = await clientSafeSupabase
        .from("wishlists")
        .insert({
          customer_id: userId,
          product_id: id,
          wishlist_type: "favorite"
        });

      if (!error) {
        setFavorites(prev => [...prev, id]);
        if (prod) {
          triggerNotification(`Added ${prod.brand} - ${prod.name} to your Favorites.`);
        }
      }
    } else {
      const { error } = await clientSafeSupabase
        .from("wishlists")
        .delete()
        .match({
          customer_id: userId,
          product_id: id,
          wishlist_type: "favorite"
        });

      if (!error) {
        setFavorites(prev => prev.filter(favId => favId !== id));
        if (prod) {
          triggerNotification(`Removed ${prod.brand} - ${prod.name} from your Favorites.`);
        }
      }
    }
  };

  const toggleBuyLater = async (id: number) => {
    if (!userEmail) {
      router.push("/signin");
      return;
    }

    const isAdding = !buyLater.includes(id);
    const userId = localStorage.getItem("userId") || "";
    const prod = productsList.find(p => p.id === id);

    if (isAdding) {
      const { error } = await clientSafeSupabase
        .from("wishlists")
        .insert({
          customer_id: userId,
          product_id: id,
          wishlist_type: "buy_later"
        });

      if (!error) {
        setBuyLater(prev => [...prev, id]);
        if (prod) {
          triggerNotification(`Added ${prod.brand} - ${prod.name} to Save to Buy Later.`);
        }
      }
    } else {
      const { error } = await clientSafeSupabase
        .from("wishlists")
        .delete()
        .match({
          customer_id: userId,
          product_id: id,
          wishlist_type: "buy_later"
        });

      if (!error) {
        setBuyLater(prev => prev.filter(laterId => laterId !== id));
        if (prod) {
          triggerNotification(`Removed ${prod.brand} - ${prod.name} from Save to Buy Later.`);
        }
      }
    }
  };

  const selectSize = (productId: number, size: string) => {
    setSelectedSizes(prev => ({
      ...prev,
      [productId]: size
    }));
  };

  const handleAddToCart = (productId: number) => {
    const prod = productsList.find(p => p.id === productId);
    if (!prod) return;
    const size = selectedSizes[productId] ?? prod.sizes[0];

    setCartItems(prev => {
      const existingIndex = prev.findIndex(
        item => item.product.id === productId && item.selectedSize === size
      );
      if (existingIndex > -1) {
        const newItems = [...prev];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + 1
        };
        return newItems;
      } else {
        return [...prev, { product: prod, quantity: 1, selectedSize: size }];
      }
    });

    triggerNotification(`Added 1x ${prod.brand} (${size}) to your Selection.`);
    setIsCartOpen(true); // Automatically open slide-in cart preview drawer!
  };

  const handleUpdateQuantity = (productId: number, size: string, delta: number) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.product.id === productId && item.selectedSize === size) {
          const newQty = item.quantity + delta;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const handleRemoveItem = (productId: number, size: string) => {
    setCartItems(prev => prev.filter(item => !(item.product.id === productId && item.selectedSize === size)));
  };


  const triggerNotification = (message: string) => {
    setShowNotification(message);
    setTimeout(() => {
      setShowNotification(null);
    }, 3500);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasVisited = localStorage.getItem("gharib_has_visited");
      if (!hasVisited) {
        setShowIntro(true);
        // 1. Preloader runs for 3.2 seconds on first visit
        const introTimer = setTimeout(() => {
          setShowIntro(false);
          try {
            localStorage.setItem("gharib_has_visited", "true");
          } catch (_) { }

          // 2. Reveal interface smoothly
          const interfaceTimer = setTimeout(() => {
            setRevealInterface(true);
          }, 1200);

          return () => clearTimeout(interfaceTimer);
        }, 3200);

        return () => clearTimeout(introTimer);
      } else {
        // Return visits: skip preloader completely and reveal interface immediately
        setShowIntro(false);
        setRevealInterface(true);
      }
    }
  }, []);

  // Scroll detection for sticky light-theme navbar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* Fragrances shown in the BEST SELLER marquee that closes the hero fold.
     Bestsellers first, topped up with the rest of the catalogue, capped at 8. */
  const marqueeProducts = useMemo(() => {
    const best = productsList.filter((p) => p.isBestSeller);
    return (
      best.length >= 4 ? best : [...best, ...productsList.filter((p) => !p.isBestSeller)]
    ).slice(0, 8);
  }, [productsList]);

  return (
    <div className="relative min-h-screen w-full bg-[#070200] text-white flex flex-col overflow-x-hidden overflow-y-auto font-sans-luxury scroll-smooth">

      {/* Mobile Luxury Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 bg-white text-black font-body flex flex-col"
          >
            {/* Header / Close Row */}
            <div
              className="flex items-center justify-between h-[62px] px-5 border-b flex-shrink-0"
              style={{ borderColor: HAIRLINE }}
            >
              <Image
                src="/logo.png"
                alt="Gharib"
                width={150}
                height={38}
                className="h-8 w-auto object-contain"
                style={{ mixBlendMode: "multiply" }}
              />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-black transition-opacity duration-300 hover:opacity-60 cursor-pointer"
              >
                <X className="w-[20px] h-[20px]" strokeWidth={1.25} />
              </button>
            </div>

            {/* Menu Links scroll area */}
            <div className="flex-grow overflow-y-auto px-5 pb-16">
              {/* Main Links */}
              <ul>
                <li className="border-b" style={{ borderColor: HAIRLINE }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedOlfactory(null);
                      setSelectedBrand(null);
                      setSelectedCollection(null);
                      setIsMobileMenuOpen(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="block w-full text-left py-5 font-display text-[18px] uppercase tracking-[0.08em] text-black cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li className="border-b" style={{ borderColor: HAIRLINE }}>
                  <Link
                    href="/collections"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-5 font-display text-[18px] uppercase tracking-[0.08em] text-black"
                  >
                    Brands
                  </Link>
                </li>
                <li className="border-b" style={{ borderColor: HAIRLINE }}>
                  <Link
                    href="/shop"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-5 font-display text-[18px] uppercase tracking-[0.08em] text-black"
                  >
                    Shop
                  </Link>
                </li>
                <li className="border-b" style={{ borderColor: HAIRLINE }}>
                  <Link
                    href="/blogs"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-5 font-display text-[18px] uppercase tracking-[0.08em] text-black"
                  >
                    Blogs
                  </Link>
                </li>
                <li className="border-b" style={{ borderColor: HAIRLINE }}>
                  <Link
                    href="/contact"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-5 font-display text-[18px] uppercase tracking-[0.08em] text-black"
                  >
                    Contact
                  </Link>
                </li>
                <li className="border-b" style={{ borderColor: HAIRLINE }}>
                  <Link
                    href="/wishlist"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-5 font-display text-[18px] uppercase tracking-[0.08em] text-black"
                  >
                    Wishlist
                  </Link>
                </li>
              </ul>

              {/* Brand Collections — each opens its own house page */}
              {brandCollections.length > 0 && (
                <>
                  <p className="maison-eyebrow mt-10 mb-3">Maisons</p>
                  <ul>
                    {brandCollections.map((brand) => (
                      <li key={brand.id}>
                        <Link
                          href={`/collection/${brand.id}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={MEGA_LINK_CLASS}
                        >
                          {toTitleCase(brand.title)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Collections */}
              <p className="maison-eyebrow mt-10 mb-3">Collections</p>
              <ul>
                {collectionsList.map((col) => (
                  <li key={col.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        router.push(`/shop?collection=${encodeURIComponent(col.id)}`);
                      }}
                      className={MEGA_LINK_CLASS}
                    >
                      {col.title}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setIsMobileMenuOpen(false);
                      router.push("/shop");
                    }}
                    className={MEGA_LINK_CLASS}
                  >
                    All fragrances
                  </button>
                </li>
              </ul>

              {/* Olfactive families */}
              <p className="maison-eyebrow mt-10 mb-3">Olfactive families</p>
              <ul>
                {["Woody & Oud", "Amber & Oriental", "Floral & Sweet", "Fresh & Aquatic"].map((note) => (
                  <li key={note}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        router.push(`/shop?olfactory=${encodeURIComponent(note)}`);
                      }}
                      className={MEGA_LINK_CLASS}
                    >
                      {note}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Account */}
              <p className="maison-eyebrow mt-10 mb-3">Account</p>
              <ul>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      router.push(userEmail ? "/customer/dashboard" : "/signin");
                    }}
                    className={MEGA_LINK_CLASS}
                  >
                    {userEmail ? "My account" : "Sign in"}
                  </button>
                </li>
              </ul>

              {/* Footer / Maison signature */}
              <div className="border-t mt-10 pt-6" style={{ borderColor: HAIRLINE }}>
                <p className="maison-eyebrow">Gharib Atelier</p>
                <p className="mt-2 text-[13px] font-light text-[#646464]">
                  Artisanal olfactory creations — Dubai, UAE
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Sticky Light-Theme Navbar */}
      <AnimatePresence>
        {isScrolled && (
          <motion.header
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 left-0 right-0 z-40 bg-white text-black font-body border-b"
            style={{ borderColor: HAIRLINE }}
          >
            {renderHeaderRows("light")}
          </motion.header>
        )}
      </AnimatePresence>

      {/* Premium Cinematic Preloader */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="preloader"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              y: "-100%",
              transition: { duration: 1.2, ease: [0.85, 0, 0.15, 1] }
            }}
            className="fixed inset-0 z-50 overflow-hidden"
          >
            <PreloaderMistReveal />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Hero Full Screen Fold */}
      <div className="relative h-screen min-h-screen w-full flex flex-col justify-between flex-shrink-0 overflow-hidden font-sans-luxury hero-fold-backdrop">
        {/* Background Video Wrapper */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
          {/* Luxury dark veil layer */}
          <div className="absolute inset-0 bg-black/55 z-10 pointer-events-none"></div>
          {/* Luxury subtle ambient golden vignette */}
          <div className="absolute inset-0 bg-radial from-transparent via-[#1c0901]/40 to-[#0c0400]/95 z-10 pointer-events-none"></div>
          <video
            autoPlay
            muted
            playsInline
            loop
            preload="auto"
            poster="/Perfume_bottles_floating_luxury_poster.jpg"
            className="w-full h-full object-cover scale-105 relative z-0"
          >
            <source src="/Perfume_bottles_floating_luxury_optimized.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Visual Isolation Backdrop Dimmer */}
        <AnimatePresence>
          {(isMegaMenuOpen || isBrandsMenuOpen) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              onClick={() => {
                setIsMegaMenuOpen(false);
                setIsBrandsMenuOpen(false);
              }}
              onMouseEnter={() => {
                setIsMegaMenuOpen(false);
                setIsBrandsMenuOpen(false);
              }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 pointer-events-auto"
            />
          )}
        </AnimatePresence>

        {/* 1. Header / Navigation */}
        <motion.header
          initial={{ y: -30, opacity: 0 }}
          animate={revealInterface ? { y: 0, opacity: 1 } : { y: -30, opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full z-30 relative bg-transparent text-white font-body border-b"
          style={{ borderColor: "rgba(255,255,255,0.18)" }}
        >
          {renderHeaderRows("dark")}
        </motion.header>

        {/* 2. Main Hero Section */}
        <main className="flex-grow max-w-[1440px] mx-auto w-full px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-0 items-center py-4 lg:py-0 relative z-10 overflow-hidden">
          {/* Left Panel: Headline */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={revealInterface ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="lg:col-span-5 flex flex-col justify-end h-full py-4 lg:py-12"
          >
            <div className="mb-6 lg:mb-16 w-full">
              <h1 className="text-4xl md:text-5xl lg:text-[56px] font-medium leading-[1.1] tracking-tight font-serif-luxury max-w-md">
                World-Class Luxury<br />
                Perfume Collective <br />
                Gharib
              </h1>
              <p className="mt-3 text-xs tracking-[0.15em] text-white/50 font-sans-luxury">
                {HERO_TAGLINE.toUpperCase()}
              </p>
            </div>
          </motion.div>

          {/* Remaining columns intentionally left empty so the background video breathes */}
          <div className="lg:col-span-7 pointer-events-none hidden lg:block"></div>
        </main>



        {/* 3. Bottom Grid / Catalog Footer */}
        <footer className="w-full border-t border-white/10 z-25 relative backdrop-blur-sm overflow-hidden">
          <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
            {/* Box 1: Best Seller Header - FIXED */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={revealInterface ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
              className="p-4 md:p-5 flex flex-col items-center justify-center min-h-[110px] bg-transparent w-full md:w-[220px] flex-shrink-0 z-30 text-center border-r border-white/10"
            >
              <span className="text-[13px] md:text-[15px] tracking-[0.25em] font-black text-white uppercase font-sans-luxury whitespace-nowrap select-none">
                BEST SELLER
              </span>
            </motion.div>

            {/* Scrolling Track Container */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={revealInterface ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
              className="w-full md:flex-grow overflow-hidden flex items-center relative min-h-[110px] bg-transparent"
            >
              {marqueeProducts.length > 0 && (
                <div className="animate-marquee-track flex divide-x divide-white/10">
                  {/* Loop 1 / 2 / 3 — duplicated so the marquee seams continuously */}
                  {["loop1", "loop2", "loop3"].map((loop) => (
                    <React.Fragment key={loop}>
                      {marqueeProducts.map((prod) => {
                        const marqueeName = prod.name.replace(/_/g, " ");
                        return (
                          <Link
                            key={`${loop}-${prod.id}`}
                            href={`/product/${prod.id}`}
                            className="p-4 md:p-5 lg:p-6 flex items-center justify-between gap-6 cursor-pointer transition-all-custom group min-h-[110px] w-[260px] md:w-[320px] flex-shrink-0 hover:bg-white/[0.02]"
                          >
                            {/* Left product detail */}
                            <div className="flex flex-col justify-between h-full min-h-[75px] max-w-[70%]">
                              <div>
                                <span className="text-[14px] font-serif-luxury font-medium block">
                                  {formatCurrency(parseFloat(prod.price.replace("$", "")) || 0)}
                                </span>
                                <span className="text-[10px] font-semibold tracking-[0.15em] text-white/90 uppercase mt-0.5 block">
                                  {marqueeName}
                                </span>
                              </div>
                              <p className="text-[10px] leading-relaxed text-white/45 tracking-wider line-clamp-1 mt-1 group-hover:text-white/60 transition-colors duration-300">
                                {prod.description || prod.olfactory || prod.brand}
                              </p>
                            </div>

                            {/* Right product bottle thumbnail */}
                            <div className="w-12 h-16 md:w-14 md:h-18 lg:w-16 lg:h-20 relative flex-shrink-0 flex items-center justify-center">
                              <div className="absolute inset-0 bg-white/2 blur-lg rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                              {prod.image && (
                                <Image
                                  src={prod.image}
                                  alt={marqueeName}
                                  fill
                                  className="object-contain transition-all duration-500 scale-90 group-hover:scale-100 group-hover:rotate-3 drop-shadow-[0_6px_12px_rgba(0,0,0,0.4)]"
                                />
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </footer>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          1. FEATURED PRODUCTS  (#new-in)
          Centered serif title → text tabs → 4-across catalogue grid.
          Also hosts the live search / filter result set.
          ══════════════════════════════════════════════════════════════ */}
      <section id="new-in" className="maison maison-section w-full border-t" style={{ borderColor: HAIRLINE }}>
        <div className="maison-container">
          {isFiltered ? (
            <div className="min-h-[400px]">
              <div className="text-center">
                <p className="maison-eyebrow">Selection</p>
                <h2 className="maison-page-title mt-4">
                  {selectedCollection ? `${selectedCollection} collection` : "Filtered fragrances"}
                </h2>
              </div>

              <div
                className="mt-10 flex flex-col gap-5 border-b border-t py-4 md:flex-row md:items-center md:justify-between"
                style={{ borderColor: HAIRLINE }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {searchTerm.trim() !== "" && (
                    <span
                      className="inline-flex items-center gap-2 border px-3 py-1.5 text-[12px] uppercase tracking-[0.1em] text-black"
                      style={{ borderColor: HAIRLINE }}
                    >
                      Search: &ldquo;{searchTerm}&rdquo;
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        aria-label="Clear search filter"
                        className="cursor-pointer text-[#646464] transition-colors duration-300 hover:text-black"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedOlfactory && (
                    <span
                      className="inline-flex items-center gap-2 border px-3 py-1.5 text-[12px] uppercase tracking-[0.1em] text-black"
                      style={{ borderColor: HAIRLINE }}
                    >
                      Family: {selectedOlfactory}
                      <button
                        type="button"
                        onClick={() => setSelectedOlfactory(null)}
                        aria-label="Clear olfactive family filter"
                        className="cursor-pointer text-[#646464] transition-colors duration-300 hover:text-black"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedBrand && (
                    <span
                      className="inline-flex items-center gap-2 border px-3 py-1.5 text-[12px] uppercase tracking-[0.1em] text-black"
                      style={{ borderColor: HAIRLINE }}
                    >
                      Maison: {selectedBrand}
                      <button
                        type="button"
                        onClick={() => setSelectedBrand(null)}
                        aria-label="Clear maison filter"
                        className="cursor-pointer text-[#646464] transition-colors duration-300 hover:text-black"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedCollection && (
                    <span
                      className="inline-flex items-center gap-2 border px-3 py-1.5 text-[12px] uppercase tracking-[0.1em] text-black"
                      style={{ borderColor: HAIRLINE }}
                    >
                      Collection: {selectedCollection}
                      <button
                        type="button"
                        onClick={() => setSelectedCollection(null)}
                        aria-label="Clear collection filter"
                        className="cursor-pointer text-[#646464] transition-colors duration-300 hover:text-black"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {selectedGender && (
                    <span
                      className="inline-flex items-center gap-2 border px-3 py-1.5 text-[12px] uppercase tracking-[0.1em] text-black"
                      style={{ borderColor: HAIRLINE }}
                    >
                      For: {selectedGender === "unisex" ? "unisex" : selectedGender}
                      <button
                        type="button"
                        onClick={() => setSelectedGender(null)}
                        aria-label="Clear gender filter"
                        className="cursor-pointer text-[#646464] transition-colors duration-300 hover:text-black"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedOlfactory(null);
                    setSelectedBrand(null);
                    setSelectedCollection(null);
                    setSelectedGender(null);
                  }}
                  className="maison-link cursor-pointer self-start md:self-auto"
                >
                  Reset all filters
                </button>
              </div>

              {(() => {
                let matched = productsList;

                // Apply Search Term Filter
                if (searchTerm.trim() !== "") {
                  const searchLower = searchTerm.toLowerCase();
                  matched = matched.filter(prod =>
                    prod.brand.toLowerCase().includes(searchLower) ||
                    prod.name.toLowerCase().includes(searchLower)
                  );
                }

                // Apply Olfactory Family Filter
                if (selectedOlfactory) {
                  matched = matched.filter(prod => prod.olfactory === selectedOlfactory);
                }

                // Apply Brand Filter
                if (selectedBrand) {
                  matched = matched.filter(prod => prod.brand.toUpperCase() === selectedBrand.toUpperCase());
                }

                // Apply Gender Filter
                if (selectedGender) {
                  matched = matched.filter(prod => prod.gender === selectedGender || prod.gender === "unisex");
                }

                // Apply Collection Filter
                if (selectedCollection) {
                  if (selectedCollection === "new") {
                    matched = matched.filter(prod => prod.isNew);
                  } else if (selectedCollection === "bestsellers") {
                    matched = matched.filter(prod => prod.isBestSeller);
                  } else if (selectedCollection === "favorites") {
                    matched = matched.filter(prod => favorites.includes(prod.id));
                  } else if (selectedCollection === "offers" || selectedCollection === "trending") {
                    matched = matched.filter(prod => prod.isBestSeller || prod.isNew);
                  } else {
                    // Custom manual database collection
                    const allowedIds = productCollectionsList
                      .filter((pc) => pc.collection_id === selectedCollection)
                      .map((pc) => pc.product_id);
                    matched = matched.filter(prod => allowedIds.includes(prod.id));
                  }
                }

                if (isLoadingProducts) {
                  return <ProductGridPlaceholder />;
                }

                if (matched.length === 0) {
                  return (
                    <div className="py-24 text-center">
                      <h3 className="font-display text-[18px] uppercase tracking-[0.1em] text-black">
                        No fragrances found
                      </h3>
                      <p className="mx-auto mt-4 max-w-[46ch] text-[15px] font-light leading-[1.7] text-black/70">
                        Nothing in the catalogue matches the filters you have applied. Reset them to
                        browse the full house.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-14 md:grid-cols-3 lg:grid-cols-4">
                    {matched.map(prod => {
                      const isFav = favorites.includes(prod.id);
                      const isBuyLater = buyLater.includes(prod.id);
                      const activeSize = selectedSizes[prod.id] ?? prod.sizes[0];
                      return (
                        <ProductCard
                          key={prod.id}
                          prod={prod}
                          isFav={isFav}
                          isBuyLater={isBuyLater}
                          isLoggedIn={!!userEmail}
                          activeSize={activeSize}
                          onToggleFavorite={toggleFavorite}
                          onToggleBuyLater={toggleBuyLater}
                          onSelectSize={selectSize}
                          onAddToCart={handleAddToCart}
                          badgeText={prod.isFeaturedLarge ? "Featured" : prod.isNew ? "New" : undefined}
                          formatCurrency={formatCurrency}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            (() => {
              const activeTab = activeCatalogTab === "all" ? "new" : activeCatalogTab;
              const tabs: { id: "new" | "bestsellers" | "favorites"; label: string }[] = [
                { id: "new", label: "New in" },
                { id: "bestsellers", label: "Best sellers" },
                { id: "favorites", label: "Exclusive offers" },
              ];

              const tabProducts =
                activeTab === "new"
                  ? productsList.filter(p => p.isNew)
                  : activeTab === "bestsellers"
                    ? productsList.filter(p => p.isBestSeller)
                    : productsList.filter(p => favorites.includes(p.id));

              const badgeFor = (prod: CatalogProduct) =>
                activeTab === "new" ? "New in" : activeTab === "bestsellers" ? "Best seller" : prod.isNew ? "New" : undefined;

              return (
                <>
                  <h2 className="maison-section-title text-center">Featured fragrances</h2>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                    {tabs.map(tab => {
                      const isActiveTab = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveCatalogTab(tab.id)}
                          aria-pressed={isActiveTab}
                          className={`cursor-pointer border-b pb-1.5 font-body text-[12px] font-semibold uppercase leading-none tracking-[0.21em] transition-colors duration-300 ${isActiveTab ? "border-black text-black" : "border-transparent text-[#646464] hover:text-black"
                            }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {isLoadingProducts ? (
                    <ProductGridPlaceholder />
                  ) : activeTab === "favorites" && !userEmail ? (
                    <div className="mt-14 border-b border-t py-20 text-center" style={{ borderColor: HAIRLINE }}>
                      <h3 className="font-display text-[18px] uppercase tracking-[0.1em] text-black">
                        Scent vault access required
                      </h3>
                      <p className="mx-auto mt-4 max-w-[46ch] text-[15px] font-light leading-[1.7] text-black/70">
                        Sign in to open your scent vault and see the offers reserved for you.
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push("/signin?redirect=/")}
                        className="maison-btn mt-8 h-12"
                      >
                        Sign in
                      </button>
                    </div>
                  ) : tabProducts.length === 0 ? (
                    <div className="mt-14 border-b border-t py-20 text-center" style={{ borderColor: HAIRLINE }}>
                      <h3 className="font-display text-[18px] uppercase tracking-[0.1em] text-black">
                        {activeTab === "favorites" ? "Your vault is empty" : "Nothing here yet"}
                      </h3>
                      <p className="mx-auto mt-4 max-w-[46ch] text-[15px] font-light leading-[1.7] text-black/70">
                        {activeTab === "favorites"
                          ? "Mark any fragrance with the bookmark on its card and it will be kept here."
                          : "This edit is being restocked. Browse the full house in the meantime."}
                      </p>
                      <Link href="/shop" className="maison-link mt-8">
                        Browse the house
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-14 md:grid-cols-3 lg:grid-cols-4">
                      {tabProducts.map(prod => {
                        const isFav = favorites.includes(prod.id);
                        const isBuyLater = buyLater.includes(prod.id);
                        const activeSize = selectedSizes[prod.id] ?? prod.sizes[0];
                        return (
                          <ProductCard
                            key={prod.id}
                            prod={prod}
                            isFav={isFav}
                            isBuyLater={isBuyLater}
                            isLoggedIn={!!userEmail}
                            activeSize={activeSize}
                            onToggleFavorite={toggleFavorite}
                            onToggleBuyLater={toggleBuyLater}
                            onSelectSize={selectSize}
                            onAddToCart={handleAddToCart}
                            badgeText={badgeFor(prod)}
                            formatCurrency={formatCurrency}
                          />
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-16 text-center">
                    <Link href="/shop" className="maison-link">
                      View all
                    </Link>
                  </div>
                </>
              );
            })()
          )}
        </div>
      </section>

      {!isFiltered && (
        <>
          {/* ══════════════════════════════════════════════════════════════
              2. FULL-BLEED CAMPAIGN FILM  (#promotions)
              Sits directly under the featured fragrances. A silent, looping
              band with no overlay copy and no scrim — the film carries the
              moment on its own.
              ══════════════════════════════════════════════════════════════ */}
          <section id="promotions" className="maison w-full border-t" style={{ borderColor: HAIRLINE }}>
            <div className="relative h-[520px] w-full overflow-hidden bg-[#F5F5F5] md:h-[720px]">
              <video
                autoPlay
                muted
                playsInline
                loop
                preload="metadata"
                poster="/Perfume_bottle_on_ice_poster.jpg"
                aria-label="Hawas Ice"
                className="absolute inset-0 h-full w-full object-cover"
              >
                <source src="/Perfume_bottle_on_ice_optimized.mp4" type="video/mp4" />
              </video>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              3. CATEGORY TILES  (#atelier-curations)
              ══════════════════════════════════════════════════════════════ */}
          <section
            id="atelier-curations"
            className="maison maison-section w-full border-t"
            style={{ borderColor: HAIRLINE }}
          >
            <div className="maison-container">
              <h2 className="maison-section-title text-center">The curations</h2>

              <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-14 lg:grid-cols-4">
                {[
                  { label: "For her", image: "/women-perfume-v2.jpg", href: "/shop?gender=women", contain: false },
                  { label: "For him", image: "/men-perfume-v2.jpg", href: "/shop?gender=men", contain: false },
                  { label: "Gift sets", image: "/bento-vanilla-box.png", href: "/shop?collection=bestsellers", contain: false },
                  { label: "Discovery sets", image: "/unisex-perfume.jpg", href: "/shop?gender=unisex", contain: false },
                ].map(tile => (
                  <Link key={tile.label} href={tile.href} className="group block cursor-pointer text-center">
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F5F5F5]">
                      <Image
                        src={tile.image}
                        alt={tile.label}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
                        className={`${tile.contain ? "object-contain p-6" : "object-cover"
                          } transition-transform duration-700 ease-out group-hover:scale-[1.04]`}
                      />
                    </div>
                    <h3 className="maison-card-title mt-6">{tile.label}</h3>
                    <span className="maison-link mt-4">Discover</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              4. SPLIT 50/50 EDITORIAL — image left, text right  (#offers)
              ══════════════════════════════════════════════════════════════ */}
          <section id="offers" className="maison w-full border-t" style={{ borderColor: HAIRLINE }}>
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="relative aspect-[4/3] w-full bg-[#F5F5F5] lg:aspect-auto lg:min-h-[560px]">
                <Image
                  src="/campaign-red-black.png"
                  alt="The season privileges"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex items-center px-5 py-16 md:px-16 md:py-20"
              >
                <div className="max-w-[46ch]">
                  <p className="maison-eyebrow">Exclusive offers</p>
                  <h2 className="mt-5 font-display text-[22px] uppercase leading-[1.25] tracking-[0.1em] text-black md:text-[28px]">
                    The privileges of the season
                  </h2>
                  <p className="mt-6 text-[15px] font-light leading-[1.75] text-black/75">
                    Twenty per cent on the private duo, a complimentary second bottle across the
                    gifting sets, and the archive vault opened at up to half its original price while
                    stock remains. Every order leaves the Dubai atelier with two discovery samples,
                    chosen to sit alongside the fragrance you have picked.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCatalogTab("favorites");
                      const el = document.getElementById("new-in");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="maison-link mt-8 cursor-pointer"
                  >
                    View the offers
                  </button>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              5. BEST SELLERS  (#best-sellers)
              ══════════════════════════════════════════════════════════════ */}
          <section
            id="best-sellers"
            className="maison maison-section w-full border-t"
            style={{ borderColor: HAIRLINE }}
          >
            <div className="maison-container">
              <h2 className="maison-section-title text-center">Best sellers</h2>
              <p className="maison-eyebrow mt-5 text-center">The most desired signatures</p>

              {(() => {
                if (isLoadingProducts) {
                  return <ProductGridPlaceholder count={4} />;
                }

                const bestSellers = productsList.filter(p => p.isBestSeller);

                if (bestSellers.length === 0) {
                  return (
                    <div className="mt-14 border-b border-t py-20 text-center" style={{ borderColor: HAIRLINE }}>
                      <h3 className="font-display text-[18px] uppercase tracking-[0.1em] text-black">
                        Nothing here yet
                      </h3>
                      <p className="mx-auto mt-4 max-w-[46ch] text-[15px] font-light leading-[1.7] text-black/70">
                        This edit is being restocked. Browse the full house in the meantime.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-14 md:grid-cols-3 lg:grid-cols-4">
                    {bestSellers.map(prod => {
                      const isFav = favorites.includes(prod.id);
                      const isBuyLater = buyLater.includes(prod.id);
                      const activeSize = selectedSizes[prod.id] ?? prod.sizes[0];
                      return (
                        <ProductCard
                          key={prod.id}
                          prod={prod}
                          isFav={isFav}
                          isBuyLater={isBuyLater}
                          isLoggedIn={!!userEmail}
                          activeSize={activeSize}
                          onToggleFavorite={toggleFavorite}
                          onToggleBuyLater={toggleBuyLater}
                          onSelectSize={selectSize}
                          onAddToCart={handleAddToCart}
                          badgeText="Best seller"
                          formatCurrency={formatCurrency}
                        />
                      );
                    })}
                  </div>
                );
              })()}

              <div className="mt-16 text-center">
                <Link href="/shop?collection=bestsellers" className="maison-link">
                  View all
                </Link>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              6. SPLIT 50/50 EDITORIAL — text left, image right  (#about)
              ══════════════════════════════════════════════════════════════ */}
          <section id="about" className="maison w-full border-t" style={{ borderColor: HAIRLINE }}>
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="relative aspect-[4/3] w-full bg-[#F5F5F5] lg:order-2 lg:aspect-auto lg:min-h-[560px]">
                <Image
                  src="/campaign-silver.png"
                  alt="The Dubai atelier"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex items-center px-5 py-16 md:px-16 md:py-20 lg:order-1"
              >
                <div className="max-w-[46ch]">
                  <p className="maison-eyebrow">The house</p>
                  <h2 className="mt-5 font-display text-[22px] uppercase leading-[1.25] tracking-[0.1em] text-black md:text-[28px]">
                    A Dubai maison since 1993
                  </h2>
                  <p className="mt-6 text-[15px] font-light leading-[1.75] text-black/75">
                    Gharib began as a single counter of raw materials in Deira: Cambodian oud,
                    Tunisian orange blossom, Indian sandalwood, weighed out and blended to order.
                    Three decades on the method has not changed. Small batches, long macerations, and
                    decanters finished by hand in the atelier, some wrapped in matte leather, some
                    topped with hammered metal that doubles as sculpture. Nothing is released until it
                    has settled.
                  </p>
                  <Link href="/blogs" className="maison-link mt-8">
                    Read the journal
                  </Link>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              7. PULL-QUOTE
              ══════════════════════════════════════════════════════════════ */}
          <section className="maison w-full" style={{ background: "var(--surface-3)" }}>
            <div className="maison-container maison-section">
              <motion.figure
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="mx-auto max-w-[820px] border-b border-t py-14 text-center"
                style={{ borderColor: HAIRLINE }}
              >
                <blockquote className="font-display text-[20px] italic leading-[1.5] tracking-[0.02em] text-black md:text-[24px]">
                  A fragrance should arrive a moment before you do, and stay a little after you have
                  left the room.
                </blockquote>
                <figcaption className="maison-eyebrow mt-8">The Gharib atelier, Dubai</figcaption>
              </motion.figure>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              8. EXCLUSIVE SERVICES
              ══════════════════════════════════════════════════════════════ */}
          <section className="maison maison-section w-full border-t" style={{ borderColor: HAIRLINE }}>
            <div className="maison-container">
              <div className="grid grid-cols-1 md:grid-cols-3">
                {[
                  {
                    title: "Complimentary delivery",
                    copy: "Express shipping across the UAE at no cost, tracked worldwide dispatch on every order.",
                    icon: (
                      <>
                        <path d="M2 6h12v11H2z" />
                        <path d="M14 10h4.5l3 3.5V17H14z" />
                        <circle cx="6.5" cy="18.5" r="2" />
                        <circle cx="17.5" cy="18.5" r="2" />
                      </>
                    ),
                  },
                  {
                    title: "Authenticity guaranteed",
                    copy: "Every bottle is sourced through official channels and arrives sealed as it left the house.",
                    icon: (
                      <>
                        <path d="M12 2.5 4.5 5.3v5.9c0 4.6 3.2 8.3 7.5 10 4.3-1.7 7.5-5.4 7.5-10V5.3L12 2.5Z" />
                        <path d="m8.6 12.2 2.4 2.4 4.4-4.6" />
                      </>
                    ),
                  },
                  {
                    title: "Gift wrapping",
                    copy: "Hand-wrapped boxes, ribbon and a written card, prepared at no additional charge.",
                    icon: (
                      <>
                        <path d="M3.5 8.5h17V21h-17z" />
                        <path d="M3.5 12.6h17M12 8.5V21" />
                        <path d="M12 8.5S10.7 3.4 8.2 3.4a2.5 2.5 0 0 0 0 5.1H12Z" />
                        <path d="M12 8.5s1.3-5.1 3.8-5.1a2.5 2.5 0 0 1 0 5.1H12Z" />
                      </>
                    ),
                  },
                ].map((service, index) => (
                  <div
                    key={service.title}
                    className={`flex flex-col items-center px-6 py-12 text-center md:py-4 ${index > 0 ? "border-t md:border-l md:border-t-0" : ""
                      }`}
                    style={index > 0 ? { borderColor: HAIRLINE } : undefined}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-black"
                      aria-hidden="true"
                    >
                      {service.icon}
                    </svg>
                    <h3 className="mt-6 font-display text-[18px] uppercase leading-[1.3] tracking-[0.08em] text-black">
                      {service.title}
                    </h3>
                    <p className="mt-3 max-w-[36ch] text-[14px] font-light leading-[1.7] text-black/70">
                      {service.copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </>
      )}

      {/* 4. Maison Footer — design-system.md §5.8 */}
      <footer
        className="relative z-10 w-full bg-white text-black font-body border-t"
        style={{ borderColor: HAIRLINE }}
      >
        {/* ── Newsletter strip ─────────────────────────────────────── */}
        <section className="border-b" style={{ borderColor: HAIRLINE }}>
          <div className="maison-container py-14 md:py-16 text-center">
            <h2 className="font-display text-[18px] md:text-[20px] leading-none tracking-[0.08em] uppercase text-black">
              Join the private circle
            </h2>
            <p className="mt-5 text-[14px] font-light leading-relaxed text-black/75">
              Private archive releases, new arrivals and invitations to our closed sales.
            </p>

            {isSubscribed ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="mt-8 text-[14px] font-light text-black"
              >
                Thank you. You are now part of the private circle.
              </motion.p>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); if (subscribedEmail) setIsSubscribed(true); }}
                className="mt-8 mx-auto flex w-full max-w-[520px] items-stretch gap-4"
              >
                <input
                  type="email"
                  required
                  placeholder="Your email address"
                  value={subscribedEmail}
                  onChange={(e) => setSubscribedEmail(e.target.value)}
                  aria-label="Email address"
                  className="h-12 min-w-0 flex-1 bg-transparent border-b border-[rgba(0,0,0,0.35)] text-[14px] font-light text-black placeholder:text-[#757575] outline-none transition-colors duration-300 focus:border-black"
                />
                <button type="submit" className="maison-btn-outline h-12">
                  Join in
                </button>
              </form>
            )}
          </div>
        </section>

        {/* ── Brand column + link columns ──────────────────────────── */}
        <section className="maison-container py-14 md:py-20">
          <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4 lg:grid-cols-12 lg:gap-x-10">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-4 lg:col-span-4">
              <Link href="/" className="inline-block">
                <Image
                  src="/logo.png"
                  alt="GHARIB Perfumes"
                  width={180}
                  height={55}
                  className="h-10 w-auto object-contain mix-blend-multiply cursor-pointer"
                />
              </Link>
              <p className="maison-body mt-6 max-w-[42ch]">
                Gharib has curated high-art olfactory masterpieces and private perfume
                commissions from Dubai since 1993. Every bottle is filled, sealed and
                inspected by hand in our atelier.
              </p>

              <div className="mt-7 flex items-center gap-6">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  title="Instagram"
                  className="text-black/75 transition-colors duration-300 hover:text-black"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.25" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  title="Facebook"
                  className="text-black/75 transition-colors duration-300 hover:text-black"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.25" viewBox="0 0 24 24">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  title="X"
                  className="text-black/75 transition-colors duration-300 hover:text-black"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  title="YouTube"
                  className="text-black/75 transition-colors duration-300 hover:text-black"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.25" viewBox="0 0 24 24">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                    <path d="M9.75 15.02 15.5 11.75 9.75 8.48v6.54z" />
                  </svg>
                </a>
              </div>

              <p className="mt-7 text-[12px] font-light text-[#757575]">
                Curated globally. Crafted in Dubai.
              </p>
            </div>

            {/* Link columns */}
            {([
              {
                heading: "Boutique",
                links: [
                  { label: "New arrivals", href: "#new-in" },
                  { label: "Bestsellers", href: "#best-sellers" },
                  { label: "Offers", href: "#offers" },
                  { label: "Atelier edit", href: "#atelier-curations" },
                ],
              },
              {
                heading: "The maison",
                links: [
                  { label: "About the maison", href: "#about" },
                  { label: "Journal", href: "/blogs" },
                  { label: "Contact us", href: "/contact" },
                ],
              },
              {
                heading: "Private care",
                links: [
                  { label: "Private consultation" },
                  { label: "Shipping & vaulting" },
                  { label: "Return policy" },
                ],
              },
              {
                heading: "Account & orders",
                links: [
                  {
                    label: "My account",
                    onClick: () => router.push(userEmail ? "/customer/dashboard" : "/signin"),
                  },
                  { label: "Order tracking", href: "/customer/dashboard" },
                  { label: "Admin desk", onClick: () => router.push("/admin") },
                ],
              },
            ] as {
              heading: string;
              links: { label: string; href?: string; onClick?: () => void }[];
            }[]).map((column) => {
              const linkClass =
                "text-[14px] font-[350] text-black/75 transition-colors duration-300 hover:text-black hover:underline hover:underline-offset-[5px] decoration-1";

              return (
                <div key={column.heading} className="lg:col-span-2">
                  <h4 className="mb-6 text-[16px] font-normal tracking-[0.04em] text-black">
                    {column.heading}
                  </h4>
                  <ul className="flex flex-col gap-3.5">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        {link.href ? (
                          <Link href={link.href} className={linkClass}>
                            {link.label}
                          </Link>
                        ) : link.onClick ? (
                          <button
                            type="button"
                            onClick={link.onClick}
                            className={`${linkClass} cursor-pointer text-left`}
                          >
                            {link.label}
                          </button>
                        ) : (
                          <span className={`${linkClass} cursor-pointer`}>{link.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Bottom bar ───────────────────────────────────────────── */}
        <section className="border-t" style={{ borderColor: HAIRLINE }}>
          <div className="maison-container flex flex-wrap items-center justify-between gap-x-10 gap-y-6 py-7 text-[12px] font-light text-[#757575]">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <span>© 2026 Gharib. All rights reserved.</span>

              {/* Currency selector — bare text button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFooterCurrencyOpen(!isFooterCurrencyOpen)}
                  aria-expanded={isFooterCurrencyOpen}
                  aria-haspopup="listbox"
                  className="flex cursor-pointer items-center gap-1.5 text-[12px] font-light text-[#757575] transition-colors duration-300 hover:text-black"
                >
                  <span>Currency</span>
                  <span className="text-black">{activeCurrency}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-300 ${isFooterCurrencyOpen ? "rotate-180" : ""}`}
                    strokeWidth={1.25}
                  />
                </button>

                <AnimatePresence>
                  {isFooterCurrencyOpen && (
                    <motion.ul
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute bottom-full left-0 z-50 mb-3 max-h-72 w-60 overflow-y-auto border bg-white py-1"
                      style={{ borderColor: HAIRLINE }}
                    >
                      {[
                        { code: "AED", name: "UAE Dirham" },
                        { code: "SAR", name: "Saudi Riyal" },
                        { code: "QAR", name: "Qatari Riyal" },
                        { code: "KWD", name: "Kuwaiti Dinar" },
                        { code: "BHD", name: "Bahraini Dinar" },
                        { code: "OMR", name: "Omani Rial" },
                        { code: "USD", name: "US Dollar" },
                        { code: "EUR", name: "Euro" },
                        { code: "GBP", name: "British Pound" },
                        { code: "INR", name: "Indian Rupee" }
                      ].map((curr) => (
                        <li key={curr.code}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCurrency(curr.code);
                              localStorage.setItem("gharib_active_currency", curr.code);
                              setIsFooterCurrencyOpen(false);
                            }}
                            className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-[13px] transition-colors duration-300 hover:bg-[#F5F5F5] hover:text-black ${
                              activeCurrency === curr.code ? "text-black" : "text-black/60"
                            }`}
                          >
                            <span>
                              {curr.code} — {curr.name}
                            </span>
                            {activeCurrency === curr.code && (
                              <span aria-hidden="true" className="text-[11px]">
                                ✓
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex items-center gap-2">
                {["Visa", "Mastercard", "Amex", "Apple Pay"].map((mark) => (
                  <span
                    key={mark}
                    className="flex h-6 items-center border px-2.5 text-[10px] font-normal uppercase tracking-[0.12em] text-[#757575]"
                    style={{ borderColor: HAIRLINE }}
                  >
                    {mark}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <span className="cursor-pointer transition-colors duration-300 hover:text-black">
                  Privacy policy
                </span>
                <span className="cursor-pointer transition-colors duration-300 hover:text-black">
                  Terms of use
                </span>
              </div>
            </div>
          </div>
        </section>
      </footer>

      {/* Notification toast — flat black panel, one-shot fade */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-8 right-8 z-[200] flex max-w-sm items-center justify-between gap-6 bg-black px-6 py-4 text-white font-body"
          >
            <p className="text-[12px] font-normal uppercase tracking-[0.1em] leading-[1.5]">
              {showNotification}
            </p>
            <button
              onClick={() => setShowNotification(null)}
              aria-label="Dismiss notification"
              className="text-white/60 transition-colors duration-300 hover:text-white cursor-pointer"
            >
              <X className="w-[14px] h-[14px]" strokeWidth={1.25} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Cart drawer — design-system.md §5.6 */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/40 z-[100] cursor-pointer"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white border-l z-[101] flex flex-col font-body text-black"
              style={{ borderColor: HAIRLINE }}
            >
              {/* Header */}
              <div
                className="flex items-start justify-between gap-4 px-6 py-6 border-b"
                style={{ borderColor: HAIRLINE }}
              >
                <div className="flex items-baseline gap-3">
                  <h3 className="font-display text-[20px] leading-none tracking-[0.07em] uppercase text-black">
                    Your selection
                  </h3>
                  <span className="text-[12px] font-normal uppercase tracking-[0.1em] text-[#646464]">
                    ({cartCount})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  aria-label="Close cart"
                  className="text-black transition-opacity duration-300 hover:opacity-60 cursor-pointer"
                >
                  <X className="w-[18px] h-[18px]" strokeWidth={1.25} />
                </button>
              </div>

              {/* Line items */}
              <div className="flex-grow overflow-y-auto px-6 flex flex-col">
                {cartItems.length === 0 ? (
                  <div className="flex flex-grow flex-col items-center justify-center gap-8 py-20 text-center">
                    <p className="font-display text-[20px] leading-none tracking-[0.07em] uppercase text-black">
                      Your cart is empty
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(false)}
                      className="maison-btn-outline"
                    >
                      Continue shopping
                    </button>
                  </div>
                ) : (
                  <ul className="flex flex-col">
                    {cartItems.map((item) => {
                      const priceNum = parseFloat(String(item.product.price).replace("$", "")) || 0;
                      const itemTotal = priceNum * item.quantity;

                      return (
                        <li
                          key={`${item.product.id}-${item.selectedSize}`}
                          className="flex gap-5 py-6 border-b last:border-b-0"
                          style={{ borderColor: HAIRLINE }}
                        >
                          {/* Thumb */}
                          <div className="relative w-24 h-24 flex-shrink-0 bg-[#F5F5F5]">
                            {item.product.image && (
                              <Image
                                src={item.product.image}
                                alt={item.product.name}
                                fill
                                sizes="96px"
                                className="object-contain p-2"
                              />
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex min-w-0 flex-grow flex-col">
                            <div className="flex items-start justify-between gap-4">
                              <h4 className="font-display text-[16px] leading-[1.3] tracking-[0.06em] uppercase text-black">
                                {item.product.name}
                              </h4>
                              <span className="maison-price whitespace-nowrap">
                                {formatCurrency(itemTotal)}
                              </span>
                            </div>

                            <p className="mt-2 text-[12px] font-normal uppercase tracking-[0.02em] text-[#646464]">
                              {item.product.brand} — {item.selectedSize}
                            </p>

                            <div className="mt-auto flex items-center justify-between gap-4 pt-5">
                              {/* Bare hairline quantity stepper */}
                              <div
                                className="inline-flex items-center border"
                                style={{ borderColor: HAIRLINE }}
                              >
                                <button
                                  type="button"
                                  aria-label="Decrease quantity"
                                  onClick={() => handleUpdateQuantity(item.product.id, item.selectedSize, -1)}
                                  className="flex h-8 w-8 items-center justify-center text-[14px] font-light text-black transition-colors duration-300 hover:bg-[#F5F5F5] cursor-pointer"
                                >
                                  −
                                </button>
                                <span className="w-8 text-center text-[13px] font-light text-black">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Increase quantity"
                                  onClick={() => handleUpdateQuantity(item.product.id, item.selectedSize, 1)}
                                  className="flex h-8 w-8 items-center justify-center text-[14px] font-light text-black transition-colors duration-300 hover:bg-[#F5F5F5] cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.product.id, item.selectedSize)}
                                className="text-[12px] uppercase tracking-[0.1em] text-[#646464] transition-colors duration-300 hover:text-black cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Footer / totals */}
              {cartItems.length > 0 && (
                <div
                  className="border-t px-6 py-6 flex flex-col gap-5"
                  style={{ borderColor: HAIRLINE }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-light text-black">Subtotal</span>
                    <span className="text-[14px] font-light text-black text-right">
                      {formatCurrency(cartItems.reduce((sum, item) => sum + (parseFloat(String(item.product.price).replace("$", "")) || 0) * item.quantity, 0))}
                    </span>
                  </div>

                  <p className="text-[12px] font-light leading-relaxed text-[#646464]">
                    Complimentary delivery and hand-finished gift wrapping are included with
                    every order. Taxes calculated at checkout.
                  </p>

                  <Link href="/checkout" className="maison-btn w-full">
                    Proceed to checkout
                  </Link>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(false)}
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
    </div>
  );
}


