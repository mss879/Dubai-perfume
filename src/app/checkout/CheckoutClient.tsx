"use client";

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import { useCart, type CartLine } from "../lib/cart";
import { useCurrency } from "../lib/currency";
import { getBrowserSupabase } from "../lib/supabase-browser";

/** Never-changing store, used only to distinguish server render from client. */
const subscribeToNothing = () => () => {};

/**
 * Product thumbnail. A missing or broken asset leaves the flat #F5F5F5 tile in
 * place rather than substituting another product's photograph. Tracks the failed
 * src (rather than mirroring props into state via an effect) so it self-corrects
 * when the item's image changes.
 */
function CartItemImage({
  src,
  alt,
  sizes,
}: {
  src: string;
  alt: string;
  sizes: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className="object-contain"
      onError={() => setFailedSrc(src)}
    />
  );
}

const HAIRLINE = "rgba(0,0,0,0.12)";

/** Free delivery over AED 250; AED 25 below — matches the server (place_order). */
const FREE_SHIPPING_THRESHOLD_AED = 250;
const SHIPPING_FEE_AED = 25;

/** sessionStorage key for the stable abandoned-cart id. */
const ABANDONED_CART_ID_KEY = "gharib_ac_id";

const CHECKOUT_STEPS = [
  { id: "selection", label: "Selection" },
  { id: "details", label: "Checkout" },
  { id: "confirmation", label: "Confirmation" },
] as const;

const SHIPPING_COUNTRIES = [
  "United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain",
  "United States", "United Kingdom", "Canada", "Switzerland", "Germany", "France",
  "Italy", "Spain", "Netherlands", "Belgium", "Sweden", "Norway", "Japan",
  "South Korea", "Singapore", "Australia", "New Zealand", "Hong Kong", "Turkey",
  "Egypt", "Jordan", "Lebanon", "Morocco", "India", "China", "Malaysia",
  "Thailand", "Brazil", "Mexico",
];

/** Server-computed order figures returned by POST /api/checkout. */
interface OrderResult {
  order_id: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total: number;
}

