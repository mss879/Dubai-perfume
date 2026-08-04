"use client";

import { useState } from "react";
import Link from "next/link";

type Status = "idle" | "sending" | "done" | "error";

export default function StopRecoveryClient({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = async () => {
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/cart-recovery/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && json?.ok) {
        setStatus("done");
      } else {
        setStatus("error");
        setError(json?.error || "We could not action this just now. Please try again in a moment.");
      }
    } catch {
      setStatus("error");
      setError("We could not reach the boutique. Please check your connection and try again.");
    }
  };

  if (!token) {
    return (
      <p className="mt-10 text-[13px] font-light leading-[1.8] text-[#646464]">
        This link is incomplete. Please open it again from the message we sent, or{" "}
        <Link href="/contact" className="maison-link">
          write to us
        </Link>{" "}
        and we will action it by hand.
      </p>
    );
  }

  if (status === "done") {
    return (
      <div className="mt-10">
        <p className="text-[14px] font-light leading-[1.8] text-black">
          Done. You will not hear from us about saved selections again.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/shop" className="maison-btn-outline w-full sm:w-auto">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={stop}
        disabled={status === "sending"}
        className="maison-btn cursor-pointer disabled:opacity-60"
      >
        {status === "sending" ? "One moment…" : "Stop these reminders"}
      </button>

      {error && (
        <p role="alert" className="mt-6 text-[13px] font-light leading-[1.8] text-black">
          {error}
        </p>
      )}
    </div>
  );
}
