"use client";

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import FreeDeliveryProgress from "../components/FreeDeliveryProgress";
import { useCart, readCart, type CartLine } from "../lib/cart";
import { useCurrency } from "../lib/currency";
import { shippingFeeForSubtotal } from "../lib/shipping";
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

/** sessionStorage key for the stable abandoned-cart id. */
const ABANDONED_CART_ID_KEY = "gharib_ac_id";

/** sessionStorage key for the last confirmation, so a reload does not lose it. */
const LAST_ORDER_KEY = "gharib_last_order";

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

/**
 * What the confirmation screen still needs after a reload: the server's figures
 * plus the email and code the order was placed with, neither of which survives
 * in the form once the page is re-rendered from scratch.
 */
interface ConfirmedOrder extends OrderResult {
  email: string;
  code: string | null;
}

/**
 * The last confirmation from this session, if there is one to show.
 *
 * A cart with anything in it means the shopper is buying again rather than
 * re-reading a receipt, so the stale confirmation is dropped instead.
 */
function readStoredOrder(): ConfirmedOrder | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY);
    if (!raw) return null;
    if (readCart().length > 0) {
      sessionStorage.removeItem(LAST_ORDER_KEY);
      return null;
    }
    const saved = JSON.parse(raw) as ConfirmedOrder;
    return saved?.order_id ? saved : null;
  } catch {
    // An unreadable store simply means there is nothing to restore.
    return null;
  }
}

/**
 * Snapshot of the stored confirmation, resolved once and then held.
 *
 * useSyncExternalStore compares snapshots by reference, so this must return the
 * same object every time or the component re-renders forever. Cached at module
 * scope, and refreshed by the submit handler when a new order replaces it.
 */
let storedOrderSnapshot: ConfirmedOrder | null | undefined;

function getStoredOrder(): ConfirmedOrder | null {
  if (storedOrderSnapshot === undefined) storedOrderSnapshot = readStoredOrder();
  return storedOrderSnapshot;
}

