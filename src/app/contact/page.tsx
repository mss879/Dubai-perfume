"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, MapPin, Clock, ChevronDown, Check, Sparkles, Compass } from "lucide-react";

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
    subject: "General Olfactory Inquiry",
    message: "",
  });
  
  const [isSending, setIsSending] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isFormDropdownOpen, setIsFormDropdownOpen] = useState(false);

  const subjectOptions = [
    "General Olfactory Inquiry",
    "Bespoke Scent Consultation Appointment",
    "Private Collection & Gifting Services",
    "Exclusive Boutique Event Invitations",
    "Order & Bespoke Delivery Support",
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
  };

  const handleSubjectSelect = (opt: string) => {
    setFormData((prev) => ({ ...prev, subject: opt }));
    setIsFormDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    
    setIsSending(true);
    
    setTimeout(() => {
      setIsSending(false);
      setIsSubmitted(true);
      
      setFormData({
        name: "",
        email: "",
        subject: "General Olfactory Inquiry",
        message: "",
      });
    }, 1800);
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

      {/* ═══════════════════════════════════════════════════
          HEADER: Premium Responsive Light-Theme Navbar
          ═══════════════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#FAF6F0]/95 backdrop-blur-md text-neutral-800 shadow-[0_2px_15px_rgba(27,15,10,0.06)] border-b border-amber-800/10 font-sans-luxury">
        <div className="w-full">
          <nav className="max-w-[1440px] mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
            
            {/* Left Menu Items */}
            <div className="hidden md:flex items-center gap-10 text-[13px] font-medium tracking-[0.2em] transition-colors duration-300 text-neutral-800/70">
              <Link
                href="/"
                className="transition-colors duration-300 uppercase font-medium hover:text-amber-800 decoration-none"
              >
                HOME
              </Link>
              <Link
                href="/#about"
                className="transition-colors duration-300 uppercase font-medium hover:text-amber-800 decoration-none"
              >
                ABOUT
              </Link>
              <Link
                href="/contact"
                className="transition-colors duration-300 uppercase font-black text-amber-800 decoration-none"
              >
                CONTACT
              </Link>
              <Link
                href="/#new-in"
                className="transition-colors duration-300 uppercase font-medium hover:text-amber-800 decoration-none"
              >
                SHOP
              </Link>
            </div>

            {/* Logo Center */}
            <div className="flex-1 flex justify-center md:flex-initial">
              <Link href="/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Gharib"
                  className="h-10 md:h-[42px] w-auto object-contain rounded-xl overflow-hidden cursor-pointer transition-all duration-300 mix-blend-multiply"
                  style={{ mixBlendMode: 'multiply' }}
                />
              </Link>
            </div>

            {/* Right Menu Items */}
            <div className="hidden md:flex items-center gap-8 text-[13px] font-medium tracking-[0.2em] transition-colors duration-300 justify-end text-neutral-800/70">
              
              {/* Better Search Bar Container */}
              <div className="relative flex items-center">
                <div className="relative flex items-center rounded-none px-4 py-1.5 w-[200px] lg:w-[240px] transition-all duration-300 bg-neutral-900/5 border border-neutral-900/10 hover:border-neutral-900/20 focus-within:border-amber-800/50">
                  <svg className="w-3.5 h-3.5 mr-2 flex-shrink-0 transition-colors duration-300 text-neutral-800/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchTerm(val);
                      if (val.trim() === "") {
                        setSearchSuggestions([]);
                      } else {
                        const searchLower = val.toLowerCase();
                        const matches = CATALOG_PRODUCTS.filter(prod =>
                          prod.brand.toLowerCase().includes(searchLower) ||
                          prod.name.toLowerCase().includes(searchLower)
                        ).slice(0, 4);
                        setSearchSuggestions(matches);
                      }
                    }}
                    placeholder="Search scent..."
                    className="bg-transparent text-[10px] tracking-widest uppercase outline-none w-full font-bold transition-colors duration-300 text-neutral-800 placeholder-neutral-800/40"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setSearchSuggestions([]);
                      }}
                      className="text-[9px] font-bold ml-1 cursor-pointer transition-colors duration-300 text-neutral-800/40 hover:text-neutral-900"
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
                      className="absolute top-full mt-2.5 right-0 w-[300px] md:w-[360px] bg-[#FAF6F0] border border-amber-800/15 shadow-[0_20px_50px_rgba(27,15,10,0.08)] z-50 overflow-hidden flex flex-col text-neutral-800"
                    >
                      <div className="px-4 py-2 bg-neutral-900/5 border-b border-amber-800/10 text-[9px] tracking-widest text-amber-800 font-extrabold uppercase">
                        Real-time Suggestions
                      </div>

                      <div className="flex flex-col max-h-[320px] overflow-y-auto divide-y divide-amber-800/10">
                        {searchSuggestions.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => {
                              router.push(`/?search=${encodeURIComponent(prod.name)}`);
                            }}
                            className="p-3 flex items-center gap-3.5 hover:bg-neutral-900/5 transition-colors duration-200 cursor-pointer text-left group"
                          >
                            <div className="relative w-10 h-12 bg-neutral-900/5 flex-shrink-0 flex items-center justify-center p-1 border border-neutral-800/5 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={prod.image}
                                alt={prod.name}
                                className="object-contain filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300 h-10 w-auto"
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
                              {formatCurrency(parseFloat(prod.price) || 0)}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-3.5 bg-neutral-900/5 border-t border-amber-800/10 flex items-center justify-between">
                        <span className="text-[9px] tracking-widest text-neutral-500 font-semibold uppercase">
                          Click to filter catalog view
                        </span>
                        <Link
                          href="/#new-in"
                          className="text-[9px] tracking-widest text-amber-800 hover:text-amber-900 font-extrabold uppercase transition-colors decoration-none"
                        >
                          View All ✧
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User Profile / Sign In */}
              <Link
                href={userEmail ? "/customer/dashboard" : "/signin"}
                className="relative flex items-center justify-center cursor-pointer py-1.5 active:scale-[0.92] transition-transform text-neutral-800"
              >
                <div className="relative flex items-center justify-center w-[38px] h-[38px]">
                  <svg
                    className="w-[28px] h-[28px] relative z-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="9" stroke="rgba(27,15,10,0.55)" strokeLinecap="round" fill="none" />
                    <circle cx="12" cy="10" r="3" stroke="rgba(27,15,10,0.7)" strokeLinecap="round" fill="none" />
                    <path d="M6.168 18.849A4.5 4.5 0 0112 15.75a4.5 4.5 0 015.832 3.099" stroke="rgba(27,15,10,0.55)" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  {userEmail && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-pulse z-20 border border-amber-400/50" />
                  )}
                </div>
              </Link>

              {/* Wishlist */}
              <Link
                href="/#offers"
                className="relative flex items-center justify-center cursor-pointer py-1.5 text-neutral-800"
              >
                <div className="relative flex items-center justify-center w-[38px] h-[38px]">
                  <svg
                    className="w-[28px] h-[28px] relative z-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  {favoritesCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-amber-500 text-black text-[9px] font-black w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.5)] z-20">
                      {favoritesCount}
                    </span>
                  )}
                </div>
              </Link>

              {/* Cart/Bag */}
              <Link
                href="/checkout"
                className="relative flex items-center justify-center cursor-pointer py-1.5 text-neutral-800"
              >
                <div className="relative flex items-center justify-center w-[38px] h-[38px]">
                  <svg
                    className="w-[28px] h-[28px] relative z-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      d="M4 8h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <path
                      d="M8 8V7a4 4 0 018 0v1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-amber-500 text-black text-[9px] font-black w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.5)] z-20">
                      {cartCount}
                    </span>
                  )}
                </div>
              </Link>

              {/* Premium Currency Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                  className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest hover:text-black transition-colors duration-300 uppercase cursor-pointer text-neutral-800/70 py-1.5"
                >
                  <span>
                    {activeCurrency === "AED" && "🇦🇪 AED"}
                    {activeCurrency === "SAR" && "🇸🇦 SAR"}
                    {activeCurrency === "QAR" && "🇶🇦 QAR"}
                    {activeCurrency === "KWD" && "🇰🇼 KWD"}
                    {activeCurrency === "BHD" && "🇧🇭 BHD"}
                    {activeCurrency === "OMR" && "🇴🇲 OMR"}
                    {activeCurrency === "USD" && "🇺🇸 USD"}
                    {activeCurrency === "EUR" && "🇪🇺 EUR"}
                    {activeCurrency === "GBP" && "🇬🇧 GBP"}
                    {activeCurrency === "INR" && "🇮🇳 INR"}
                  </span>
                  <span className="text-[7px] opacity-60">▼</span>
                </button>

                <AnimatePresence>
                  {isCurrencyDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full mt-2.5 bg-[#FAF6F0] border border-amber-800/15 p-2 shadow-xl z-50 flex flex-col gap-1 w-64 font-sans-luxury"
                    >
                      {[
                        { code: "AED", label: "🇦🇪 AED - UAE Dirham" },
                        { code: "SAR", label: "🇸🇦 SAR - Saudi Riyal" },
                        { code: "QAR", label: "🇶🇦 QAR - Qatari Riyal" },
                        { code: "KWD", label: "🇰🇼 KWD - Kuwaiti Dinar" },
                        { code: "BHD", label: "🇧🇭 BHD - Bahraini Dinar" },
                        { code: "OMR", label: "🇴🇲 OMR - Omani Rial" },
                        { code: "USD", label: "🇺🇸 USD - US Dollar" },
                        { code: "EUR", label: "🇪🇺 EUR - Euro" },
                        { code: "GBP", label: "🇬🇧 GBP - British Pound" },
                        { code: "INR", label: "🇮🇳 INR - Indian Rupee" }
                      ].map((curr) => (
                        <button
                          key={curr.code}
                          onClick={() => {
                            setActiveCurrency(curr.code);
                            localStorage.setItem("gharib_active_currency", curr.code);
                            setIsCurrencyDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[10px] tracking-widest uppercase font-bold transition-all duration-200 cursor-pointer flex justify-between items-center ${activeCurrency === curr.code
                            ? "bg-amber-800/10 text-amber-800"
                            : "text-neutral-700 hover:bg-neutral-800/5 hover:text-black"
                            }`}
                        >
                          <span>{curr.label}</span>
                          {activeCurrency === curr.code && (
                            <span className="text-amber-800 text-[8px]">✓</span>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* MOBILE: Action Bar & Hamburger Toggle */}
            <div className="flex md:hidden items-center gap-4 text-neutral-800">
              <Link
                href={userEmail ? "/customer/dashboard" : "/signin"}
                className="text-neutral-800"
              >
                <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9" strokeLinecap="round" />
                  <circle cx="12" cy="10" r="3" strokeLinecap="round" />
                  <path d="M6.168 18.849A4.5 4.5 0 0112 15.75a4.5 4.5 0 015.832 3.099" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="/checkout"
                className="relative text-neutral-800"
              >
                <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path d="M4 8h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 8V7a4 4 0 018 0v1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-amber-500 text-black text-[8px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1 transition-colors text-neutral-800/70 hover:text-neutral-900 cursor-pointer"
                aria-label="Toggle Menu"
              >
                <div className="w-6 h-5 flex flex-col justify-between">
                  <span className="w-6 h-0.5 bg-neutral-800"></span>
                  <span className="w-6 h-0.5 bg-neutral-800"></span>
                  <span className="w-6 h-0.5 bg-neutral-800"></span>
                </div>
              </button>
            </div>
          </nav>
        </div>
      </header>

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
                GHARIB ATELIER
              </span>
              <span className="text-[10px] text-neutral-400 tracking-widest uppercase">
                Artisanal Olfactory Creations • Dubai, UAE
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
              LEFT COLUMN: Concierge & Flagship Details
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
                  FRAGRANCE HOUSE CONCIERGE
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif-luxury font-medium tracking-wide text-[#1C130D] uppercase leading-tight">
                OUR ATELIER
              </h1>
              <p className="text-xs md:text-sm text-[#1C130D]/70 tracking-wider leading-relaxed font-medium">
                Located in the heart of Dubai&apos;s artistic district, our atelier is a temple of fine niche perfumery. We invite you to experience bespoke olfactory consultations, tailored compositions, and custom discovery in a sanctuary of premium sensory indulgence.
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
                    Atelier Flagship
                  </h4>
                  <p className="text-xs text-[#1C130D]/80 font-semibold tracking-wider leading-relaxed">
                    Alserkal Avenue, Al Quoz 1<br />
                    Dubai, United Arab Emirates
                  </p>
                </div>
              </div>

              {/* Detail 2: Registry */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full border border-amber-800/10 bg-white flex items-center justify-center flex-shrink-0 text-amber-800 shadow-[0_4px_10px_rgba(140,98,57,0.04)]">
                  <Phone className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div>
                  <h4 className="text-[10px] tracking-[0.25em] text-amber-800 font-extrabold uppercase mb-1">
                    Contact Registry
                  </h4>
                  <p className="text-xs text-[#1C130D]/80 font-semibold tracking-wider leading-relaxed">
                    Telephone: <a href="tel:+97143808888" className="hover:text-amber-800 transition-colors">+971 4 380 8888</a><br />
                    Concierge Email: <a href="mailto:concierge@gharibprive.com" className="hover:text-amber-800 transition-colors">concierge@gharibprive.com</a>
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
                    Atelier Hours
                  </h4>
                  <p className="text-xs text-[#1C130D]/80 font-semibold tracking-wider leading-relaxed">
                    Monday to Sunday: 10:00 AM – 10:00 PM GST<br />
                    Private Booking slots available upon request.
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
                    Boutique Locations
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
                  <Sparkles className="w-3 h-3 text-amber-600" /> PRIVATE OLFACTORY CURATION
                </span>
                <p className="text-[11px] font-bold text-[#1C130D] uppercase tracking-wider">
                  Bespoke Signature Consultation
                </p>
                <p className="text-[10px] text-[#1C130D]/60 tracking-wide font-medium">
                  Schedule a private 1-on-1 session with our Master Scent Curator. Together, we will craft your custom olfactory signature.
                </p>
                <button
                  onClick={() => {
                    setFormData(prev => ({ ...prev, subject: "Bespoke Scent Consultation Appointment" }));
                    window.scrollTo({ top: 400, behavior: "smooth" });
                  }}
                  className="text-[9px] tracking-widest text-amber-800 font-black uppercase flex items-center gap-1 mt-2 group-hover:gap-2 transition-all cursor-pointer text-left"
                >
                  Book Private Slot ✧
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
                      CONNECT WITH US
                    </h2>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-left">
                    
                    {/* Name Input */}
                    <div className="flex flex-col gap-2 relative group">
                      <label className="text-[8px] tracking-[0.25em] text-[#1C130D]/50 uppercase font-black pl-0.5">
                        PATRON NAME
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
                          placeholder="e.g. Alexander Mercer"
                          className="bg-white border border-[#EAE3DB] focus:border-[#8C6239] rounded-none px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C130D] font-bold placeholder-[#1C130D]/20 transition-all duration-300 w-full shadow-inner"
                        />
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8C6239] transition-all duration-500 origin-left"
                          style={{ transform: focusedField === "name" ? "scaleX(1)" : "scaleX(0)" }}
                        />
                      </div>
                    </div>

                    {/* Email Input */}
                    <div className="flex flex-col gap-2 relative group">
                      <label className="text-[8px] tracking-[0.25em] text-[#1C130D]/50 uppercase font-black pl-0.5">
                        EMAIL ADDRESS
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
                          placeholder="e.g. patron@gharibprive.com"
                          className="bg-white border border-[#EAE3DB] focus:border-[#8C6239] rounded-none px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C130D] font-bold placeholder-[#1C130D]/20 transition-all duration-300 w-full shadow-inner"
                        />
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8C6239] transition-all duration-500 origin-left"
                          style={{ transform: focusedField === "email" ? "scaleX(1)" : "scaleX(0)" }}
                        />
                      </div>
                    </div>

                    {/* Subject Input */}
                    <div className="flex flex-col gap-2 relative z-30">
                      <label className="text-[8px] tracking-[0.25em] text-[#1C130D]/50 uppercase font-black pl-0.5">
                        INQUIRY DEPT.
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
                      <label className="text-[8px] tracking-[0.25em] text-[#1C130D]/50 uppercase font-black pl-0.5">
                        PATRON MESSAGE
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
                          placeholder="Please articulate your custom request, olfactory preferences, or boutique event interests in detail..."
                          className="bg-white border border-[#EAE3DB] focus:border-[#8C6239] rounded-none px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C130D] font-bold placeholder-[#1C130D]/20 transition-all duration-300 w-full shadow-inner resize-none leading-relaxed"
                        />
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8C6239] transition-all duration-500 origin-left"
                          style={{ transform: focusedField === "message" ? "scaleX(1)" : "scaleX(0)" }}
                        />
                      </div>
                    </div>

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
                          SENDING TO CONCIERGE...
                        </>
                      ) : (
                        "SUBMIT INQUIRY ✧"
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

                  <span className="text-[9px] tracking-[0.35em] text-amber-700 uppercase font-black mb-3">
                    INQUIRY TRANSMITTED SUCCESSFUL
                  </span>
                  
                  <h3 className="text-2xl font-serif-luxury font-medium tracking-widest text-[#1C130D] uppercase mb-8">
                    DEAR PATRON,
                  </h3>

                  <div className="max-w-[420px] text-left border-l border-amber-800/10 pl-6 my-2 space-y-4">
                    <p className="text-[11px] leading-relaxed text-[#1C130D]/75 font-semibold tracking-wider uppercase">
                      Thank you for contacting the House of Gharib. Your custom request has been logged and dispatched to our elite Fragrance Concierge.
                    </p>
                    <p className="text-[11px] leading-relaxed text-[#1C130D]/75 font-semibold tracking-wider uppercase">
                      A dedicated curator is reviewing your sensory details and will reach out to you within 24 hours to assist you further.
                    </p>
                  </div>

                  <div className="mt-10 mb-8 text-center flex flex-col items-center">
                    <span className="text-[9px] text-[#1C130D]/40 tracking-[0.25em] font-extrabold uppercase mb-1">
                      With elegance,
                    </span>
                    <span className="text-[10px] text-amber-800 tracking-[0.3em] font-black uppercase">
                      Gharib Privé Atelier
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3.5 w-full mt-4 relative z-20">
                    <button 
                      onClick={() => isSubmitted && setIsSubmitted(false)}
                      className="flex-1 bg-transparent border border-neutral-300 hover:border-amber-600 text-neutral-800 hover:text-amber-700 text-[9px] font-black tracking-[0.2em] uppercase py-4 transition-all duration-300 rounded-none cursor-pointer"
                    >
                      SEND ANOTHER INQUIRY
                    </button>
                    <button 
                      onClick={() => router.push("/")}
                      className="flex-1 bg-[#8C6239] text-white hover:bg-[#1C130D] text-[9px] font-black tracking-[0.2em] uppercase py-4 transition-all duration-300 rounded-none cursor-pointer"
                    >
                      RETURN TO HOME
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </main>

      {/* ═══════════════════════════════════════════════════
          FOOTER: Premium Secured Suede Panel
          ═══════════════════════════════════════════════════ */}
      <footer className="w-full bg-[#FAF6F0] relative z-25 border-t border-[#EAE3DB]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[8px] tracking-[0.22em] text-[#1C130D]/40 uppercase font-extrabold">
            © {new Date().getFullYear()} GHARIB PRIVÉ ATELIER. ALL RIGHTS RESERVED.
          </span>
          
          <div className="flex items-center gap-1.5 text-[8px] tracking-[0.22em] text-[#1C130D]/40 font-extrabold uppercase select-none">
            <svg className="w-3 h-3 text-amber-700/60" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            SSL SECURE DATA CONCIERGE
          </div>
        </div>
      </footer>

    </div>
  );
}
