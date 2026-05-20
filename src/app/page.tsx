"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
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
  melt/disperse to reveal "Evoke Every Emotion with Fragsence"
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
          Evoke Every<br />
          Emotion with<br />
          Fragsence
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
  },
  {
    id: 2,
    brand: "JULIETTE HAS A GUN",
    name: "Juliette",
    price: "$98",
    sizes: ["30ml", "50ml"],
    image: "/catalog_juliette_gun.png",
    isBestSeller: true,
  },
  {
    id: 3,
    brand: "RABANNE",
    name: "Phantom",
    price: "$120",
    sizes: ["50ml", "100ml"],
    image: "/catalog_rabanne_phantom.png",
    isNew: true,
  },
  {
    id: 4,
    brand: "HFC",
    name: "Devil's intrigue",
    price: "$370",
    sizes: ["75ml"],
    image: "/catalog_hfc_devils.png",
    isBestSeller: true,
  },
  {
    id: 5,
    brand: "TOM FORD",
    name: "Lost Cherry eau de parfum",
    price: "$326.00",
    sizes: ["30ml", "50ml", "100ml"],
    image: "/catalog_tom_ford_cherry.png",
    isBestSeller: true,
  },
  {
    id: 6,
    brand: "MOSCHINO",
    name: "Toy Boy",
    price: "$43.12",
    sizes: ["30ml", "50ml", "100ml"],
    image: "/catalog_moschino_teddy.png",
    isNew: true,
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
  },
  {
    id: 9,
    brand: "MARC-ANTOINE BARROIS",
    name: "Ganymede Extrait",
    price: "$319",
    sizes: ["30ml", "50ml"],
    image: "/catalog_marc_barrois.png",
    isNew: true,
  }
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
    <motion.div
      layout
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
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
                    className={`text-[9px] tracking-[0.15em] font-extrabold uppercase transition-all duration-300 relative py-0.5 ${
                      activeSize === sz
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
    </motion.div>
  );
};

export default function Home() {
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
  const [cartCount, setCartCount] = useState(2); // default cart value of 2 to match mockup cart [2]
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  
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
          ? `Added ${prod.brand} - ${prod.name} to your Private Collection.` 
          : `Removed ${prod.brand} from your Private Collection.`
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
    const size = selectedSizes[productId] || "50ml";
    setCartCount(prev => prev + 1);
    triggerNotification(`Added 1x ${prod?.brand} (${size}) to your bag.`);
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
            className="w-full h-full object-cover scale-105 relative z-0"
          >
            <source src="/Perfume_bottles_floating_luxury_…_202605201020.mp4" type="video/mp4" />
          </video>
        </div>

        {/* 1. Header / Navigation */}
        <motion.header
          initial={{ y: -30, opacity: 0 }}
          animate={revealInterface ? { y: 0, opacity: 1 } : { y: -30, opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full border-b border-white/10 backdrop-blur-md z-30 relative"
        >
          <nav className="max-w-[1440px] mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
            {/* Left Menu Items */}
            <div className="hidden md:flex items-center gap-10 text-[13px] font-medium tracking-[0.2em] text-white/70">
              <a href="#new-in" className="hover:text-white transition-colors duration-300">NEW IN</a>
              <a href="#best-sellers" className="hover:text-white transition-colors duration-300">BEST SELLERS</a>
              <a href="#private-vault" className="hover:text-white transition-colors duration-300">PRIVATE VAULT</a>
            </div>

            {/* Logo Center */}
            <div className="flex-1 flex justify-center md:flex-initial">
              <Image
                src="/logo.png"
                alt="Fragsence"
                width={220}
                height={55}
                className="h-11 md:h-[48px] w-auto object-contain rounded-xl overflow-hidden"
                priority
              />
            </div>

            {/* Right Menu Items */}
            <div className="hidden md:flex items-center gap-8 text-[13px] font-medium tracking-[0.2em] text-white/70 justify-end">
              <a href="#offers-bento" className="hover:text-white transition-colors duration-300">OFFERS</a>
              <a href="#contact" className="hover:text-white transition-colors duration-300">CONTACT</a>
              
              {/* Search toggle */}
              <div className="relative flex items-center">
                <button 
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className="hover:text-white text-white/70 transition-colors duration-300 cursor-pointer flex items-center gap-1.5 uppercase"
                >
                  <svg className="w-3.5 h-3.5 text-white/60 hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="hidden lg:inline">Search</span>
                </button>
                <AnimatePresence>
                  {isSearchOpen && (
                    <motion.input
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 120, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search scent..."
                      className="ml-2 border-b border-white/30 focus:border-white text-[10px] tracking-widest uppercase py-0.5 outline-none font-bold text-white bg-transparent w-[120px]"
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Shopping Cart count indicator */}
              <button className="relative flex items-center gap-2.5 text-[12px] font-medium tracking-[0.2em] text-white/80 hover:text-white transition-all duration-300 uppercase cursor-pointer py-1.5 group/cart">
                <span className="relative">
                  Bag
                  <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-white group-hover/cart:w-full transition-all duration-300"></span>
                </span>
                <div className="relative flex items-center justify-center ml-0.5">
                  <svg className="w-[28px] h-[28px] text-white/70 group-hover/cart:text-white transition-colors duration-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <span className="absolute -top-1 -right-1.5 bg-amber-500 text-black text-[9px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full shadow-[0_2px_8px_rgba(245,158,11,0.4)] scale-90 group-hover/cart:scale-105 transition-transform duration-300">
                    {cartCount}
                  </span>
                </div>
              </button>
            </div>

            {/* Mobile Menu Action Bar */}
            <div className="flex md:hidden items-center gap-4">
              {/* Mobile Search */}
              <div className="relative flex items-center">
                <button 
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <AnimatePresence>
                  {isSearchOpen && (
                    <motion.input
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 90, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search..."
                      className="ml-1 border-b border-white/30 focus:border-white text-[10px] tracking-widest uppercase py-0.5 outline-none font-bold text-white bg-transparent w-[90px]"
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile Cart */}
              <button className="relative flex items-center gap-1.5 text-[11px] font-medium tracking-[0.15em] text-white/80 hover:text-white transition-all duration-300 uppercase cursor-pointer py-1 group/cart">
                <div className="relative flex items-center justify-center">
                  <svg className="w-[28px] h-[28px] text-white/80" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <span className="absolute -top-1 -right-1.5 bg-amber-500 text-black text-[9px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full shadow-[0_2px_8px_rgba(245,158,11,0.45)] scale-90">
                    {cartCount}
                  </span>
                </div>
              </button>
              
              <button className="flex flex-col gap-1.5 p-2 text-white" aria-label="Toggle Menu">
                <span className="w-6 h-0.5 bg-white"></span>
                <span className="w-4 h-0.5 bg-white self-end"></span>
              </button>
            </div>
          </nav>
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
                Evoke Every<br />
                Emotion with<br />
                Fragsence
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
                  const el = document.getElementById("offers-bento");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs font-semibold tracking-[0.2em] uppercase text-white/80 hover:text-white flex items-center gap-2 group transition-colors duration-300 cursor-pointer"
              >
                <span>View Special Offers</span>
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
        id="offers-bento"
        className="w-full bg-gradient-to-b from-[#070200] via-[#1b0f0a] to-[#070200] px-0 py-20 border-t border-white/5 relative z-10 flex flex-col items-center"
      >
        {/* Subtle background luxury glow spots */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#522a16]/10 rounded-full blur-[120px] pointer-events-none"></div>



        {/* Bento Grid Container - Full screen edge-to-edge */}
        <div className="w-full max-w-none grid grid-cols-1 md:grid-cols-3 gap-0 relative z-10">
          
          {/* CARD 1: The Long Card (Ice Video background) - 2 Columns wide */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-2 min-h-[385px] rounded-none overflow-hidden relative border-b md:border-r border-white/10 hover:border-amber-500/35 hover:shadow-[0_0_40px_rgba(212,175,55,0.06)] group transition-all duration-700 flex flex-col justify-end p-8 md:p-10"
          >
            {/* Background Ice Video */}
            <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none scale-100 group-hover:scale-102 transition-transform duration-[1.2s] ease-out">
              <div className="absolute inset-0 bg-gradient-to-t from-[#130702] via-[#24150e]/65 to-black/20 z-10"></div>
              <video
                autoPlay
                muted
                playsInline
                loop
                className="w-full h-full object-cover"
              >
                <source src="/Perfume_bottle_on_ice_202605201706.mp4" type="video/mp4" />
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
          </motion.div>

          {/* CARD 2: Box Card 1 (Amber Duo Offer) - 1 Column wide */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="min-h-[385px] rounded-none overflow-hidden relative bg-[#23150e]/30 backdrop-blur-md border-b border-white/10 hover:border-amber-500/35 hover:shadow-[0_0_45px_rgba(212,175,55,0.08)] group transition-all duration-700 flex flex-col justify-end p-8"
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
          </motion.div>

          {/* CARD 3: Box Card 2 (Vault Clearance) - 1 Column wide */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="min-h-[320px] rounded-none overflow-hidden relative bg-[#23150e]/30 backdrop-blur-md border-b md:border-b-0 md:border-r border-white/10 hover:border-amber-500/35 hover:shadow-[0_0_45px_rgba(212,175,55,0.08)] group transition-all duration-700 flex flex-col justify-end p-6"
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
          </motion.div>

          {/* CARD 4: Box Card 3 (BOGO Gifting) - 1 Column wide */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="min-h-[320px] rounded-none overflow-hidden relative bg-[#23150e]/30 backdrop-blur-md border-b md:border-b-0 md:border-r border-white/10 hover:border-amber-500/35 hover:shadow-[0_0_45px_rgba(212,175,55,0.08)] group transition-all duration-700 flex flex-col justify-end p-6"
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
          </motion.div>

          {/* CARD 5: Box Card 4 (50% Off Last Chance) - 1 Column wide */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            className="min-h-[320px] rounded-none overflow-hidden relative bg-[#23150e]/30 backdrop-blur-md border border-transparent hover:border-amber-500/35 hover:shadow-[0_0_45px_rgba(212,175,55,0.08)] group transition-all duration-700 flex flex-col justify-end p-6"
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
          </motion.div>

        </div>
      </section>

      {/* 3. High-Fashion Minimalist E-Commerce Catalog Suite */}
      
      {/* ==========================================
          SECTION 1: THE NEW RELEASES (#new-in)
          ========================================== */}
      <section id="new-in" className="w-full bg-[#FAF5EF] text-black relative z-10 border-t border-[#EAE3DB] px-4 md:px-8 lg:px-12 py-20 flex flex-col items-center">
        


        {/* Dedicated Search Results Block */}
        {searchTerm.trim() !== "" ? (
          <div className="w-full max-w-[1360px] min-h-[400px]">
            <div className="w-full flex items-baseline justify-between border-b border-black/10 pb-6 mb-10">
              <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-black font-sans-luxury uppercase">
                Search Results for: &ldquo;{searchTerm}&rdquo;
              </h2>
              <button 
                onClick={() => setSearchTerm("")} 
                className="text-xs font-bold tracking-widest text-[#8C8276] hover:text-black uppercase border-b border-black/20"
              >
                Clear Search
              </button>
            </div>

            {(() => {
              const searchLower = searchTerm.toLowerCase();
              const matched = CATALOG_PRODUCTS.filter(prod => 
                prod.brand.toLowerCase().includes(searchLower) ||
                prod.name.toLowerCase().includes(searchLower)
              );

              if (matched.length === 0) {
                return (
                  <div className="w-full text-center py-20 bg-white border border-black/10 flex flex-col items-center justify-center p-8 rounded-none">
                    <span className="text-4xl text-[#8C8276]/30 mb-4 block">✧</span>
                    <h3 className="text-lg font-serif-luxury font-medium tracking-widest uppercase text-black mb-2">No Fragrances Found</h3>
                    <p className="text-xs text-[#8C8276] tracking-widest max-w-sm uppercase">We could not find any scents matching your query. Please try searching other brands.</p>
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
                        badgeText={prod.isFeaturedLarge ? "FEATURED ART" : "SEARCH MATCH"}
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

      {/* ==========================================
          SECTION 2: THE BEST SELLERS (#best-sellers)
          ========================================== */}
      {searchTerm.trim() === "" && (
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
      {searchTerm.trim() === "" && (
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
          SECTION 3: MY PRIVATE COLLECTION / VAULT (#private-vault)
          ========================================== */}
      {searchTerm.trim() === "" && (
        <section id="private-vault" className="w-full bg-[#FAF5EF] text-black relative z-10 border-t border-[#EAE3DB] px-4 md:px-8 lg:px-12 py-24 flex flex-col items-center">
          <div className="w-full max-w-[1360px]">
            
            {/* Section Header */}
            <div className="w-full flex flex-wrap items-baseline justify-between border-b border-black/10 pb-6 mb-12">
              <div className="flex items-baseline gap-6">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-black font-sans-luxury select-none">
                  MY PRIVATE COLLECTION
                </h2>
                <span className="text-xs tracking-[0.15em] text-[#8C8276] uppercase font-bold pl-[0.15em]">
                  / Custom Vault (Favorites: {favorites.length})
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
                      Your Private Collection Vault is Empty
                    </h3>
                    <p className="text-xs text-[#8C8276] tracking-widest max-w-md mx-auto leading-relaxed uppercase mb-6">
                      Explore our collections above and touch the heart icon on any perfume card to curate your own personal signature archive.
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
                        badgeText="IN MY VAULT"
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
      {searchTerm.trim() === "" && (
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
      {searchTerm.trim() === "" && (
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
                FRAGSENCE
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
              <li><a href="#private-vault" className="hover:text-black transition-colors duration-300">My Vault</a></li>
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
            <span>© 2026 FRAGSENCE. All Rights Reserved.</span>
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
            className="fixed bottom-8 right-8 z-50 bg-black text-white px-6 py-4 rounded-none shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-[#EAE3DB]/20 max-w-sm flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-ping"></div>
              <p className="text-[11px] font-sans-luxury tracking-widest font-semibold uppercase leading-normal">
                {showNotification}
              </p>
            </div>
            <button 
              onClick={() => setShowNotification(null)}
              className="text-white/40 hover:text-white text-xs tracking-widest font-bold"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

