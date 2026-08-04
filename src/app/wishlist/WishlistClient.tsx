"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import CartDrawer, { openCartDrawer } from "../components/CartDrawer";
import EmptyState from "../components/EmptyState";
import Price from "../components/Price";
import { getBrowserSupabase } from "../lib/supabase-browser";
import { useCart } from "../lib/cart";
import { PRODUCT_FIELDS, toArray } from "../lib/catalogue";

interface WishlistProduct {
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
  top_notes?: string[] | null;
  heart_notes?: string[] | null;
  wishlist_type: "favorite" | "buy_later";
}

interface WishlistRow {
  customer_id: string;
  product_id: number;
  wishlist_type: "favorite" | "buy_later";
}

const itemImage = (item: WishlistProduct) =>
  item.image_url || toArray(item.image_urls)[0] || "";

const itemPriceAed = (item: WishlistProduct) => parseFloat(String(item.price)) || 0;

export default function WishlistClient() {
  const router = useRouter();
  const { add } = useCart();
  const [loading, setLoading] = useState(true);
  // The auth.uid()-keyed session user — RLS on `wishlists` matches on it, so
  // the legacy localStorage id must never be used here.
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"favorite" | "buy_later">("favorite");

  // Data States
  const [wishlistItems, setWishlistItems] = useState<WishlistProduct[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const supabase = getBrowserSupabase();

      let userId: string | null = null;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        userId = null;
      }

      if (!userId) {
        setSessionUserId(null);
        setLoading(false);
        return;
      }
      setSessionUserId(userId);

      try {
        const [{ data: products, error: productsError }, { data: wishlistData }] = await Promise.all([
          supabase.from("products").select(PRODUCT_FIELDS),
          supabase.from("wishlists").select("*").eq("customer_id", userId)
        ]);

        if (productsError) throw productsError;

        const rows: WishlistRow[] = Array.isArray(wishlistData) ? wishlistData : [];
        const catalog = (Array.isArray(products) ? products : []) as Omit<
          WishlistProduct,
          "wishlist_type"
        >[];

        // Only rows whose product still exists in the live catalogue are shown.
        const mappedItems = rows
          .map((w) => {
            const prod = catalog.find((p) => p.id === w.product_id);
            return prod ? { ...prod, wishlist_type: w.wishlist_type } : null;
          })
          .filter((item): item is WishlistProduct => item !== null);

        setWishlistItems(mappedItems);
      } catch (err) {
        console.error("Error loading wishlist items:", err);
        setWishlistItems([]);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRemoveItem = async (productId: number, type: "favorite" | "buy_later") => {
    if (!sessionUserId) return;
    try {
      const { error } = await getBrowserSupabase()
        .from("wishlists")
        .delete()
        .match({
          customer_id: sessionUserId,
          product_id: productId,
          wishlist_type: type
        });

      if (!error) {
        setWishlistItems(prev => prev.filter(item => !(item.id === productId && item.wishlist_type === type)));
        triggerToast("Removed from your wishlist.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveItem = async (productId: number, fromType: "favorite" | "buy_later", toType: "favorite" | "buy_later") => {
    if (!sessionUserId) return;
    try {
      const supabase = getBrowserSupabase();

      // 1. Delete old type
      await supabase
        .from("wishlists")
        .delete()
        .match({
          customer_id: sessionUserId,
          product_id: productId,
          wishlist_type: fromType
        });

      // 2. Insert new type
      const { error } = await supabase
        .from("wishlists")
        .insert({
          customer_id: sessionUserId,
          product_id: productId,
          wishlist_type: toType
        });

      if (!error) {
        setWishlistItems(prev => prev.map(item => {
          if (item.id === productId && item.wishlist_type === fromType) {
            return { ...item, wishlist_type: toType };
          }
          return item;
        }));
        triggerToast(`Moved to ${toType === "favorite" ? "Favorites" : "Buy Later"}.`);
      }
    } catch (err) {
      console.error(err);
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
        price: itemPriceAed(item),
        image_url: itemImage(item),
      },
      defaultSize
    );
    return defaultSize;
  };

  const handleAddToBag = (item: WishlistProduct) => {
    addItemToBag(item);
    openCartDrawer();
  };

  const handleBuyNow = (item: WishlistProduct) => {
    addItemToBag(item);
    router.push("/checkout");
  };

  // Scent-family line shown under the product name on each card
  const scentLine = (item: WishlistProduct) => {
    if (item.olfactory_group) return String(item.olfactory_group);
    const notes = [...toArray(item.top_notes), ...toArray(item.heart_notes)].slice(0, 3);
    return notes.length > 0 ? notes.join(" · ") : "";
  };

  const filteredItems = wishlistItems.filter(item => item.wishlist_type === activeTab);

  const tabs: { key: "favorite" | "buy_later"; label: string }[] = [
    { key: "favorite", label: "Favorites" },
    { key: "buy_later", label: "Buy Later" }
  ];

  // Quiet skeleton — flat #F5F5F5 blocks at the real aspect ratios, no motion.
  if (loading) {
    return (
      <div className="maison min-h-screen flex flex-col">
        <AppHeader activePage="wishlist" />
        <main className="flex-grow">
          <div className="maison-container maison-section">
            <div className="h-7 w-64 mx-auto bg-[var(--surface-2)]" />
            <div className="mt-10">
              <hr className="maison-rule" />
            </div>
            <div className="mt-8 flex items-center justify-center gap-10">
              <div className="h-4 w-24 bg-[var(--surface-2)]" />
              <div className="h-4 w-24 bg-[var(--surface-2)]" />
            </div>
            <div className="mt-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col">
                  <div className="w-full aspect-square bg-[var(--surface-2)]" />
                  <div className="h-4 w-3/4 mt-6 mx-auto bg-[var(--surface-2)]" />
                  <div className="h-3 w-1/2 mt-3 mx-auto bg-[var(--surface-2)]" />
                  <div className="h-12 w-full mt-5 bg-[var(--surface-2)]" />
                </div>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not Logged In — auth gate. The redirect param brings the shopper straight back here.
  if (!sessionUserId) {
    return (
      <div className="maison min-h-screen flex flex-col">
        <AppHeader activePage="wishlist" />

        <main className="flex-grow flex items-center justify-center">
          <div className="maison-container maison-section">
            <EmptyState
              eyebrow="Account"
              title="Sign in to view your wishlist"
              body="Your saved fragrances are kept with your account. Sign in to find them exactly as you left them."
              ctaLabel="Sign in"
              ctaHref="/signin?redirect=/wishlist"
            />
            <p className="text-center">
              <Link href="/shop" className="maison-link text-[#646464] hover:text-black">
                Discover the collection
              </Link>
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="maison min-h-screen flex flex-col">
      <AppHeader activePage="wishlist" />
      <CartDrawer />

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-6 right-5 md:right-10 z-[120] bg-[#121212] text-white px-6 py-4 max-w-[360px] text-[12px] font-normal tracking-[0.1em] uppercase"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow">
        <div className="maison-container maison-section">

          {/* Page header */}
          <header className="text-center">
            <span className="maison-eyebrow block">Saved</span>
            <h1 className="maison-page-title mt-5">Your wishlist</h1>
          </header>

          {/* .maison-rule forces margin:0, so spacing lives on the wrapper */}
          <div className="mt-10">
            <hr className="maison-rule" />
          </div>

          {/* List switcher */}
          <nav className="mt-8 flex items-center justify-center gap-10">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-1.5 text-[15px] uppercase tracking-[0.06em] transition-colors duration-300 cursor-pointer ${
                  activeTab === tab.key
                    ? "text-black border-b border-black"
                    : "text-[#646464] border-b border-transparent hover:text-black"
                }`}
                style={{ fontWeight: 350 }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Item count */}
          <p
            className="mt-6 text-center text-[14px] tracking-[0.02em] text-[#646464]"
            style={{ fontWeight: 350 }}
          >
            {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"} saved
          </p>

          {filteredItems.length === 0 ? (
            /* Empty state */
            <motion.div
              key={`empty-${activeTab}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="py-24 text-center"
            >
              <h2 className="maison-page-title">Your wishlist is empty</h2>
              <p className="mt-6 mx-auto max-w-[46ch] text-[14px] font-light leading-[1.7] text-[#646464]">
                {activeTab === "favorite"
                  ? "Save the fragrances you love and they will be waiting here for you."
                  : "Set aside the fragrances you intend to buy later and they will be waiting here for you."}
              </p>
              <div className="mt-10">
                <Link href="/shop" className="maison-btn-outline">
                  Discover the collection
                </Link>
              </div>
            </motion.div>
          ) : (
            /* Product grid — 4 / 3 / 2 */
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mt-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16"
            >
              {filteredItems.map(item => (
                <article key={`${item.id}-${item.wishlist_type}`} className="group flex flex-col">

                  {/* Media */}
                  <Link href={`/product/${item.id}`} className="maison-card-media block">
                    {itemImage(item) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={itemImage(item)}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="absolute inset-0 bg-[var(--surface-2)]" />
                    )}
                  </Link>

                  {/* Text block — grows so the actions align across a row */}
                  <div className="flex-grow">
                    {item.brand && (
                      <span className="maison-eyebrow block text-center mt-6">
                        {item.brand}
                      </span>
                    )}
                    <Link href={`/product/${item.id}`} className={`block ${item.brand ? "mt-2" : "mt-6"}`}>
                      <h2 className="maison-card-title">{item.name}</h2>
                    </Link>

                    {scentLine(item) && (
                      <p className="maison-card-notes mt-2">{scentLine(item)}</p>
                    )}

                    <p className="maison-price mt-3 text-center">
                      <Price amountAed={itemPriceAed(item)} />
                    </p>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => handleAddToBag(item)}
                    className="maison-btn-outline w-full mt-5"
                    style={{ height: 48, paddingLeft: 12, paddingRight: 12 }}
                  >
                    Add to cart
                  </button>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                    <button
                      onClick={() => handleBuyNow(item)}
                      className="text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                    >
                      Buy now
                    </button>
                    <button
                      onClick={() => handleMoveItem(
                        item.id,
                        activeTab,
                        activeTab === "favorite" ? "buy_later" : "favorite"
                      )}
                      className="text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                    >
                      {activeTab === "favorite" ? "Move to buy later" : "Move to favorites"}
                    </button>
                    <button
                      onClick={() => handleRemoveItem(item.id, activeTab)}
                      className="text-[12px] uppercase tracking-[0.1em] text-[#646464] hover:text-black transition-colors duration-300 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
