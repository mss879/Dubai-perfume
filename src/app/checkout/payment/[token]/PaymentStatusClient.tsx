"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { mergeIntoCart, type CartLine } from "../../../lib/cart";
import { clearPendingPayment, isPaymobCheckoutUrl } from "../../../lib/payments/pending-payment";
import type { PaymentView } from "../../../lib/payments/paymob/rpc";

const HAIRLINE = "rgba(0,0,0,0.12)";

/** How long to keep checking after the shopper returns from Paymob before offering to pay again. */
const CONFIRM_WINDOW_MS = 60_000;
const POLL_EVERY_MS = 3_000;

const formatAed = (amount: number) =>
  `AED ${amount.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REASONS: Record<string, string> = {
  busy: "Your payment page is already being prepared. Please wait a moment and try again.",
  too_many_attempts: "This order has reached its limit of payment attempts. Please change the order and place it again.",
  window_closed: "The payment window for this order has closed. Please change the order and place it again.",
  gateway_error: "We could not reach our payment partner just now. Please try again in a moment.",
  unavailable: "Online payment is unavailable for a moment. Please try again shortly.",
  already_paid: "This order has already been paid.",
  closed: "This order is no longer awaiting payment.",
  payment_pending: "A payment for this order is still being processed by your bank. Please wait a minute before changing it.",
  not_found: "We could not find this payment.",
};

type Phase = "idle" | "confirming" | "working";

async function post(path: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

function isView(value: unknown): value is PaymentView {
  return Boolean(value && typeof value === "object" && typeof (value as PaymentView).order_id === "string");
}

export default function PaymentStatusClient({
  token,
  initial,
  returning,
}: {
  token: string;
  initial: PaymentView | null;
  returning: boolean;
}) {
  const [view, setView] = useState<PaymentView | null>(initial);
  const [phase, setPhase] = useState<Phase>(returning && initial?.state === "awaiting" ? "confirming" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const startedAt = useRef<number>(0);
  const path = token ? `/checkout/payment/${token}` : "";

  // Paymob's transaction details ride on the URL when it sends the shopper
  // back. They are not used; take them out of the address bar and history.
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, []);

  // Once the order is settled one way or the other, the "awaiting payment"
  // reminder on the checkout page has done its job.
  useEffect(() => {
    if (view && view.state !== "awaiting") clearPendingPayment(path);
  }, [view, path]);

  const refresh = useCallback(async () => {
    if (!token) return null;
    const json = await post("/api/payments/paymob/status", token);
    const next = json && isView(json.view) ? json.view : null;
    if (next) setView(next);
    return next;
  }, [token]);

  // One check on arrival (the server asks Paymob, throttled), then — if the
  // shopper has just come back from Paymob — keep checking for a minute rather
  // than inviting a second payment while the first is being confirmed.
  useEffect(() => {
    if (!token || !initial) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    startedAt.current = Date.now();

    const tick = async () => {
      const next = await refresh();
      if (cancelled) return;
      const awaiting = (next ?? initial).state === "awaiting";
      if (returning && awaiting && Date.now() - startedAt.current < CONFIRM_WINDOW_MS) {
        timer = setTimeout(tick, POLL_EVERY_MS);
      } else {
        setPhase((p) => (p === "confirming" ? "idle" : p));
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, initial, returning, refresh]);

  const payNow = async () => {
    setMessage(null);
    setPhase("working");
    const json = await post("/api/payments/paymob/retry", token);
    if (json?.ok && isPaymobCheckoutUrl(json.redirectUrl)) {
      window.location.assign(json.redirectUrl);
      return;
    }
    if (json && isView(json.view)) setView(json.view);
    setMessage(REASONS[String(json?.reason ?? "unavailable")] ?? REASONS.unavailable);
    setPhase("idle");
  };

  const restoreAndReturn = (items: CartLine[]) => {
    mergeIntoCart(items);
    clearPendingPayment(path);
    window.location.assign("/checkout");
  };

  const changeOrder = async () => {
    setMessage(null);
    setPhase("working");
    const json = await post("/api/payments/paymob/cancel", token);
    if (json?.ok && Array.isArray(json.items)) {
      restoreAndReturn(json.items as CartLine[]);
      return;
    }
    if (json && isView(json.view)) setView(json.view);
    setMessage(REASONS[String(json?.reason ?? "unavailable")] ?? REASONS.unavailable);
    setPhase("idle");
  };

  /* ── Not found ─────────────────────────────────────────────── */

  if (!view) {
    return (
      <Frame eyebrow="Payment" title="We could not find this payment">
        <p className="maison-body">
          The link may be incomplete, or online payment may be unavailable just now. If you have already
          paid, a confirmation is on its way to your inbox.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/track" className="maison-btn w-full sm:w-auto">
            Track your order
          </Link>
          <Link href="/shop" className="maison-btn-outline w-full sm:w-auto">
            Back to the boutique
          </Link>
        </div>
      </Frame>
    );
  }

  const total = Number(view.total) || 0;
  const trackHref = `/track?order=${encodeURIComponent(view.order_id)}`;

  /* ── Paid (and what may have happened since) ───────────────── */

  if (view.state === "paid") {
    const refunded = (Number(view.refunded_fils) || 0) / 100;
    const note =
      view.payment_status === "voided"
        ? "The payment was cancelled before it settled. You have not been charged."
        : view.payment_status === "refunded"
          ? "This payment has been refunded to your original payment method."
          : view.payment_status === "partially_refunded"
            ? `${formatAed(refunded)} of this payment has been refunded to your original payment method.`
            : "Your payment has been received and your fragrances are being prepared in our Dubai atelier. A confirmation is on its way to your inbox.";
    return (
      <Frame eyebrow={`Order reference  ${view.order_id}`} title="Thank you for your order">
        <p className="maison-body">{note}</p>
        <Totals label={view.payment_status === "voided" ? "Order total" : "Total paid"} amount={total} />
        <p className="mt-10 text-[13px] font-light leading-[1.8] text-[#646464]">
          To track your order, keep your order reference {view.order_id} and the email address you ordered
          with to hand.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href={trackHref} className="maison-btn w-full sm:w-auto">
            Track your order
          </Link>
          <Link href="/shop" className="maison-btn-outline w-full sm:w-auto">
            Back to the boutique
          </Link>
        </div>
      </Frame>
    );
  }

  /* ── Released ──────────────────────────────────────────────── */

  if (view.state === "expired" || view.state === "cancelled") {
    if (view.paid_after_close) {
      return (
        <Frame eyebrow={`Order reference  ${view.order_id}`} title="We have received your payment">
          <p className="maison-body">
            Your payment arrived after this order&rsquo;s payment window had closed. A client advisor will be in
            touch shortly to complete your order or refund you in full.
          </p>
          <Totals label="Total paid" amount={total} />
        </Frame>
      );
    }
    return (
      <Frame eyebrow={`Order reference  ${view.order_id}`} title="This order was not completed">
        <p className="maison-body">
          {view.state === "expired"
            ? "The payment window closed before payment was received, so your selection was released. Nothing was charged."
            : "This order was cancelled before payment. Nothing was charged."}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {view.items.length > 0 && (
            <button type="button" className="maison-btn w-full sm:w-auto" onClick={() => restoreAndReturn(view.items)}>
              Restore my selection
            </button>
          )}
          <Link href="/shop" className="maison-btn-outline w-full sm:w-auto">
            Back to the boutique
          </Link>
        </div>
      </Frame>
    );
  }

  /* ── Awaiting payment ──────────────────────────────────────── */

  if (phase === "confirming") {
    return (
      <Frame eyebrow={`Order reference  ${view.order_id}`} title="Confirming your payment">
        <p className="maison-body" role="status">
          We are confirming your payment with our payment partner. This usually takes a few seconds — please
          keep this page open.
        </p>
        <Totals label="Order total" amount={total} />
      </Frame>
    );
  }

  const declined = view.last_attempt_status === "declined";
  const reservedUntil = new Date(view.due_at);
  const until = Number.isNaN(reservedUntil.getTime())
    ? null
    : reservedUntil.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <Frame eyebrow={`Order reference  ${view.order_id}`} title="Complete your payment">
      <p className="maison-body">
        {declined
          ? "Your bank did not approve the payment, and nothing was charged. You can try again with the same card or another."
          : returning
            ? "We have not received confirmation of your payment yet. If you completed it, a confirmation will reach your inbox shortly; otherwise you can pay below."
            : "Your selection is reserved while you complete the payment on our payment partner’s secure page."}
      </p>
      {until && view.can_pay && (
        <p className="mt-4 text-[13px] font-light leading-[1.8] text-[#646464]">Reserved for you until {until}.</p>
      )}
      <Totals label="Amount to pay" amount={total} />

      {message && (
        <p className="mt-8 text-[13px] font-light leading-[1.8] text-black" role="alert">
          {message}
        </p>
      )}

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        {view.can_pay && (
          <button
            type="button"
            className="maison-btn w-full sm:w-auto"
            disabled={phase === "working"}
            onClick={payNow}
          >
            {phase === "working" ? "One moment" : declined ? "Try again" : "Pay now"}
          </button>
        )}
        {view.can_cancel && (
          <button
            type="button"
            className="maison-btn-outline w-full sm:w-auto"
            disabled={phase === "working"}
            onClick={changeOrder}
          >
            Change my order
          </button>
        )}
      </div>
      {!view.can_pay && (
        <p className="mt-8 text-[13px] font-light leading-[1.8] text-[#646464]">
          This order can no longer be paid. Choose &ldquo;Change my order&rdquo; to put your selection back in
          your bag and order again.
        </p>
      )}
    </Frame>
  );
}

function Frame({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="maison-container maison-section">
      <div className="mx-auto max-w-[620px] text-center">
        <p className="maison-eyebrow whitespace-pre">{eyebrow}</p>
        <h1 className="maison-page-title mt-5">{title}</h1>
        <div className="mt-10 pt-10" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Totals({ label, amount }: { label: string; amount: number }) {
  return (
    <div
      className="mt-10 mx-auto max-w-[380px] pt-5 flex items-baseline justify-between gap-4"
      style={{ borderTop: `1px solid ${HAIRLINE}` }}
    >
      <span className="font-display text-[16px] uppercase tracking-[0.08em] text-black">{label}</span>
      <span className="font-display text-[16px] uppercase tracking-[0.08em] text-black">{formatAed(amount)}</span>
    </div>
  );
}
