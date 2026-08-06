"use client";

import { useState } from "react";
import { ORDER_STEPS, isCancelledOrder, stepIndexForStatus } from "../../lib/orders";
import type { ConciergeOrderView } from "../../lib/concierge/types";

const HAIRLINE = "rgba(0,0,0,0.12)";

/**
 * The order lookup, on the stage.
 *
 * Two panes in one exhibit: the form, and the timeline it produces. What is
 * typed here goes straight to /api/concierge/order and nowhere near the model —
 * the agent never sees the email or the reference, which is the entire reason
 * this is a form rather than a conversation.
 *
 * The /track layout does not survive being put in a 480px drawer at 38% height,
 * so this is the compact reading of the same stepper: the dots and their
 * connectors, and the most recent movement rather than the whole history.
 */

/**
 * A step's label is a NOUN ("In transit"), so it cannot be dropped into a
 * sentence — "your order is at in transit" is how that reads. These are the
 * same four states as clauses.
 */
const STEP_PHRASE: Record<string, string> = {
  placed: "with us, and being prepared",
  preparing: "being prepared for you",
  in_transit: "on its way to you",
  delivered: "delivered",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function orderSummaryLine(order: ConciergeOrderView): string {
  const cancelled = isCancelledOrder(order.status);
  const items = order.items.map((i) => i.name.replace(/_/g, " ")).filter(Boolean);
  const holds =
    items.length === 0
      ? ""
      : items.length === 1
        ? ` It holds your ${items[0]}.`
        : ` It holds your ${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}.`;

  if (cancelled) {
    return `Order ${order.orderId} was cancelled.${holds} If that is not what you expected, the contact page will reach a person.`;
  }
  const phrase = STEP_PHRASE[ORDER_STEPS[stepIndexForStatus(order.status)]?.key ?? "placed"] ?? "with us";
  return `Order ${order.orderId} is ${phrase}.${holds}`;
}

export const ORDER_CHIPS = [
  "What did I order again?",
  "Something to layer with it",
  "Show me what is new",
];

export default function StageOrderLookup({
  prefillOrderRef,
  order,
  busy,
  onLookup,
  onReset,
}: {
  prefillOrderRef?: string;
  order?: ConciergeOrderView | null;
  busy: boolean;
  onLookup: (orderRef: string, email: string) => Promise<void>;
  onReset: () => void;
}) {
  const [ref, setRef] = useState(prefillOrderRef ?? "");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const r = ref.trim();
    const e = email.trim();
    if (!r || !e || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onLookup(r, e);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "That lookup did not work.");
    } finally {
      setSubmitting(false);
    }
  };

  if (order) {
    const cancelled = isCancelledOrder(order.status);
    const activeStep = stepIndexForStatus(order.status);
    const latest = order.events[order.events.length - 1];

    return (
      <div className="flex h-full flex-col overflow-y-auto px-6 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="maison-eyebrow">{order.orderId}</span>
          <button
            type="button"
            onClick={onReset}
            className="maison-link text-[9px] cursor-pointer"
          >
            Another order
          </button>
        </div>

        {cancelled ? (
          <p className="mt-4 text-[13px] font-light leading-relaxed text-black">
            This order was cancelled. If that is not what you expected, the contact page will
            reach a person.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col">
            {ORDER_STEPS.map((step, index) => {
              const done = index <= activeStep;
              return (
                <li key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: done ? "#000" : HAIRLINE }}
                    />
                    {index < ORDER_STEPS.length - 1 && (
                      <span
                        className="w-px flex-1"
                        style={{
                          minHeight: 26,
                          backgroundColor: index < activeStep ? "#000" : HAIRLINE,
                        }}
                      />
                    )}
                  </div>
                  <span
                    className={`-mt-[5px] text-[12px] font-light leading-relaxed ${
                      done ? "text-black" : "text-[#9a9a9a]"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {latest && (
          <p className="mt-3 text-[11px] font-light leading-relaxed text-[#646464]">
            {latest.description || latest.status}
            {latest.location ? ` — ${latest.location}` : ""}
            {latest.updatedAt ? `, ${formatDate(latest.updatedAt)}` : ""}
          </p>
        )}

        {order.trackingNumber && (
          <p className="mt-2 text-[11px] font-light text-[#646464]">
            Carrier reference {order.trackingNumber}
            {order.trackingUrl && (
              <>
                {" · "}
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="maison-link text-[9px]"
                >
                  Track
                </a>
              </>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-6 py-5">
      <div>
        <span className="maison-eyebrow">Find your order</span>
        <p className="mt-1 text-[11px] font-light leading-relaxed text-[#646464]">
          Typed here, not in the conversation — the concierge does not see these.
        </p>
      </div>

      <input
        type="text"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Order number"
        aria-label="Order number"
        autoComplete="off"
        className="w-full border bg-white px-3 py-2.5 text-[13px] font-light text-black outline-none transition-colors duration-300 focus:border-black placeholder:text-[#9a9a9a]"
        style={{ borderColor: HAIRLINE }}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Order email"
        aria-label="The email you ordered with"
        autoComplete="email"
        className="w-full border bg-white px-3 py-2.5 text-[13px] font-light text-black outline-none transition-colors duration-300 focus:border-black placeholder:text-[#9a9a9a]"
        style={{ borderColor: HAIRLINE }}
      />

      <button
        type="button"
        onClick={submit}
        disabled={!ref.trim() || !email.trim() || submitting || busy}
        className="maison-btn w-full cursor-pointer"
        style={{ padding: "11px 20px", fontSize: 11 }}
      >
        {submitting ? "Looking…" : "Find it"}
      </button>

      {error && (
        <p className="text-[11px] font-light leading-relaxed text-[#646464]">{error}</p>
      )}
    </div>
  );
}
