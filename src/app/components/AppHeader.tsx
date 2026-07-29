"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, ShoppingBag, User, Menu, X } from "lucide-react";
import BrandsDropdown from "./BrandsDropdown";

interface AppHeaderProps {
  activePage?: "home" | "brands" | "shop" | "blogs" | "contact" | "wishlist";
}

export default function AppHeader({ activePage }: AppHeaderProps) {
  const [isBrandsMenuOpen, setIsBrandsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleBrandsMouseEnter = () => setIsBrandsMenuOpen(true);
  const handleBrandsMouseLeave = () => setIsBrandsMenuOpen(false);

  return (
    <>
      {/* Clean White Container Navbar for All Subpages */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-md text-[#1b0f0a] shadow-[0_2px_20px_rgba(0,0,0,0.06)] border-b border-neutral-200/80 font-sans-luxury">
        <div className="w-full relative">
          <nav className="max-w-[1440px] mx-auto px-6 md:px-12 py-3.5 flex items-center justify-between relative">
            
            {/* Left Menu Items (HOME, BRANDS, SHOP, BLOGS) */}
            <div className="hidden md:flex items-center gap-9 text-[12px] font-bold tracking-[0.2em] transition-colors duration-300 text-neutral-800">
              <Link
                href="/"
                className={`transition-colors duration-300 uppercase hover:text-amber-800 ${
                  activePage === "home" ? "text-amber-900 font-black" : "text-neutral-700"
                }`}
              >
                HOME
              </Link>

              {/* Brands Trigger with Hover Dropdown */}
              <div
                className="relative py-2 cursor-pointer"
                onMouseEnter={handleBrandsMouseEnter}
                onMouseLeave={handleBrandsMouseLeave}
              >
                <Link
                  href="/collections"
                  className={`transition-colors duration-300 flex items-center gap-1.5 uppercase hover:text-amber-800 cursor-pointer ${
                    activePage === "brands" ? "text-amber-900 font-black" : "text-neutral-700"
                  }`}
                >
                  BRANDS
                  <svg
                    className={`w-2.5 h-2.5 transition-transform duration-300 ${isBrandsMenuOpen ? "rotate-180 text-amber-800" : "text-neutral-400"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </Link>
              </div>

              <Link
                href="/shop"
                className={`transition-colors duration-300 uppercase hover:text-amber-800 ${
                  activePage === "shop" ? "text-amber-900 font-black" : "text-neutral-700"
                }`}
              >
                SHOP
              </Link>

              <Link
                href="/blogs"
                className={`transition-colors duration-300 uppercase hover:text-amber-800 ${
                  activePage === "blogs" ? "text-amber-900 font-black" : "text-neutral-700"
                }`}
              >
                BLOGS
              </Link>
            </div>

            {/* Mobile Hamburger Button */}
            <div className="flex md:hidden items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-neutral-800 hover:text-amber-800 focus:outline-none"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            {/* Logo Center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Link href="/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Gharib"
                  className="h-12 md:h-[58px] w-auto object-contain rounded-xl cursor-pointer transition-all duration-300 mix-blend-multiply"
                  style={{ mixBlendMode: 'multiply' }}
                />
              </Link>
            </div>

            {/* Right Menu Items (Search, Wishlist, Bag, Account) */}
            <div className="flex items-center gap-5 sm:gap-7 text-[12px] font-bold tracking-[0.2em] justify-end text-neutral-800">
              {/* Search Bar Container */}
              <div className="hidden sm:flex relative items-center">
                <div className="relative flex items-center rounded-full px-3.5 py-1.5 w-[160px] lg:w-[200px] transition-all duration-300 bg-neutral-100 border border-neutral-200 hover:border-amber-800/40 focus-within:border-amber-800">
                  <Search className="w-3.5 h-3.5 mr-2 text-neutral-500 shrink-0" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="SEARCH..."
                    className="bg-transparent text-[10px] tracking-widest uppercase outline-none w-full font-bold text-neutral-800 placeholder-neutral-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="text-[9px] font-bold ml-1 text-neutral-400 hover:text-neutral-900"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Wishlist */}
              <Link
                href="/wishlist"
                className="hover:text-amber-800 transition-colors flex items-center gap-1.5"
                title="Wishlist"
              >
                <Heart className="w-4 h-4 text-neutral-700 hover:text-amber-800" />
              </Link>

              {/* Cart / Shopping Bag */}
              <Link
                href="/checkout"
                className="hover:text-amber-800 transition-colors flex items-center gap-1.5"
                title="Cart"
              >
                <ShoppingBag className="w-4 h-4 text-neutral-700 hover:text-amber-800" />
              </Link>

              {/* User Account */}
              <Link
                href="/signin"
                className="hover:text-amber-800 transition-colors hidden sm:flex items-center gap-1.5"
                title="Account"
              >
                <User className="w-4 h-4 text-neutral-700 hover:text-amber-800" />
              </Link>
            </div>
          </nav>

          {/* Brands Dropdown Menu */}
          <BrandsDropdown
            isOpen={isBrandsMenuOpen}
            onClose={() => setIsBrandsMenuOpen(false)}
            onMouseEnter={handleBrandsMouseEnter}
            onMouseLeave={handleBrandsMouseLeave}
            isDarkTheme={false}
          />
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 bg-white text-neutral-800 flex flex-col p-6 font-sans-luxury"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <span className="text-xs font-black tracking-[0.25em] uppercase text-amber-900">MENU</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-grow overflow-y-auto py-8 flex flex-col gap-6 text-left">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-black tracking-[0.25em] text-neutral-800 uppercase">HOME</Link>
              <Link href="/collections" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-black tracking-[0.25em] text-neutral-800 uppercase">BRANDS</Link>
              <Link href="/#new-in" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-black tracking-[0.25em] text-neutral-800 uppercase">SHOP</Link>
              <Link href="/blogs" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-black tracking-[0.25em] text-neutral-800 uppercase">BLOGS</Link>
              <Link href="/wishlist" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-black tracking-[0.25em] text-neutral-800 uppercase">WISHLIST</Link>
              <Link href="/signin" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-black tracking-[0.25em] text-neutral-800 uppercase">MY ACCOUNT</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
