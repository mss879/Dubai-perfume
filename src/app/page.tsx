"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Product {
  id: number;
  title: string;
  price: string;
  image: string;
  description: string;
  tagline: string;
}

const PRODUCTS: Product[] = [
  {
    id: 1,
    title: "Gold Memoir",
    price: "$203",
    image: "/gold-memoir.png",
    description:
      "Elevate your everyday moments with our luxurious fragrances that transform routine into a sensory journey of pleasure and luxury.",
    tagline: "Aurum Noble Edition",
  },
  {
    id: 2,
    title: "Enchanted Blooms",
    price: "$119",
    image: "/enchanted-blooms.png",
    description:
      "A floral-centric perfume inspired by a magical garden with a delicate bouquet of blooming jasmine, fresh peony, and soft vanilla highlights.",
    tagline: "Aura Floral Collection",
  },
  {
    id: 3,
    title: "Mystic Oud",
    price: "$169",
    image: "/mystic-oud.png",
    description:
      "An oriental fragrance that combines the richness of exotic spices, warm agarwood, and rare dark cardamom for a mysterious, timeless appeal.",
    tagline: "Royal Spice Reserve",
  },
  {
    id: 4,
    title: "Ocean Breeze",
    price: "$145",
    image: "/ocean-breeze.png",
    description:
      "A fresh marine experience blending salty sea minerals, crushed mint leaves, amberwood, and bright Italian bergamot for clean coastal refinement.",
    tagline: "Aquamarine Coast Line",
  },
];

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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#070200] overflow-hidden">
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
  isNew?: boolean;
  isBestSeller?: boolean;
  isFeaturedLarge?: boolean;
  description?: string;
  olfactory?: string;
}

const CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: 1,
    brand: "INITIO PARFUMS PRIVES",
    name: "Oud for greatness",
    price: "$331",
    sizes: ["50ml", "90ml"],
    image: "/catalog_initio_oud.png",
    isNew: true,
    olfactory: "Woody & Oud",
  },
  {
    id: 2,
    brand: "JULIETTE HAS A GUN",
    name: "Juliette",
    price: "$98",
    sizes: ["30ml", "50ml"],
    image: "/catalog_juliette_gun.png",
    isBestSeller: true,
    olfactory: "Floral & Sweet",
  },
  {
    id: 3,
    brand: "RABANNE",
    name: "Phantom",
    price: "$120",
    sizes: ["50ml", "100ml"],
    image: "/catalog_rabanne_phantom.png",
    isNew: true,
    olfactory: "Fresh & Aquatic",
  },
  {
    id: 4,
    brand: "HFC",
    name: "Devil's intrigue",
    price: "$370",
    sizes: ["75ml"],
    image: "/catalog_hfc_devils.png",
    isBestSeller: true,
    olfactory: "Amber & Oriental",
  },
  {
    id: 5,
    brand: "TOM FORD",
    name: "Lost Cherry eau de parfum",
    price: "$326.00",
    sizes: ["30ml", "50ml", "100ml"],
    image: "/catalog_tom_ford_cherry.png",
    isBestSeller: true,
    olfactory: "Floral & Sweet",
  },
  {
    id: 6,
    brand: "MOSCHINO",
    name: "Toy Boy",
    price: "$43.12",
    sizes: ["30ml", "50ml", "100ml"],
    image: "/catalog_moschino_teddy.png",
    isNew: true,
    olfactory: "Woody & Oud",
  },
  {
    id: 7,
    brand: "FILIPPO SORCINELLI",
    name: "Epicentro",
    price: "$326.00",
    sizes: ["50ml", "100ml"],
    image: "/catalog_sorcinelli_epicentro.png",
    isBestSeller: true,
    isFeaturedLarge: true,
    description: "Epicentro is an artistic perfume that represents a deep volcanic impact. Topped with a heavy raw silver metal crumpled sculpture that serves as both the cap and a piece of tactile art, reflecting the dramatic nature of Filippo Sorcinelli's olfactory expressions.",
    olfactory: "Fresh & Aquatic",
  },
  {
    id: 8,
    brand: "FILIPPO SORCINELLI",
    name: "Eio_non_ho_mani_che_mi_accarezzino_il_volto",
    price: "$235.00",
    sizes: ["100ml"],
    image: "/catalog_sorcinelli_leather.png",
    isNew: true,
    isFeaturedLarge: true,
    description: "An avante-garde olfactory masterpiece encased in a bottle wrapped dramatically in draped, textured organic matte black leather folds. The scent is a heavy gothic mixture of warm incense, cedarwood, and resinous leather accord.",
    olfactory: "Amber & Oriental",
  },
  {
    id: 9,
    brand: "MARC-ANTOINE BARROIS",
    name: "Ganymede Extrait",
    price: "$319",
    sizes: ["30ml", "50ml"],
    image: "/catalog_marc_barrois.png",
    isNew: true,
    olfactory: "Woody & Oud",
  }
];

const megaMenuContainerVariants: any = {
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

const megaMenuColumnVariants: any = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
  },
  exit: {
    opacity: 1,
  },
};


const MEGA_MENU_COLLECTIONS = [
  { id: "new", title: "New Arrivals", desc: "Freshly decanted summer releases" },
  { id: "bestsellers", title: "Bestsellers", desc: "Our most coveted scent signatures" },
  { id: "favorites", title: "Exclusive Offers", desc: "Hand-selected custom vaults" },
  { id: "trending", title: "Trending", desc: "Most wanted scent creations" },
];

const MEGA_MENU_OLFACTORY = [
  {
    label: "Woody & Oud",
    desc: "deep, raw, & dramatic sophistication",
    glow: "from-amber-600/5 via-amber-500/2 to-transparent",
    symbol: "🪵",
  },
  {
    label: "Amber & Oriental",
    desc: "warm resinous spices & sensuality",
    glow: "from-yellow-600/5 via-amber-500/2 to-transparent",
    symbol: "✨",
  },
  {
    label: "Floral & Sweet",
    desc: "blooming jasmine & rich velvet vanilla",
    glow: "from-rose-600/5 via-rose-500/2 to-transparent",
    symbol: "🌸",
  },
  {
    label: "Fresh & Aquatic",
    desc: "crisp marine breeze & mineral bergamot",
    glow: "from-cyan-600/5 via-teal-500/2 to-transparent",
    symbol: "🌊",
  },
];

