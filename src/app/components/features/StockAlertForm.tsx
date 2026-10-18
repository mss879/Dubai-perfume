"use client";

import { useState } from "react";
import { useFeature } from "../StoreFeaturesProvider";

/** "Notify me when it's back" for a sold-out size (Admin → Back-in-stock alerts). */
export default function StockAlertForm({ productId, size, defaultEmail = "" }: { productId: number; size: string; defaultEmail?: string }) {
  const settings = useFeature("back_in_stock");
  const [email, setEmail] = useState(defaultEmail);
  const [company, setCompany] = useState("");
  const [state, setState] = useState<{ size: string; status: "idle" | "busy" | "done" | "error"; message?: string }>({ size, status: "idle" });
  if (!settings) return null;
  // A different size was chosen: start again.
  const current = state.size === size ? state : { size, status: "idle" as const };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ size, status: "busy" });
    try {
      const res = await fetch("/api/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, size, email: email.trim(), company }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && json?.ok) setState({ size, status: "done" });
      else setState({ size, status: "error", message: json?.error || "We couldn't save that just now. Please try again." });
    } catch {
      setState({ size, status: "error", message: "We couldn't reach the boutique. Please try again." });
    }
  };

  if (current.status === "done") {
    return (
      <p className="mt-4 bg-[var(--surface-2)] p-4 text-[13px] font-light leading-[1.7] text-black" role="status">
        Thank you. We&rsquo;ll write to {email.trim()} as soon as {size} is back.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 bg-[var(--surface-2)] p-4">
      <p className="text-[13px] font-normal text-black">Notify me when {size} is back</p>
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <div className="mt-3 flex items-stretch gap-3">
        <label htmlFor="stock-alert-email" className="sr-only">
          Email address
        </label>
        <input
          id="stock-alert-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="maison-input min-w-0 flex-1 bg-white"
        />
        <button type="submit" disabled={current.status === "busy"} className="maison-btn shrink-0" style={{ paddingLeft: 20, paddingRight: 20 }}>
          {current.status === "busy" ? "One moment" : "Notify me"}
        </button>
      </div>
      {current.status === "error" ? (
        <p role="alert" className="mt-2 text-[12px] text-black">
          {current.message}
        </p>
      ) : (
        <p className="mt-2 text-[12px] font-light text-[#646464]">{String(settings.form_note || "We'll write once, when it's back.")}</p>
      )}
    </form>
  );
}
