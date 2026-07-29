"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { clientSafeSupabase } from "../lib/supabase";

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

interface CartItem {
  product: {
    id: number;
    brand: string;
    name: string;
    price: string | number;
    image_url: string;
    image?: string;
  };
  quantity: number;
  selectedSize: string;
}

/** The subset of public.products the checkout needs to re-verify a stored bag. */
interface ProductRow {
  id: number;
  brand: string | null;
  name: string | null;
  price: number | string | null;
  image_url: string | null;
  image_urls: string[] | null;
}

const HAIRLINE = "rgba(0,0,0,0.12)";

const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  AED: 1.0,
  USD: 0.2722,
  EUR: 0.2514,
  GBP: 0.2154,
  SAR: 1.0208,
  QAR: 0.9912,
  KWD: 0.0838,
  BHD: 0.1027,
  OMR: 0.1048,
  INR: 22.68
};

// Helper to generate dynamic UUID for tracking session
const generateUUID = () => {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Reads the persisted bag out of localStorage; returns an empty bag on the
// server or when the stored payload is unreadable.
const readStoredCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("gharib_cart_v2");
  if (!stored) return [];
  try {
    return JSON.parse(stored) as CartItem[];
  } catch (e) {
    console.error("Could not parse stored cart", e);
    return [];
  }
};

const CHECKOUT_STEPS = [
  { id: "selection", label: "Selection" },
  { id: "details", label: "Checkout" },
  { id: "confirmation", label: "Confirmation" }
] as const;

