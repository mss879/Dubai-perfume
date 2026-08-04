"use client";

import { useEffect } from "react";
import "./globals.css";
import { SITE_NAME } from "./lib/site";

/**
 * Last resort: the root layout itself threw, so this replaces it and has to
 * bring its own <html>, <body> and stylesheet. Metadata exports are not
 * available here, hence the React <title>. Deliberately the same face as
 * error.tsx — a shopper should never meet the unbranded stock page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error.digest ?? "no digest", error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <title>{`Something went wrong | ${SITE_NAME}`}</title>
        <main className="maison flex min-h-screen flex-col items-center justify-center gap-8 bg-white px-6 text-center">
          <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">
            Something went wrong
          </p>
          <h1 className="font-display text-[28px] leading-none tracking-[0.1em] uppercase text-black">
            A moment, please
          </h1>
          <p className="max-w-[46ch] text-[14px] font-light leading-relaxed text-[#646464]">
            An unexpected error occurred. Please try again.
          </p>
          <button type="button" onClick={reset} className="maison-btn-outline cursor-pointer">
            Try again
          </button>
          {error.digest && (
            <p className="text-[11px] font-light tracking-[0.08em] text-[#909090]">
              Reference {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
