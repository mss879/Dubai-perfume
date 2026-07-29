"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type FooterLink = {
  label: string;
  href?: string;
};

type FooterColumn = {
  heading: string;
  links: FooterLink[];
};

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Fragrances",
    links: [
      { label: "Shop all fragrances", href: "/shop" },
      { label: "New arrivals", href: "/shop?collection=new" },
      { label: "Brands", href: "/collections" },
      { label: "Wishlist", href: "/wishlist" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Private consultation" },
      { label: "Shipping & vaulting" },
      { label: "Returns & exchanges" },
    ],
  },
  {
    heading: "The maison",
    links: [
      { label: "Journal", href: "/blogs" },
      { label: "Contact us", href: "/contact" },
    ],
  },
  {
    heading: "Account & orders",
    links: [
      { label: "My account", href: "/signin" },
      { label: "Order tracking", href: "/customer/dashboard" },
      { label: "Admin desk", href: "/admin" },
    ],
  },
];

const CURRENCIES: { code: string; name: string }[] = [
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
];

const PAYMENT_MARKS = ["Visa", "Mastercard", "Amex", "Apple Pay"];

const LINK_CLASS =
  "text-[14px] font-[350] text-black/75 transition-colors duration-300 hover:text-black hover:underline hover:underline-offset-[5px] decoration-1";

const SOCIALS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.25" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.25" viewBox="0 0 24 24">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://twitter.com",
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.25" viewBox="0 0 24 24">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
        <path d="M9.75 15.02 15.5 11.75 9.75 8.48v6.54z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const [subscribedEmail, setSubscribedEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState("AED");
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);

  return (
    <footer className="relative z-10 w-full bg-white text-black font-body border-t border-[rgba(0,0,0,0.12)]">
      {/* ── Newsletter strip ─────────────────────────────────────── */}
      <section className="border-b border-[rgba(0,0,0,0.12)]">
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
              onSubmit={(e) => {
                e.preventDefault();
                if (subscribedEmail) setIsSubscribed(true);
              }}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="GHARIB Perfumes"
                className="h-10 w-auto object-contain mix-blend-multiply"
              />
            </Link>
            <p className="maison-body mt-6 max-w-[42ch]">
              Gharib has composed rare oriental and contemporary fragrances in Dubai since 1993.
              Every bottle is filled, sealed and inspected by hand in our atelier.
            </p>

            <div className="mt-7 flex items-center gap-6">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="text-black/75 transition-colors duration-300 hover:text-black"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading} className="lg:col-span-2">
              <h3 className="mb-6 text-[16px] font-normal tracking-[0.04em] text-black">
                {column.heading}
              </h3>
              <ul className="flex flex-col gap-3.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <Link href={link.href} className={LINK_CLASS}>
                        {link.label}
                      </Link>
                    ) : (
                      <span className={`${LINK_CLASS} cursor-pointer`}>{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom bar ───────────────────────────────────────────── */}
      <section className="border-t border-[rgba(0,0,0,0.12)]">
        <div className="maison-container flex flex-wrap items-center justify-between gap-x-10 gap-y-6 py-7 text-[12px] font-light text-[#757575]">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <span>© 2026 Gharib. All rights reserved.</span>

            {/* Currency selector — bare text button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                aria-expanded={isCurrencyDropdownOpen}
                aria-haspopup="listbox"
                className="flex cursor-pointer items-center gap-1.5 text-[12px] font-light text-[#757575] transition-colors duration-300 hover:text-black"
              >
                <span>Currency</span>
                <span className="text-black">{activeCurrency}</span>
                <span aria-hidden="true" className="text-[8px] leading-none">
                  ▼
                </span>
              </button>

              <AnimatePresence>
                {isCurrencyDropdownOpen && (
                  <motion.ul
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute bottom-full left-0 z-50 mb-3 max-h-72 w-60 overflow-y-auto border border-[rgba(0,0,0,0.12)] bg-white py-1"
                  >
                    {CURRENCIES.map((curr) => (
                      <li key={curr.code}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCurrency(curr.code);
                            localStorage.setItem("gharib_active_currency", curr.code);
                            setIsCurrencyDropdownOpen(false);
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
              {PAYMENT_MARKS.map((mark) => (
                <span
                  key={mark}
                  className="flex h-6 items-center border border-[rgba(0,0,0,0.12)] px-2.5 text-[10px] font-normal uppercase tracking-[0.12em] text-[#757575]"
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
  );
}