const SHIPPING_COUNTRIES = [
  "United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain",
  "United States", "United Kingdom", "Canada", "Switzerland", "Germany", "France",
  "Italy", "Spain", "Netherlands", "Belgium", "Sweden", "Norway", "Japan",
  "South Korea", "Singapore", "Australia", "New Zealand", "Hong Kong", "Turkey",
  "Egypt", "Jordan", "Lebanon", "Morocco", "India", "China", "Malaysia",
  "Thailand", "Brazil", "Mexico"
];

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => readStoredCart());
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<"selection" | "details">("selection");

  // Currency Engine States
  const [activeCurrency] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("gharib_active_currency") || "AED"
      : "AED"
  );
  const [exchangeRates] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      const cachedRates = sessionStorage.getItem("gharib_exchange_rates");
      if (cachedRates) {
        try {
          return JSON.parse(cachedRates) as Record<string, number>;
        } catch (e) {
          console.error("Could not parse cached exchange rates", e);
        }
      }
    }
    return DEFAULT_EXCHANGE_RATES;
  });

  // Global Price Formatter Utility
  const formatCurrency = useCallback((aedAmount: number, targetCurrency: string = activeCurrency) => {
    const rate = exchangeRates[targetCurrency] || 1.0;
    const converted = aedAmount * rate;

    const symbols: Record<string, string> = {
      AED: "AED",
      USD: "$",
      EUR: "€",
      GBP: "£",
      SAR: "SAR",
      QAR: "QAR",
      KWD: "KWD",
      BHD: "BHD",
      OMR: "OMR",
      INR: "₹"
    };

    const symbol = symbols[targetCurrency] || "$";
    const decimals = ["AED", "SAR", "QAR", "OMR", "BHD", "KWD"].includes(targetCurrency) ? 0 : 2;
    const formattedVal = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(converted);

    if (["AED", "SAR", "QAR", "OMR", "BHD", "KWD"].includes(targetCurrency)) {
      return `${formattedVal} ${symbol}`;
    }
    return `${symbol}${formattedVal}`;
  }, [activeCurrency, exchangeRates]);

  // Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("United Arab Emirates");
  const [postalCode, setPostalCode] = useState("");

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "card">("cod");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // System States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [abandonedCartId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    let sessionCartId = sessionStorage.getItem("gharib_abandoned_cart_id");
    if (!sessionCartId) {
      sessionCartId = generateUUID();
      sessionStorage.setItem("gharib_abandoned_cart_id", sessionCartId);
    }
    return sessionCartId;
  });

  // The bag, currency, rates and abandoned-cart id are all hydrated
  // synchronously via lazy state initialisers above. The auth lookup and the
  // catalogue reconciliation are the asynchronous parts.
  useEffect(() => {
    const syncUser = async () => {
      try {
        const { data: { user } } = await clientSafeSupabase.auth.getUser();
        const storedEmail = localStorage.getItem("userEmail");
        const storedId = localStorage.getItem("userId");

        const activeEmail = user?.email || storedEmail || "";
        const activeId = user?.id || storedId || null;

        setUserId(activeId);
        if (activeEmail) {
          setEmail(activeEmail);
        }
      } catch (err) {
        console.error("Could not resolve the signed-in shopper", err);
      } finally {
        // The checkout must always become interactive, even if auth is down.
        setLoading(false);
      }
    };
    syncUser();
  }, []);

  // A bag persisted in an earlier session can hold stale names, prices, imagery
  // or products that have since left the catalogue. Reconcile it against
  // public.products so the selection is always the live record. Lines whose
  // product no longer exists are dropped rather than shown with old data.
  useEffect(() => {
    let cancelled = false;

    const reconcileWithCatalogue = async () => {
      const stored = readStoredCart();
      if (stored.length === 0) return;

      try {
        const { data, error } = await clientSafeSupabase
          .from("products")
          .select("id, brand, name, price, image_url, image_urls");
        if (error || !Array.isArray(data) || cancelled) return;

        const catalogue = new Map<number, ProductRow>(
          (data as ProductRow[]).map((row) => [Number(row.id), row])
        );

        const reconciled = stored
          .map((item) => {
            const row = catalogue.get(Number(item.product?.id));
            if (!row) return null;
            const images = Array.isArray(row.image_urls)
              ? row.image_urls.filter((u): u is string => typeof u === "string" && u.trim() !== "")
              : [];
            return {
              ...item,
              product: {
                ...item.product,
                brand: row.brand ?? "",
                name: row.name ?? "",
                price: row.price ?? 0,
                image_url: row.image_url || images[0] || ""
              }
            };
          })
          .filter((item): item is CartItem => item !== null);

        if (cancelled) return;
        if (JSON.stringify(reconciled) !== JSON.stringify(stored)) {
          setCartItems(reconciled);
          localStorage.setItem("gharib_cart_v2", JSON.stringify(reconciled));
        }
      } catch (err) {
        console.error("Could not reconcile the bag with the catalogue", err);
      }
    };

    reconcileWithCatalogue();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cart mutation — keeps localStorage in sync with the on-screen selection
  const persistCart = (next: CartItem[]) => {
    setCartItems(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("gharib_cart_v2", JSON.stringify(next));
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    persistCart(
      cartItems.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) } : item
      )
    );
  };

  const removeItem = (index: number) => {
    persistCart(cartItems.filter((_, i) => i !== index));
  };

  const getUnitPrice = (item: CartItem) =>
    parseFloat(String(item.product.price).replace("$", "")) || 0;

  // Totals computation
  const getSubtotal = useCallback(() => {
    return cartItems.reduce((sum, item) => {
      const priceVal = parseFloat(String(item.product.price).replace("$", "")) || 0;
      return sum + priceVal * item.quantity;
    }, 0);
  }, [cartItems]);

  const getShipping = useCallback(() => {
    const sub = getSubtotal();
    return sub > 250 || sub === 0 ? 0 : 25; // Free shipping over $250
  }, [getSubtotal]);

  const getTotal = useCallback(() => {
    return getSubtotal() + getShipping();
  }, [getSubtotal, getShipping]);

  const itemCount = cartItems.reduce((n, item) => n + (item.quantity || 0), 0);

  const goToDetails = () => {
    setStep("details");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  };

  // Debounced autosave for abandoned cart recovery
  useEffect(() => {
    if (!abandonedCartId || cartItems.length === 0) return;
    // We only trigger when a valid contact email and a first name exist
    if (!email || !email.includes("@") || !firstName) return;

    const timer = setTimeout(async () => {
      try {
        const totalVal = getTotal();
        const payload = {
          id: abandonedCartId,
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          shipping_address: {
            street: street.trim(),
            city: city.trim(),
            country: country.trim(),
            postal_code: postalCode.trim()
          },
          cart_items: cartItems.map(item => ({
            product_id: item.product.id,
            brand: item.product.brand,
            name: item.product.name,
            size: item.selectedSize,
            quantity: item.quantity,
            unit_price: parseFloat(String(item.product.price).replace("$", "")) || 0
          })),
          total_price: totalVal,
          converted: false,
          updated_at: new Date().toISOString(),
          currency: activeCurrency,
          exchange_rate: exchangeRates[activeCurrency] || 1.0,
          converted_total: formatCurrency(totalVal, activeCurrency)
        };

        await clientSafeSupabase
          .from("abandoned_carts")
          .upsert(payload);
      } catch (err) {
        console.error("Friction autosaving abandoned cart session", err);
      }
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timer);
  }, [abandonedCartId, firstName, lastName, email, phone, street, city, country, postalCode, cartItems, activeCurrency, exchangeRates, formatCurrency, getTotal]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    if (cartItems.length === 0) {
      setErrorMsg("Your selection is currently empty.");
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Generate unique Order ID
      const orderNum = Math.floor(1000 + Math.random() * 9000);
      const generatedOrderId = `ORD-${orderNum}`;

      // 2. Format Shipping Address JSONB
      const shippingAddress = {
        name: `${firstName.trim()} ${lastName.trim()}`,
        street: street.trim(),
        city: city.trim(),
        country: country.trim(),
        postal_code: postalCode.trim()
      };

      // 3. Save order row to public.orders table
      const totalAmount = getTotal();
      const orderRow = {
        id: generatedOrderId,
        customer_id: userId,
        email: email.trim(),
        total_price: totalAmount,
        status: "pending",
        shipping_address: shippingAddress,
        tracking_number: null,
        tracking_url: null,
        currency: activeCurrency,
        exchange_rate: exchangeRates[activeCurrency] || 1.0,
        converted_total: formatCurrency(totalAmount, activeCurrency)
      };

      const { error: orderError } = await clientSafeSupabase
        .from("orders")
        .insert(orderRow);

      if (orderError) {
        throw new Error(orderError.message || "Failed to create order record.");
      }

      // 4. Save itemized decants into public.order_items table
      const itemizedRows = cartItems.map(item => {
        const priceVal = parseFloat(String(item.product.price).replace("$", "")) || 0;
        return {
          order_id: generatedOrderId,
          product_id: item.product.id,
          size: item.selectedSize,
          quantity: item.quantity,
          unit_price: priceVal
        };
      });

      const { error: itemsError } = await clientSafeSupabase
        .from("order_items")
        .insert(itemizedRows);

      if (itemsError) {
        console.error("Friction inserting itemized decants", itemsError);
      }

      // 5. Save initial order tracking step into public.order_tracking
      const initialLog = {
        order_id: generatedOrderId,
        status: "Order Placed",
        location: "Dubai Headquarters",
        description: "We have received your exclusive order selection. Scent artists will review it shortly."
      };

      await clientSafeSupabase
        .from("order_tracking")
        .insert(initialLog);

      // 5.5 Mark abandoned cart as converted
      if (abandonedCartId) {
        try {
          await clientSafeSupabase
            .from("abandoned_carts")
            .upsert({
              id: abandonedCartId,
              email: email.trim(),
              converted: true,
              converted_order_id: generatedOrderId,
              updated_at: new Date().toISOString()
            });
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("gharib_abandoned_cart_id");
          }
        } catch (e) {
          console.error("Error converting abandoned cart:", e);
        }
      }

      // 6. Success checkout completion
      setOrderSuccess(generatedOrderId);
      if (typeof window !== "undefined") {
        localStorage.removeItem("gharib_cart_v2"); // Flush cart
        window.scrollTo({ top: 0 });
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(
        (err instanceof Error && err.message) ||
        "An unexpected system conflict occurred. Order processing failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Shared fragments ─────────────────────────────────────────── */

  const storeHeader = (
    <header className="w-full bg-white" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <div className="maison-container flex items-center justify-between h-[62px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300"
        >
          Back to store
        </Link>
        <Link href="/" className="font-display text-[16px] md:text-[18px] uppercase tracking-[0.18em] text-black">
          Gharib
        </Link>
        <span className="hidden sm:block text-[12px] uppercase tracking-[0.1em] text-[#646464]">
          Secure payment
        </span>
      </div>
    </header>
  );

  const storeFooter = (
    <footer className="w-full" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <div className="maison-container py-8 flex flex-col md:flex-row items-center justify-between gap-3">
        <span className="text-[12px] font-light text-[#757575]">
          © {new Date().getFullYear()} Gharib. All rights reserved.
        </span>
        <span className="text-[12px] uppercase tracking-[0.1em] text-[#757575]">
          Encrypted payment · Discreet delivery
        </span>
      </div>
    </footer>
  );

  const stepIndicator = (current: "selection" | "details" | "confirmation") => {
    const activeIndex = CHECKOUT_STEPS.findIndex(s => s.id === current);
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
        <span className="text-[14px] font-light text-black">{formatCurrency(getSubtotal())}</span>
      </div>
      <div className="flex items-baseline justify-between py-2">
        <span className="text-[14px] font-light text-black">Delivery</span>
        <span className="text-[14px] font-light text-black">
          {getShipping() === 0 ? "Complimentary" : formatCurrency(getShipping())}
        </span>
      </div>
      {getShipping() > 0 && (
        <p className="pt-1 pb-2 text-[12px] font-light text-[#646464]">
          Complimentary delivery on orders above {formatCurrency(250)}.
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
          {formatCurrency(getTotal())}
        </span>
      </div>
    </div>
  );

  /* ── Loading shell ────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="maison min-h-screen flex flex-col">
        {storeHeader}
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
      </div>
    );
  }

  /* ── Order confirmation ───────────────────────────────────────── */

  if (orderSuccess) {
    return (
      <div className="maison min-h-screen flex flex-col">
        {storeHeader}
        <main className="flex-grow">
          <div className="maison-container maison-section">
            <div className="mx-auto max-w-[620px] text-center">
              <h1 className="maison-page-title">Thank you for your order</h1>
              {stepIndicator("confirmation")}

              <div className="mt-12 pt-10" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                <p className="maison-eyebrow">Order reference&nbsp;&nbsp;{orderSuccess}</p>
              </div>

              <p className="mt-6 text-[14px] font-light leading-[1.8] text-black">
                Your fragrances are being prepared in our Dubai atelier. A confirmation has been sent
                to {email || "your inbox"}, and tracking will appear in your account as soon as the
                parcel leaves us.
              </p>

              <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/customer/dashboard?tab=tracking" className="maison-btn w-full sm:w-auto">
                  Track your order
                </Link>
                <Link href="/shop" className="maison-btn-outline w-full sm:w-auto">
                  Back to the boutique
                </Link>
              </div>
            </div>
          </div>
        </main>
        {storeFooter}
      </div>
    );
  }

  /* ── Empty selection ──────────────────────────────────────────── */

  if (cartItems.length === 0) {
    return (
      <div className="maison min-h-screen flex flex-col">
        {storeHeader}
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
        {storeFooter}
      </div>
    );
  }

  /* ── Selection + checkout ─────────────────────────────────────── */

  return (
    <div className="maison min-h-screen flex flex-col">
      {storeHeader}

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
                    {itemCount} {itemCount === 1 ? "Item" : "Items"}
                  </h2>

                  <ul style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                    {cartItems.map((item, idx) => (
                      <li
                        key={`${item.product.id}-${item.selectedSize}-${idx}`}
                        className="flex gap-5 md:gap-8 py-8"
                        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                      >
                        <div className="w-24 h-24 shrink-0 flex items-center justify-center bg-[#F5F5F5] p-3">
                          <div className="relative w-full h-full">
                            <CartItemImage
                              src={item.product.image_url || item.product.image || ""}
                              alt={item.product.name}
                              sizes="96px"
                            />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-8">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">
                              {item.product.brand}
                            </p>
                            <h3 className="mt-2 font-display text-[16px] uppercase tracking-[0.08em] leading-[1.4] text-black">
                              {item.product.name}
                            </h3>
                            <p className="mt-2 text-[12px] uppercase tracking-[0.08em] text-[#646464]">
                              {item.selectedSize}
                            </p>

                            <div className="mt-5 flex items-center gap-6">
                              <div
                                className="inline-flex items-center bg-transparent"
                                style={{ border: `1px solid ${HAIRLINE}` }}
                              >
                                <button
                                  type="button"
                                  aria-label={`Decrease quantity of ${item.product.name}`}
                                  onClick={() => updateQuantity(idx, -1)}
                                  disabled={item.quantity <= 1}
                                  className="w-9 h-9 flex items-center justify-center text-[14px] text-[#646464] hover:text-black transition-colors duration-300 disabled:opacity-30 cursor-pointer"
                                >
                                  &minus;
                                </button>
                                <span className="w-9 text-center text-[13px] font-light text-black">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Increase quantity of ${item.product.name}`}
                                  onClick={() => updateQuantity(idx, 1)}
                                  className="w-9 h-9 flex items-center justify-center text-[14px] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="sm:text-right shrink-0">
                            <span className="maison-price">
                              {formatCurrency(getUnitPrice(item) * item.quantity)}
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

                  {/* Payment method */}
                  <section>
                    <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                      Payment method
                    </h2>

                    <div className="pt-2">
                      <label
                        className="w-full flex items-start gap-4 py-6 cursor-pointer"
                        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value="cod"
                          checked={paymentMethod === "cod"}
                          onChange={() => setPaymentMethod("cod")}
                          className="sr-only peer"
                        />
                        <span
                          aria-hidden="true"
                          className="mt-[2px] w-4 h-4 shrink-0 flex items-center justify-center border border-black peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black"
                        >
                          {paymentMethod === "cod" && <span className="block w-2 h-2 bg-black" />}
                        </span>
                        <span className="flex-1">
                          <span className="block text-[13px] uppercase tracking-[0.1em] text-black">
                            Cash on delivery
                          </span>
                          <span className="mt-2 block text-[13px] font-light leading-[1.7] text-[#646464]">
                            Settle in cash or by card terminal with our delivery concierge when your
                            order arrives.
                          </span>
                        </span>
                      </label>

                      <label
                        className="w-full flex items-start gap-4 py-6 cursor-pointer"
                        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value="card"
                          checked={paymentMethod === "card"}
                          onChange={() => setPaymentMethod("card")}
                          className="sr-only peer"
                        />
                        <span
                          aria-hidden="true"
                          className="mt-[2px] w-4 h-4 shrink-0 flex items-center justify-center border border-black peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black"
                        >
                          {paymentMethod === "card" && <span className="block w-2 h-2 bg-black" />}
                        </span>
                        <span className="flex-1">
                          <span className="block text-[13px] uppercase tracking-[0.1em] text-black">
                            Credit or debit card
                          </span>
                          <span className="mt-2 block text-[13px] font-light leading-[1.7] text-[#646464]">
                            Visa, Mastercard and American Express. Processed over an encrypted
                            connection.
                          </span>
                        </span>
                      </label>

                      {paymentMethod === "card" && (
                        <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="md:col-span-2">
                            <label htmlFor="cardNumber" className="maison-label">Card number</label>
                            <input
                              id="cardNumber"
                              type="text"
                              inputMode="numeric"
                              autoComplete="cc-number"
                              required={paymentMethod === "card"}
                              maxLength={19}
                              value={cardNumber}
                              onChange={(e) => {
                                // auto space credit card formatting
                                const val = e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
                                setCardNumber(val);
                              }}
                              placeholder="4242 4242 4242 4242"
                              className="maison-input"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label htmlFor="cardName" className="maison-label">Name on card</label>
                            <input
                              id="cardName"
                              type="text"
                              autoComplete="cc-name"
                              required={paymentMethod === "card"}
                              value={cardName}
                              onChange={(e) => setCardName(e.target.value)}
                              placeholder="Alex Mercer"
                              className="maison-input"
                            />
                          </div>

                          <div>
                            <label htmlFor="cardExpiry" className="maison-label">Expiry date</label>
                            <input
                              id="cardExpiry"
                              type="text"
                              inputMode="numeric"
                              autoComplete="cc-exp"
                              required={paymentMethod === "card"}
                              maxLength={5}
                              value={cardExpiry}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\//g, '');
                                if (val.length >= 2) {
                                  setCardExpiry(val.slice(0, 2) + "/" + val.slice(2, 4));
                                } else {
                                  setCardExpiry(val);
                                }
                              }}
                              placeholder="MM/YY"
                              className="maison-input"
                            />
                          </div>

                          <div>
                            <label htmlFor="cardCvv" className="maison-label">Security code</label>
                            <input
                              id="cardCvv"
                              type="password"
                              inputMode="numeric"
                              autoComplete="cc-csc"
                              required={paymentMethod === "card"}
                              maxLength={3}
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              placeholder="123"
                              className="maison-input"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="flex flex-col items-center gap-6">
                    <button type="submit" disabled={isSubmitting} className="maison-btn w-full">
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
                  {cartItems.map((item, idx) => (
                    <li
                      key={`summary-${item.product.id}-${item.selectedSize}-${idx}`}
                      className="flex gap-4 py-5"
                      style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                    >
                      <div className="w-16 h-16 shrink-0 flex items-center justify-center bg-[#F5F5F5] p-2">
                        <div className="relative w-full h-full">
                          <CartItemImage
                            src={item.product.image_url || item.product.image || ""}
                            alt={item.product.name}
                            sizes="64px"
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-[14px] uppercase tracking-[0.08em] leading-[1.4] text-black">
                          {item.product.name}
                        </h3>
                        <p className="mt-1.5 text-[12px] uppercase tracking-[0.08em] text-[#646464]">
                          {item.selectedSize} &nbsp;·&nbsp; Qty {item.quantity}
                        </p>
                      </div>
                      <span className="maison-price shrink-0">
                        {formatCurrency(getUnitPrice(item) * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className={step === "details" ? "pt-6" : "pt-8"}>
                {totalsBlock}
              </div>

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

              <p className="mt-8 text-[12px] font-light leading-[1.8] text-[#646464]">
                All payments are processed over an encrypted connection. Your details are never shared
                with third parties.
              </p>
            </aside>
          </div>
        </div>
      </main>

      {storeFooter}
    </div>
  );
}