/** Server render has no sessionStorage, so it restores nothing. */
const noStoredOrder = () => null;

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

  // Honeypot — a bot filling this in is the only way it carries a value.
  const [company, setCompany] = useState("");

  // Discount code — priced by the server before the shopper commits, then
  // re-validated and re-priced at order time, which is the authority.
  const [discountInput, setDiscountInput] = useState("");
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountNote, setDiscountNote] = useState<string | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);

  // System states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [orderResult, setOrderResult] = useState<ConfirmedOrder | null>(null);
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

  // The confirmation lived in component state alone, so a reload lost it. It is
  // now kept for the session and read back through the same external-store
  // mechanism the cart uses: the server snapshot is null so the markup matches
  // on both sides, and no state is set from an effect to achieve it.
  const restoredOrder = useSyncExternalStore(
    subscribeToNothing,
    getStoredOrder,
    noStoredOrder
  );

  /**
   * A new bag retires the old receipt.
   *
   * storedOrderSnapshot is module-scoped and resolved once — useSyncExternalStore
   * compares snapshots by reference, so it must not be re-read on every render.
   * The consequence is that readStoredOrder's own "cart is non-empty, drop the
   * receipt" guard stops being consulted the moment the snapshot is set, and the
   * submit handler sets it directly. Clearing it here is what lets a shopper
   * place a second order in the same tab.
   *
   * Touches no React state, so it cannot cascade a render.
   */
  useEffect(() => {
    if (lines.length === 0) return;
    storedOrderSnapshot = null;
    try {
      sessionStorage.removeItem(LAST_ORDER_KEY);
    } catch {
      // A sessionStorage that will not co-operate simply keeps nothing.
    }
  }, [lines.length]);

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
  const shippingFee = subtotal === 0 ? 0 : shippingFeeForSubtotal(subtotal);
  const total = Math.max(0, subtotal + shippingFee - discountAmount);

  /**
   * Re-price an applied code whenever the basket changes.
   *
   * discountAmount is a quote for one particular basket. Change the bag and it
   * goes stale: a percentage code is worth more on a larger basket, and a code
   * with a minimum stops applying to a smaller one. place_order() always
   * re-prices from the live basket, so leaving the old figure on screen means
   * quoting a total the server will not charge.
   *
   * The server is asked again rather than the arithmetic being repeated here —
   * percentage-vs-fixed, the minimum and the usage cap all live in the database,
   * and a second implementation of them would be a second thing to get wrong.
   */
  const pricedForSubtotal = useRef<number | null>(null);

  useEffect(() => {
    if (!discountCode) {
      pricedForSubtotal.current = null;
      return;
    }
    // Already priced for exactly this basket (including the apply that set it).
    if (pricedForSubtotal.current === subtotal) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/discount", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: discountCode, subtotal }),
        });
        const json = (await res.json().catch(() => null)) as {
          valid?: boolean | null;
          discountAmount?: number;
          message?: string;
        } | null;
        if (cancelled) return;

        pricedForSubtotal.current = subtotal;

        if (res.ok && json?.valid === true) {
          setDiscountAmount(Number(json.discountAmount) || 0);
          setDiscountNote(json.message || "Your code has been applied.");
        } else if (res.ok && json?.valid === false) {
          // Usually a minimum the basket has dropped below. The code stays in
          // the box so the shopper can see which one stopped applying, and it
          // is worth nothing until it qualifies again.
          setDiscountAmount(0);
          setDiscountNote(json.message || "That code no longer applies to this order.");
        } else {
          setDiscountAmount(0);
          setDiscountNote(
            "We could not re-check that code. It will be applied if it is valid when your order is placed."
          );
        }
      } catch {
        // Promise nothing we cannot verify; place_order still honours a valid code.
        if (cancelled) return;
        pricedForSubtotal.current = subtotal;
        setDiscountAmount(0);
      }
    })();

    return () => {
      // A later basket must win: an in-flight answer for a bag the shopper has
      // already changed is discarded rather than overwriting the newer quote.
      cancelled = true;
    };
  }, [subtotal, discountCode]);

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
          company,
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
        const confirmed: ConfirmedOrder = {
          order_id: String(json.order_id ?? ""),
          subtotal: Number(json.subtotal) || 0,
          shipping_fee: Number(json.shipping_fee) || 0,
          discount_amount: Number(json.discount_amount) || 0,
          total: Number(json.total) || 0,
          email: email.trim(),
          code: discountCode,
        };
        clear();
        try {
          sessionStorage.removeItem(ABANDONED_CART_ID_KEY);
          sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(confirmed));
        } catch {}
        // Keep the restore snapshot in step, so returning to checkout later in
        // the same session shows this order rather than a stale earlier one.
        storedOrderSnapshot = confirmed;
        abandonedCartIdRef.current = null;
        setOrderResult(confirmed);
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

  // Ask the server what the code is worth for this basket. The figure is only
  // ever shown, never charged: place_order re-validates and re-prices it.
  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code || checkingDiscount) return;
    setErrorMsg(null);
    setCheckingDiscount(true);
    try {
      const res = await fetch("/api/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });

      let json: {
        valid?: boolean | null;
        discountAmount?: number;
        message?: string;
      } | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      // Records the basket this answer was priced against, so the re-pricing
      // effect does not immediately ask the same question again.
      pricedForSubtotal.current = subtotal;

      if (res.ok && json?.valid === true) {
        setDiscountCode(code);
        setDiscountAmount(Number(json.discountAmount) || 0);
        setDiscountNote(json.message || "Your code has been applied.");
      } else if (res.ok && json?.valid === false) {
        setDiscountCode(null);
        setDiscountAmount(0);
        setDiscountNote(json.message || "That code cannot be used with this order.");
      } else {
        // valid: null, or an endpoint that is not answering properly — keep the
        // code so the server can still honour it, and promise nothing.
        setDiscountCode(code);
        setDiscountAmount(0);
        setDiscountNote(
          json?.message ||
            "We could not check that code just now. It will be applied if it is valid when your order is placed."
        );
      }
    } catch {
      pricedForSubtotal.current = subtotal;
      setDiscountCode(code);
      setDiscountAmount(0);
      setDiscountNote(
        "We could not check that code just now. It will be applied if it is valid when your order is placed."
      );
    } finally {
      setCheckingDiscount(false);
    }
  };

  const removeDiscount = () => {
    setDiscountCode(null);
    setDiscountInput("");
    setDiscountAmount(0);
    setDiscountNote(null);
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
      {discountAmount > 0 && (
        <div className="flex items-baseline justify-between py-2">
          <span className="text-[14px] font-light text-black">
            Discount{discountCode ? ` (${discountCode})` : ""}
          </span>
          <span className="text-[14px] font-light text-black">
            &minus;{format(discountAmount)}
          </span>
        </div>
      )}
      {/* The same nudge the cart drawer shows, so a shopper who ignored it
          there meets it once more with the total in front of them.
          Only while there is still a fee to lose: the Delivery row above
          already reads "Complimentary" once they qualify, and saying it twice
          in adjacent lines reads as a mistake. */}
      {shippingFee > 0 && (
        <FreeDeliveryProgress subtotalAed={subtotal} className="pt-2 pb-1" />
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
            disabled={checkingDiscount}
            className="maison-btn-outline shrink-0"
          >
            {checkingDiscount ? "Checking" : "Apply"}
          </button>
        </div>
      )}
      {discountNote && (
        <p className="pt-3 text-[12px] font-light leading-[1.7] text-[#646464]" role="status">
          {discountNote}
        </p>
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

  // The order just placed, or the one this session placed before a reload.
  //
  // A RESTORED receipt is shown only while the bag is empty: with something in
  // it the shopper is buying again, and the confirmation offers no route back to
  // the form, so rendering it over a full bag strands them. orderResult is not
  // gated — someone who adds an item while still reading the receipt they just
  // earned should keep seeing it.
  const confirmedOrder = orderResult ?? (lines.length === 0 ? restoredOrder : null);

  if (confirmedOrder) {
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
                <p className="maison-eyebrow">Order reference&nbsp;&nbsp;{confirmedOrder.order_id}</p>
              </div>

              <p className="mt-6 text-[14px] font-light leading-[1.8] text-black">
                Your fragrances are being prepared in our Dubai atelier. A confirmation has been sent
                to {confirmedOrder.email || "your inbox"}. Your order is payable in cash or by card to
                the courier on delivery.
              </p>

              {/* Server-computed figures — the authoritative record. */}
              <div className="mt-10 mx-auto max-w-[380px] text-left">
                <div className="flex items-baseline justify-between py-2">
                  <span className="text-[14px] font-light text-black">Subtotal</span>
                  <span className="text-[14px] font-light text-black">
                    {format(confirmedOrder.subtotal)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between py-2">
                  <span className="text-[14px] font-light text-black">Delivery</span>
                  <span className="text-[14px] font-light text-black">
                    {confirmedOrder.shipping_fee === 0 ? "Complimentary" : format(confirmedOrder.shipping_fee)}
                  </span>
                </div>
                {confirmedOrder.discount_amount > 0 && (
                  <div className="flex items-baseline justify-between py-2">
                    <span className="text-[14px] font-light text-black">
                      Discount{confirmedOrder.code ? ` (${confirmedOrder.code})` : ""}
                    </span>
                    <span className="text-[14px] font-light text-black">
                      &minus;{format(confirmedOrder.discount_amount)}
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
                    {format(confirmedOrder.total)}
                  </span>
                </div>
              </div>

              <p className="mt-10 text-[13px] font-light leading-[1.8] text-[#646464]">
                To track your order, keep your order reference {confirmedOrder.order_id} and the email
                address you ordered with to hand — both are needed to follow the parcel.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href={`/track?order=${encodeURIComponent(confirmedOrder.order_id)}`}
                  className="maison-btn w-full sm:w-auto"
                >
                  Track your order
                </Link>
                <Link
                  href={`/order/${encodeURIComponent(confirmedOrder.order_id)}?email=${encodeURIComponent(confirmedOrder.email)}`}
                  className="maison-btn-outline w-full sm:w-auto"
                >
                  View your order
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
                  {/*
                    Honeypot. Positioned off-screen rather than hidden with
                    `display: none`, which the cruder form-fillers know to skip.
                    Out of flow, so it adds no gap to the column.
                  */}
                  <input
                    type="text"
                    name="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    autoComplete="off"
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: "-9999px",
                      width: 1,
                      height: 1,
                      opacity: 0,
                    }}
                  />

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
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
