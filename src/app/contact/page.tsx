"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, MapPin, Clock, ChevronDown, Check, Sparkles, Compass } from "lucide-react";
import { clientSafeSupabase } from "../lib/supabase";
import BrandsDropdown from "../components/BrandsDropdown";
import AppHeader from "../components/AppHeader";

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
    price: "1215",
    sizes: ["50ml", "90ml"],
    image: "/catalog_initio_oud.png",
    isNew: true,
    olfactory: "Woody & Oud",
  },
  {
    id: 2,
    brand: "JULIETTE HAS A GUN",
    name: "Juliette",
    price: "360",
    sizes: ["30ml", "50ml"],
    image: "/catalog_juliette_gun.png",
    isBestSeller: true,
    olfactory: "Floral & Sweet",
  },
  {
    id: 3,
    brand: "RABANNE",
    name: "Phantom",
    price: "440",
    sizes: ["50ml", "100ml"],
    image: "/catalog_rabanne_phantom.png",
    isNew: true,
    olfactory: "Fresh & Aquatic",
  },
  {
    id: 4,
    brand: "HFC",
    name: "Devil's intrigue",
    price: "1358",
    sizes: ["75ml"],
    image: "/catalog_hfc_devils.png",
    isBestSeller: true,
    olfactory: "Amber & Oriental",
  },
  {
    id: 5,
    brand: "TOM FORD",
    name: "Lost Cherry eau de parfum",
    price: "1196",
    sizes: ["30ml", "50ml", "100ml"],
    image: "/catalog_tom_ford_cherry.png",
    isBestSeller: true,
    olfactory: "Floral & Sweet",
  },
  {
    id: 6,
    brand: "MOSCHINO",
    name: "Toy Boy",
    price: "158",
    sizes: ["30ml", "50ml", "100ml"],
    image: "/catalog_moschino_teddy.png",
    isNew: true,
    olfactory: "Woody & Oud",
  },
  {
    id: 7,
    brand: "FILIPPO SORCINELLI",
    name: "Epicentro",
    price: "1196",
    sizes: ["50ml", "100ml"],
    image: "/catalog_sorcinelli_epicentro.png",
    isBestSeller: true,
    isFeaturedLarge: true,
    description: "Epicentro is an artistic perfume that represents a deep volcanic impact.",
    olfactory: "Fresh & Aquatic",
  },
  {
    id: 8,
    brand: "FILIPPO SORCINELLI",
    name: "Eio_non_ho_mani_che_mi_accarezzino_il_volto",
    price: "862",
    sizes: ["100ml"],
    image: "/catalog_sorcinelli_leather.png",
    isNew: true,
    isFeaturedLarge: true,
    description: "An avante-garde olfactory masterpiece encased in a bottle wrapped dramatically in leather folds.",
    olfactory: "Amber & Oriental",
  },
  {
    id: 9,
    brand: "MARC-ANTOINE BARROIS",
    name: "Ganymede Extrait",
    price: "1170",
    sizes: ["30ml", "50ml"],
    image: "/catalog_marc_barrois.png",
    isNew: true,
    olfactory: "Woody & Oud",
  }
];

