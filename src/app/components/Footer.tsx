"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency, SUPPORTED_CURRENCIES } from "../lib/currency";

type FooterLink = {
  label: string;
  href: string;
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
      { label: "Private consultation", href: "/contact" },
      { label: "Shipping & vaulting", href: "/returns" },
      { label: "Returns & exchanges", href: "/returns" },
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
      { label: "Track your order", href: "/track" },
    ],
  },
];

const PAYMENT_MARKS = ["Cash on Delivery"];

const LINK_CLASS =
  "text-[14px] font-[350] text-black/75 transition-colors duration-300 hover:text-black hover:underline hover:underline-offset-[5px] decoration-1";

type NewsletterStatus = "idle" | "sending" | "success" | "error";

export default function Footer() {
  const [subscribedEmail, setSubscribedEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<NewsletterStatus>("idle");
  const { currency, setCurrency } = useCurrency();
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);

  const submitNewsletter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = subscribedEmail.trim();
    if (!email || newsletterStatus === "sending") return;
    setNewsletterStatus("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      });
      setNewsletterStatus(res.ok ? "success" : "error");
    } catch {
      setNewsletterStatus("error");
    }
  };

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

          {newsletterStatus === "success" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mt-8 text-[14px] font-light text-black"
            >
              Thank you. You are now part of the private circle.
            </motion.p>
          ) : (
            <>
              <form
                onSubmit={submitNewsletter}
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
                <button
                  type="submit"
                  disabled={newsletterStatus === "sending"}
                  className="maison-btn-outline h-12 disabled:opacity-60"
                >
                  {newsletterStatus === "sending" ? "Joining…" : "Join in"}
                </button>
              </form>
              {newsletterStatus === "error" && (
                <p role="alert" className="mt-4 text-[13px] font-light text-black">
                  We could not add your address just now. Please try again in a moment.
                </p>
              )}
            </>
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
                width={952}
                height={488}
                className="h-10 w-auto object-contain mix-blend-multiply"
              />
            </Link>
            <p className="maison-body mt-6 max-w-[42ch]">
              Gharib has composed rare oriental and contemporary fragrances in Dubai since 1993.
              Every bottle is filled, sealed and inspected by hand in our atelier.
            </p>
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
                    <Link href={link.href} className={LINK_CLASS}>
                      {link.label}
                    </Link>
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
                <span className="text-black">{currency}</span>
                <span aria-hidden="true" className="text-[8px] leading-none">
                  ▼
                </span>
              </button>

              <AnimatePresence>
                {isCurrencyDropdownOpen && (
                  <motion.ul
                    role="listbox"
                    aria-label="Display currency"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute bottom-full left-0 z-50 mb-3 max-h-72 w-60 overflow-y-auto border border-[rgba(0,0,0,0.12)] bg-white py-1"
                  >
                    {SUPPORTED_CURRENCIES.map((curr) => (
                      <li key={curr.code} role="option" aria-selected={currency === curr.code}>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrency(curr.code);
                            setIsCurrencyDropdownOpen(false);
                          }}
                          className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-[13px] transition-colors duration-300 hover:bg-[#F5F5F5] hover:text-black ${
                            currency === curr.code ? "text-black" : "text-black/60"
                          }`}
                        >
                          <span>
                            {curr.code} — {curr.label}
                          </span>
                          {currency === curr.code && (
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
              <Link
                href="/privacy"
                className="cursor-pointer transition-colors duration-300 hover:text-black"
              >
                Privacy policy
              </Link>
              <Link
                href="/terms"
                className="cursor-pointer transition-colors duration-300 hover:text-black"
              >
                Terms of use
              </Link>
            </div>
          </div>
        </div>
      </section>
    </footer>
  );
}
