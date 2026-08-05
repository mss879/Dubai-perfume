"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import CartDrawer, { openCartDrawer } from "../../components/CartDrawer";
import Price from "../../components/Price";
import { getBrowserSupabase } from "../../lib/supabase-browser";
import { useCart } from "../../lib/cart";
import { ORDER_STEPS, isCancelledOrder, stepIndexForStatus } from "../../lib/orders";
import { PRODUCT_FIELDS, toArray } from "../../lib/catalogue";

type TabKey = "orders" | "wishlist" | "tracking" | "settings";

type WishlistType = "favorite" | "buy_later";

interface ShippingAddress {
  name?: string | null;
  city?: string | null;
  country?: string | null;
}

interface OrderRecord {
  id: string;
  email: string;
  status?: string | null;
  created_at: string;
  shipping_address?: ShippingAddress | null;
  total_price: string | number;
  packing_charges?: string | number | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
}

interface TrackingLog {
  id: number;
  order_id: string;
  status: string;
  location?: string | null;
  description?: string | null;
  updated_at: string;
}

interface CatalogProduct {
  id: number;
  brand?: string | null;
  name: string;
  price: string | number;
  sizes?: string[] | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  description?: string | null;
  tagline?: string | null;
  olfactory_group?: string | null;
}

type WishlistProduct = CatalogProduct & { wishlist_type: WishlistType };

interface WishlistRow {
  customer_id: string;
  product_id: number;
  wishlist_type?: WishlistType | null;
}

/** A row of `order_items`, as stored when the order was placed. */
interface OrderItemRow {
  order_id: string;
  product_id: number;
  size: string | null;
  quantity: number;
  unit_price: string | number;
}

/** An order line, resolved against the catalogue for display. */
interface OrderLine {
  productId: number;
  name: string;
  brand: string | null;
  imageUrl: string;
  size: string;
  quantity: number;
  /** What was charged then — not today's catalogue price. */
  unitPriceAed: number;
  /** False once a product has been withdrawn; it stays listed, but unlinked. */
  stillSold: boolean;
}

const NAV_ITEMS: { key: TabKey; label: string }[] = [
  { key: "orders", label: "Order history" },
  { key: "wishlist", label: "Wishlist" },
  { key: "tracking", label: "Order tracking" },
  { key: "settings", label: "Settings" },
];

/**
 * The shopper's own details, as stored on `customers`.
 *
 * The email is deliberately absent: it is the login credential, it comes from
 * the session, and migration 51 pins the column so it cannot be changed from
 * the client even if a field for it appeared.
 */
interface ProfileDetails {
  first_name: string;
  last_name: string;
  phone: string;
  street: string;
  city: string;
  country: string;
  postal_code: string;
}

const EMPTY_PROFILE: ProfileDetails = {
  first_name: "",
  last_name: "",
  phone: "",
  street: "",
  city: "",
  country: "",
  postal_code: "",
};

/**
 * A `customers` row as the form wants it. Every column is nullable in the
 * database, and a null in a controlled input makes React drop back to an
 * uncontrolled field — so nulls become empty strings here, once.
 */
function toProfile(row: unknown): ProfileDetails {
  const source = (row ?? {}) as Record<string, unknown>;
  const text = (key: keyof ProfileDetails) =>
    typeof source[key] === "string" ? (source[key] as string) : "";

  return {
    first_name: text("first_name"),
    last_name: text("last_name"),
    phone: text("phone"),
    street: text("street"),
    city: text("city"),
    country: text("country"),
    postal_code: text("postal_code"),
  };
}

/**
 * Fulfilment milestones and the status→step mapping now live in
 * src/app/lib/orders.ts, shared with the admin registry and `place_order`, so
 * every status an operator can set actually advances the stepper.
 */
const STEPPER_STEPS = ORDER_STEPS;