export default function ContactPage() {
  const router = useRouter();
  
  // Header / Navigation States
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const favoritesCount = 4; // Default symmetric grid size
  const [activeCurrency, setActiveCurrency] = useState("AED");
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
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
  const [searchTerm, setSearchTerm] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<CatalogProduct[]>([]);
  const [exchangeRates] = useState<Record<string, number>>({
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

  // Contact Form States
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "General Inquiries",
    message: "",
  });
  
  const [isSending, setIsSending] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isFormDropdownOpen, setIsFormDropdownOpen] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const subjectOptions = [
    "General Inquiries",
    "Wholesale Order Inquiries",
    "Order/Shipping Inquiries",
  ];

  // Sync client-side localStorage values on mount safely to avoid synchronous render effects
  useEffect(() => {
    const email = localStorage.getItem("userEmail");
    const curr = localStorage.getItem("gharib_active_currency");
    const storedCart = localStorage.getItem("gharib_cart");

    setTimeout(() => {
      if (email) setUserEmail(email);
      if (curr) setActiveCurrency(curr);
      if (storedCart) {
        try {
          const items = JSON.parse(storedCart) as { quantity: number }[];
          const count = items.reduce((acc: number, item) => acc + item.quantity, 0);
          setCartCount(count);
        } catch (e) {
          console.error(e);
        }
      } else {
        setCartCount(2); // Match storefront initial mock
      }
    }, 0);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when typing
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubjectSelect = (opt: string) => {
    setFormData((prev) => ({ ...prev, subject: opt }));
    setIsFormDropdownOpen(false);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // 1. Honeypot check (anti-bot)
    if (honeypot) {
      errors.spam = "Spam detection triggered.";
      return errors;
    }

    // 2. Name validation (no numeric values, minimum 3 chars)
    const nameTrimmed = formData.name.trim();
    if (nameTrimmed.length < 3) {
      errors.name = "Name must be at least 3 characters.";
    } else if (!/^[a-zA-Z\s'.]+$/.test(nameTrimmed)) {
      errors.name = "Name can only contain letters and spaces.";
    }

    // 3. Email validation & block common disposable/spam domains
    const emailTrimmed = formData.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      errors.email = "Please enter a valid email.";
    } else {
      const disposableDomains = [
        "mailinator.com", "yopmail.com", "tempmail.com", "trashmail.com",
        "10minutemail.com", "guerrillamail.com", "sharklasers.com", "dispostable.com"
      ];
      const domain = emailTrimmed.split("@")[1];
      if (disposableDomains.includes(domain)) {
        errors.email = "Please use a real email address.";
      }
    }

    // 4. Message validation (avoid very short spam or ultra long dumps)
    const msgTrimmed = formData.message.trim();
    if (msgTrimmed.length < 15) {
      errors.message = "Your message must be at least 15 characters.";
    } else if (msgTrimmed.length > 2000) {
      errors.message = "Your message is too long (max 2000 characters).";
    }

    // 5. Anti-spam: check for url structures in name or message
    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|\.com\/|\.net\/|\.org\/)/i;
    if (urlPattern.test(msgTrimmed) || urlPattern.test(nameTrimmed)) {
      errors.message = "Please do not include links or websites.";
    }

    // 6. Anti-spam Rate Limiting: 60-second cooldown
    const lastSubmit = localStorage.getItem("last_inquiry_submit");
    if (lastSubmit) {
      const timeDiff = Date.now() - parseInt(lastSubmit);
      const limitWindow = 60000;
      if (timeDiff < limitWindow) {
        const secsLeft = Math.ceil((limitWindow - timeDiff) / 1000);
        errors.rateLimit = `You already sent a message. Please wait ${secsLeft} seconds.`;
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      if (errors.spam) {
        // Silently mimic success to bot
        setIsSubmitted(true);
        return;
      }
      setValidationErrors(errors);
      if (errors.rateLimit) {
        setSubmitError(errors.rateLimit);
      }
      return;
    }

    setIsSending(true);

    try {
      const { error } = await clientSafeSupabase
        .from("contact_inquiries")
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          subject: formData.subject,
          message: formData.message.trim(),
          created_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(error.message || "Failed to transmit inquiry.");
      }

      // Record successful submit time for rate limiting
      localStorage.setItem("last_inquiry_submit", Date.now().toString());

      setIsSubmitted(true);
      setFormData({
        name: "",
        email: "",
        subject: "General Inquiries",
        message: "",
      });
      setValidationErrors({});
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected network error occurred. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Global Price Formatter Utility matching storefront
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

  return (
    <div className="relative min-h-screen bg-[#FAF6F0] text-[#1C130D] flex flex-col justify-between font-sans-luxury select-none overflow-x-hidden pt-20 md:pt-24">
      
      {/* Subtle luxury ambient pattern overlay */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%238C6239' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      <AppHeader activePage="contact" />

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
            <div className="flex items-center justify-between border-b border-amber-800/10 pb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Gharib"
                className="h-8 w-auto object-contain rounded-lg overflow-hidden brightness-0"
              />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-10 h-10 flex items-center justify-center border border-amber-800/20 rounded-full text-neutral-600 hover:text-neutral-900 hover:border-amber-800/40 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-grow overflow-y-auto py-8 flex flex-col gap-8 text-left">
              <div className="flex flex-col gap-5">
                <Link
                  href="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-black tracking-[0.25em] text-neutral-800 hover:text-amber-800 uppercase text-left transition-colors decoration-none"
                >
                  HOME
                </Link>
                <Link
                  href="/#about"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-black tracking-[0.25em] text-neutral-800 hover:text-amber-800 uppercase transition-colors decoration-none"
                >
                  ABOUT
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-black tracking-[0.25em] text-amber-800 uppercase transition-colors decoration-none"
                >
                  CONTACT
                </Link>
                <Link
                  href="/blogs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-black tracking-[0.25em] text-neutral-800 hover:text-amber-800 uppercase transition-colors decoration-none"
                >
                  BLOGS
                </Link>
                <Link
                  href="/#new-in"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-black tracking-[0.25em] text-neutral-800 hover:text-amber-800 uppercase transition-colors decoration-none"
                >
                  SHOP
                </Link>
              </div>

              <div className="flex flex-col border-t border-amber-800/10 pt-6">
                <span className="text-[10px] font-black tracking-[0.25em] text-amber-800 uppercase mb-4 pl-[0.1em]">
                  Shop Collections
                </span>
                <div className="grid grid-cols-2 gap-3.5 text-xs font-bold tracking-widest text-neutral-500">
                  <Link
                    href="/#new-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="hover:text-amber-800 text-left uppercase decoration-none"
                  >
                    ✧ New In
                  </Link>
                  <Link
                    href="/#new-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="hover:text-amber-800 text-left uppercase decoration-none"
                  >
                    ✧ Bestsellers
                  </Link>
                  <Link
                    href="/#offers"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="hover:text-amber-800 text-left uppercase decoration-none"
                  >
                    ✧ Exclusives
                  </Link>
                  <Link
                    href="/#new-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="hover:text-amber-800 text-left uppercase decoration-none"
                  >
                    ✧ All Fragrances
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t border-amber-800/10 pt-5 flex flex-col gap-2">
              <span className="text-[8px] tracking-[0.3em] font-extrabold text-amber-800 uppercase pl-[0.1em]">
                GHARIB PERFUMES
              </span>
              <span className="text-[10px] text-neutral-400 tracking-widest uppercase">
                Premium Perfumes • Dubai, UAE
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════
          MAIN CONTENT: Left Details & Right Form Container
          ═══════════════════════════════════════════════════ */}
      <main className="flex-1 flex items-center justify-center pt-24 md:pt-32 pb-12 md:pb-20 relative z-25">
        <div className="max-w-7xl mx-auto w-full px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-stretch">
          
          {/* ─────────────────────────────────────────────────
              LEFT COLUMN: Contact details
              ───────────────────────────────────────────────── */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:col-span-5 flex flex-col justify-between"
          >
            {/* Header Titles */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                <span className="text-[9px] tracking-[0.35em] text-amber-700 uppercase font-black">
                  CONTACT US
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif-luxury font-medium tracking-wide text-[#1C130D] uppercase leading-tight">
                OUR STORE
              </h1>
              <p className="text-xs md:text-sm text-[#1C130D]/70 tracking-wider leading-relaxed font-medium">
                Come visit our store in Dubai to see our collection of premium perfumes.
              </p>
            </div>

            {/* Premium Details Block */}
            <div className="my-10 space-y-8 border-t border-b border-[#EAE3DB] py-10">
              
              {/* Detail 1: Address */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full border border-amber-800/10 bg-white flex items-center justify-center flex-shrink-0 text-amber-800 shadow-[0_4px_10px_rgba(140,98,57,0.04)]">
                  <MapPin className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div>
                  <h4 className="text-[10px] tracking-[0.25em] text-amber-800 font-extrabold uppercase mb-1">
                    Main Store
                  </h4>
                  <p className="text-xs text-[#1C130D]/80 font-semibold tracking-wider leading-relaxed">
                    Alserkal Avenue, Al Quoz 1<br />
                    Dubai, United Arab Emirates
                  </p>
                </div>
              </div>

              {/* Detail 2: Phone/Email */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full border border-amber-800/10 bg-white flex items-center justify-center flex-shrink-0 text-amber-800 shadow-[0_4px_10px_rgba(140,98,57,0.04)]">
                  <Phone className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div>
                  <h4 className="text-[10px] tracking-[0.25em] text-amber-800 font-extrabold uppercase mb-1">
                    Phone and Email
                  </h4>
                  <p className="text-xs text-[#1C130D]/80 font-semibold tracking-wider leading-relaxed">
                    Telephone: <a href="tel:+97143808888" className="hover:text-amber-800 transition-colors">+971 4 380 8888</a><br />
                    Email: <a href="mailto:info@gharib.com" className="hover:text-amber-800 transition-colors">info@gharib.com</a>
                  </p>
                </div>
              </div>

              {/* Detail 3: Clock */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full border border-amber-800/10 bg-white flex items-center justify-center flex-shrink-0 text-amber-800 shadow-[0_4px_10px_rgba(140,98,57,0.04)]">
                  <Clock className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div>
                  <h4 className="text-[10px] tracking-[0.25em] text-amber-800 font-extrabold uppercase mb-1">
                    Opening Hours
                  </h4>
                  <p className="text-xs text-[#1C130D]/80 font-semibold tracking-wider leading-relaxed">
                    Every day: 10:00 AM – 10:00 PM<br />
                    Please email or call us to book a private visit.
                  </p>
                </div>
              </div>

              {/* Detail 4: Boutiques */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full border border-amber-800/10 bg-white flex items-center justify-center flex-shrink-0 text-amber-800 shadow-[0_4px_10px_rgba(140,98,57,0.04)]">
                  <Compass className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div>
                  <h4 className="text-[10px] tracking-[0.25em] text-amber-800 font-extrabold uppercase mb-1">
                    Other Stores
                  </h4>
                  <p className="text-xs text-[#1C130D]/80 font-semibold tracking-wider leading-relaxed">
                    The Dubai Mall • Fashion Avenue, Level 1<br />
                    Galeries Lafayette • The Dubai Mall
                  </p>
                </div>
              </div>
            </div>

            {/* Premium Gold Silk Card Link */}
            <div className="relative border border-[#EAE3DB] bg-white p-6 shadow-[0_15px_40px_rgba(28,19,13,0.02)] group overflow-hidden">
              <div className="absolute right-0 bottom-0 w-24 h-24 bg-[#FAF6F0] rounded-full filter blur-xl opacity-80 pointer-events-none group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10 flex flex-col gap-2">
                <span className="text-[8px] tracking-[0.3em] font-extrabold text-amber-800 uppercase pl-[0.1em] flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-600" /> PRIVATE VISIT
                </span>
                <p className="text-[11px] font-bold text-[#1C130D] uppercase tracking-wider">
                  Book a Custom Perfume Session
                </p>
                <p className="text-[10px] text-[#1C130D]/60 tracking-wide font-medium">
                  Book a private session with us. We will help you choose or create a unique perfume that fits your style.
                </p>
                <button
                  onClick={() => {
                    setFormData(prev => ({ ...prev, subject: "General Inquiries" }));
                    window.scrollTo({ top: 400, behavior: "smooth" });
                  }}
                  className="text-[9px] tracking-widest text-amber-800 font-black uppercase flex items-center gap-1 mt-2 group-hover:gap-2 transition-all cursor-pointer text-left"
                >
                  Book Now ✧
                </button>
              </div>
            </div>
          </motion.div>
          
          {/* ─────────────────────────────────────────────────
              RIGHT COLUMN: Interactive Contact Form / Success
              ───────────────────────────────────────────────── */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            className="lg:col-span-7 flex flex-col justify-center animate-fade-in"
          >
            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                /* ═══════════════════════════════════════════════════
                    FORM CONTAINER CARD
                   ═══════════════════════════════════════════════════ */
                <motion.div
                  key="contact-form"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                  className="w-full bg-white border border-[#EAE3DB] p-8 md:p-12 shadow-[0_45px_100px_rgba(28,19,13,0.04),inset_0_1px_2px_rgba(255,255,255,0.8)] relative"
                >
                  {/* Subtle top amber border highlight */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#8C6239]" />

                  {/* Header */}
                  <div className="mb-8 select-none text-left">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-600" />
                      <span className="text-[8px] tracking-[0.35em] text-amber-700 uppercase font-black">
                        DIGITAL ATELIER GATEWAY
                      </span>
                    </div>
                    <h2 className="text-2xl font-serif-luxury font-medium tracking-[0.1em] text-[#1C130D] uppercase">
                      Contact Us
                    </h2>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-left">
                    
                    {/* Honeypot field (hidden from users, bot trap) */}
                    <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" aria-hidden="true">
                      <label htmlFor="website">Website Address (Do not fill)</label>
                      <input 
                        type="text" 
                        id="website" 
                        name="website" 
                        value={honeypot} 
                        onChange={(e) => setHoneypot(e.target.value)} 
                        tabIndex={-1} 
                      />
                    </div>

                    {/* Name Input */}
                    <div className="flex flex-col gap-2 relative group">
                      <label className="text-[9px] tracking-[0.15em] text-[#1C130D]/60 uppercase font-black pl-0.5">
                        Your Name
                      </label>
                      <div className="relative">
                        <input 
                          type="text" 
                          name="name"
                          required
                          value={formData.name}
                          onChange={handleInputChange}
                          onFocus={() => setFocusedField("name")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Enter your name"
                          className="bg-white border border-[#EAE3DB] focus:border-[#8C6239] rounded-none px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C130D] font-bold placeholder-[#1C130D]/20 transition-all duration-300 w-full shadow-inner"
                        />
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8C6239] transition-all duration-500 origin-left"
                          style={{ transform: focusedField === "name" ? "scaleX(1)" : "scaleX(0)" }}
                        />
                      </div>
                      {validationErrors.name && (
                        <span className="text-[10px] text-red-700 font-bold tracking-wider mt-0.5 pl-0.5">{validationErrors.name}</span>
                      )}
                    </div>

                    {/* Email Input */}
                    <div className="flex flex-col gap-2 relative group">
                      <label className="text-[9px] tracking-[0.15em] text-[#1C130D]/60 uppercase font-black pl-0.5">
                        Your Email
                      </label>
                      <div className="relative">
                        <input 
                          type="email" 
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          onFocus={() => setFocusedField("email")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Enter your email"
                          className="bg-white border border-[#EAE3DB] focus:border-[#8C6239] rounded-none px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C130D] font-bold placeholder-[#1C130D]/20 transition-all duration-300 w-full shadow-inner"
                        />
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8C6239] transition-all duration-500 origin-left"
                          style={{ transform: focusedField === "email" ? "scaleX(1)" : "scaleX(0)" }}
                        />
                      </div>
                      {validationErrors.email && (
                        <span className="text-[10px] text-red-700 font-bold tracking-wider mt-0.5 pl-0.5">{validationErrors.email}</span>
                      )}
                    </div>

                    {/* Subject Input */}
                    <div className="flex flex-col gap-2 relative z-30">
                      <label className="text-[9px] tracking-[0.15em] text-[#1C130D]/60 uppercase font-black pl-0.5">
                        Subject
                      </label>
                      
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsFormDropdownOpen(!isFormDropdownOpen)}
                          className="bg-white border border-[#EAE3DB] hover:border-[#8C6239]/50 rounded-none px-4 py-3.5 text-[11px] tracking-widest text-[#1C130D] font-bold transition-all duration-300 w-full flex justify-between items-center text-left cursor-pointer text-neutral-800"
                        >
                          <span className="truncate uppercase">{formData.subject}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-300 ${isFormDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        <AnimatePresence>
                          {isFormDropdownOpen && (
                            <motion.div
                               initial={{ opacity: 0, y: 5 }}
                               animate={{ opacity: 1, y: 0 }}
                               exit={{ opacity: 0, y: 5 }}
                               className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#EAE3DB] p-2 shadow-2xl z-50 flex flex-col gap-0.5 text-neutral-800"
                            >
                              {subjectOptions.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleSubjectSelect(opt)}
                                  className={`w-full text-left px-3 py-2.5 text-[10px] tracking-widest uppercase font-bold transition-all duration-200 cursor-pointer flex justify-between items-center ${
                                    formData.subject === opt
                                      ? "bg-amber-800/10 text-amber-800"
                                      : "text-neutral-700 hover:bg-[#FAF6F0] hover:text-black"
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {formData.subject === opt && (
                                    <Check className="w-3.5 h-3.5 text-amber-800" />
                                  )}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Message Textarea */}
                    <div className="flex flex-col gap-2 relative group">
                      <label className="text-[9px] tracking-[0.15em] text-[#1C130D]/60 uppercase font-black pl-0.5">
                        Your Message
                      </label>
                      <div className="relative">
                        <textarea 
                          name="message"
                          required
                          rows={5}
                          value={formData.message}
                          onChange={handleInputChange}
                          onFocus={() => setFocusedField("message")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Type your message here..."
                          className="bg-white border border-[#EAE3DB] focus:border-[#8C6239] rounded-none px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C130D] font-bold placeholder-[#1C130D]/20 transition-all duration-300 w-full shadow-inner resize-none leading-relaxed"
                        />
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8C6239] transition-all duration-500 origin-left"
                          style={{ transform: focusedField === "message" ? "scaleX(1)" : "scaleX(0)" }}
                        />
                      </div>
                      {validationErrors.message && (
                        <span className="text-[10px] text-red-700 font-bold tracking-wider mt-0.5 pl-0.5">{validationErrors.message}</span>
                      )}
                    </div>

                    {/* Submit Error alert */}
                    {submitError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] tracking-widest uppercase font-bold p-3 text-center">
                        {submitError}
                      </div>
                    )}

                    {/* Submit Button */}
                    <button 
                      type="submit"
                      disabled={isSending}
                      className="w-full bg-[#8C6239] text-white hover:bg-[#1C130D] disabled:bg-[#8C6239]/60 disabled:cursor-not-allowed text-[9.5px] font-black tracking-[0.25em] uppercase py-4.5 transition-all duration-300 shadow-[0_4px_12px_rgba(140,98,57,0.1)] hover:shadow-[0_4px_18px_rgba(28,19,13,0.18)] rounded-none cursor-pointer mt-3 z-20 flex justify-center items-center gap-2"
                    >
                      {isSending ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          SENDING...
                        </>
                      ) : (
                        "SEND MESSAGE"
                      )}
                    </button>
                  </form>
                </motion.div>
              ) : (
                /* ═══════════════════════════════════════════════════
                    SUCCESS / CONFIRMATION PANEL
                   ═══════════════════════════════════════════════════ */
                <motion.div
                  key="success-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-full bg-[#FAF7F2] border border-amber-800/15 p-10 md:p-14 shadow-[0_40px_90px_rgba(46,34,25,0.06),inset_0_1px_2px_rgba(255,255,255,0.8)] relative text-center flex flex-col items-center"
                >
                  <div className="absolute inset-2 border border-amber-800/[0.04] pointer-events-none" />

                  {/* Pulsing Golden Wax Seal */}
                  <motion.div 
                    className="relative w-20 h-20 rounded-full border border-amber-600/35 bg-white/70 flex items-center justify-center mb-8 shadow-[0_8px_25px_rgba(217,119,6,0.1)] cursor-pointer group"
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="absolute inset-0 rounded-full bg-radial-gradient(circle, rgba(217,119,6,0.15) 0%, transparent 70%)" />
                    
                    <span className="text-2xl font-serif-luxury font-medium text-amber-800 select-none group-hover:scale-110 transition-transform duration-300">G</span>
                    
                    <span className="absolute inset-0 rounded-full border border-amber-600/20 animate-ping opacity-30 scale-105" />
                  </motion.div>

                  <span className="text-[9px] tracking-[0.2em] text-amber-700 uppercase font-black mb-3">
                    MESSAGE SENT
                  </span>
                  
                  <h3 className="text-2xl font-serif-luxury font-medium tracking-widest text-[#1C130D] uppercase mb-8">
                    THANK YOU!
                  </h3>

                  <div className="max-w-[420px] text-center border-l-0 pl-0 my-2 space-y-4">
                    <p className="text-[11px] leading-relaxed text-[#1C130D]/75 font-semibold tracking-wider uppercase">
                      We received your message.
                    </p>
                    <p className="text-[11px] leading-relaxed text-[#1C130D]/75 font-semibold tracking-wider uppercase">
                      We will reply to you within 24 hours.
                    </p>
                  </div>

                  <div className="mt-10 mb-8 text-center flex flex-col items-center">
                    <span className="text-[9px] text-[#1C130D]/40 tracking-[0.25em] font-extrabold uppercase mb-1">
                      Best regards,
                    </span>
                    <span className="text-[10px] text-amber-800 tracking-[0.3em] font-black uppercase">
                      Gharib Perfumes
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3.5 w-full mt-4 relative z-20">
                    <button 
                      onClick={() => isSubmitted && setIsSubmitted(false)}
                      className="flex-1 bg-transparent border border-neutral-300 hover:border-amber-600 text-neutral-800 hover:text-amber-700 text-[9px] font-black tracking-[0.2em] uppercase py-4 transition-all duration-300 rounded-none cursor-pointer"
                    >
                      SEND ANOTHER MESSAGE
                    </button>
                    <button 
                      onClick={() => router.push("/")}
                      className="flex-1 bg-[#8C6239] text-white hover:bg-[#1C130D] text-[9px] font-black tracking-[0.2em] uppercase py-4 transition-all duration-300 rounded-none cursor-pointer"
                    >
                      GO TO HOME
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </main>

      {/* ═══════════════════════════════════════════════════
          FOOTER: Secure Footer Panel
          ═══════════════════════════════════════════════════ */}
      <footer className="w-full bg-[#FAF6F0] relative z-25 border-t border-[#EAE3DB]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[8px] tracking-[0.22em] text-[#1C130D]/40 uppercase font-extrabold">
            © {new Date().getFullYear()} GHARIB PERFUMES. ALL RIGHTS RESERVED.
          </span>
          
          <div className="flex items-center gap-1.5 text-[8px] tracking-[0.22em] text-[#1C130D]/40 font-extrabold uppercase select-none">
            <svg className="w-3 h-3 text-amber-700/60" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            SSL SECURE SYSTEM
          </div>
        </div>
      </footer>

    </div>
  );
}
