"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A server error reaches the browser stripped of its message; the digest is
  // the only handle back to the server log, so log it and let the shopper
  // quote it to us.
  useEffect(() => {
    console.error("Route error:", error.digest ?? "no digest", error);
  }, [error]);

  return (
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
  );
}
