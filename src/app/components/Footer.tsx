"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Footer() {
  const router = useRouter();
  const [subscribedEmail, setSubscribedEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState("AED");
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);

  return (
    <footer className="w-full bg-[#FAF5EF] text-black border-t border-[#EAE3DB] relative z-10 font-sans-luxury">
      {/* Main Footer Links & Newsletter */}
      <div className="w-full max-w-[1360px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 py-16 px-6 md:px-12 border-b border-black/10">
        {/* Column 1: Brand manifesto & core identity - takes 4 columns */}
        <div className="lg:col-span-4 text-left flex flex-col justify-between min-h-[180px]">
          <div>
            <Link href="/" className="inline-block mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="GHARIB Perfumes"
                className="h-12 w-auto object-contain mix-blend-multiply cursor-pointer"
                style={{ mixBlendMode: "multiply" }}
              />
            </Link>
            <p className="text-[11px] leading-relaxed text-[#8C8276] tracking-widest uppercase max-w-sm">
              Curating premium, high-art olfactory masterpieces and private perfume campaigns since 1993. Evoking raw emotion through elite liquid scent signatures.
            </p>
          </div>

          {/* Social Media Icons */}
          <div className="flex items-center gap-3 mt-6">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center text-[#171310] hover:text-white hover:bg-[#171310] hover:border-[#171310] transition-all duration-300 shadow-sm"
              title="Instagram"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center text-[#171310] hover:text-white hover:bg-[#171310] hover:border-[#171310] transition-all duration-300 shadow-sm"
              title="Facebook"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center text-[#171310] hover:text-white hover:bg-[#171310] hover:border-[#171310] transition-all duration-300 shadow-sm"
              title="X (Twitter)"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full border border-black/15 flex items-center justify-center text-[#171310] hover:text-white hover:bg-[#171310] hover:border-[#171310] transition-all duration-300 shadow-sm"
              title="YouTube"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
          </div>

          <div className="mt-6 text-[9px] tracking-[0.25em] text-[#8C8276]/60 uppercase">
            Curated globally. Crafted in Dubai.
          </div>
        </div>

        {/* Column 2: Directory links - takes 2 columns */}
        <div className="lg:col-span-2 text-left">
          <h4 className="text-[10px] font-black tracking-[0.25em] text-black uppercase mb-5">
            BOUTIQUE
          </h4>
          <ul className="flex flex-col gap-3 text-[10px] font-bold tracking-[0.15em] text-[#8C8276] uppercase">
            <li><Link href="/shop" className="hover:text-black transition-colors duration-300">Shop All Scent Vault</Link></li>
            <li><Link href="/shop?collection=new" className="hover:text-black transition-colors duration-300">New arrivals</Link></li>
            <li><Link href="/collections" className="hover:text-black transition-colors duration-300">Brands</Link></li>
            <li><Link href="/blogs" className="hover:text-black transition-colors duration-300">Blogs</Link></li>
            <li><Link href="/contact" className="hover:text-black transition-colors duration-300">Contact</Link></li>
          </ul>
        </div>

        {/* Column 3: Care/Support - takes 2 columns */}
        <div className="lg:col-span-2 text-left">
          <h4 className="text-[10px] font-black tracking-[0.25em] text-black uppercase mb-5">
            PRIVATE CARE
          </h4>
          <ul className="flex flex-col gap-3 text-[10px] font-bold tracking-[0.15em] text-[#8C8276] uppercase">
            <li><Link href="/contact" className="hover:text-black transition-colors duration-300">Contact Us</Link></li>
            <li><span className="hover:text-black transition-colors duration-300 cursor-pointer">Private Consult</span></li>
            <li><span className="hover:text-black transition-colors duration-300 cursor-pointer">Shipping & Vaulting</span></li>
            <li><span className="hover:text-black transition-colors duration-300 cursor-pointer">Return Policy</span></li>
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

      {/* Bottom Utility Bar */}
      <div className="w-full max-w-[1360px] mx-auto flex flex-wrap items-center justify-between py-8 px-6 md:px-12 text-[9px] tracking-[0.2em] text-[#8C8276] uppercase font-bold gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <span>© 2026 GHARIB. All Rights Reserved.</span>
          <span onClick={() => router.push("/signin")} className="hover:text-black transition-colors duration-300 cursor-pointer">My Account</span>
          <span onClick={() => router.push("/admin")} className="hover:text-black transition-colors duration-300 cursor-pointer">Admin Desk</span>
          <span className="hover:text-black transition-colors duration-300 cursor-pointer">Privacy Policy</span>
          <span className="hover:text-black transition-colors duration-300 cursor-pointer">Terms of Use</span>
        </div>

        <div className="flex items-center gap-8">
          {/* Currency Selector */}
          <div className="relative">
            <div
              onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
              className="flex items-center gap-2 cursor-pointer hover:text-black transition-colors"
            >
              <span>Currency:</span>
              <span className="text-black font-extrabold flex items-center gap-1">
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
                <span className="text-[7px] opacity-60 ml-0.5">▼</span>
              </span>
            </div>

            <AnimatePresence>
              {isCurrencyDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 bottom-full mb-2.5 bg-[#FAF6F0] border border-amber-800/15 p-2 shadow-xl z-50 flex flex-col gap-1 w-64 font-sans-luxury"
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

          {/* Social handles */}
          <div className="flex items-center gap-4">
            <span className="hover:text-black transition-colors duration-300 cursor-pointer">Instagram</span>
            <Link href="/blogs" className="hover:text-black transition-colors duration-300 cursor-pointer">Journal</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