export default function DashboardClient() {
  const router = useRouter();
  const { add } = useCart();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // auth.uid() of the cookie session — RLS on `wishlists` keys on it.
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("orders");
  const [wishlistTab, setWishlistTab] = useState<"favorite" | "buy_later">("favorite");

  // Data States
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderLines, setOrderLines] = useState<Record<string, OrderLine[]>>({});
  const [wishlist, setWishlist] = useState<WishlistProduct[]>([]);
  const [trackingLogs, setTrackingLogs] = useState<TrackingLog[]>([]);
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string>("");

  // Settings — profile details
  const [profile, setProfile] = useState<ProfileDetails>(EMPTY_PROFILE);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Settings — password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const supabase = getBrowserSupabase();

      // The cookie session is the identity — the legacy localStorage id is
      // never trusted (RLS keys on auth.uid(), so it silently breaks).
      let user: { id: string; email?: string | null } | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        user = data?.user ?? null;
      } catch {
        user = null;
      }

      if (!user) {
        // Redirect to login if not authenticated — and come straight back.
        router.push("/signin?redirect=/customer/dashboard");
        return;
      }

      const email = user.email || "";
      setUserEmail(email);
      setSessionUserId(user.id);

      try {
        // This shopper's own orders only — never another customer's, and never a
        // fallback list when they have none. Newest first: Postgres guarantees
        // no order without an ORDER BY, so "most recent" was previously
        // whichever row the planner happened to return last.
        const { data: ordersData } = await supabase
          .from("orders")
          .select("*")
          .eq("email", email)
          .order("created_at", { ascending: false });

        const myOrders = (Array.isArray(ordersData) ? ordersData : []).filter(
          (o: OrderRecord) => (o.email || "").toLowerCase() === email.toLowerCase()
        ) as OrderRecord[];
        setOrders(myOrders);

        // The tracking tab opens on the shopper's most recent order, if any.
        setSelectedTrackingOrderId(myOrders.length > 0 ? myOrders[0].id : "");

        const orderIds = myOrders.map((o) => o.id);

        const [
          { data: allProducts, error: productsError },
          { data: wishlistData },
          { data: itemRows },
          { data: profileRow },
        ] = await Promise.all([
            supabase.from("products").select(PRODUCT_FIELDS),
            supabase.from("wishlists").select("*").eq("customer_id", user.id),
            // `.in()` on an empty list is not a valid filter, so a shopper with
            // no orders skips the query entirely.
            orderIds.length > 0
              ? supabase
                  .from("order_items")
                  .select("order_id, product_id, size, quantity, unit_price")
                  .in("order_id", orderIds)
              : Promise.resolve({ data: [] as OrderItemRow[] }),
            supabase
              .from("customers")
              .select("first_name, last_name, phone, street, city, country, postal_code")
              .eq("id", user.id)
              .maybeSingle(),
          ]);

        // The address columns arrive with migration 51. Until it is applied the
        // select errors and `profileRow` is null, which simply leaves the form
        // blank rather than breaking the rest of the account page.
        if (profileRow) setProfile(toProfile(profileRow));

        if (productsError) throw productsError;

        const catalog = (Array.isArray(allProducts) ? allProducts : []) as CatalogProduct[];
        const wishlistRows = (Array.isArray(wishlistData) ? wishlistData : []) as WishlistRow[];

        // What was actually bought, resolved against the live catalogue for the
        // name and image. The price shown is the one charged at the time
        // (order_items.unit_price), not today's — a past order must not
        // silently restate itself when the catalogue is repriced.
        const linesByOrder: Record<string, OrderLine[]> = {};
        for (const row of (Array.isArray(itemRows) ? itemRows : []) as OrderItemRow[]) {
          const product = catalog.find((p) => p.id === row.product_id);
          (linesByOrder[row.order_id] ||= []).push({
            productId: row.product_id,
            name: product?.name || `Product ${row.product_id}`,
            brand: product?.brand || null,
            imageUrl: product?.image_url || toArray(product?.image_urls)[0] || "",
            size: row.size || "",
            quantity: Number(row.quantity) || 1,
            unitPriceAed: parseFloat(String(row.unit_price)) || 0,
            stillSold: Boolean(product),
          });
        }
        setOrderLines(linesByOrder);

        // Saved rows joined against the live catalogue. Nothing is ever seeded in.
        setWishlist(
          wishlistRows
            .map((w) => {
              const prod = catalog.find((p) => p.id === w.product_id);
              return prod ? { ...prod, wishlist_type: w.wishlist_type || "favorite" } : null;
            })
            .filter((item): item is WishlistProduct => item !== null)
        );

        const { data: trackData } = await supabase
          .from("order_tracking")
          .select("*");
        const myOrderIds = new Set(myOrders.map((o) => o.id));
        setTrackingLogs(
          (Array.isArray(trackData) ? trackData : []).filter((log: TrackingLog) =>
            myOrderIds.has(log.order_id)
          ) as TrackingLog[]
        );
      } catch (err) {
        console.error("Error loading customer data", err);
        setOrders([]);
        setOrderLines({});
        setWishlist([]);
        setTrackingLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRemoveFromWishlist = async (productId: number, type: "favorite" | "buy_later") => {
    if (!sessionUserId) return;
    try {
      await getBrowserSupabase().from("wishlists")
        .delete()
        .match({
          customer_id: sessionUserId,
          product_id: productId,
          wishlist_type: type
        });
      setWishlist(prev => prev.filter(item => !(item.id === productId && item.wishlist_type === type)));
      triggerToast("Item removed from your wishlist.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoveItem = async (productId: number, fromType: "favorite" | "buy_later", toType: "favorite" | "buy_later") => {
    if (!sessionUserId) return;
    try {
      const supabase = getBrowserSupabase();

      await supabase
        .from("wishlists")
        .delete()
        .match({
          customer_id: sessionUserId,
          product_id: productId,
          wishlist_type: fromType
        });

      const { error } = await supabase
        .from("wishlists")
        .insert({
          customer_id: sessionUserId,
          product_id: productId,
          wishlist_type: toType
        });

      if (!error) {
        setWishlist(prev => prev.map(item => {
          if (item.id === productId && item.wishlist_type === fromType) {
            return { ...item, wishlist_type: toType };
          }
          return item;
        }));
        triggerToast(`Moved to ${toType === "favorite" ? "Favorites" : "Buy later"}.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  /** Shared bag write — same store the header, drawer and checkout read. */
  const addItemToBag = (item: WishlistProduct) => {
    const sizes = toArray(item.sizes);
    const defaultSize = sizes[0] || "";
    add(
      {
        id: item.id,
        brand: item.brand || "",
        name: item.name,
        price: parseFloat(String(item.price)) || 0,
        image_url: item.image_url || toArray(item.image_urls)[0] || "",
      },
      defaultSize
    );
  };

  const handleAddToBag = (item: WishlistProduct) => {
    addItemToBag(item);
    openCartDrawer();
  };

  const handleBuyNow = (item: WishlistProduct) => {
    addItemToBag(item);
    router.push("/checkout");
  };

  const setProfileField = (field: keyof ProfileDetails, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setProfileSuccess(null);
    setProfileError(null);
  };

  /**
   * Saves the shopper's own `customers` row. RLS scopes the write to their own
   * id, and migration 51 pins `email` and `is_admin`, so nothing here can widen
   * what a shopper is able to change.
   */
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId) return;

    setProfileError(null);
    setProfileSuccess(null);
    setProfileSaving(true);

    try {
      const { error } = await getBrowserSupabase()
        .from("customers")
        .update({
          first_name: profile.first_name.trim(),
          last_name: profile.last_name.trim(),
          phone: profile.phone.trim(),
          street: profile.street.trim(),
          city: profile.city.trim(),
          country: profile.country.trim(),
          postal_code: profile.postal_code.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionUserId);

      if (error) {
        console.error("Profile update failed", error);
        // A missing column means migration 51 has not been applied yet; saying
        // so beats "Please try again" on something retrying cannot fix.
        setProfileError(
          /column .* does not exist|schema cache/i.test(error.message || "")
            ? "Your details cannot be saved until the latest database migration has been applied."
            : "We could not save your details. Please try again."
        );
        return;
      }

      setProfileSuccess("Your details have been saved.");
      triggerToast("Your details have been saved.");
    } catch (err) {
      console.error("Profile update failed", err);
      setProfileError("An unexpected error occurred. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (newPassword.length < 6) {
      setFormError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("New password and confirmation do not match.");
      return;
    }

    setFormSubmitting(true);
    try {
      const { error } = await getBrowserSupabase().auth.updateUser({ password: newPassword });
      if (error) {
        setFormError(error.message);
      } else {
        setFormSuccess("Your password has been updated successfully.");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      console.error("Error updating password", err);
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await getBrowserSupabase().auth.signOut();
    } catch (e) {
      console.error("Sign out failed", e);
    }
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userId");
    router.push("/");
  };

  // Tracking details for the selected order
  const activeOrderLogs = trackingLogs
    .filter(log => log.order_id === selectedTrackingOrderId)
    .sort((a, b) => a.id - b.id);

  const trackingOrderObj = orders.find(o => o.id === selectedTrackingOrderId);

  const isCancelled = isCancelledOrder(trackingOrderObj?.status);
  const activeStepIdx = stepIndexForStatus(trackingOrderObj?.status);

  const orderTotal = (order: OrderRecord) =>
    (parseFloat(String(order.total_price)) || 0) +
    (parseFloat(String(order.packing_charges ?? 0)) || 0);

  const lifetimeTotal = orders.reduce(
    (sum, order) => sum + orderTotal(order),
    0
  );

  const visibleWishlist = wishlist.filter(item => item.wishlist_type === wishlistTab);

  const stats: { value: React.ReactNode; label: string }[] = [
    { value: String(orders.length), label: "Orders placed" },
    { value: String(wishlist.length), label: "Saved fragrances" },
    { value: <Price amountAed={lifetimeTotal} />, label: "Lifetime total" },
  ];

  const wishlistTabs: { key: "favorite" | "buy_later"; label: string }[] = [
    { key: "favorite", label: "Favorites" },
    { key: "buy_later", label: "Buy later" },
  ];

  const panelMotion = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut" as const },
  };

  // Quiet skeleton — flat #F5F5F5 blocks, no motion.
  if (loading) {
    return (
      <div className="maison min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-grow">
          <div className="maison-container maison-section">
            <div className="h-7 w-64 bg-[#F5F5F5]" />
            <div className="mt-10">
              <hr className="maison-rule" />
            </div>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-[#F5F5F5]" />
              ))}
            </div>
            <div className="mt-14 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
              <div className="flex flex-col gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-5 w-36 bg-[#F5F5F5]" />
                ))}
              </div>
              <div className="flex flex-col gap-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 bg-[#F5F5F5]" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="maison min-h-screen flex flex-col">
      <AppHeader />
      <CartDrawer />

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-6 right-5 md:right-10 z-[120] bg-[#121212] text-white px-6 py-4 max-w-[360px] text-[12px] tracking-[0.1em] uppercase"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow">
        <div className="maison-container maison-section">

          {/* Page header */}
          <header className="text-center">
            <span className="maison-eyebrow block">Account</span>
            <h1 className="maison-page-title mt-5">My account</h1>
            {userEmail && (
              <p className="mt-6 text-[14px] font-light leading-[1.7] text-[#646464] break-all">
                Signed in as {userEmail}
              </p>
            )}
          </header>

          {/* Stats — no cards, no borders */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
            {stats.map(stat => (
              <div key={stat.label}>
                <span className="font-display block text-[28px] leading-none text-black">
                  {stat.value}
                </span>
                <span className="maison-eyebrow mt-3 block">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* .maison-rule forces margin:0, so spacing lives on the wrapper */}
          <div className="mt-14">
            <hr className="maison-rule" />
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 lg:gap-16">

            {/* Sidebar nav — horizontal tab row on mobile */}
            <nav className="flex lg:flex-col gap-8 lg:gap-0 overflow-x-auto no-scrollbar border-b lg:border-b-0 border-[rgba(0,0,0,0.12)] pb-4 lg:pb-0 lg:border-t lg:border-t-[rgba(0,0,0,0.12)]">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className="text-left whitespace-nowrap lg:border-b lg:border-[rgba(0,0,0,0.12)] lg:py-4 cursor-pointer"
                >
                  <span
                    className={`inline-block pb-1 text-[14px] transition-colors duration-300 ${
                      activeTab === item.key
                        ? "text-black border-b border-black"
                        : "text-[#646464] border-b border-transparent hover:text-black"
                    }`}
                    style={{ fontWeight: 350 }}
                  >
                    {item.label}
                  </span>
                </button>
              ))}

              <button
                onClick={handleSignOut}
                className="text-left whitespace-nowrap lg:border-b lg:border-[rgba(0,0,0,0.12)] lg:py-4 cursor-pointer"
              >
                <span
                  className="inline-block pb-1 text-[14px] text-[#646464] border-b border-transparent hover:text-black transition-colors duration-300"
                  style={{ fontWeight: 350 }}
                >
                  Sign out
                </span>
              </button>
            </nav>

            {/* Content panels */}
            <div className="min-w-0">

              {/* ── ORDER HISTORY ─────────────────────────────────── */}
              {activeTab === "orders" && (
                <motion.section key="orders-panel" {...panelMotion}>
                  <span className="maison-eyebrow block">Order history</span>

                  {orders.length === 0 ? (
                    <div className="py-20 text-center">
                      <h2 className="maison-page-title">No orders yet</h2>
                      <p className="mt-6 mx-auto max-w-[46ch] text-[14px] font-light leading-[1.7] text-[#646464]">
                        When you place an order it will appear here, with its delivery status.
                      </p>
                      <div className="mt-10">
                        <Link href="/shop" className="maison-btn-outline">
                          Discover the collection
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-8">
                      {/* Column heads — desktop only */}
                      <div className="hidden md:grid grid-cols-[1fr_1fr_1.6fr_1fr_0.8fr_auto] gap-6 border-b border-[rgba(0,0,0,0.12)] pb-4">
                        <span className="maison-eyebrow">Order</span>
                        <span className="maison-eyebrow">Placed</span>
                        <span className="maison-eyebrow">Delivered to</span>
                        <span className="maison-eyebrow">Status</span>
                        <span className="maison-eyebrow text-right">Total</span>
                        <span className="maison-eyebrow sr-only">Action</span>
                      </div>

                      {orders.map(order => (
                        <div key={order.id} className="border-b border-[rgba(0,0,0,0.12)] py-6">
                        <div
                          className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.6fr_1fr_0.8fr_auto] gap-3 md:gap-6 md:items-center"
                        >
                          <div>
                            <span className="maison-eyebrow block md:hidden">Order</span>
                            <span className="text-[14px] uppercase tracking-[0.07em] text-black" style={{ fontWeight: 350 }}>
                              {order.id}
                            </span>
                          </div>

                          <div>
                            <span className="maison-eyebrow block md:hidden">Placed</span>
                            <span className="text-[14px] font-light text-[#646464]">
                              {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}
                            </span>
                          </div>

                          <div>
                            <span className="maison-eyebrow block md:hidden">Delivered to</span>
                            <span className="text-[14px] font-light text-[#646464]">
                              {order.shipping_address?.name} — {order.shipping_address?.city}, {order.shipping_address?.country}
                            </span>
                          </div>

                          <div>
                            <span className="maison-eyebrow block md:hidden">Status</span>
                            <span className="text-[12px] uppercase tracking-[0.1em] text-black">
                              {order.status?.replace("_", " ")}
                            </span>
                          </div>

                          <div className="md:text-right">
                            <span className="maison-eyebrow block md:hidden">Total</span>
                            <span className="maison-price">
                              <Price amountAed={orderTotal(order)} />
                            </span>
                            {(parseFloat(String(order.packing_charges ?? 0)) || 0) > 0 && (
                              <span className="block mt-1 text-[12px] text-[#646464]">
                                incl. <Price amountAed={parseFloat(String(order.packing_charges)) || 0} /> packing
                              </span>
                            )}
                          </div>

                          <div className="md:text-right">
                            <button
                              onClick={() => {
                                setSelectedTrackingOrderId(order.id);
                                setActiveTab("tracking");
                                triggerToast(`Loaded tracking for order ${order.id}`);
                              }}
                              className="maison-link cursor-pointer text-[#646464] hover:text-black"
                            >
                              Track
                            </button>
                          </div>
                        </div>

                        {/* What was in this order. Previously the account showed
                            only a total, so a shopper could not tell one past
                            order from another. */}
                        {(orderLines[order.id] ?? []).length > 0 && (
                          <ul className="mt-6 flex flex-col gap-4 md:pl-0">
                            {orderLines[order.id].map((line, i) => (
                              <li key={`${order.id}-${line.productId}-${line.size}-${i}`} className="flex items-center gap-4">
                                <span className="w-14 h-14 flex-shrink-0 bg-[#F5F5F5] flex items-center justify-center p-1.5">
                                  {line.imageUrl && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={line.imageUrl}
                                      alt={line.name}
                                      className="w-full h-full object-contain"
                                    />
                                  )}
                                </span>

                                <span className="flex-grow min-w-0">
                                  {line.brand && (
                                    <span className="maison-eyebrow block">{line.brand}</span>
                                  )}
                                  {line.stillSold ? (
                                    <Link
                                      href={`/product/${line.productId}`}
                                      className="block text-[14px] text-black hover:opacity-60 transition-opacity duration-300"
                                      style={{ fontWeight: 350 }}
                                    >
                                      {line.name}
                                    </Link>
                                  ) : (
                                    <span className="block text-[14px] text-black" style={{ fontWeight: 350 }}>
                                      {line.name}
                                    </span>
                                  )}
                                  <span className="mt-1 block text-[12px] text-[#646464]">
                                    {[line.size, `Qty ${line.quantity}`].filter(Boolean).join(" · ")}
                                  </span>
                                </span>

                                <span className="flex-shrink-0 text-right text-[14px] text-[#646464]">
                                  <Price amountAed={line.unitPriceAed * line.quantity} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>
              )}

              {/* ── WISHLIST ──────────────────────────────────────── */}
              {activeTab === "wishlist" && (
                <motion.section key="wishlist-panel" {...panelMotion}>
                  <span className="maison-eyebrow block">Wishlist</span>

                  {/* List switcher */}
                  <nav className="mt-8 flex items-center gap-10 border-b border-[rgba(0,0,0,0.12)] pb-4">
                    {wishlistTabs.map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setWishlistTab(tab.key)}
                        className={`pb-1.5 text-[15px] uppercase tracking-[0.06em] transition-colors duration-300 cursor-pointer ${
                          wishlistTab === tab.key
                            ? "text-black border-b border-black"
                            : "text-[#646464] border-b border-transparent hover:text-black"
                        }`}
                        style={{ fontWeight: 350 }}
                      >
                        {tab.label} ({wishlist.filter(item => item.wishlist_type === tab.key).length})
                      </button>
                    ))}
                  </nav>

                  {visibleWishlist.length === 0 ? (
                    <div className="py-20 text-center">
                      <h2 className="maison-page-title">
                        {wishlistTab === "favorite" ? "No favorites yet" : "Nothing saved for later"}
                      </h2>
                      <p className="mt-6 mx-auto max-w-[46ch] text-[14px] font-light leading-[1.7] text-[#646464]">
                        Save the fragrances you love and they will be waiting here for you.
                      </p>
                      <div className="mt-10">
                        <Link href="/shop" className="maison-btn-outline">
                          Discover the collection
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {visibleWishlist.map(item => (
                        <div
                          key={`${item.id}-${item.wishlist_type}`}
                          className="flex flex-col sm:flex-row sm:items-center gap-6 border-b border-[rgba(0,0,0,0.12)] py-8"
                        >
                          <Link
                            href={`/product/${item.id}`}
                            className="w-24 h-24 flex-shrink-0 bg-[#F5F5F5] flex items-center justify-center p-3"
                          >
                            {(item.image_url || toArray(item.image_urls)[0]) && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={item.image_url || toArray(item.image_urls)[0]}
                                alt={item.name}
                                className="w-full h-full object-contain"
                              />
                            )}
                          </Link>

                          <div className="flex-grow min-w-0">
                            {item.brand && (
                              <span className="maison-eyebrow block">{item.brand}</span>
                            )}
                            <Link href={`/product/${item.id}`} className="block mt-2">
                              <h3 className="font-display text-[18px] leading-[1.3] tracking-[0.08em] uppercase text-black">
                                {item.name}
                              </h3>
                            </Link>
                            {item.olfactory_group && (
                              <p className="mt-2 text-[12px] uppercase tracking-[0.02em] text-[#646464]">
                                {item.olfactory_group}
                              </p>
                            )}
                            <p className="maison-price mt-3 block">
                              <Price amountAed={parseFloat(String(item.price)) || 0} />
                            </p>
                          </div>

                          <div className="flex flex-col items-start sm:items-end gap-4 sm:w-[200px] flex-shrink-0">
                            <button
                              onClick={() => handleAddToBag(item)}
                              className="maison-btn-outline w-full"
                              style={{ height: 48, paddingLeft: 12, paddingRight: 12 }}
                            >
                              Add to cart
                            </button>

                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end">
                              <button
                                onClick={() => handleBuyNow(item)}
                                className="text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                              >
                                Buy now
                              </button>
                              <button
                                onClick={() => handleMoveItem(
                                  item.id,
                                  wishlistTab,
                                  wishlistTab === "favorite" ? "buy_later" : "favorite"
                                )}
                                className="text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                              >
                                {wishlistTab === "favorite" ? "Move to buy later" : "Move to favorites"}
                              </button>
                              <button
                                onClick={() => handleRemoveFromWishlist(item.id, wishlistTab)}
                                className="text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>
              )}

              {/* ── ORDER TRACKING ────────────────────────────────── */}
              {activeTab === "tracking" && (
                <motion.section key="tracking-panel" {...panelMotion}>
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <span className="maison-eyebrow block">Order tracking</span>

                    {orders.length > 0 && (
                      <div className="w-full md:w-[260px]">
                        <label htmlFor="tracking-order" className="maison-label">
                          Select order
                        </label>
                        <div className="relative">
                          <select
                            id="tracking-order"
                            value={selectedTrackingOrderId}
                            onChange={(e) => setSelectedTrackingOrderId(e.target.value)}
                            className="maison-select cursor-pointer pr-10"
                          >
                            {orders.map(o => (
                              <option key={o.id} value={o.id}>{o.id}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-[#646464]">
                            ▾
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {orders.length === 0 ? (
                    <div className="py-20 text-center">
                      <h2 className="maison-page-title">Nothing to track yet</h2>
                      <p className="mt-6 mx-auto max-w-[46ch] text-[14px] font-light leading-[1.7] text-[#646464]">
                        Place an order and its delivery journey will be shown here.
                      </p>
                      <div className="mt-10">
                        <Link href="/shop" className="maison-btn-outline">
                          Discover the collection
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-12">

                      {/* Shipment meta — only real data, never invented details */}
                      {trackingOrderObj && (
                        <div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                            {trackingOrderObj.tracking_number && (
                              <div className="border-t border-[rgba(0,0,0,0.12)] py-5">
                                <span className="maison-eyebrow block">Tracking id</span>
                                <span className="mt-2 block text-[14px]" style={{ fontWeight: 350 }}>
                                  {trackingOrderObj.tracking_number}
                                </span>
                              </div>
                            )}
                            <div className="border-t border-[rgba(0,0,0,0.12)] py-5">
                              <span className="maison-eyebrow block">Destination</span>
                              <span className="mt-2 block text-[14px]" style={{ fontWeight: 350 }}>
                                {trackingOrderObj.shipping_address?.city}, {trackingOrderObj.shipping_address?.country}
                              </span>
                            </div>
                          </div>

                          {trackingOrderObj.tracking_url ? (
                            <div className="mt-8 bg-[#F5F5F5] px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                              <div>
                                <span className="maison-eyebrow block">Live carrier link</span>
                                <p className="mt-2 text-[14px] font-light leading-[1.6] text-[rgba(0,0,0,0.75)]">
                                  The carrier has provided a direct tracking link for this delivery.
                                </p>
                              </div>
                              <a
                                href={trackingOrderObj.tracking_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="maison-link flex-shrink-0"
                              >
                                Track via carrier
                              </a>
                            </div>
                          ) : (
                            !trackingOrderObj.tracking_number &&
                            !isCancelled && (
                              <p className="mt-8 text-[14px] font-light leading-[1.7] text-[#646464]">
                                Tracking details will appear once your order ships.
                              </p>
                            )
                          )}
                        </div>
                      )}

                      {/* Shipment progress — derived from orders.status */}
                      {isCancelled ? (
                        <div className="mt-14 border-t border-b border-[rgba(0,0,0,0.12)] py-6">
                          <span className="block text-[12px] uppercase tracking-[0.1em] text-black">
                            Order cancelled
                          </span>
                          <p className="mt-2 text-[14px] font-light leading-[1.6] text-[#646464]">
                            This order has been cancelled and will not be delivered. If you have any
                            questions, please contact us.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-8">
                          {STEPPER_STEPS.map((step, i) => {
                            const isCompleted = i <= activeStepIdx;
                            return (
                              <div
                                key={step.key}
                                className={`border-t pt-4 transition-colors duration-300 ${
                                  isCompleted ? "border-black" : "border-[rgba(0,0,0,0.12)]"
                                }`}
                              >
                                <span
                                  className={`block text-[12px] uppercase tracking-[0.1em] ${
                                    isCompleted ? "text-black" : "text-[#646464]"
                                  }`}
                                >
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                <span
                                  className={`mt-2 block text-[14px] ${isCompleted ? "text-black" : "text-[#646464]"}`}
                                  style={{ fontWeight: 350 }}
                                >
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Shipment log */}
                      <div className="mt-16">
                        <span className="maison-eyebrow block">Shipment log</span>

                        {activeOrderLogs.length === 0 ? (
                          <p className="mt-8 text-[14px] font-light leading-[1.7] text-[#646464]">
                            No delivery updates have been recorded for this order yet.
                          </p>
                        ) : (
                          <div className="mt-8">
                            {activeOrderLogs.map((log) => (
                              <div
                                key={log.id}
                                className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 border-t border-[rgba(0,0,0,0.12)] py-6 last:border-b last:border-[rgba(0,0,0,0.12)]"
                              >
                                <div className="md:pr-10">
                                  <span className="block text-[12px] uppercase tracking-[0.1em] text-black">
                                    {log.status}
                                  </span>
                                  <p className="mt-2 text-[14px] font-light leading-[1.6] text-[rgba(0,0,0,0.75)]">
                                    {log.description}
                                  </p>
                                </div>
                                <div className="md:text-right flex-shrink-0">
                                  <span className="block text-[12px] uppercase tracking-[0.1em] text-[#646464]">
                                    {log.location}
                                  </span>
                                  <span className="mt-2 block text-[12px] text-[#646464]">
                                    {new Date(log.updated_at).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.section>
              )}

              {/* ── SETTINGS ──────────────────────────────────────── */}
              {activeTab === "settings" && (
                <motion.section key="settings-panel" {...panelMotion}>
                  <span className="maison-eyebrow block">Your details</span>
                  <p className="mt-6 max-w-[46ch] text-[14px] font-light leading-[1.7] text-[#646464]">
                    Your name, telephone and delivery address. We use these to prepare and
                    deliver your orders, and they fill in your next checkout for you.
                  </p>

                  <form onSubmit={handleUpdateProfile} className="mt-10 flex flex-col gap-6 max-w-[520px]">

                    {profileSuccess && (
                      <p className="border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-[12px] uppercase tracking-[0.1em] text-black">
                        {profileSuccess}
                      </p>
                    )}
                    {profileError && (
                      <p className="border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-[12px] uppercase tracking-[0.1em] text-black">
                        {profileError}
                      </p>
                    )}

                    {/* Email is the credential, not a detail — shown so the
                        shopper knows which account this is, never editable. */}
                    <div>
                      <span className="maison-label">Email address</span>
                      <p className="mt-1 text-[14px] font-light text-[#646464] break-all">
                        {userEmail}
                      </p>
                      <p className="mt-2 text-[12px] font-light text-[#909090]">
                        Your email address is how you sign in and cannot be changed here.
                        Please write to us if you need it moved.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="profile-first-name" className="maison-label">
                          First name
                        </label>
                        <input
                          id="profile-first-name"
                          type="text"
                          autoComplete="given-name"
                          value={profile.first_name}
                          onChange={(e) => setProfileField("first_name", e.target.value)}
                          className="maison-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-last-name" className="maison-label">
                          Last name
                        </label>
                        <input
                          id="profile-last-name"
                          type="text"
                          autoComplete="family-name"
                          value={profile.last_name}
                          onChange={(e) => setProfileField("last_name", e.target.value)}
                          className="maison-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="profile-phone" className="maison-label">
                        Telephone
                      </label>
                      <input
                        id="profile-phone"
                        type="tel"
                        autoComplete="tel"
                        value={profile.phone}
                        onChange={(e) => setProfileField("phone", e.target.value)}
                        placeholder="+971 50 000 0000"
                        className="maison-input"
                      />
                      <p className="mt-2 text-[12px] font-light text-[#909090]">
                        Our courier calls this number before a cash-on-delivery arrival.
                      </p>
                    </div>

                    <div className="mt-4">
                      <hr className="maison-rule" />
                    </div>

                    <span className="maison-eyebrow block">Delivery address</span>

                    <div>
                      <label htmlFor="profile-street" className="maison-label">
                        Street address
                      </label>
                      <input
                        id="profile-street"
                        type="text"
                        autoComplete="street-address"
                        value={profile.street}
                        onChange={(e) => setProfileField("street", e.target.value)}
                        className="maison-input"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="profile-city" className="maison-label">
                          City
                        </label>
                        <input
                          id="profile-city"
                          type="text"
                          autoComplete="address-level2"
                          value={profile.city}
                          onChange={(e) => setProfileField("city", e.target.value)}
                          className="maison-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-postal-code" className="maison-label">
                          Postal code
                        </label>
                        <input
                          id="profile-postal-code"
                          type="text"
                          autoComplete="postal-code"
                          value={profile.postal_code}
                          onChange={(e) => setProfileField("postal_code", e.target.value)}
                          className="maison-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="profile-country" className="maison-label">
                        Country
                      </label>
                      <input
                        id="profile-country"
                        type="text"
                        autoComplete="country-name"
                        value={profile.country}
                        onChange={(e) => setProfileField("country", e.target.value)}
                        placeholder="United Arab Emirates"
                        className="maison-input"
                      />
                    </div>

                    <button type="submit" disabled={profileSaving} className="maison-btn w-full mt-2 sm:w-auto sm:self-start sm:px-12">
                      {profileSaving ? "Saving" : "Save details"}
                    </button>
                  </form>

                  <div className="mt-16">
                    <hr className="maison-rule" />
                  </div>

                  <span className="maison-eyebrow mt-16 block">Security</span>
                  <p className="mt-6 max-w-[46ch] text-[14px] font-light leading-[1.7] text-[#646464]">
                    Update the password used to sign in to your account.
                  </p>

                  <form onSubmit={handleUpdatePassword} className="mt-10 flex flex-col gap-6 max-w-[420px]">

                    {formSuccess && (
                      <p className="border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-[12px] uppercase tracking-[0.1em] text-black">
                        {formSuccess}
                      </p>
                    )}

                    {formError && (
                      <p className="border border-[rgba(0,0,0,0.12)] bg-[#F5F5F5] px-4 py-3 text-[12px] uppercase tracking-[0.1em] text-black">
                        {formError}
                      </p>
                    )}

                    <div>
                      <div className="flex items-baseline justify-between">
                        <label htmlFor="new-password" className="maison-label">
                          New password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      <input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="maison-input"
                      />
                    </div>

                    <div>
                      <label htmlFor="confirm-password" className="maison-label">
                        Confirm new password
                      </label>
                      <input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="maison-input"
                      />
                    </div>

                    <button type="submit" disabled={formSubmitting} className="maison-btn w-full mt-2">
                      {formSubmitting ? "Updating" : "Update password"}
                    </button>
                  </form>
                </motion.section>
              )}

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