const ProductCard: React.FC<{
  prod: CatalogProduct;
  isFav: boolean;
  activeSize: string;
  onToggleFavorite: (id: number) => void;
  onSelectSize: (id: number, size: string) => void;
  onAddToCart: (id: number) => void;
  badgeText?: string;
}> = ({ prod, isFav, activeSize, onToggleFavorite, onSelectSize, onAddToCart, badgeText }) => {


  return (
    <div
      className="border border-[#EAE3DB]/70 bg-white hover:border-amber-600/40 hover:shadow-[0_24px_55px_rgba(27,15,10,0.08)] group transition-all duration-500 flex flex-col justify-between rounded-none overflow-hidden h-full relative"
    >
      {/* Decorative gold hairline accents that appear on card hover */}
      <div className="absolute inset-0 border border-amber-600/0 group-hover:border-amber-600/10 pointer-events-none transition-colors duration-500 z-10"></div>

      {/* Image Container */}
      <div className="bg-gradient-to-b from-[#FAF9F6] via-[#FCFBF9] to-[#FAF9F6] relative flex items-center justify-center p-4 w-full aspect-[4/5] overflow-hidden border-b border-[#EAE3DB]/30">

        {/* Luxury Badge */}
        {badgeText && (
          <span className="absolute top-4 left-4 bg-black text-white text-[7px] font-bold tracking-[0.25em] uppercase px-3 py-1.5 rounded-none z-20 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-white/10">
            {badgeText}
          </span>
        )}

        {/* Favorite Trigger */}
        <button
          onClick={() => onToggleFavorite(prod.id)}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm border border-[#EAE3DB] text-black hover:bg-black hover:border-black hover:text-white hover:scale-105 active:scale-95 transition-all duration-300 rounded-full cursor-pointer shadow-sm animate-fade-in"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-300 ${isFav ? "fill-red-600 text-red-600 scale-110" : "text-black hover:scale-110"}`}
            fill={isFav ? "currentColor" : "none"}
            stroke={isFav ? "none" : "currentColor"}
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>

        {/* Subtle Ambient Radial Glow Behind Bottle */}
        <div className="absolute inset-0 bg-radial from-amber-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

        {/* Main Bottle Image */}
        <div className="relative w-[85%] h-[85%] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08] flex items-center justify-center">
          <Image
            src={prod.image}
            alt={prod.name}
            fill
            className="object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.06)] group-hover:drop-shadow-[0_18px_32px_rgba(82,42,22,0.12)] transition-all duration-700"
            priority
          />
        </div>
      </div>

      {/* Details Box */}
      <div className="p-6 flex-grow flex flex-col justify-between text-left bg-white transition-all duration-500 font-sans-luxury">

        {/* Brand & Name */}
        <div>
          <span className="text-[8px] tracking-[0.3em] font-extrabold text-amber-800/80 uppercase block mb-1 pl-[0.1em]">
            {prod.brand}
          </span>
          <h3 className="text-[15px] font-serif-luxury font-medium text-neutral-900 uppercase tracking-wide leading-snug line-clamp-1 group-hover:text-amber-900 transition-colors duration-300">
            {prod.name}
          </h3>
          <span className="text-[9px] text-neutral-400 tracking-widest uppercase block mt-1 font-semibold pl-[0.1em]">
            EXTRAIT DE PARFUM
          </span>
        </div>

        {/* Sizes & Purchase Row */}
        <div className="mt-5 border-t border-neutral-100 pt-4 flex flex-col gap-4">

          {/* Sizing Controls */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] tracking-widest text-neutral-400 uppercase font-medium">Select Volume</span>
            <div className="flex items-center gap-2.5">
              {prod.sizes.map((sz, idx) => (
                <React.Fragment key={sz}>
                  {idx > 0 && <span className="text-black/10 text-[8px] select-none font-light">|</span>}
                  <button
                    onClick={() => onSelectSize(prod.id, sz)}
                    className={`text-[9px] tracking-[0.15em] font-extrabold uppercase transition-all duration-300 relative py-0.5 ${activeSize === sz
                        ? "text-black after:content-[''] after:absolute after:-bottom-0.5 after:left-0 after:w-full after:h-[1.5px] after:bg-amber-600"
                        : "text-neutral-400 hover:text-black"
                      }`}
                  >
                    {sz}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Pricing & CTA Button */}
          <div className="flex items-center justify-between mt-1 pt-3 border-t border-neutral-100/60">
            <div className="flex flex-col">
              <span className="text-[8px] tracking-widest text-neutral-400 uppercase font-medium">Retail Price</span>
              <span className="text-[17px] font-serif-luxury font-semibold text-neutral-900 tracking-tight mt-0.5">
                {prod.price}
              </span>
            </div>
            <button
              onClick={() => onAddToCart(prod.id)}
              className="bg-black hover:bg-amber-950 text-white text-[8px] font-bold tracking-[0.25em] uppercase px-5 py-3.5 transition-all duration-300 rounded-none cursor-pointer border border-black hover:border-amber-950 active:scale-95 shadow-sm"
            >
              Add To Bag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CartItem {
  product: CatalogProduct;
  quantity: number;
  selectedSize: string;
}

export default function Home() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Preloader Visibility State
  const [showIntro, setShowIntro] = useState(true);

  // Main Storefront UI Staggered Entrance Reveal State
  const [revealInterface, setRevealInterface] = useState(false);

  const activeProduct = PRODUCTS[activeIndex];

  // Catalog e-commerce states
  const [activeCatalogTab, setActiveCatalogTab] = useState<"all" | "new" | "bestsellers" | "favorites">("all");
  const [favorites, setFavorites] = useState<number[]>([2, 4, 5, 9]); // default pre-liked standard perfume bottles for symmetrical grid
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({
    1: "50ml",
    2: "30ml",
    3: "50ml",
    4: "75ml",
    5: "50ml",
    6: "50ml",
    7: "50ml",
    8: "100ml",
    9: "30ml"
  });

  // Luxury Reactive Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      product: CATALOG_PRODUCTS[0], // Oud for greatness
      quantity: 1,
      selectedSize: "90ml"
    },
    {
      product: CATALOG_PRODUCTS[1], // Juliette
      quantity: 1,
      selectedSize: "50ml"
    }
  ]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartPageOpen, setIsCartPageOpen] = useState(false);

  // Luxury Auth & Member states
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

  const showNotificationState = useState<string | null>(null);
  const showNotification = showNotificationState[0];
  const setShowNotification = showNotificationState[1];

  const [selectedOlfactory, setSelectedOlfactory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<"all" | "new" | "bestsellers" | "favorites" | "offers" | "trending" | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<CatalogProduct[]>([]);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync auth state on mount
  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail");
    if (storedEmail) {
      setUserEmail(storedEmail);
    } else {
      setUserEmail(null);
    }

    const pendingNotify = localStorage.getItem("authNotification");
    if (pendingNotify) {
      setShowNotification(pendingNotify);
      localStorage.removeItem("authNotification");
    }
  }, []);

  const isFiltered = searchTerm.trim() !== "" || selectedOlfactory !== null || selectedBrand !== null || selectedCollection !== null;

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setSearchSuggestions([]);
      return;
    }
    const searchLower = searchTerm.toLowerCase();
    const matches = CATALOG_PRODUCTS.filter(prod =>
      prod.brand.toLowerCase().includes(searchLower) ||
      prod.name.toLowerCase().includes(searchLower)
    ).slice(0, 4);
    setSearchSuggestions(matches);
  }, [searchTerm]);

  // Newsletter subscription states
  const [subscribedEmail, setSubscribedEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const toggleFavorite = (id: number) => {
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(favId => favId !== id) : [...prev, id]
    );

    // Tiny toast notification for favorite
    const prod = CATALOG_PRODUCTS.find(p => p.id === id);
    if (prod) {
      const isAdding = !favorites.includes(id);
      triggerNotification(
        isAdding
          ? `Added ${prod.brand} - ${prod.name} to your Exclusive Offers.`
          : `Removed ${prod.brand} from your Exclusive Offers.`
      );
    }
  };

  const selectSize = (productId: number, size: string) => {
    setSelectedSizes(prev => ({
      ...prev,
      [productId]: size
    }));
  };

  const handleAddToCart = (productId: number) => {
    const prod = CATALOG_PRODUCTS.find(p => p.id === productId);
    if (!prod) return;
    const size = selectedSizes[productId] || "50ml";

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
    // 1. Preloader runs for 3.2 seconds
    const introTimer = setTimeout(() => {
      setShowIntro(false);

      // 2. Wait for preloader slide exit curtain (1.2s) + 2.0s of pure ambient background video play!
      const interfaceTimer = setTimeout(() => {
        setRevealInterface(true);
      }, 3200);

      return () => clearTimeout(interfaceTimer);
    }, 3200);

    return () => clearTimeout(introTimer);
  }, []);

  const handlePrev = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setActiveIndex((prev) => (prev === 0 ? PRODUCTS.length - 1 : prev - 1));
      setIsAnimating(false);
    }, 400);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setActiveIndex((prev) => (prev === PRODUCTS.length - 1 ? 0 : prev + 1));
      setIsAnimating(false);
    }, 400);
  };

  const handleSelectProduct = (index: number) => {
    if (isAnimating || index === activeIndex) return;
    setIsAnimating(true);
    setTimeout(() => {
      setActiveIndex(index);
      setIsAnimating(false);
    }, 400);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, isAnimating]);

  return (
    <div className="relative min-h-screen w-full bg-[#070200] text-white flex flex-col overflow-x-hidden overflow-y-auto font-sans-luxury scroll-smooth">

      {/* Mobile Luxury Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#FAF6F0]/98 border-l border-amber-800/10 backdrop-blur-xl z-50 flex flex-col justify-between p-8 font-sans-luxury text-neutral-800"
          >
            {/* Header / Close Row */}
            <div className="flex items-center justify-between border-b border-amber-800/10 pb-5">
              <Image
                src="/logo.png"
                alt="Gharib"
                width={150}
                height={38}
                className="h-8 w-auto object-contain rounded-lg overflow-hidden brightness-0"
              />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-10 h-10 flex items-center justify-center border border-amber-800/20 rounded-full text-neutral-600 hover:text-neutral-900 hover:border-amber-800/40 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Menu Links scroll area */}
            <div className="flex-grow overflow-y-auto py-8 flex flex-col gap-8 text-left">
              {/* Main Links */}
              <div className="flex flex-col gap-5">
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedOlfactory(null);
                    setSelectedBrand(null);
                    setSelectedCollection(null);
                    setIsMobileMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-lg font-black tracking-[0.25em] text-neutral-800 hover:text-amber-800 uppercase text-left transition-colors cursor-pointer"
                >
                  HOME
                </button>
                <a
                  href="#about"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-black tracking-[0.25em] text-neutral-800 hover:text-amber-800 uppercase transition-colors"
                >
                  ABOUT
                </a>
                <a
                  href="#contact"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-black tracking-[0.25em] text-neutral-800 hover:text-amber-800 uppercase transition-colors"
                >
                  CONTACT
                </a>
              </div>

              {/* Collections Grid */}
              <div className="flex flex-col border-t border-amber-800/10 pt-6">
                <span className="text-[10px] font-black tracking-[0.25em] text-amber-800 uppercase mb-4 pl-[0.1em]">
                  Shop Collections
                </span>
                <div className="grid grid-cols-2 gap-3.5 text-xs font-bold tracking-widest text-neutral-500">
                  <button
                    onClick={() => {
                      setSelectedCollection("new");
                      setSelectedBrand(null);
                      setSelectedOlfactory(null);
                      setIsMobileMenuOpen(false);
                      const el = document.getElementById("new-in");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="hover:text-amber-800 text-left uppercase cursor-pointer"
                  >
                    ✧ New In
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCollection("bestsellers");
                      setSelectedBrand(null);
                      setSelectedOlfactory(null);
                      setIsMobileMenuOpen(false);
                      const el = document.getElementById("new-in");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="hover:text-amber-800 text-left uppercase cursor-pointer"
                  >
                    ✧ Bestsellers
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCollection("favorites");
                      setSelectedBrand(null);
                      setSelectedOlfactory(null);
                      setIsMobileMenuOpen(false);
                      const el = document.getElementById("new-in");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="hover:text-amber-800 text-left uppercase cursor-pointer"
                  >
                    ✧ Exclusives
                  </button>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCollection(null);
                      setSelectedBrand(null);
                      setSelectedOlfactory(null);
                      setIsMobileMenuOpen(false);
                      const el = document.getElementById("new-in");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="hover:text-amber-800 text-left uppercase cursor-pointer"
                  >
                    ✧ All Fragrances
                  </button>
                </div>
              </div>

              {/* Olfactory Families */}
              <div className="flex flex-col border-t border-amber-800/10 pt-6">
                <span className="text-[10px] font-black tracking-[0.25em] text-amber-800 uppercase mb-4 pl-[0.1em]">
                  Scent notes
                </span>
                <div className="grid grid-cols-2 gap-4 text-xs font-bold tracking-widest text-neutral-500">
                  {["Woody & Oud", "Amber & Oriental", "Floral & Sweet", "Fresh & Aquatic"].map((note) => (
                    <button
                      key={note}
                      onClick={() => {
                        setSelectedOlfactory(note);
                        setSelectedBrand(null);
                        setSelectedCollection(null);
                        setIsMobileMenuOpen(false);
                        const el = document.getElementById("new-in");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="hover:text-amber-800 text-left uppercase cursor-pointer"
                    >
                      ✦ {note.split(" & ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer / Spotlight Shortcut */}
            <div className="border-t border-amber-800/10 pt-5 flex flex-col gap-2">
              <span className="text-[8px] tracking-[0.3em] font-extrabold text-amber-800 uppercase pl-[0.1em]">
                GHARIB ATELIER
              </span>
              <span className="text-[10px] text-neutral-400 tracking-widest uppercase">
                Artisanal Olfactory Creations • Dubai, UAE
              </span>
            </div>
          </motion.div>
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
      <div className="relative h-screen min-h-screen w-full flex flex-col justify-between flex-shrink-0 overflow-hidden">
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
          {isMegaMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              onClick={() => setIsMegaMenuOpen(false)}
              onMouseEnter={() => setIsMegaMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-20 pointer-events-auto cursor-pointer"
            />
          )}
        </AnimatePresence>

        {/* 1. Header / Navigation */}
        <motion.header
          initial={{ y: -30, opacity: 0 }}
          animate={revealInterface ? { y: 0, opacity: 1 } : { y: -30, opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full z-30 relative text-white"
        >
          {/* Glassmorphic navbar wrapper to isolate backdrop-blur and prevent transparency leaking into absolute dropdowns */}
          <div className="w-full border-b border-white/10 backdrop-blur-md bg-black/10">
            <nav className="max-w-[1440px] mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
            {/* Left Menu Items (Home, About, Shop with Dropdown) */}
            <div className="hidden md:flex items-center gap-10 text-[13px] font-medium tracking-[0.2em] transition-colors duration-300 text-white/70">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedOlfactory(null);
                  setSelectedBrand(null);
                  setSelectedCollection(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="transition-colors duration-300 cursor-pointer uppercase font-medium hover:text-white"
              >
                HOME
              </button>
              <a
                href="#about"
                className="transition-colors duration-300 uppercase font-medium hover:text-white"
              >
                ABOUT
              </a>
              <a
                href="#contact"
                className="transition-colors duration-300 uppercase font-medium hover:text-white"
              >
                CONTACT
              </a>
              {/* Shop trigger wrapper for Mega Menu */}
              <div
                className="relative py-2 cursor-pointer"
                onMouseEnter={() => setIsMegaMenuOpen(true)}
                onMouseLeave={() => setIsMegaMenuOpen(false)}
              >
                <button
                  onClick={() => setIsMegaMenuOpen(!isMegaMenuOpen)}
                  className="transition-colors duration-300 flex items-center gap-1.5 uppercase font-medium cursor-pointer hover:text-white"
                >
                  SHOP
                  <svg
                    className={`w-2.5 h-2.5 transition-transform duration-300 ${isMegaMenuOpen ? "rotate-180 text-white" : "text-white/50"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Logo Center */}
            <div className="flex-1 flex justify-center md:flex-initial">
              <Image
                src="/logo.png"
                alt="Gharib"
                width={220}
                height={55}
                className="h-11 md:h-[48px] w-auto object-contain rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
                priority
                onClick={() => {
                  setSearchTerm("");
                  setSelectedOlfactory(null);
                  setSelectedBrand(null);
                  setSelectedCollection(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>

            {/* Right Menu Items (Search bar, Contact, Bag) */}
            <div className="hidden md:flex items-center gap-8 text-[13px] font-medium tracking-[0.2em] transition-colors duration-300 justify-end text-white/70">
              {/* Better Search Bar Container */}
              <div className="relative flex items-center">
                <div className="relative flex items-center rounded-none px-4 py-1.5 w-[200px] lg:w-[240px] transition-all duration-300 bg-white/5 border border-white/10 hover:border-white/20 focus-within:border-amber-500/50">
                  <svg className="w-3.5 h-3.5 mr-2 flex-shrink-0 transition-colors duration-300 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="bg-transparent text-[10px] tracking-widest uppercase outline-none w-full font-bold transition-colors duration-300 text-white placeholder-white/40"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="text-[9px] font-bold ml-1 cursor-pointer transition-colors duration-300 text-white/40 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Intelligent Search Suggestions Dropdown */}
                <AnimatePresence>
                  {searchTerm.trim() !== "" && searchSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 15 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute top-full mt-2.5 right-0 w-[300px] md:w-[360px] bg-[#FAF6F0] border border-amber-800/15 shadow-[0_20px_50px_rgba(27,15,10,0.08)] z-50 overflow-hidden flex flex-col"
                    >
                      {/* Section Header */}
                      <div className="px-4 py-2 bg-neutral-900/5 border-b border-amber-800/10 text-[9px] tracking-widest text-amber-800 font-extrabold uppercase">
                        Real-time Suggestions
                      </div>

                      {/* Suggestion List */}
                      <div className="flex flex-col max-h-[320px] overflow-y-auto divide-y divide-amber-800/10 custom-scrollbar">
                        {searchSuggestions.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => {
                              // Clear search suggestions overlay and filter to this product
                              setSearchTerm(prod.name);
                              // Trigger smooth scroll to catalog container `#new-in`
                              const el = document.getElementById("new-in");
                              if (el) el.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="p-3 flex items-center gap-3.5 hover:bg-neutral-900/5 transition-colors duration-200 cursor-pointer text-left group"
                          >
                            <div className="relative w-10 h-12 bg-neutral-900/5 flex-shrink-0 flex items-center justify-center p-1 border border-neutral-800/5 overflow-hidden">
                              <Image
                                src={prod.image}
                                alt={prod.name}
                                width={40}
                                height={48}
                                className="object-contain filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300"
                              />
                            </div>
                            <div className="flex-grow flex flex-col justify-center min-w-0">
                              <span className="text-[8px] font-extrabold tracking-widest text-amber-800 uppercase truncate">
                                {prod.brand}
                              </span>
                              <span className="text-[11px] font-medium tracking-wide text-neutral-800 uppercase truncate mt-0.5 group-hover:text-amber-800 transition-colors duration-200">
                                {prod.name}
                              </span>
                              <span className="text-[9px] text-neutral-500 tracking-wider font-semibold uppercase mt-0.5">
                                {prod.olfactory} • Extrait de Parfum
                              </span>
                            </div>
                            <div className="text-[12px] font-bold text-neutral-800 tracking-wider flex-shrink-0 pl-1">
                              {prod.price}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer Actions */}
                      <div className="p-3.5 bg-neutral-900/5 border-t border-amber-800/10 flex items-center justify-between">
                        <span className="text-[9px] tracking-widest text-neutral-500 font-semibold uppercase">
                          Click to filter catalog view
                        </span>
                        <button
                          onClick={() => {
                            const el = document.getElementById("new-in");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="text-[9px] tracking-widest text-amber-800 hover:text-amber-900 font-extrabold uppercase transition-colors"
                        >
                          View All ✧
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ═══════════════════════════════════════════════════
                  DESKTOP: Perpetual Luxury Motion Icons
                  Always-playing continuous looping animations
                  using animate + repeat: Infinity
              ═══════════════════════════════════════════════════ */}

              {/* User Profile / Sign In — Static icon, no animation */}
              <button
                onClick={() => router.push("/signin")}
                className="relative flex items-center justify-center cursor-pointer py-1.5 active:scale-[0.92] transition-transform"
              >
                <div className="relative flex items-center justify-center w-[38px] h-[38px]">
                  <svg
                    className="w-[28px] h-[28px] relative z-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="1.5"
                  >
                    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.55)" strokeLinecap="round" fill="none" />
                    <circle cx="12" cy="10" r="3" stroke="rgba(255,255,255,0.7)" strokeLinecap="round" fill="none" />
                    <path d="M6.168 18.849A4.5 4.5 0 0112 15.75a4.5 4.5 0 015.832 3.099" stroke="rgba(255,255,255,0.55)" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>

                  {userEmail && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-pulse z-20 border border-amber-400/50" />
                  )}
                </div>
              </button>

              {/* Wishlist — Living heartbeat + twinkling sparkles */}
              <motion.button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedOlfactory(null);
                  setSelectedBrand(null);
                  setSelectedCollection(null);
                  setTimeout(() => {
                    const el = document.getElementById("offers");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className="relative flex items-center justify-center cursor-pointer py-1.5"
                whileTap={{ scale: 0.92 }}
              >
                <motion.div
                  className="relative flex items-center justify-center w-[38px] h-[38px]"
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                  {/* Rose-gold breathing glow */}
                  <motion.div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(244,63,94,0.12) 0%, rgba(245,158,11,0.06) 50%, transparent 70%)" }}
                    animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  />

                  <svg
                    className="w-[28px] h-[28px] relative z-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="1.5"
                  >
                    {/* Heart — continuous heartbeat rhythm */}
                    <motion.path
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      animate={{
                        scale: [1, 1.12, 1, 1.08, 1],
                        stroke: ["rgba(255,255,255,0.55)", "#e88a9a", "#f43f5e", "#e88a9a", "rgba(255,255,255,0.55)"],
                      }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                      style={{ transformOrigin: "center center" }}
                    />
                    {/* Sparkle #1 — top-right twinkle */}
                    <motion.path
                      d="M19.5 2l.3 1.2 1.2.3-1.2.3-.3 1.2-.3-1.2-1.2-.3 1.2-.3z"
                      fill="#f59e0b"
                      stroke="none"
                      animate={{
                        scale: [0, 1.2, 0],
                        opacity: [0, 0.9, 0],
                        rotate: [0, 180],
                      }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                    />
                    {/* Sparkle #2 — bottom-left echo twinkle */}
                    <motion.path
                      d="M5 18l.2.8.8.2-.8.2-.2.8-.2-.8-.8-.2.8-.2z"
                      fill="#f59e0b"
                      stroke="none"
                      animate={{
                        scale: [0, 1, 0],
                        opacity: [0, 0.6, 0],
                        rotate: [0, -180],
                      }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
                    />
                  </svg>

                  {favorites.length > 0 && (
                    <motion.span
                      className="absolute -top-1.5 -right-2.5 bg-amber-500 text-black text-[9px] font-black w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.5)] z-20"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {favorites.length}
                    </motion.span>
                  )}
                </motion.div>
              </motion.button>

              {/* Cart/Bag — Bouncing handle + breathing body + pulsing dot */}
              <motion.button
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center justify-center cursor-pointer py-1.5"
                whileTap={{ scale: 0.92 }}
              >
                <motion.div
                  className="relative flex items-center justify-center w-[38px] h-[38px]"
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                >
                  {/* Amber breathing glow */}
                  <motion.div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)" }}
                    animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  />

                  <svg
                    className="w-[28px] h-[28px] relative z-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="1.5"
                  >
                    {/* Bag body — subtle breathing scale */}
                    <motion.path
                      d="M4 8h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      style={{ transformOrigin: "center bottom" }}
                      animate={{
                        scaleY: [1, 1.03, 1, 0.97, 1],
                        stroke: ["rgba(255,255,255,0.55)", "rgba(255,255,255,0.75)", "rgba(255,255,255,0.55)"],
                      }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    {/* Handle — elastic bounce */}
                    <motion.path
                      d="M8 8V7a4 4 0 018 0v1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      animate={{
                        y: [0, -2, 0.5, 0],
                        stroke: ["rgba(255,255,255,0.55)", "#d4a053", "#f59e0b", "rgba(255,255,255,0.55)"],
                      }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                    />
                    {/* Gold center dot — pulsing in/out */}
                    <motion.circle
                      cx="12" cy="14.5" r="2"
                      fill="#f59e0b"
                      stroke="none"
                      animate={{
                        scale: [0, 1, 1, 0],
                        opacity: [0, 0.8, 0.8, 0],
                      }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    />
                    {/* Expanding ring echo */}
                    <motion.circle
                      cx="12" cy="14.5" r="4"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="0.5"
                      animate={{
                        scale: [0, 1.5, 0],
                        opacity: [0, 0.35, 0],
                      }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                    />
                  </svg>

                  <motion.span
                    className="absolute -top-1.5 -right-2.5 bg-amber-500 text-black text-[9px] font-black w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.5)] z-20"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  >
                    {cartCount}
                  </motion.span>
                </motion.div>
              </motion.button>
            </div>

            {/* MOBILE: Action Bar & Toggler */}
            <div className="flex md:hidden items-center gap-4 text-white">
              {/* Mobile Search */}
              <div className="relative flex items-center">
                <button
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className="p-1 transition-colors text-white/70 hover:text-white cursor-pointer"
                  aria-label="Toggle Search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <AnimatePresence>
                  {isSearchOpen && (
                    <motion.input
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 100, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={searchPlaceholder}
                      className="ml-1 border-b text-[10px] tracking-widest uppercase py-0.5 outline-none font-bold bg-transparent w-[90px] transition-colors duration-300 border-white/30 focus:border-white text-white placeholder-white/40"
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile User Profile */}
              <button
                onClick={() => router.push("/signin")}
                className="relative flex items-center justify-center cursor-pointer py-1 active:scale-[0.92] transition-transform text-white"
                aria-label="Sign In"
              >
                <div className="relative flex items-center justify-center w-[36px] h-[36px]">
                  <svg className="w-[28px] h-[28px] relative z-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.55)" strokeLinecap="round" fill="none" />
                    <circle cx="12" cy="10" r="3" stroke="rgba(255,255,255,0.7)" strokeLinecap="round" fill="none" />
                    <path d="M6.168 18.849A4.5 4.5 0 0112 15.75a4.5 4.5 0 015.832 3.099" stroke="rgba(255,255,255,0.55)" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  {userEmail && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-pulse z-20 border border-amber-400/50" />
                  )}
                </div>
              </button>

              {/* Mobile Wishlist */}
              <motion.button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedOlfactory(null);
                  setSelectedBrand(null);
                  setSelectedCollection(null);
                  setTimeout(() => {
                    const el = document.getElementById("offers");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className="relative flex items-center justify-center cursor-pointer py-1 text-white"
                whileTap={{ scale: 0.92 }}
                aria-label="Wishlist"
              >
                <motion.div
                  className="relative flex items-center justify-center w-[36px] h-[36px]"
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(244,63,94,0.12) 0%, rgba(245,158,11,0.06) 50%, transparent 70%)" }}
                    animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  />
                  <svg className="w-[28px] h-[28px] relative z-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                    <motion.path
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      animate={{
                        scale: [1, 1.12, 1, 1.08, 1],
                        stroke: ["rgba(255,255,255,0.55)", "#e88a9a", "#f43f5e", "#e88a9a", "rgba(255,255,255,0.55)"],
                      }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                      style={{ transformOrigin: "center center" }}
                    />
                    <motion.path
                      d="M19.5 2l.3 1.2 1.2.3-1.2.3-.3 1.2-.3-1.2-1.2-.3 1.2-.3z"
                      fill="#f59e0b"
                      stroke="none"
                      animate={{ scale: [0, 1.2, 0], opacity: [0, 0.9, 0], rotate: [0, 180] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                    />
                    <motion.path
                      d="M5 18l.2.8.8.2-.8.2-.2.8-.2-.8-.8-.2.8-.2z"
                      fill="#f59e0b"
                      stroke="none"
                      animate={{ scale: [0, 1, 0], opacity: [0, 0.6, 0], rotate: [0, -180] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
                    />
                  </svg>
                  {favorites.length > 0 && (
                    <motion.span
                      className="absolute -top-1.5 -right-2.5 bg-amber-500 text-black text-[9px] font-black w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.5)] z-20"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {favorites.length}
                    </motion.span>
                  )}
                </motion.div>
              </motion.button>

              {/* Mobile Cart */}
              <motion.button
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center justify-center cursor-pointer py-1 text-white"
                whileTap={{ scale: 0.92 }}
                aria-label="Cart"
              >
                <motion.div
                  className="relative flex items-center justify-center w-[36px] h-[36px]"
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)" }}
                    animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  />
                  <svg className="w-[28px] h-[28px] relative z-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                    <motion.path
                      d="M4 8h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      style={{ transformOrigin: "center bottom" }}
                      animate={{
                        scaleY: [1, 1.03, 1, 0.97, 1],
                        stroke: ["rgba(255,255,255,0.55)", "rgba(255,255,255,0.75)", "rgba(255,255,255,0.55)"],
                      }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.path
                      d="M8 8V7a4 4 0 018 0v1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      animate={{
                        y: [0, -2, 0.5, 0],
                        stroke: ["rgba(255,255,255,0.55)", "#d4a053", "#f59e0b", "rgba(255,255,255,0.55)"],
                      }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                    />
                    <motion.circle
                      cx="12" cy="14.5" r="2"
                      fill="#f59e0b"
                      stroke="none"
                      animate={{ scale: [0, 1, 1, 0], opacity: [0, 0.8, 0.8, 0] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    />
                    <motion.circle
                      cx="12" cy="14.5" r="4"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="0.5"
                      animate={{ scale: [0, 1.5, 0], opacity: [0, 0.35, 0] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                    />
                  </svg>
                  {cartCount > 0 && (
                    <motion.span
                      className="absolute -top-1.5 -right-2.5 bg-amber-500 text-black text-[9px] font-black w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.5)] z-20"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </motion.div>
              </motion.button>

              {/* Mobile Toggle Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex flex-col gap-1.5 p-2 cursor-pointer hover:opacity-80 transition-opacity text-white"
                aria-label="Toggle Menu"
              >
                <span className="w-6 h-0.5 bg-white"></span>
                <span className="w-4 h-0.5 self-end bg-white"></span>
              </button>
            </div>
          </nav>
        </div>

          {/* Shop Mega Menu Dropdown */}
          <AnimatePresence>
            {isMegaMenuOpen && (
              <motion.div
                variants={megaMenuContainerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onMouseEnter={() => setIsMegaMenuOpen(true)}
                onMouseLeave={() => setIsMegaMenuOpen(false)}
                className="absolute top-full left-0 w-full bg-[#FAF6F0] border-b border-amber-800/15 z-40 overflow-hidden shadow-[0_35px_80px_rgba(46,34,25,0.08)] text-neutral-800"
              >
                {/* Glowing top gold hairline strip */}
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-amber-700/20 to-transparent z-20 pointer-events-none"></div>
 
                {/* Layered warm-gold luxury ambient backlighting */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-radial from-amber-600/[0.04] via-transparent to-transparent blur-[90px] pointer-events-none z-0"></div>
                <div className="absolute inset-0 bg-radial from-amber-700/[0.01] via-transparent to-transparent pointer-events-none z-0"></div>
 
                <div className="max-w-[1440px] mx-auto px-12 py-14 grid grid-cols-1 md:grid-cols-4 gap-10 text-left border-t border-amber-800/10 relative z-10">
                  {/* Column 1: COLLECTIONS */}
                  <motion.div variants={megaMenuColumnVariants} className="flex flex-col">
                    <span className="text-[12px] font-black tracking-[0.3em] text-amber-800 uppercase border-b border-amber-800/10 pb-5 mb-6 block font-sans-luxury pl-[0.1em]">
                      COLLECTIONS
                    </span>
                    <ul className="flex flex-col gap-6">
                      {MEGA_MENU_COLLECTIONS.map((col) => (
                        <li key={col.id}>
                          <button
                            onClick={() => {
                              setSelectedCollection(col.id as any);
                              setSelectedBrand(null);
                              setSelectedOlfactory(null);
                              setIsMegaMenuOpen(false);
                              const el = document.getElementById("new-in");
                              if (el) el.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="transition-all duration-300 uppercase cursor-pointer flex flex-col group text-left w-full relative pl-2 hover:pl-4"
                          >
                            {/* Vertical accent glow line on the left on hover */}
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 bg-amber-600 transition-all duration-300 group-hover:h-[80%]"></span>
 
                            <span className="text-[13px] font-extrabold tracking-[0.18em] text-neutral-800 group-hover:text-amber-800 transition-colors duration-300 flex items-center gap-2">
                              <span className="text-amber-600 group-hover:scale-110 transition-all duration-300 text-[10px]">✧</span>
                              {col.title}
                            </span>
                            <span className="text-[9.5px] leading-relaxed text-neutral-500 group-hover:text-neutral-800 tracking-[0.12em] pl-4 mt-1.5 font-medium transition-colors duration-300">
                              {col.desc}
                            </span>
                          </button>
                        </li>
                      ))}
                      {/* Special: All Fragrances link at the bottom */}
                      <li className="border-t border-amber-800/10 pt-5 mt-1">
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            setSelectedCollection(null);
                            setSelectedBrand(null);
                            setSelectedOlfactory(null);
                            setIsMegaMenuOpen(false);
                            const el = document.getElementById("new-in");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="hover:text-amber-800 transition-all duration-300 uppercase cursor-pointer flex items-center gap-2.5 group text-left w-full text-[13px] font-black tracking-[0.2em] text-neutral-800 pl-2 hover:pl-4"
                        >
                          <span className="text-amber-600 group-hover:rotate-180 transition-transform duration-500">✧</span>
                          ALL FRAGRANCES
                        </button>
                      </li>
                    </ul>
                  </motion.div>
 
                  {/* Column 2: OLFACTORY FAMILIES */}
                  <motion.div variants={megaMenuColumnVariants} className="flex flex-col">
                    <span className="text-[12px] font-black tracking-[0.3em] text-amber-800 uppercase border-b border-amber-800/10 pb-5 mb-6 block font-sans-luxury pl-[0.1em]">
                      OLFACTORY FAMILIES
                    </span>
                    <div className="grid grid-cols-1 gap-3.5">
                      {MEGA_MENU_OLFACTORY.map((item) => (
                        <button
                          key={item.label}
                          onClick={() => {
                            setSelectedOlfactory(item.label);
                            setSelectedBrand(null);
                            setSelectedCollection(null);
                            setIsMegaMenuOpen(false);
                            const el = document.getElementById("new-in");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="relative overflow-hidden bg-white/75 hover:bg-gradient-to-b hover:from-white hover:to-[#FAF6F0] border border-amber-800/10 hover:border-amber-600/30 p-5 transition-all duration-300 group/olf flex items-center gap-4 text-left w-full rounded-none cursor-pointer shadow-[0_2px_8px_rgba(27,15,10,0.01)] hover:shadow-[0_15px_30px_rgba(27,15,10,0.04),_0_0_15px_rgba(180,100,50,0.02)]"
                        >
                          {/* Ambient radial glow container */}
                          <div className={`absolute inset-0 bg-gradient-to-r ${item.glow} opacity-0 group-hover/olf:opacity-100 transition-all duration-700 pointer-events-none`}></div>
 
                          {/* Sensory Gold-Rimmed Icon Ring */}
                          <div className="relative w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0 text-base z-10 group-hover/olf:border-amber-500/40 group-hover/olf:bg-amber-500/20 group-hover/olf:scale-[1.15] transition-all duration-300">
                            {item.symbol}
                          </div>
 
                          <div className="flex-grow flex flex-col min-w-0 z-10">
                            <span className="text-[13px] font-extrabold tracking-[0.15em] text-neutral-800 group-hover/olf:text-amber-800 transition-colors duration-300 uppercase">
                              {item.label}
                            </span>
                            <span className="text-[9px] text-neutral-500 group-hover/olf:text-neutral-700 tracking-[0.12em] font-medium mt-1 transition-colors duration-300 leading-relaxed">
                              {item.desc}
                            </span>
                          </div>
 
                          <span className="text-[10px] text-neutral-400 group-hover/olf:text-amber-600 group-hover/olf:translate-x-1.5 transition-all duration-300 flex-shrink-0">
                            ✧
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
 
                  {/* Column 3: AUTEUR BRANDS */}
                  <motion.div variants={megaMenuColumnVariants} className="flex flex-col">
                    <span className="text-[12px] font-black tracking-[0.3em] text-amber-800 uppercase border-b border-amber-800/10 pb-5 mb-6 block font-sans-luxury pl-[0.1em]">
                      AUTEUR BRANDS
                    </span>
                    <ul className="flex flex-col text-xs font-bold tracking-widest text-neutral-800">
                      {[
                        "FILIPPO SORCINELLI",
                        "INITIO PARFUMS PRIVES",
                        "TOM FORD",
                        "RABANNE",
                        "JULIETTE HAS A GUN",
                        "HFC",
                      ].map((bname) => (
                        <li key={bname} className="border-b border-amber-800/10 last:border-0 py-3.5 first:pt-0">
                          <button
                            onClick={() => {
                              setSelectedBrand(bname);
                              setSelectedOlfactory(null);
                              setSelectedCollection(null);
                              setIsMegaMenuOpen(false);
                              const el = document.getElementById("new-in");
                              if (el) el.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="text-neutral-800 hover:text-amber-800 hover:translate-x-2.5 transition-all duration-300 uppercase cursor-pointer flex items-center justify-between group text-left w-full text-[12.5px] font-extrabold tracking-[0.22em] truncate"
                          >
                            <div className="flex items-center gap-3.5">
                              <span className="w-1.5 h-1.5 border border-amber-600/30 bg-amber-500/10 group-hover:bg-amber-600 group-hover:border-amber-600 rounded-none transform rotate-45 group-hover:rotate-135 transition-all duration-300"></span>
                              <span>{bname.replace(" PARFUMS PRIVES", "")}</span>
                            </div>
 
                            {/* Classy location origin tags */}
                            <span className="text-[8.5px] text-neutral-500 group-hover:text-amber-800 tracking-[0.25em] font-bold uppercase transition-colors select-none">
                              {bname === "FILIPPO SORCINELLI" ? "ITALY" : bname === "INITIO PARFUMS PRIVES" ? "PARIS" : bname === "TOM FORD" ? "NEW YORK" : bname === "RABANNE" ? "FRANCE" : "GRASSE"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
 
                  {/* Column 4: CINEMATIC SPOTLIGHT */}
                  <motion.div
                    variants={megaMenuColumnVariants}
                    className="flex flex-col bg-white hover:bg-[#FAF6F0] border border-amber-800/10 hover:border-amber-600/30 p-6 relative overflow-hidden group/spot shadow-[0_4px_20px_rgba(27,15,10,0.02)] hover:shadow-[0_25px_60px_rgba(180,100,50,0.06)] transition-all duration-500 rounded-none"
                  >
                    {/* Background Halo */}
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.01] to-transparent pointer-events-none z-0"></div>
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-48 h-48 bg-radial from-amber-500/[0.05] to-transparent rounded-full blur-[35px] pointer-events-none z-0"></div>
 
                    <div className="absolute top-3 right-3 text-[7.5px] tracking-[0.3em] font-extrabold text-amber-800 uppercase bg-[#FAF6F0] border border-amber-800/20 px-2 py-1 z-10 shadow-[0_2px_8px_rgba(27,15,10,0.03)]">
                      FEATURED ✧
                    </div>
 
                    <motion.div
                      inherit={false}
                      variants={{}}
                      whileHover={{ y: -6, rotate: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="relative w-full h-[140px] flex items-center justify-center mb-5 cursor-pointer z-10"
                      onClick={() => {
                        setSelectedBrand("FILIPPO SORCINELLI");
                        setSelectedOlfactory(null);
                        setSelectedCollection(null);
                        setIsMegaMenuOpen(false);
                        const el = document.getElementById("new-in");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      <Image
                        src="/catalog_sorcinelli_epicentro.png"
                        alt="Epicentro Filippo Sorcinelli"
                        width={95}
                        height={115}
                        className="object-contain z-10 filter drop-shadow-[0_12px_22px_rgba(27,15,10,0.05)] group-hover/spot:scale-105 transition-transform duration-700"
                      />
                    </motion.div>
 
                    <div className="flex flex-col text-left z-10 mt-auto font-sans-luxury">
                      <span className="text-[9.5px] font-black tracking-[0.3em] text-amber-700 uppercase">
                        FILIPPO SORCINELLI
                      </span>
                      <h4 className="text-[16px] font-serif-luxury font-semibold text-neutral-800 tracking-wider uppercase mt-1.5 line-clamp-1 group-hover/spot:text-amber-800 transition-colors">
                        EPICENTRO
                      </h4>
                      <p className="text-[9.5px] leading-relaxed text-neutral-500 group-hover/spot:text-neutral-700 mt-2.5 tracking-[0.12em] uppercase line-clamp-2">
                        Artistic volcanic incense formulation with raw metallic cap.
                      </p>
 
                      <button
                        onClick={() => {
                          setSelectedBrand("FILIPPO SORCINELLI");
                          setSelectedOlfactory(null);
                          setSelectedCollection(null);
                          setIsMegaMenuOpen(false);
                          const el = document.getElementById("new-in");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="mt-5 w-full bg-neutral-900 text-white hover:bg-amber-950 hover:text-white font-extrabold tracking-[0.25em] text-[9.5px] py-4 transition-all duration-300 text-center cursor-pointer shadow-[0_10px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_15px_30px_rgba(180,100,50,0.12)] border border-neutral-900 hover:border-amber-950 uppercase relative overflow-hidden group-hover/spot:bg-neutral-800"
                      >
                        <span className="relative z-10">ACQUIRE SCENT — $326.00</span>
                      </button>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>

        {/* 2. Main Hero Section */}
        <main className="flex-grow max-w-[1440px] mx-auto w-full px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-0 items-center py-4 lg:py-0 relative z-10 overflow-hidden">
          {/* Left Panel: Headline */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={revealInterface ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="lg:col-span-4 flex flex-col justify-end h-full py-4 lg:py-12"
          >
            <div className="mb-6 lg:mb-16 w-full">
              <h1 className="text-4xl md:text-5xl lg:text-[56px] font-medium leading-[1.1] tracking-tight font-serif-luxury max-w-md">
                World-Class Luxury<br />
                Perfume Collective <br />
                Gharib
              </h1>
              <p className="mt-3 text-xs tracking-[0.15em] text-white/50 font-sans-luxury">
                {activeProduct.tagline.toUpperCase()}
              </p>
            </div>
          </motion.div>

          {/* Center Panel: Empty spacer to let the background video play freely */}
          <div className="lg:col-span-4 pointer-events-none hidden lg:block"></div>

          {/* Right Panel: Active Product Details & Inline Miniature Image */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={revealInterface ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            className="lg:col-span-4 flex flex-col justify-between h-full py-4 lg:py-10 lg:pl-12"
          >
            {/* Header Block: Price, Miniature Bottle, and Navigation Arrows */}
            <div className="mt-2 lg:mt-6">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 w-full">
                {/* Product Price & Name */}
                <div className={`transition-all duration-500 ${isAnimating ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"} min-w-[130px]`}>
                  <div className="text-[26px] font-serif-luxury font-medium tracking-wide">
                    {activeProduct.price}
                  </div>
                  <div className="text-xs tracking-[0.2em] font-medium text-white/50 uppercase mt-0.5">
                    {activeProduct.title}
                  </div>
                </div>

                {/* Inline Miniature Floating Perfume Image */}
                <div className="flex-grow flex justify-center items-center relative min-h-[90px] max-w-[140px] px-2">
                  <div
                    className={`relative w-[65px] h-[85px] md:w-[75px] md:h-[95px] transition-all-custom ${isAnimating ? "opacity-0 scale-90 rotate-6 blur-sm" : "opacity-100 scale-100 rotate-0"
                      }`}
                  >
                    <div className="w-full h-full relative flex items-center justify-center animate-float-main">
                      <div className="w-[85%] h-[85%] relative">
                        <Image
                          src={activeProduct.image}
                          alt={activeProduct.title}
                          fill
                          priority
                          className="object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation Arrows pushed all the way to the right */}
                <div className="flex items-center gap-4 text-lg text-white/60 ml-auto">
                  <button
                    onClick={handlePrev}
                    className="hover:text-white p-2 transition-all duration-300 hover:translate-x-[-3px] cursor-pointer"
                    aria-label="Previous Fragrance"
                  >
                    ←
                  </button>
                  <span className="text-white/20">|</span>
                  <button
                    onClick={handleNext}
                    className="hover:text-white p-2 transition-all duration-300 hover:translate-x-[3px] cursor-pointer"
                    aria-label="Next Fragrance"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Description Paragraph */}
              <div className="mt-6 max-w-md">
                <p className={`text-xs md:text-[13px] leading-relaxed tracking-wider text-white/70 font-light font-sans-luxury transition-all duration-500 ${isAnimating ? "opacity-0" : "opacity-100"
                  }`}>
                  {activeProduct.description}
                </p>
              </div>
            </div>

            {/* CTA Action Buttons */}
            <div className="flex items-center gap-8 mt-6 lg:mt-10">
              <button className="bg-white text-black px-8 py-3.5 text-xs font-semibold tracking-[0.2em] uppercase rounded-none hover:bg-white/90 hover:scale-102 hover:shadow-[0_10px_20px_rgba(255,255,255,0.1)] transition-all duration-300">
                Shop Now
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById("about");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs font-semibold tracking-[0.2em] uppercase text-white/80 hover:text-white flex items-center gap-2 group transition-colors duration-300 cursor-pointer"
              >
                <span>About Us</span>
                <span className="group-hover:translate-y-0.5 group-hover:scale-105 transition-transform duration-300">▼</span>
              </button>
            </div>
          </motion.div>
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
            <div className="w-full md:flex-grow overflow-hidden flex items-center relative min-h-[110px] bg-transparent">
              <div className="animate-marquee-track flex divide-x divide-white/10">
                {/* Loop 1 */}
                {PRODUCTS.map((prod, index) => {
                  const isSelfActive = activeIndex === index;
                  return (
                    <div
                      key={`loop1-${prod.id}`}
                      onClick={() => handleSelectProduct(index)}
                      className={`p-4 md:p-5 lg:p-6 flex items-center justify-between gap-6 cursor-pointer transition-all-custom group min-h-[110px] w-[260px] md:w-[320px] flex-shrink-0 ${isSelfActive
                        ? "bg-white/5 shadow-inner"
                        : "hover:bg-white/[0.02]"
                        }`}
                    >
                      {/* Left product detail */}
                      <div className="flex flex-col justify-between h-full min-h-[75px] max-w-[70%]">
                        <div>
                          <span className="text-[14px] font-serif-luxury font-medium block">
                            {prod.price}
                          </span>
                          <span className="text-[10px] font-semibold tracking-[0.15em] text-white/90 uppercase mt-0.5 block">
                            {prod.title}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/45 tracking-wider line-clamp-1 mt-1 group-hover:text-white/60 transition-colors duration-300">
                          {prod.description}
                        </p>
                      </div>

                      {/* Right product bottle thumbnail */}
                      <div className="w-12 h-16 md:w-14 md:h-18 lg:w-16 lg:h-20 relative flex-shrink-0 flex items-center justify-center">
                        <div className="absolute inset-0 bg-white/2 blur-lg rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                        <Image
                          src={prod.image}
                          alt={prod.title}
                          fill
                          className={`object-contain transition-all duration-500 ${isSelfActive
                            ? "scale-105 filter drop-shadow-[0_4px_8px_rgba(255,255,255,0.15)]"
                            : "scale-90 group-hover:scale-100 group-hover:rotate-3 drop-shadow-[0_6px_12px_rgba(0,0,0,0.4)]"
                            }`}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Loop 2 */}
                {PRODUCTS.map((prod, index) => {
                  const isSelfActive = activeIndex === index;
                  return (
                    <div
                      key={`loop2-${prod.id}`}
                      onClick={() => handleSelectProduct(index)}
                      className={`p-4 md:p-5 lg:p-6 flex items-center justify-between gap-6 cursor-pointer transition-all-custom group min-h-[110px] w-[260px] md:w-[320px] flex-shrink-0 ${isSelfActive
                        ? "bg-white/5 shadow-inner"
                        : "hover:bg-white/[0.02]"
                        }`}
                    >
                      {/* Left product detail */}
                      <div className="flex flex-col justify-between h-full min-h-[75px] max-w-[70%]">
                        <div>
                          <span className="text-[14px] font-serif-luxury font-medium block">
                            {prod.price}
                          </span>
                          <span className="text-[10px] font-semibold tracking-[0.15em] text-white/90 uppercase mt-0.5 block">
                            {prod.title}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/45 tracking-wider line-clamp-1 mt-1 group-hover:text-white/60 transition-colors duration-300">
                          {prod.description}
                        </p>
                      </div>

                      {/* Right product bottle thumbnail */}
                      <div className="w-12 h-16 md:w-14 md:h-18 lg:w-16 lg:h-20 relative flex-shrink-0 flex items-center justify-center">
                        <div className="absolute inset-0 bg-white/2 blur-lg rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                        <Image
                          src={prod.image}
                          alt={prod.title}
                          fill
                          className={`object-contain transition-all duration-500 ${isSelfActive
                            ? "scale-105 filter drop-shadow-[0_4px_8px_rgba(255,255,255,0.15)]"
                            : "scale-90 group-hover:scale-100 group-hover:rotate-3 drop-shadow-[0_6px_12px_rgba(0,0,0,0.4)]"
                            }`}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Loop 3 */}
                {PRODUCTS.map((prod, index) => {
                  const isSelfActive = activeIndex === index;
                  return (
                    <div
                      key={`loop3-${prod.id}`}
                      onClick={() => handleSelectProduct(index)}
                      className={`p-4 md:p-5 lg:p-6 flex items-center justify-between gap-6 cursor-pointer transition-all-custom group min-h-[110px] w-[260px] md:w-[320px] flex-shrink-0 ${isSelfActive
                        ? "bg-white/5 shadow-inner"
                        : "hover:bg-white/[0.02]"
                        }`}
                    >
                      {/* Left product detail */}
                      <div className="flex flex-col justify-between h-full min-h-[75px] max-w-[70%]">
                        <div>
                          <span className="text-[14px] font-serif-luxury font-medium block">
                            {prod.price}
                          </span>
                          <span className="text-[10px] font-semibold tracking-[0.15em] text-white/90 uppercase mt-0.5 block">
                            {prod.title}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/45 tracking-wider line-clamp-1 mt-1 group-hover:text-white/60 transition-colors duration-300">
                          {prod.description}
                        </p>
                      </div>

                      {/* Right product bottle thumbnail */}
                      <div className="w-12 h-16 md:w-14 md:h-18 lg:w-16 lg:h-20 relative flex-shrink-0 flex items-center justify-center">
                        <div className="absolute inset-0 bg-white/2 blur-lg rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                        <Image
                          src={prod.image}
                          alt={prod.title}
                          fill
                          className={`object-contain transition-all duration-500 ${isSelfActive
                            ? "scale-105 filter drop-shadow-[0_4px_8px_rgba(255,255,255,0.15)]"
                            : "scale-90 group-hover:scale-100 group-hover:rotate-3 drop-shadow-[0_6px_12px_rgba(0,0,0,0.4)]"
                            }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* 2. Bento Grid Section - Rich Dark Brown & Gold Aesthetic */}
      <section
        id="about"
        className="w-full bg-gradient-to-b from-[#070200] via-[#1b0f0a] to-[#070200] px-0 py-0 border-t border-white/5 relative z-10 flex flex-col items-center"
      >
        {/* Subtle background luxury glow spots */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#522a16]/10 rounded-full blur-[120px] pointer-events-none"></div>



        {/* Bento Grid Container - Full screen edge-to-edge */}
        <div className="w-full max-w-none grid grid-cols-1 md:grid-cols-3 gap-0 relative z-10">

          {/* CARD 1: The Long Card (Ice Video background) - 2 Columns wide */}
          <div
            className="md:col-span-2 aspect-video rounded-none overflow-hidden relative border-b md:border-r border-white/10 hover:border-amber-500/35 hover:shadow-[0_0_40px_rgba(212,175,55,0.06)] group transition-all duration-700 flex flex-col justify-end p-8 md:p-10"
          >
            {/* Background Ice Video */}
            <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none scale-100 group-hover:scale-102 transition-transform duration-[1.2s] ease-out">
              <div className="absolute inset-0 bg-gradient-to-t from-[#130702] via-[#24150e]/65 to-black/20 z-10"></div>
              <video
                autoPlay
                muted
                playsInline
                loop
                preload="metadata"
                poster="/Perfume_bottle_on_ice_poster.jpg"
                className="w-full h-full object-cover"
              >
                <source src="/Perfume_bottle_on_ice_optimized.mp4" type="video/mp4" />
              </video>
            </div>

            {/* Top Left Badge inside Card */}
            <div className="absolute top-6 left-6 z-20">
              <span className="inline-flex items-center justify-center whitespace-nowrap border border-amber-500/35 bg-[#23150e]/85 backdrop-blur-md text-amber-400 text-[10px] tracking-[0.15em] uppercase px-4 py-1.5 font-extrabold rounded-none">
                TRENDING
              </span>
            </div>

            {/* Card Content Overlay */}
            <div className="relative z-20 max-w-lg">
              <h3 className="text-3xl md:text-5xl font-serif-luxury font-medium tracking-wide text-white leading-tight">
                Rasasi Hawas Ice
              </h3>
            </div>
          </div>

          {/* CARD 2: Box Card 1 (Amber Duo Offer) - 1 Column wide */}
          <div
            className="aspect-[4/3] md:aspect-auto rounded-none overflow-hidden relative bg-[#23150e]/30 backdrop-blur-md border-b border-white/10 hover:border-amber-500/35 hover:shadow-[0_0_45px_rgba(212,175,55,0.08)] group transition-all duration-700 flex flex-col justify-end p-8"
          >
            {/* Absolute Background Image with Zoom hover effect */}
            <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 z-10"></div>
              <Image
                src="/bento-amber-duo-dark.png"
                alt="Exclusive Duo Campaign"
                fill
                className="object-cover scale-100 group-hover:scale-105 transition-transform duration-[1.2s] ease-out opacity-75 group-hover:opacity-90"
              />
            </div>

            {/* Creative Luxury Glass Plaque */}
            <div className="relative z-20 self-start translate-y-0 group-hover:-translate-y-1 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="bg-black/65 backdrop-blur-md border border-amber-500/20 p-5 md:p-6 text-left relative overflow-hidden transition-colors duration-500 group-hover:border-amber-500/45">
                {/* Thin gold decorative frame */}
                <div className="absolute inset-1 border border-amber-500/10 pointer-events-none"></div>
                {/* Small luxury sub-label */}
                <span className="block text-[8px] tracking-[0.25em] uppercase text-amber-500/80 mb-1.5 font-bold pl-[0.25em]">
                  CAMPAIGN PRIVATE DUO
                </span>
                {/* Main Offer text */}
                <h3 className="text-xl md:text-2xl lg:text-3xl font-serif-luxury text-white font-medium tracking-[0.05em] select-none">
                  20% OFF
                </h3>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3. High-Fashion Minimalist E-Commerce Catalog Suite */}

      {/* ==========================================
          SECTION 1: THE NEW RELEASES (#new-in)
          ========================================== */}
      <section id="new-in" className="w-full bg-[#FAF5EF] text-black relative z-10 border-t border-[#EAE3DB] px-4 md:px-8 lg:px-12 py-20 flex flex-col items-center">



        {/* Dedicated Search & Filter Results Block */}
        {isFiltered ? (
          <div className="w-full max-w-[1360px] min-h-[400px]">
            <div className="w-full flex flex-col md:flex-row md:items-baseline justify-between border-b border-black/10 pb-6 mb-10 gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-black font-sans-luxury uppercase">
                  {selectedCollection ? `${selectedCollection} collection` : "FILTERED CURATION"}
                </h2>
                <div className="flex flex-wrap gap-2 items-center">
                  {searchTerm.trim() !== "" && (
                    <span className="bg-amber-100/80 text-amber-900 border border-amber-200/50 text-[10px] tracking-widest font-extrabold uppercase px-2.5 py-1.5 flex items-center gap-1.5">
                      Search: &ldquo;{searchTerm}&rdquo;
                      <button onClick={() => setSearchTerm("")} className="hover:text-red-700 font-bold ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {selectedOlfactory && (
                    <span className="bg-amber-100/80 text-amber-900 border border-amber-200/50 text-[10px] tracking-widest font-extrabold uppercase px-2.5 py-1.5 flex items-center gap-1.5">
                      Olfactory: {selectedOlfactory}
                      <button onClick={() => setSelectedOlfactory(null)} className="hover:text-red-700 font-bold ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {selectedBrand && (
                    <span className="bg-amber-100/80 text-amber-900 border border-amber-200/50 text-[10px] tracking-widest font-extrabold uppercase px-2.5 py-1.5 flex items-center gap-1.5">
                      Brand: {selectedBrand}
                      <button onClick={() => setSelectedBrand(null)} className="hover:text-red-700 font-bold ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                  {selectedCollection && (
                    <span className="bg-amber-100/80 text-amber-900 border border-amber-200/50 text-[10px] tracking-widest font-extrabold uppercase px-2.5 py-1.5 flex items-center gap-1.5">
                      Collection: {selectedCollection}
                      <button onClick={() => setSelectedCollection(null)} className="hover:text-red-700 font-bold ml-0.5 cursor-pointer">✕</button>
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedOlfactory(null);
                  setSelectedBrand(null);
                  setSelectedCollection(null);
                }}
                className="text-xs font-bold tracking-widest text-[#8C8276] hover:text-black uppercase border-b border-black/20 self-start md:self-auto cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>

            {(() => {
              let matched = CATALOG_PRODUCTS;

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
                }
              }

              if (matched.length === 0) {
                return (
                  <div className="w-full text-center py-20 bg-white border border-black/10 flex flex-col items-center justify-center p-8 rounded-none">
                    <span className="text-4xl text-[#8C8276]/30 mb-4 block">✧</span>
                    <h3 className="text-lg font-serif-luxury font-medium tracking-widest uppercase text-black mb-2">No Fragrances Found</h3>
                    <p className="text-xs text-[#8C8276] tracking-widest max-w-sm uppercase">We could not find any scents matching your active filters. Try resetting filters.</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {matched.map(prod => {
                    const isFav = favorites.includes(prod.id);
                    const activeSize = selectedSizes[prod.id] || prod.sizes[0];
                    return (
                      <ProductCard
                        key={prod.id}
                        prod={prod}
                        isFav={isFav}
                        activeSize={activeSize}
                        onToggleFavorite={toggleFavorite}
                        onSelectSize={selectSize}
                        onAddToCart={handleAddToCart}
                        badgeText={prod.isFeaturedLarge ? "FEATURED ART" : selectedOlfactory ? selectedOlfactory.toUpperCase() : selectedBrand ? selectedBrand.replace(" PARFUMS PRIVES", "") : "CURATED"}
                      />
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : (
          /* Main multi-section view when search is empty */
          <div className="w-full max-w-[1360px]">

            {/* Section Header */}
            <div className="w-full flex flex-wrap items-baseline justify-between border-b border-black/10 pb-6 mb-10">
              <div className="flex items-baseline gap-6">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-black font-sans-luxury select-none">
                  NEW IN
                </h2>
                <span className="text-xs tracking-[0.15em] text-[#8C8276] uppercase font-bold pl-[0.15em]">
                  / Premium Summer Releases
                </span>
              </div>
              <div className="text-xs font-bold tracking-[0.15em] text-[#8C8276] uppercase hidden sm:block">
                Scroll for Bestsellers ▼
              </div>
            </div>

            {/* Grid of New In items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
              {CATALOG_PRODUCTS.filter(p => p.isNew).map(prod => {
                const isFav = favorites.includes(prod.id);
                const activeSize = selectedSizes[prod.id] || prod.sizes[0];
                return (
                  <ProductCard
                    key={prod.id}
                    prod={prod}
                    isFav={isFav}
                    activeSize={activeSize}
                    onToggleFavorite={toggleFavorite}
                    onSelectSize={selectSize}
                    onAddToCart={handleAddToCart}
                    badgeText={prod.isFeaturedLarge ? "FEATURED ART" : "NEW IN"}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Bento Grid Row 2 - Offers & Archives */}
      {!isFiltered && (
        <section
          id="promotions"
          className="w-full bg-gradient-to-b from-[#070200] via-[#1b0f0a] to-[#070200] px-0 py-0 border-t border-[#FAF5EF]/10 relative z-10 flex flex-col items-center"
        >
          {/* Bento Grid Container - Full screen edge-to-edge */}
          <div className="w-full max-w-none grid grid-cols-1 md:grid-cols-3 gap-0 relative z-10">

            {/* CARD 3: Box Card 2 (Vault Clearance) - 1 Column wide */}
            <div
              className="aspect-[4/3] md:aspect-[8/9] rounded-none overflow-hidden relative bg-[#23150e]/30 backdrop-blur-md border-b md:border-b-0 md:border-r border-white/10 hover:border-amber-500/35 hover:shadow-[0_0_45px_rgba(212,175,55,0.08)] group transition-all duration-700 flex flex-col justify-end p-6"
            >
              {/* Background Image */}
              <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 z-10"></div>
                <Image
                  src="/bento-oud-bundle-dark.png"
                  alt="Premium Trilogy Collection"
                  fill
                  className="object-cover scale-100 group-hover:scale-105 transition-transform duration-[1.2s] ease-out opacity-75 group-hover:opacity-90"
                />
              </div>

              {/* Creative Luxury Glass Plaque */}
              <div className="relative z-20 self-start translate-y-0 group-hover:-translate-y-1 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
                <div className="bg-black/65 backdrop-blur-md border border-amber-500/20 p-5 text-left relative overflow-hidden transition-colors duration-500 group-hover:border-amber-500/45">
                  {/* Thin gold decorative frame */}
                  <div className="absolute inset-1 border border-amber-500/10 pointer-events-none"></div>
                  {/* Small luxury sub-label */}
                  <span className="block text-[8px] tracking-[0.25em] uppercase text-amber-500/80 mb-1.5 font-bold pl-[0.25em]">
                    ARCHIVE VAULT
                  </span>
                  {/* Main Offer text */}
                  <h3 className="text-xl md:text-2xl font-serif-luxury text-white font-medium tracking-[0.05em] select-none">
                    CLEARANCE
                  </h3>
                </div>
              </div>
            </div>

            {/* CARD 4: Box Card 3 (BOGO Gifting) - 1 Column wide */}
            <div
              className="aspect-[4/3] md:aspect-[8/9] rounded-none overflow-hidden relative bg-[#23150e]/30 backdrop-blur-md border-b md:border-b-0 md:border-r border-white/10 hover:border-amber-500/35 hover:shadow-[0_0_45px_rgba(212,175,55,0.08)] group transition-all duration-700 flex flex-col justify-end p-6"
            >
              {/* Background Image */}
              <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 z-10"></div>
                <Image
                  src="/bento-vanilla-box-dark.png"
                  alt="Luxury Gift Box"
                  fill
                  className="object-cover scale-100 group-hover:scale-105 transition-transform duration-[1.2s] ease-out opacity-75 group-hover:opacity-90"
                />
              </div>

              {/* Creative Luxury Glass Plaque */}
              <div className="relative z-20 self-start translate-y-0 group-hover:-translate-y-1 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
                <div className="bg-black/65 backdrop-blur-md border border-amber-500/20 p-5 text-left relative overflow-hidden transition-colors duration-500 group-hover:border-amber-500/45">
                  {/* Thin gold decorative frame */}
                  <div className="absolute inset-1 border border-amber-500/10 pointer-events-none"></div>
                  {/* Small luxury sub-label */}
                  <span className="block text-[8px] tracking-[0.25em] uppercase text-amber-500/80 mb-1.5 font-bold pl-[0.25em]">
                    GIFT COMPLIMENTARY
                  </span>
                  {/* Main Offer text */}
                  <h3 className="text-xl md:text-2xl font-serif-luxury text-white font-medium tracking-[0.05em] select-none">
                    BOGO
                  </h3>
                </div>
              </div>
            </div>

            {/* CARD 5: Box Card 4 (50% Off Last Chance) - 1 Column wide */}
            <div
              className="aspect-[4/3] md:aspect-[8/9] rounded-none overflow-hidden relative bg-[#23150e]/30 backdrop-blur-md border border-transparent hover:border-amber-500/35 hover:shadow-[0_0_45px_rgba(212,175,55,0.08)] group transition-all duration-700 flex flex-col justify-end p-6"
            >
              {/* Background Image */}
              <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 z-10"></div>
                <Image
                  src="/bento-sandalwood-trio-dark.png"
                  alt="Signature Trio Selection"
                  fill
                  className="object-cover scale-100 group-hover:scale-105 transition-transform duration-[1.2s] ease-out opacity-75 group-hover:opacity-90"
                />
              </div>

              {/* Creative Luxury Glass Plaque */}
              <div className="relative z-20 self-start translate-y-0 group-hover:-translate-y-1 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
                <div className="bg-black/65 backdrop-blur-md border border-amber-500/20 p-5 text-left relative overflow-hidden transition-colors duration-500 group-hover:border-amber-500/45">
                  {/* Thin gold decorative frame */}
                  <div className="absolute inset-1 border border-amber-500/10 pointer-events-none"></div>
                  {/* Small luxury sub-label */}
                  <span className="block text-[8px] tracking-[0.25em] uppercase text-amber-500/80 mb-1.5 font-bold pl-[0.25em]">
                    LAST CHANCE ARCHIVE
                  </span>
                  {/* Main Offer text */}
                  <h3 className="text-xl md:text-2xl font-serif-luxury text-white font-medium tracking-[0.05em] select-none">
                    50% OFF
                  </h3>
                </div>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ==========================================
          SECTION 2: THE BEST SELLERS (#best-sellers)
          ========================================== */}
      {!isFiltered && (
        <section id="best-sellers" className="w-full bg-white text-black relative z-10 border-t border-[#EAE3DB] px-4 md:px-8 lg:px-12 py-24 flex flex-col items-center">
          <div className="w-full max-w-[1360px]">

            {/* Section Header matching "Zen" layout */}
            <div className="w-full flex flex-wrap items-baseline justify-between border-b border-black/10 pb-6 mb-12">
              <div className="flex items-baseline gap-6">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-black font-sans-luxury select-none">
                  BEST SELLERS
                </h2>
                <span className="text-xs tracking-[0.15em] text-[#8C8276] uppercase font-bold pl-[0.15em]">
                  / Most Desired Signatures
                </span>
              </div>
              <div className="text-xs font-bold tracking-[0.15em] text-[#8C8276] uppercase">
                Aesthetic Curation
              </div>
            </div>

            {/* Asymmetrical Grid matching "Zen" reference layout perfectly! */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {CATALOG_PRODUCTS.filter(p => p.isBestSeller).map(prod => {
                const isFav = favorites.includes(prod.id);
                const activeSize = selectedSizes[prod.id] || prod.sizes[0];
                return (
                  <ProductCard
                    key={prod.id}
                    prod={prod}
                    isFav={isFav}
                    activeSize={activeSize}
                    onToggleFavorite={toggleFavorite}
                    onSelectSize={selectSize}
                    onAddToCart={handleAddToCart}
                    badgeText={prod.isFeaturedLarge ? "BESTSELLER FEATURE" : "BESTSELLER"}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ==========================================
          EDITORIAL BANNER 1: GOLD MEMOIR CAMPAIGN
          ========================================== */}
      {!isFiltered && (
        <section className="w-full bg-[#0a0503] border-t border-b border-white/5 relative overflow-hidden py-24 md:py-32">
          {/* Ambient gold blur highlights */}
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-yellow-600/5 blur-[100px] pointer-events-none"></div>

          <div className="w-full max-w-[1360px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center px-6 md:px-12 relative z-10 text-left">
            {/* Left Column: Narrative Copy */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <span className="tracking-[0.3em] text-[10px] font-extrabold text-amber-500 uppercase mb-4 pl-1 block">
                CAMPAIGN VOL. I — GOLD MEMOIR
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif-luxury font-light tracking-wide text-white leading-tight uppercase mb-6">
                A Symphony <br />
                <span className="font-serif-luxury italic text-amber-400 font-normal">of Golden</span> Senses
              </h2>
              <p className="text-[11px] leading-relaxed text-[#c3b19c] tracking-widest max-w-xl uppercase mb-8 font-light">
                A majestic fusion of hand-pressed Tunisian orange blossom, rich organic amber resins, and pure Cambodian oud oil. Encased in high-contrast gilded glass, curated to evoke the radiant warmth of Arabian summer suns.
              </p>
              <div className="flex">
                <a
                  href="#new-in"
                  className="inline-block bg-white text-black hover:bg-amber-400 hover:text-white px-8 py-4 text-[9px] font-bold tracking-[0.25em] uppercase transition-all duration-300 rounded-none cursor-pointer border border-white hover:border-amber-400 active:scale-95"
                >
                  Discover Gold Memoir
                </a>
              </div>
            </div>

            {/* Right Column: Immersive Image Frame */}
            <div className="lg:col-span-5">
              <div className="relative aspect-[4/5] lg:aspect-[4/5] w-full min-h-[400px] overflow-hidden border border-white/10 group bg-neutral-900/50 shadow-2xl">
                {/* Subtle golden corner framing lines */}
                <div className="absolute top-3 left-3 w-6 h-6 border-t border-l border-amber-500/30 z-20 pointer-events-none group-hover:scale-105 transition-transform duration-700"></div>
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-amber-500/30 z-20 pointer-events-none group-hover:scale-105 transition-transform duration-700"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10 pointer-events-none"></div>
                <Image
                  src="/campaign-gold.png"
                  alt="Gold Memoir Campaign Visual"
                  fill
                  className="object-cover scale-100 group-hover:scale-105 transition-transform duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  priority
                />
              </div>
            </div>
          </div>
        </section>
      )}


      {/* ==========================================
          SECTION 3: EXCLUSIVE OFFERS (#offers)
          ========================================== */}
      {!isFiltered && (
        <section id="offers" className="w-full bg-[#FAF5EF] text-black relative z-10 border-t border-[#EAE3DB] px-4 md:px-8 lg:px-12 py-24 flex flex-col items-center">
          <div className="w-full max-w-[1360px]">

            {/* Section Header */}
            <div className="w-full flex flex-wrap items-baseline justify-between border-b border-black/10 pb-6 mb-12">
              <div className="flex items-baseline gap-6">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-black font-sans-luxury select-none">
                  EXCLUSIVE OFFERS
                </h2>
                <span className="text-xs tracking-[0.15em] text-[#8C8276] uppercase font-bold pl-[0.15em]">
                  / Custom Selections (Favorites: {favorites.length})
                </span>
              </div>
              <div className="text-xs font-bold tracking-[0.15em] text-[#8C8276] uppercase">
                Curated Archives
              </div>
            </div>

            {/* Dynamic Vault Display */}
            {(() => {
              const likedProducts = CATALOG_PRODUCTS.filter(p => favorites.includes(p.id));

              if (likedProducts.length === 0) {
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="w-full text-center py-24 bg-white border border-black/10 flex flex-col items-center justify-center p-8 rounded-none relative overflow-hidden"
                  >
                    <div className="absolute inset-1 border border-black/[0.03] pointer-events-none"></div>
                    <span className="text-4xl text-[#8C8276]/30 mb-4 block">✧</span>
                    <h3 className="text-lg font-serif-luxury font-medium tracking-widest uppercase text-black mb-2">
                      Your Exclusive Offers are Empty
                    </h3>
                    <p className="text-xs text-[#8C8276] tracking-widest max-w-md mx-auto leading-relaxed uppercase mb-6">
                      Explore our collections above and touch the heart icon on any perfume card to curate your own personal exclusive offers.
                    </p>
                    <a
                      href="#new-in"
                      className="bg-black text-white text-[10px] font-extrabold tracking-[0.2em] uppercase px-8 py-3.5 hover:bg-black/90 transition-all duration-300 rounded-none cursor-pointer"
                    >
                      Explore Catalog
                    </a>
                  </motion.div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {likedProducts.map(prod => {
                    const isFav = true;
                    const activeSize = selectedSizes[prod.id] || prod.sizes[0];
                    return (
                      <ProductCard
                        key={prod.id}
                        prod={prod}
                        isFav={isFav}
                        activeSize={activeSize}
                        onToggleFavorite={toggleFavorite}
                        onSelectSize={selectSize}
                        onAddToCart={handleAddToCart}
                        badgeText="EXCLUSIVE OFFER"
                      />
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* ==========================================
          SECTION 4: THE ATELIER CURATIONS (#atelier-curations)
          ========================================== */}
      {!isFiltered && (
        <section id="atelier-curations" className="w-full bg-white text-black relative z-10 border-t border-[#EAE3DB] px-4 md:px-8 lg:px-12 py-24 flex flex-col items-center">
          <div className="w-full max-w-[1360px]">

            {/* Section Header */}
            <div className="w-full flex flex-wrap items-baseline justify-between border-b border-black/10 pb-6 mb-12">
              <div className="flex items-baseline gap-6">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-black font-sans-luxury select-none">
                  ATELIER CURATIONS
                </h2>
                <span className="text-xs tracking-[0.15em] text-[#8C8276] uppercase font-bold pl-[0.15em]">
                  / Elite Fragrance Masterpieces
                </span>
              </div>
              <div className="text-xs font-bold tracking-[0.15em] text-[#8C8276] uppercase">
                Dubai Atelier Edit
              </div>
            </div>

            {/* Grid showing both Filippo Sorcinelli artistic bottles + Marc-Antoine Barrois + Initio Oud */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {CATALOG_PRODUCTS.filter(p => p.id === 8 || p.id === 9 || p.id === 1 || p.id === 3).map(prod => {
                const isFav = favorites.includes(prod.id);
                const activeSize = selectedSizes[prod.id] || prod.sizes[0];
                return (
                  <ProductCard
                    key={prod.id}
                    prod={prod}
                    isFav={isFav}
                    activeSize={activeSize}
                    onToggleFavorite={toggleFavorite}
                    onSelectSize={selectSize}
                    onAddToCart={handleAddToCart}
                    badgeText={prod.isFeaturedLarge ? "ATELIER FEATURE" : "ATELIER ARCHIVE"}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ==========================================
          EDITORIAL BANNER 3: ATELIER DUBAI EDIT
          ========================================== */}
      {!isFiltered && (
        <section className="w-full bg-[#08090a] border-t border-b border-white/5 relative overflow-hidden py-24 md:py-32">
          {/* Ambient silver blur highlights */}
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-slate-800/15 blur-[125px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-[#A0A0A0]/5 blur-[100px] pointer-events-none"></div>

          <div className="w-full max-w-[1360px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center px-6 md:px-12 relative z-10 text-left">
            {/* Left Column: Narrative Copy */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <span className="tracking-[0.3em] text-[10px] font-extrabold text-[#A0A0A0] uppercase mb-4 pl-1 block">
                CAMPAIGN VOL. III — DUBAI ATELIER EDIT
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif-luxury font-light tracking-wide text-white leading-tight uppercase mb-6">
                Olfactory <br />
                <span className="font-serif-luxury italic text-slate-300 font-normal">Sculptures in</span> Metal
              </h2>
              <p className="text-[11px] leading-relaxed text-[#bbc0c5] tracking-widest max-w-xl uppercase mb-8 font-light">
                Hand-pressed organic glass decanters wrapped meticulously in matte natural leather folds, topped with massive rustic hand-hammered raw metal sculptures that double as visual tactile art. An absolute peak of gothic design and liquid sensory mastery.
              </p>
              <div className="flex">
                <a
                  href="#atelier-curations"
                  className="inline-block bg-white text-black hover:bg-[#202225] hover:text-white px-8 py-4 text-[9px] font-bold tracking-[0.25em] uppercase transition-all duration-300 rounded-none cursor-pointer border border-white hover:border-[#202225] active:scale-95"
                >
                  Enter Scent Atelier
                </a>
              </div>
            </div>

            {/* Right Column: Immersive Image Frame */}
            <div className="lg:col-span-5">
              <div className="relative aspect-[4/5] lg:aspect-[4/5] w-full min-h-[400px] overflow-hidden border border-white/10 group bg-neutral-900/50 shadow-2xl">
                {/* Subtle slate corner framing lines */}
                <div className="absolute top-3 left-3 w-6 h-6 border-t border-l border-slate-500/25 z-20 pointer-events-none group-hover:scale-105 transition-transform duration-700"></div>
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-slate-500/25 z-20 pointer-events-none group-hover:scale-105 transition-transform duration-700"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10 pointer-events-none"></div>
                <Image
                  src="/campaign-silver.png"
                  alt="Dubai Atelier Edit Visual"
                  fill
                  className="object-cover scale-100 group-hover:scale-105 transition-transform duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)]"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. High-Fashion Suede E-Commerce Footer */}
      <footer className="w-full bg-[#FAF5EF] text-black border-t border-[#EAE3DB] relative z-10 font-sans-luxury">
        {/* Main Footer Links & Newsletter */}
        <div className="w-full max-w-[1360px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 py-16 px-6 md:px-12 border-b border-black/10">
          {/* Column 1: Brand manifesto & core identity - takes 4 columns */}
          <div className="lg:col-span-4 text-left flex flex-col justify-between min-h-[160px]">
            <div>
              <h2 className="text-2xl font-serif-luxury font-bold tracking-[0.25em] text-black uppercase mb-4">
                GHARIB
              </h2>
              <p className="text-[11px] leading-relaxed text-[#8C8276] tracking-widest uppercase max-w-sm">
                Curating premium, high-art olfactory masterpieces and private perfume campaigns since 1993. Evoking raw emotion through elite liquid scent signatures.
              </p>
            </div>
            <div className="mt-8 text-[9px] tracking-[0.25em] text-[#8C8276]/60 uppercase">
              Curated globally. Crafted in Dubai.
            </div>
          </div>

          {/* Column 2: Directory links - takes 2 columns */}
          <div className="lg:col-span-2 text-left">
            <h4 className="text-[10px] font-black tracking-[0.25em] text-black uppercase mb-5">
              BOUTIQUE
            </h4>
            <ul className="flex flex-col gap-3 text-[10px] font-bold tracking-[0.15em] text-[#8C8276] uppercase">
              <li><a href="#new-in" className="hover:text-black transition-colors duration-300">New arrivals</a></li>
              <li><a href="#best-sellers" className="hover:text-black transition-colors duration-300">Bestsellers</a></li>
              <li><a href="#offers" className="hover:text-black transition-colors duration-300">Offers</a></li>
              <li><a href="#atelier-curations" className="hover:text-black transition-colors duration-300">Atelier edit</a></li>
            </ul>
          </div>

          {/* Column 3: Care/Support - takes 2 columns */}
          <div className="lg:col-span-2 text-left">
            <h4 className="text-[10px] font-black tracking-[0.25em] text-black uppercase mb-5">
              PRIVATE CARE
            </h4>
            <ul className="flex flex-col gap-3 text-[10px] font-bold tracking-[0.15em] text-[#8C8276] uppercase">
              <li><span className="hover:text-black transition-colors duration-300 cursor-pointer">Private Consult</span></li>
              <li><span className="hover:text-black transition-colors duration-300 cursor-pointer">Shipping & Vaulting</span></li>
              <li><span className="hover:text-black transition-colors duration-300 cursor-pointer">Return Policy</span></li>
              <li><span className="hover:text-black transition-colors duration-300 cursor-pointer">Contact Atelier</span></li>
            </ul>
          </div>

          {/* Column 4: Newsletter subscription - takes 4 columns */}
          <div className="lg:col-span-4 text-left flex flex-col justify-between min-h-[160px]">
            <div>
              <h4 className="text-[10px] font-black tracking-[0.25em] text-black uppercase mb-3">
                JOIN THE PRIVATE SCENT CIRCLE
              </h4>
              <p className="text-[10px] leading-relaxed text-[#8C8276] tracking-widest uppercase mb-6">
                Subscribe to receive private archive releases and exclusive private sale invitations.
              </p>
            </div>

            {/* Newsletter Input Form */}
            {isSubscribed ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] font-bold tracking-[0.15em] text-black uppercase bg-[#EAE3DB]/40 p-3 text-center border border-black/10"
              >
                ✓ Welcome to the private circle.
              </motion.div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); if (subscribedEmail) setIsSubscribed(true); }}
                className="flex items-center border-b border-black pb-2 mt-2 w-full"
              >
                <input
                  type="email"
                  required
                  placeholder="ENTER YOUR EMAIL ATELIER"
                  value={subscribedEmail}
                  onChange={(e) => setSubscribedEmail(e.target.value)}
                  className="bg-transparent text-[10px] tracking-widest text-black placeholder-[#8C8276]/60 uppercase py-1 outline-none w-full font-bold"
                />
                <button
                  type="submit"
                  className="text-black hover:translate-x-1 transition-transform duration-300 pl-2 text-sm font-black cursor-pointer"
                  aria-label="Subscribe"
                >
                  →
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Utility Bar: legal, social, region and currency selects */}
        <div className="w-full max-w-[1360px] mx-auto flex flex-wrap items-center justify-between py-8 px-6 md:px-12 text-[9px] tracking-[0.2em] text-[#8C8276] uppercase font-bold gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <span>© 2026 GHARIB. All Rights Reserved.</span>
            <span className="hover:text-black transition-colors duration-300 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-black transition-colors duration-300 cursor-pointer">Terms of Use</span>
          </div>

          <div className="flex items-center gap-8">
            {/* Currency Selector */}
            <div className="flex items-center gap-2 cursor-pointer hover:text-black transition-colors">
              <span>Currency:</span>
              <span className="text-black font-extrabold">USD ($)</span>
            </div>

            {/* Social handles */}
            <div className="flex items-center gap-4">
              <span className="hover:text-black transition-colors duration-300 cursor-pointer">Instagram</span>
              <span className="hover:text-black transition-colors duration-300 cursor-pointer">Journal</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Relocated Dynamic Interactive Notification Toast */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-8 right-8 z-[200] bg-black text-white px-6 py-4 rounded-none shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-[#EAE3DB]/20 max-w-sm flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-ping"></div>
              <p className="text-[11px] font-sans-luxury tracking-widest font-semibold uppercase leading-normal">
                {showNotification}
              </p>
            </div>
            <button
              onClick={() => setShowNotification(null)}
              className="text-white/40 hover:text-white text-xs tracking-widest font-bold cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Luxury Slide-In Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] cursor-pointer"
            />

            {/* Side Drawer Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 300 } as any}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[460px] bg-[#FAF9F6]/95 backdrop-blur-md border-l border-[#EAE3DB] shadow-[0_0_60px_rgba(0,0,0,0.08)] z-[101] flex flex-col font-sans-luxury text-neutral-900"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#EAE3DB]/60 flex items-center justify-between">
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="group flex items-center gap-2 text-[10px] tracking-[0.25em] text-neutral-500 hover:text-neutral-950 uppercase transition-colors duration-300 cursor-pointer"
                >
                  <span className="group-hover:-translate-x-1 transition-transform duration-300">←</span> CLOSE
                </button>

                <h3 className="text-[11px] font-extrabold tracking-[0.3em] uppercase text-amber-800 flex items-center gap-1.5 pl-[0.3em]">
                  <span>✧</span> MY SELECTION <span>✧</span>
                </h3>

                <span className="text-[10px] font-mono text-neutral-400 font-bold">
                  [{cartCount}]
                </span>
              </div>

              {/* Drawer Content / List Area */}
              <div className="flex-grow overflow-y-auto p-6 divide-y divide-[#EAE3DB]/60 custom-scrollbar">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                    <span className="text-3xl text-amber-600/40">✧</span>
                    <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-400 font-bold">
                      Your selection is empty
                    </p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="text-[10px] text-amber-700 hover:text-black tracking-[0.2em] uppercase font-black transition-colors duration-300 mt-2 border border-amber-600/30 hover:border-neutral-900 px-4 py-2 cursor-pointer"
                    >
                      Return to Gallery
                    </button>
                  </div>
                ) : (
                  cartItems.map((item, idx) => {
                    const priceNum = parseInt(item.product.price.replace("$", "")) || 0;
                    const itemTotal = priceNum * item.quantity;

                    return (
                      <motion.div
                        key={`${item.product.id}-${item.selectedSize}`}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ delay: idx * 0.05 }}
                        className="py-5 flex gap-4 first:pt-0 last:pb-0"
                      >
                        {/* Product Image Frame */}
                        <div className="relative w-20 h-24 bg-white border border-[#EAE3DB] flex-shrink-0 overflow-hidden shadow-sm">
                          <Image
                            src={item.product.image}
                            alt={item.product.name}
                            fill
                            sizes="80px"
                            className="object-contain p-2"
                          />
                        </div>

                        {/* Product Info details */}
                        <div className="flex-grow flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[8px] font-extrabold tracking-widest text-amber-800 uppercase truncate">
                                {item.product.brand}
                              </span>
                              <button
                                onClick={() => handleRemoveItem(item.product.id, item.selectedSize)}
                                className="text-[9px] text-neutral-400 hover:text-red-600 transition-colors uppercase tracking-widest cursor-pointer font-bold"
                              >
                                REMOVE
                              </button>
                            </div>
                            <h4 className="text-xs uppercase font-serif tracking-wider font-semibold text-neutral-900 mt-0.5 truncate">
                              {item.product.name}
                            </h4>
                            <p className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1 font-mono">
                              Size: {item.selectedSize}
                            </p>
                          </div>

                          {/* Quantity control & pricing */}
                          <div className="flex justify-between items-center mt-3">
                            {/* Modern Boxy Counter */}
                            <div className="flex items-center border border-neutral-200/80">
                              <button
                                onClick={() => handleUpdateQuantity(item.product.id, item.selectedSize, -1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-all text-xs font-bold cursor-pointer"
                              >
                                −
                              </button>
                              <span className="w-8 text-center text-[10px] font-mono font-bold text-neutral-800">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateQuantity(item.product.id, item.selectedSize, 1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-all text-xs font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            {/* Price display */}
                            <span className="text-xs font-serif text-amber-800 font-semibold tracking-wider">
                              ${itemTotal}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer summary */}
              {cartItems.length > 0 && (
                <div className="p-6 border-t border-[#EAE3DB] bg-[#FAF5EF] flex flex-col gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[10px] tracking-widest uppercase text-neutral-500">
                      <span>Valued Subtotal</span>
                      <span className="font-mono text-neutral-800 font-bold">
                        ${cartItems.reduce((sum, item) => sum + (parseInt(item.product.price.replace("$", "")) || 0) * item.quantity, 0)}.00
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] tracking-widest uppercase text-amber-700/80">
                      <span>Standard Luxury Delivery</span>
                      <span className="font-bold">COMPLIMENTARY</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] tracking-widest uppercase text-amber-700/80 border-b border-neutral-200/60 pb-2">
                      <span>Olfactory Custom wrapping</span>
                      <span className="font-bold">COMPLIMENTARY</span>
                    </div>
                    <div className="flex justify-between items-center text-xs tracking-[0.15em] uppercase font-bold text-neutral-950 pt-2">
                      <span>ESTIMATED TOTAL</span>
                      <span className="font-mono text-amber-800 text-sm font-extrabold">
                        ${cartItems.reduce((sum, item) => sum + (parseInt(item.product.price.replace("$", "")) || 0) * item.quantity, 0)}.00
                      </span>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex flex-col gap-2.5 mt-2">
                    <button
                      onClick={() => {
                        setIsCartOpen(false);
                        setIsCartPageOpen(true);
                      }}
                      className="w-full text-center border border-neutral-300 hover:border-neutral-900 bg-transparent hover:bg-neutral-50 text-neutral-900 text-[10px] font-extrabold tracking-[0.25em] py-3.5 uppercase transition-all duration-300 cursor-pointer rounded-none"
                    >
                      GO TO CART (FULL VIEW)
                    </button>

                    <button
                      onClick={() => triggerNotification("Redirecting to our secure luxury concierge...")}
                      className="w-full py-4 text-center bg-black hover:bg-amber-950 text-white text-[10px] font-black tracking-[0.3em] uppercase transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-none active:scale-[0.99] cursor-pointer"
                    >
                      CONCIERGE CHECKOUT
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 6. Cinematic Full-Screen Cart Overlay Dashboard */}
      <AnimatePresence>
        {isCartPageOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 bg-[#070302] z-[110] flex flex-col text-white font-sans-luxury overflow-y-auto"
          >
            {/* Header Area */}
            <header className="w-full px-6 md:px-12 py-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#070302] backdrop-blur-md z-10">
              <button
                onClick={() => setIsCartPageOpen(false)}
                className="group flex items-center gap-2 text-[10px] tracking-[0.25em] text-white/60 hover:text-white uppercase transition-all duration-300 cursor-pointer"
              >
                <span className="group-hover:-translate-x-1.5 transition-transform duration-300">←</span> RETURN TO ATELIER
              </button>

              <h2 className="text-base md:text-lg font-bold tracking-[0.4em] uppercase text-white font-serif pl-[0.4em]">
                GHARIB
              </h2>

              <span className="text-[10px] font-mono tracking-widest text-amber-500/80 uppercase">
                SECURE BAG [{cartCount}]
              </span>
            </header>

            {/* Split Content Grid */}
            <main className="flex-grow w-full max-w-7xl mx-auto px-6 md:px-12 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Left Column: Cart Selection & Options */}
              <div className="lg:col-span-7 flex flex-col gap-10">
                <div>
                  <h3 className="text-[11px] font-black tracking-[0.25em] text-amber-500/90 uppercase border-b border-white/10 pb-3.5 mb-6 flex items-center gap-2">
                    <span>✧</span> SELECTION DETAILS <span>✧</span>
                  </h3>

                  {cartItems.length === 0 ? (
                    <div className="text-center py-16 bg-white/[0.01] border border-white/5 p-8 flex flex-col items-center justify-center gap-4">
                      <span className="text-2xl text-white/20">✧</span>
                      <p className="text-xs uppercase tracking-widest text-white/40">YOUR ATELIER SELECTION IS CURRENTLY EMPTY.</p>
                      <button
                        onClick={() => setIsCartPageOpen(false)}
                        className="text-[10px] text-amber-500 hover:text-white border border-amber-500/30 px-6 py-2.5 uppercase tracking-widest font-black transition-all mt-2 cursor-pointer"
                      >
                        BROWSE EXCLUSIVES
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {cartItems.map((item, idx) => {
                        const priceNum = parseInt(item.product.price.replace("$", "")) || 0;
                        return (
                          <motion.div
                            key={`full-${item.product.id}-${item.selectedSize}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className="bg-white/[0.01] border border-white/5 p-5 md:p-6 flex flex-col md:flex-row gap-6 relative group hover:border-amber-500/10 transition-colors duration-300"
                          >
                            {/* Product Frame */}
                            <div className="w-24 h-28 bg-white/[0.02] border border-white/10 flex-shrink-0 flex items-center justify-center p-3 relative">
                              <Image
                                src={item.product.image}
                                alt={item.product.name}
                                width={80}
                                height={96}
                                className="object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>

                            {/* Details layout */}
                            <div className="flex-grow flex flex-col justify-between min-w-0">
                              <div>
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <span className="text-[9px] font-black tracking-widest text-amber-500 uppercase">
                                      {item.product.brand}
                                    </span>
                                    <h4 className="text-sm md:text-base uppercase font-serif tracking-wider font-semibold text-white mt-0.5">
                                      {item.product.name}
                                    </h4>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveItem(item.product.id, item.selectedSize)}
                                    className="text-[9px] tracking-widest text-white/40 hover:text-red-500 uppercase transition-colors cursor-pointer font-bold"
                                  >
                                    ✕ ELIMINATE
                                  </button>
                                </div>

                                <p className="text-[10px] tracking-widest text-white/50 mt-1 font-mono uppercase">
                                  Scent Family: {item.product.olfactory || "Bespoke blend"} &nbsp;|&nbsp; Size: {item.selectedSize}
                                </p>
                              </div>

                              <div className="flex justify-between items-center mt-5 border-t border-white/5 pt-4">
                                {/* Quantity adjusts */}
                                <div className="flex items-center border border-white/10">
                                  <button
                                    onClick={() => handleUpdateQuantity(item.product.id, item.selectedSize, -1)}
                                    className="w-7 h-7 flex items-center justify-center hover:bg-white/5 text-white/60 hover:text-white transition-all text-xs font-bold cursor-pointer"
                                  >
                                    −
                                  </button>
                                  <span className="w-10 text-center text-[11px] font-mono font-bold">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => handleUpdateQuantity(item.product.id, item.selectedSize, 1)}
                                    className="w-7 h-7 flex items-center justify-center hover:bg-white/5 text-white/60 hover:text-white transition-all text-xs font-bold cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Price computation */}
                                <div className="text-right">
                                  <span className="text-[9px] uppercase tracking-widest text-white/30 block mb-0.5 font-mono">
                                    {item.quantity} x {item.product.price}
                                  </span>
                                  <span className="text-sm font-serif text-amber-400 font-semibold tracking-wider">
                                    ${priceNum * item.quantity}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Luxury Gifting Customization Option */}
                {cartItems.length > 0 && (
                  <div className="bg-white/[0.01] border border-amber-500/20 p-6 md:p-8 flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-5 h-5 border border-amber-500/40 rounded-none flex items-center justify-center cursor-pointer bg-white/5 text-amber-500 font-mono mt-0.5 hover:border-amber-500/80 transition-colors">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black tracking-[0.2em] text-white uppercase">
                          Signature Gold Gilded Gift Packaging
                        </h4>
                        <p className="text-[10px] tracking-widest text-white/50 leading-relaxed mt-1.5">
                          Enclosed in a premium high-end hot gold-stamped dark chocolate suede box, tied with natural silk cord, and finished with dried floral olfactory accents. Fully complimentary.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Free Sample Selector */}
                {cartItems.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-black tracking-[0.25em] text-amber-500/90 uppercase border-b border-white/10 pb-3.5 mb-5 flex items-center gap-2">
                      <span>✧</span> COMPLIMENTARY TRIAL DECANT (SELECT 1) <span>✧</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-amber-500/30 hover:border-amber-500/50 bg-[#0d0705]/80 p-4 flex items-center justify-between cursor-pointer transition-colors duration-300">
                        <div>
                          <span className="text-[8px] font-black tracking-widest text-amber-500 block">INITIO</span>
                          <span className="text-xs font-serif uppercase tracking-wider font-semibold">Oud Imperial (2ml)</span>
                        </div>
                        <span className="text-[9px] tracking-widest uppercase bg-amber-500/20 text-amber-400 font-extrabold px-2 py-0.5">SELECTED</span>
                      </div>
                      <div className="border border-white/5 hover:border-amber-500/30 bg-white/[0.01] p-4 flex items-center justify-between cursor-pointer transition-colors duration-300 opacity-60 hover:opacity-100">
                        <div>
                          <span className="text-[8px] font-black tracking-widest text-white/40 block">RABANNE</span>
                          <span className="text-xs font-serif uppercase tracking-wider font-semibold">Phantom Parfum (2ml)</span>
                        </div>
                        <span className="text-[9px] tracking-widest uppercase border border-white/20 text-white/50 px-2 py-0.5">CHOOSE</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Order Summary details */}
              <div className="lg:col-span-5">
                {cartItems.length > 0 && (
                  <div className="bg-[#0b0503]/60 border border-amber-500/20 p-8 flex flex-col gap-6 sticky top-28 backdrop-blur-md">
                    <h3 className="text-[11px] font-black tracking-[0.25em] text-amber-500 uppercase border-b border-white/5 pb-4">
                      VALUED SUMMARY
                    </h3>

                    {/* Math breakdown */}
                    <div className="flex flex-col gap-3.5 text-[10px] tracking-widest uppercase">
                      <div className="flex justify-between items-center text-white/50">
                        <span>Items Subtotal</span>
                        <span className="font-mono text-white/80">
                          ${cartItems.reduce((sum, item) => sum + (parseInt(item.product.price.replace("$", "")) || 0) * item.quantity, 0)}.00
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-white/50">
                        <span>Luxury Secure Transport</span>
                        <span className="text-amber-400 font-bold">COMPLIMENTARY</span>
                      </div>
                      <div className="flex justify-between items-center text-white/50">
                        <span>Temperature Controlled Pack</span>
                        <span className="text-amber-400 font-bold">COMPLIMENTARY</span>
                      </div>

                      {/* Promo Code Sharp Box */}
                      <div className="flex flex-col gap-2 mt-2">
                        <label className="text-[8px] tracking-[0.25em] text-white/40 block font-bold">
                          PROMOTIONAL ATELIER CODE
                        </label>
                        <div className="flex">
                          <input
                            type="text"
                            placeholder="ENTER GOLDEN CODE..."
                            className="flex-grow bg-white/5 border border-white/10 rounded-none px-3.5 py-2.5 text-[10px] tracking-widest uppercase outline-none text-white focus:border-amber-500/50"
                          />
                          <button
                            onClick={() => triggerNotification("Golden Code applied successfully.")}
                            className="bg-white/10 hover:bg-amber-500 hover:text-black border-y border-r border-white/10 hover:border-amber-500 text-white text-[9px] font-black tracking-widest px-4 uppercase transition-all duration-300 rounded-none cursor-pointer"
                          >
                            APPLY
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-4 flex justify-between items-center text-xs tracking-[0.15em] font-extrabold text-white mt-2">
                        <span>ESTIMATED TOTAL</span>
                        <span className="font-mono text-amber-400 text-base">
                          ${cartItems.reduce((sum, item) => sum + (parseInt(item.product.price.replace("$", "")) || 0) * item.quantity, 0)}.00
                        </span>
                      </div>
                    </div>

                    {/* CTA Concierge buttons */}
                    <div className="flex flex-col gap-3 mt-4">
                      <button
                        onClick={() => triggerNotification("Opening secure payment channels...")}
                        className="w-full py-4 text-center bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-black tracking-[0.3em] uppercase transition-all duration-300 shadow-[0_4px_25px_rgba(245,158,11,0.3)] rounded-none active:scale-[0.99] cursor-pointer"
                      >
                        PROCEED TO SECURE CHECKOUT
                      </button>

                      <button
                        onClick={() => setIsCartPageOpen(false)}
                        className="w-full text-center border border-white/20 hover:border-amber-500/40 bg-transparent text-white text-[10px] font-extrabold tracking-[0.25em] py-3.5 uppercase transition-all duration-300 cursor-pointer rounded-none"
                      >
                        CONTINUE EXPLORING
                      </button>
                    </div>

                    {/* Trust badges */}
                    <div className="border-t border-white/5 pt-6 mt-2 flex flex-col gap-3 text-center">
                      <p className="text-[9px] tracking-widest text-white/40 uppercase leading-relaxed">
                        Authorized Original Brand Guarantee &nbsp;•&nbsp; Temperature-Guaranteed Cargo &nbsp;•&nbsp; Gilded Silk Gifting Included
                      </p>

                      {/* Gilded Lock Badge */}
                      <div className="flex items-center justify-center gap-1.5 text-[8px] font-extrabold tracking-[0.2em] uppercase text-amber-500/80">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        SSL SECURED 256-BIT CHECKSUM
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


