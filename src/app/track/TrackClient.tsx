"use client";

import React, { useState } from "react";
import Link from "next/link";
import Price from "../components/Price";
import { ORDER_STEPS, isCancelledOrder, stepIndexForStatus } from "../lib/orders";

const HAIRLINE = "rgba(0,0,0,0.12)";

type TrackingEntry = {
  status: string;
  location: string | null;
  description: string | null;
  updated_at: string | null;
};

type TrackedOrder = {
  order_id: string;
  status: string;
  total_price: number | string;
  created_at: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking: TrackingEntry[];
};

const formatDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function TrackClient({ initialOrderId }: { initialOrderId: string }) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reference = orderId.trim();
    const address = email.trim();
    if (!reference || !address || status === "loading") return;

    setStatus("loading");
    setError(null);
    setOrder(null);

    try {
      const res = await fetch(
        `/api/track?order=${encodeURIComponent(reference)}&email=${encodeURIComponent(address)}`
      );
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "We could not find that order.");
      } else {
        setOrder(payload as TrackedOrder);
      }
    } catch {
      setError("We could not reach the tracking service. Please try again.");
    } finally {
      setStatus("idle");
    }
  };

  const activeStep = order ? stepIndexForStatus(order.status) : 0;
  const cancelled = order ? isCancelledOrder(order.status) : false;

  return (
    <div className="maison-container pb-16 md:pb-24">
      <div className="mx-auto max-w-[560px]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="track-order" className="maison-label">
              Order reference
            </label>
            <input
              id="track-order"
              name="order"
              required
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="ORD-10001"
              autoComplete="off"
              className="maison-input"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="track-email" className="maison-label">
              Email address used for the order
            </label>
            <input
              id="track-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="maison-input"
            />
          </div>

          <button type="submit" disabled={status === "loading"} className="maison-btn mt-2">
            {status === "loading" ? "Looking up…" : "Track order"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-8 text-[14px] font-light leading-relaxed text-black">
            {error}
          </p>
        )}

        {order && (
          <section className="mt-14 border-t pt-10" style={{ borderColor: HAIRLINE }}>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="font-display text-[16px] uppercase tracking-[0.08em] text-black">
                {order.order_id}
              </h2>
              <span className="text-[13px] font-light text-[#646464]">
                Placed {formatDate(order.created_at)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
              <span className="maison-body">Order total</span>
              <Price amountAed={parseFloat(String(order.total_price)) || 0} />
            </div>

            {cancelled ? (
              <p className="mt-10 text-[14px] font-light leading-relaxed text-black">
                This order was cancelled. Please contact us if you believe this is a mistake.
              </p>
            ) : (
              <ol className="mt-10 flex flex-col gap-0">
                {ORDER_STEPS.map((step, index) => {
                  const reached = index <= activeStep;
                  return (
                    <li key={step.key} className="flex items-start gap-4">
                      <div className="flex flex-col items-center self-stretch">
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border ${
                            reached ? "bg-black border-black" : "bg-transparent"
                          }`}
                          style={reached ? undefined : { borderColor: HAIRLINE }}
                        />
                        {index < ORDER_STEPS.length - 1 && (
                          <span
                            aria-hidden="true"
                            className="w-px flex-1 my-1"
                            style={{
                              backgroundColor: index < activeStep ? "#000" : HAIRLINE,
                              minHeight: "34px",
                            }}
                          />
                        )}
                      </div>
                      <span
                        className={`pb-6 text-[14px] ${
                          reached ? "font-normal text-black" : "font-light text-[#909090]"
                        }`}
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            {order.tracking_number && (
              <p className="mt-2 text-[13px] font-light text-[#646464]">
                Carrier reference {order.tracking_number}
                {order.tracking_url && (
                  <>
                    {" — "}
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="maison-link"
                    >
                      view with the carrier
                    </a>
                  </>
                )}
              </p>
            )}

            {order.tracking.length > 0 && (
              <div className="mt-10 border-t pt-8" style={{ borderColor: HAIRLINE }}>
                <h3 className="maison-eyebrow">History</h3>
                <ul className="mt-6 flex flex-col gap-6">
                  {order.tracking.map((entry, index) => (
                    <li key={`${entry.status}-${index}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <span className="text-[14px] font-normal text-black">{entry.status}</span>
                        <span className="text-[12px] font-light text-[#909090]">
                          {formatDate(entry.updated_at)}
                        </span>
                      </div>
                      {entry.description && (
                        <p className="mt-1.5 text-[13px] font-light leading-relaxed text-[#646464]">
                          {entry.description}
                        </p>
                      )}
                      {entry.location && (
                        <p className="mt-1 text-[12px] font-light text-[#909090]">
                          {entry.location}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-10 text-[13px] font-light text-[#646464]">
              Have an account?{" "}
              <Link href="/customer/dashboard" className="maison-link">
                See all your orders
              </Link>
              .
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