export default function CheckoutClient() {
  const { lines, count, subtotal, remove, setQuantity, clear } = useCart();
  const { currency, format, rate } = useCurrency();

  const [step, setStep] = useState<"selection" | "details">("selection");

  // The cart hydrates from localStorage after mount (useSyncExternalStore
  // serves the empty server snapshot first) — hold the skeleton until then so
  // shoppers never flash the "empty selection" screen. This is React's
  // documented "has hydration finished" store: false on the server, true on
  // the client, with no state update in an effect.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("United Arab Emirates");
  const [postalCode, setPostalCode] = useState("");

  // Discount code — stored client-side only; the server validates and prices it.
  const [discountInput, setDiscountInput] = useState("");
  const [discountCode, setDiscountCode] = useState<string | null>(null);

  // System states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prefill the contact email from the signed-in session, if any.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getBrowserSupabase();
        const { data } = await supabase.auth.getUser();
        const knownEmail =
          data?.user?.email ||
          (typeof window !== "undefined" ? localStorage.getItem("userEmail") : null);
        if (!cancelled && knownEmail) {
          setEmail((prev) => prev || knownEmail);
        }
      } catch {
        // Auth being down must never block checkout.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stable per-session abandoned-cart id, minted lazily on first use.
  const abandonedCartIdRef = useRef<string | null>(null);
  const getAbandonedCartId = useCallback((): string | null => {
    if (abandonedCartIdRef.current) return abandonedCartIdRef.current;
    if (typeof window === "undefined") return null;
    try {
      let id = sessionStorage.getItem(ABANDONED_CART_ID_KEY);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(ABANDONED_CART_ID_KEY, id);
      }
      abandonedCartIdRef.current = id;
      return id;
    } catch {
      return null;
    }
  }, []);

  // Client-side estimate only — the server reprices everything on placement.
  const shippingFee =
    subtotal > FREE_SHIPPING_THRESHOLD_AED || subtotal === 0 ? 0 : SHIPPING_FEE_AED;
  const total = subtotal + shippingFee;

  const goToDetails = () => {
    setStep("details");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  };

  // Debounced autosave for abandoned-cart recovery. Fire-and-forget: recovery
  // email friction must never surface to the shopper.
  useEffect(() => {
    if (lines.length === 0) return;
    if (!email || !email.includes("@") || !firstName) return;

    const timer = setTimeout(() => {
      const id = getAbandonedCartId();
      if (!id) return;
      fetch("/api/abandoned-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          shipping: {
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            street: street.trim(),
            city: city.trim(),
            country: country.trim(),
            postal_code: postalCode.trim(),
          },
          cartItems: lines.map((l) => ({
            product_id: l.product.id,
            brand: l.product.brand,
            name: l.product.name,
            size: l.selectedSize,
            quantity: l.quantity,
            unit_price: l.product.price,
          })),
          total,
          currency,
          exchangeRate: rate,
        }),
      }).catch(() => {});
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timer);
  }, [
    lines, email, firstName, lastName, phone, street, city, country, postalCode,
    total, currency, rate, getAbandonedCartId,
  ]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (lines.length === 0) {
      setErrorMsg("Your selection is currently empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          shipping: {
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            street: street.trim(),
            city: city.trim(),
            country: country.trim(),
            postal_code: postalCode.trim(),
          },
          items: lines.map((l) => ({
            productId: l.product.id,
            size: l.selectedSize,
            quantity: l.quantity,
          })),
          discountCode: discountCode || undefined,
          abandonedCartId: getAbandonedCartId() || undefined,
          currency,
          exchangeRate: rate,
          paymentMethod: "cod",
        }),
      });

      let json: {
        ok?: boolean;
        order_id?: string;
        subtotal?: number;
        shipping_fee?: number;
        discount_amount?: number;
        total?: number;
        error?: string;
      } | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (res.ok && json?.ok) {
        clear();
        try {
          sessionStorage.removeItem(ABANDONED_CART_ID_KEY);
        } catch {}
        abandonedCartIdRef.current = null;
        setOrderResult({
          order_id: String(json.order_id ?? ""),
          subtotal: Number(json.subtotal) || 0,
          shipping_fee: Number(json.shipping_fee) || 0,
          discount_amount: Number(json.discount_amount) || 0,
          total: Number(json.total) || 0,
        });
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0 });
        }
      } else {
        // Covers 409 out-of-stock, 422 validation and 5xx alike: surface the
        // server's message inline and stay on the page.
        setErrorMsg(json?.error || "We could not place your order. Please try again.");
      }
    } catch {
      setErrorMsg("We could not reach the boutique. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyDiscount = () => {
    const code = discountInput.trim();
    if (!code) return;
    setDiscountCode(code);
    setErrorMsg(null);
  };

  const removeDiscount = () => {
    setDiscountCode(null);
    setDiscountInput("");
    setErrorMsg(null);
  };

  /* ── Shared fragments ─────────────────────────────────────────── */

  const stepIndicator = (current: "selection" | "details" | "confirmation") => {
    const activeIndex = CHECKOUT_STEPS.findIndex((s) => s.id === current);
    return (
      <div className="mt-6 flex items-center justify-center gap-3 md:gap-5">
        {CHECKOUT_STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && (
              <span aria-hidden="true" className="block h-px w-6 md:w-10" style={{ background: HAIRLINE }} />
            )}
            <span
              className="text-[11px] md:text-[12px] uppercase tracking-[0.1em]"
              style={{ color: i === activeIndex ? "#000000" : "#646464" }}
              aria-current={i === activeIndex ? "step" : undefined}
            >
              {`0${i + 1}`}&nbsp;&nbsp;{s.label}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const totalsBlock = (
    <div>
      <div className="flex items-baseline justify-between py-2">
        <span className="text-[14px] font-light text-black">Subtotal</span>
        <span className="text-[14px] font-light text-black">{format(subtotal)}</span>
      </div>
      <div className="flex items-baseline justify-between py-2">
        <span className="text-[14px] font-light text-black">Delivery</span>
        <span className="text-[14px] font-light text-black">
          {shippingFee === 0 ? "Complimentary" : format(shippingFee)}
        </span>
      </div>
      {shippingFee > 0 && (
        <p className="pt-1 pb-2 text-[12px] font-light text-[#646464]">
          Complimentary delivery on orders over {format(FREE_SHIPPING_THRESHOLD_AED)}.
        </p>
      )}
      {discountCode && (
        <p className="pt-1 pb-2 text-[12px] font-light text-[#646464]">
          Code {discountCode} will be applied when the order is placed.
        </p>
      )}
      <div
        className="mt-4 pt-5 flex items-baseline justify-between gap-4"
        style={{ borderTop: `1px solid ${HAIRLINE}` }}
      >
        <span className="font-display text-[16px] md:text-[18px] uppercase tracking-[0.08em] text-black">
          Total
        </span>
        <span className="font-display text-[16px] md:text-[18px] uppercase tracking-[0.08em] text-black">
          {format(total)}
        </span>
      </div>
    </div>
  );

  const discountBlock = (
    <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <label htmlFor="discountCode" className="maison-label">
        Discount code
      </label>
      {discountCode ? (
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[13px] font-light uppercase tracking-[0.08em] text-black">
            {discountCode}
          </span>
          <button
            type="button"
            onClick={removeDiscount}
            className="maison-link cursor-pointer"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-stretch gap-3">
          <input
            id="discountCode"
            type="text"
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyDiscount();
              }
            }}
            placeholder="Enter code"
            className="maison-input flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={applyDiscount}
            className="maison-btn-outline shrink-0"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );

  /* ── Loading shell ────────────────────────────────────────────── */

  if (!hydrated) {
    return (
      <div className="maison min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-grow">
          <div className="maison-container">
            <div className="pt-14 pb-10 md:pt-20 md:pb-14 flex justify-center">
              <div className="h-7 w-56 bg-[#F5F5F5]" />
            </div>
            <hr className="maison-rule" />
            <div className="grid grid-cols-1 lg:grid-cols-[1.86fr_1fr] gap-x-16 gap-y-14 pt-12 pb-20 md:pb-28 items-start">
              <ul style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <li
                    key={i}
                    className="flex gap-5 md:gap-8 py-8"
                    style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                  >
                    <div className="w-24 h-24 shrink-0 bg-[#F5F5F5]" />
                    <div className="flex-1 min-w-0">
                      <div className="h-3 w-24 bg-[#F5F5F5]" />
                      <div className="h-4 w-2/3 bg-[#F5F5F5] mt-3" />
                      <div className="h-3 w-16 bg-[#F5F5F5] mt-3" />
                      <div className="h-9 w-28 bg-[#F5F5F5] mt-5" />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="bg-[#F5F5F5] h-64" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ── Order confirmation ───────────────────────────────────────── */

  if (orderResult) {
    return (
      <div className="maison min-h-screen flex flex-col">
        <AppHeader />
        <CartDrawer />
        <main className="flex-grow">
          <div className="maison-container maison-section">
            <div className="mx-auto max-w-[620px] text-center">
              <h1 className="maison-page-title">Thank you for your order</h1>
              {stepIndicator("confirmation")}

              <div className="mt-12 pt-10" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                <p className="maison-eyebrow">Order reference&nbsp;&nbsp;{orderResult.order_id}</p>
              </div>

              <p className="mt-6 text-[14px] font-light leading-[1.8] text-black">
                Your fragrances are being prepared in our Dubai atelier. A confirmation has been sent
                to {email || "your inbox"}. Your order is payable in cash or by card to the courier
                on delivery.
              </p>

              {/* Server-computed figures — the authoritative record. */}
              <div className="mt-10 mx-auto max-w-[380px] text-left">
                <div className="flex items-baseline justify-between py-2">
                  <span className="text-[14px] font-light text-black">Subtotal</span>
                  <span className="text-[14px] font-light text-black">
                    {format(orderResult.subtotal)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between py-2">
                  <span className="text-[14px] font-light text-black">Delivery</span>
                  <span className="text-[14px] font-light text-black">
                    {orderResult.shipping_fee === 0 ? "Complimentary" : format(orderResult.shipping_fee)}
                  </span>
                </div>
                {orderResult.discount_amount > 0 && (
                  <div className="flex items-baseline justify-between py-2">
                    <span className="text-[14px] font-light text-black">
                      Discount{discountCode ? ` (${discountCode})` : ""}
                    </span>
                    <span className="text-[14px] font-light text-black">
                      &minus;{format(orderResult.discount_amount)}
                    </span>
                  </div>
                )}
                <div
                  className="mt-4 pt-5 flex items-baseline justify-between gap-4"
                  style={{ borderTop: `1px solid ${HAIRLINE}` }}
                >
                  <span className="font-display text-[16px] uppercase tracking-[0.08em] text-black">
                    Total due on delivery
                  </span>
                  <span className="font-display text-[16px] uppercase tracking-[0.08em] text-black">
                    {format(orderResult.total)}
                  </span>
                </div>
              </div>

              <p className="mt-10 text-[13px] font-light leading-[1.8] text-[#646464]">
                To track your order, keep your order reference {orderResult.order_id} and the email
                address you ordered with to hand — both are needed to follow the parcel.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href={`/track?order=${encodeURIComponent(orderResult.order_id)}`}
                  className="maison-btn w-full sm:w-auto"
                >
                  Track your order
                </Link>
                <Link href="/shop" className="maison-btn-outline w-full sm:w-auto">
                  Back to the boutique
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ── Empty selection ──────────────────────────────────────────── */

  if (lines.length === 0) {
    return (
      <div className="maison min-h-screen flex flex-col">
        <AppHeader />
        <CartDrawer />
        <main className="flex-grow">
          <div className="maison-container maison-section">
            <div className="mx-auto max-w-[560px] text-center">
              <h1 className="maison-page-title">Your cart is empty</h1>
              <p className="mt-8 text-[14px] font-light leading-[1.8] text-black">
                Nothing has been selected yet. Explore the collection and compose your own signature.
              </p>
              <div className="mt-10">
                <Link href="/shop" className="maison-btn-outline">
                  Discover the fragrances
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ── Selection + checkout ─────────────────────────────────────── */

  return (
    <div className="maison min-h-screen flex flex-col">
      <AppHeader />
      <CartDrawer />

      <main className="flex-grow">
        <div className="maison-container">
          {/* Page head */}
          <div className="pt-14 pb-10 md:pt-20 md:pb-14 text-center">
            <h1 className="maison-page-title">
              {step === "selection" ? "Your selection" : "Checkout"}
            </h1>
            {stepIndicator(step)}
          </div>

          <hr className="maison-rule" />

          <div className="grid grid-cols-1 lg:grid-cols-[1.86fr_1fr] gap-x-16 gap-y-14 pt-12 pb-20 md:pb-28 items-start">
            {/* ── LEFT COLUMN ─────────────────────────────────────── */}
            <div>
              {step === "selection" ? (
                <>
                  <h2 className="maison-eyebrow pb-5">
                    {count} {count === 1 ? "Item" : "Items"}
                  </h2>

                  <ul style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                    {lines.map((line: CartLine) => (
                      <li
                        key={`${line.product.id}-${line.selectedSize}`}
                        className="flex gap-5 md:gap-8 py-8"
                        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                      >
                        <div className="w-24 h-24 shrink-0 flex items-center justify-center bg-[#F5F5F5] p-3">
                          <div className="relative w-full h-full">
                            <CartItemImage
                              src={line.product.image_url}
                              alt={line.product.name}
                              sizes="96px"
                            />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-8">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">
                              {line.product.brand}
                            </p>
                            <h3 className="mt-2 font-display text-[16px] uppercase tracking-[0.08em] leading-[1.4] text-black">
                              {line.product.name}
                            </h3>
                            <p className="mt-2 text-[12px] uppercase tracking-[0.08em] text-[#646464]">
                              {line.selectedSize}
                            </p>

                            <div className="mt-5 flex items-center gap-6">
                              <div
                                className="inline-flex items-center bg-transparent"
                                style={{ border: `1px solid ${HAIRLINE}` }}
                              >
                                <button
                                  type="button"
                                  aria-label={`Decrease quantity of ${line.product.name}`}
                                  onClick={() =>
                                    setQuantity(line.product.id, line.selectedSize, line.quantity - 1)
                                  }
                                  disabled={line.quantity <= 1}
                                  className="w-9 h-9 flex items-center justify-center text-[14px] text-[#646464] hover:text-black transition-colors duration-300 disabled:opacity-30 cursor-pointer"
                                >
                                  &minus;
                                </button>
                                <span className="w-9 text-center text-[13px] font-light text-black">
                                  {line.quantity}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Increase quantity of ${line.product.name}`}
                                  onClick={() =>
                                    setQuantity(line.product.id, line.selectedSize, line.quantity + 1)
                                  }
                                  className="w-9 h-9 flex items-center justify-center text-[14px] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => remove(line.product.id, line.selectedSize)}
                                className="text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="sm:text-right shrink-0">
                            <span className="maison-price">
                              {format(line.product.price * line.quantity)}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <form onSubmit={handlePlaceOrder} className="flex flex-col gap-14">
                  {errorMsg && (
                    <p
                      className="pl-4 text-[13px] font-light leading-[1.7] text-black"
                      style={{ borderLeft: "1px solid #000000" }}
                      role="alert"
                    >
                      {errorMsg}
                    </p>
                  )}

                  {/* Contact */}
                  <section>
                    <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                      Contact
                    </h2>
                    <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="firstName" className="maison-label">First name</label>
                        <input
                          id="firstName"
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Alex"
                          className="maison-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="lastName" className="maison-label">Last name</label>
                        <input
                          id="lastName"
                          type="text"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Mercer"
                          className="maison-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="maison-label">Email address</label>
                        <input
                          id="email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="maison-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="phone" className="maison-label">Phone number</label>
                        <input
                          id="phone"
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+971 50 123 4567"
                          className="maison-input"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Delivery address */}
                  <section>
                    <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                      Delivery address
                    </h2>
                    <div className="pt-8 flex flex-col gap-6">
                      <div>
                        <label htmlFor="street" className="maison-label">Street address</label>
                        <input
                          id="street"
                          type="text"
                          required
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          placeholder="Sheikh Zayed Road, Apt 1402"
                          className="maison-input"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label htmlFor="city" className="maison-label">City</label>
                          <input
                            id="city"
                            type="text"
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Dubai"
                            className="maison-input"
                          />
                        </div>

                        <div>
                          <label htmlFor="country" className="maison-label">Country</label>
                          <div className="relative">
                            <select
                              id="country"
                              value={country}
                              onChange={(e) => setCountry(e.target.value)}
                              className="maison-select cursor-pointer"
                              style={{ paddingRight: 36 }}
                            >
                              {SHIPPING_COUNTRIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-[12px] text-[#646464]"
                            >
                              &#9662;
                            </span>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="postalCode" className="maison-label">Postal code</label>
                          <input
                            id="postalCode"
                            type="text"
                            required
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            placeholder="00000"
                            className="maison-input"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Payment — cash on delivery only */}
                  <section>
                    <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                      Payment
                    </h2>
                    <div className="mt-8 bg-[#F5F5F5] p-6 md:p-8">
                      <p className="text-[13px] uppercase tracking-[0.1em] text-black">
                        Cash on delivery
                      </p>
                      <p className="mt-3 text-[13px] font-light leading-[1.7] text-[#646464]">
                        Pay in cash or by card to the courier when your order arrives. Nothing is
                        charged before your parcel is in your hands.
                      </p>
                    </div>
                  </section>

                  <div className="flex flex-col items-center gap-6">
                    <label
                      htmlFor="accept-terms"
                      className="flex w-full items-start gap-3 text-[13px] font-light leading-[1.7] text-[#646464]"
                    >
                      <input
                        id="accept-terms"
                        name="acceptTerms"
                        type="checkbox"
                        required
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 accent-black"
                      />
                      <span>
                        I accept the{" "}
                        <Link href="/terms" className="maison-link" target="_blank">
                          terms of use
                        </Link>{" "}
                        and the{" "}
                        <Link href="/returns" className="maison-link" target="_blank">
                          shipping &amp; returns policy
                        </Link>
                        .
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSubmitting || !acceptedTerms}
                      className="maison-btn w-full"
                    >
                      {isSubmitting ? "Placing order" : "Place order"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep("selection")}
                      className="maison-link cursor-pointer"
                    >
                      Return to selection
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* ── RIGHT COLUMN — order summary ────────────────────── */}
            <aside className="lg:sticky lg:top-10">
              <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                Order summary
              </h2>

              {step === "details" && (
                <ul className="pt-2">
                  {lines.map((line: CartLine) => (
                    <li
                      key={`summary-${line.product.id}-${line.selectedSize}`}
                      className="flex gap-4 py-5"
                      style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                    >
                      <div className="w-16 h-16 shrink-0 flex items-center justify-center bg-[#F5F5F5] p-2">
                        <div className="relative w-full h-full">
                          <CartItemImage
                            src={line.product.image_url}
                            alt={line.product.name}
                            sizes="64px"
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-[14px] uppercase tracking-[0.08em] leading-[1.4] text-black">
                          {line.product.name}
                        </h3>
                        <p className="mt-1.5 text-[12px] uppercase tracking-[0.08em] text-[#646464]">
                          {line.selectedSize} &nbsp;·&nbsp; Qty {line.quantity}
                        </p>
                      </div>
                      <span className="maison-price shrink-0">
                        {format(line.product.price * line.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className={step === "details" ? "pt-6" : "pt-8"}>
                {totalsBlock}
              </div>

              {discountBlock}

              {step === "selection" && (
                <div className="mt-10 flex flex-col items-center gap-6">
                  <button type="button" onClick={goToDetails} className="maison-btn w-full">
                    Proceed to checkout
                  </button>
                  <Link href="/shop" className="maison-link">
                    Continue shopping
                  </Link>
                </div>
              )}

              <div className="mt-8 flex flex-col gap-2">
                <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">
                  Payment on delivery
                </p>
                <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">
                  Hand-finished gift wrapping
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
