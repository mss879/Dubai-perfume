"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, Trash2, ShoppingBag, ArrowRight, Loader2, 
  Home, LogIn, Sparkles, Check, Bookmark, ArrowLeftRight
} from "lucide-react";
import { clientSafeSupabase } from "../lib/supabase";

export default function WishlistPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"favorite" | "buy_later">("favorite");
  
  // Data States
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [activeCurrency, setActiveCurrency] = useState("AED");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      // Get session
      const storedEmail = localStorage.getItem("userEmail");
      const { data: { user } } = await clientSafeSupabase.auth.getUser();
      const email = user?.email || storedEmail;

      if (!email) {
        setUserEmail(null);
        setLoading(false);
        return;
      }
      setUserEmail(email);

      try {
        // Load products
        const { data: products } = await clientSafeSupabase.from("products").select("*");
        // Load wishlist items
        const { data: wishlistData } = await clientSafeSupabase.from("wishlists").select("*");

        if (wishlistData && products) {
          const userId = localStorage.getItem("userId") || "";
          const userWishlist = wishlistData.filter((w: any) => w.customer_id === userId);
          
          const mappedItems = userWishlist.map((w: any) => {
            const prod = products.find((p: any) => p.id === w.product_id);
            return prod ? { ...prod, wishlist_type: w.wishlist_type } : null;
          }).filter(Boolean);

          setWishlistItems(mappedItems);
        }
      } catch (err) {
        console.error("Error loading wishlist items:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
    
    // Load currency and cart count
    if (typeof window !== "undefined") {
      const savedCurrency = localStorage.getItem("gharib_active_currency") || "AED";
      setActiveCurrency(savedCurrency);

      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        try {
          const items = JSON.parse(savedCart);
          const count = items.reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);
          setCartCount(count);
        } catch (_) {}
      }
    }
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRemoveItem = async (productId: number, type: "favorite" | "buy_later") => {
    try {
      const userId = localStorage.getItem("userId") || "";
      const { error } = await clientSafeSupabase
        .from("wishlists")
        .delete()
        .match({
          customer_id: userId,
          product_id: productId,
          wishlist_type: type
        });

      if (!error) {
        setWishlistItems(prev => prev.filter(item => !(item.id === productId && item.wishlist_type === type)));
        triggerToast("Item removed from your Scent Vault.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveItem = async (productId: number, fromType: "favorite" | "buy_later", toType: "favorite" | "buy_later") => {
    try {
      const userId = localStorage.getItem("userId") || "";
      
      // 1. Delete old type
      await clientSafeSupabase
        .from("wishlists")
        .delete()
        .match({
          customer_id: userId,
          product_id: productId,
          wishlist_type: fromType
        });
      
      // 2. Insert new type
      const { error } = await clientSafeSupabase
        .from("wishlists")
        .insert({
          customer_id: userId,
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
        triggerToast(`Moved scent to ${toType === "favorite" ? "Favorites" : "Save to Buy Later"}.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToBag = (item: any) => {
    // Add item to cart in local storage
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("cart") || "[]";
      let cart = [];
      try {
        cart = JSON.parse(savedCart);
      } catch (_) {}

      const defaultSize = item.sizes?.[0] || "50ml";
      const existingIdx = cart.findIndex((i: any) => i.product.id === item.id && i.selectedSize === defaultSize);

      if (existingIdx > -1) {
        cart[existingIdx].quantity += 1;
      } else {
        cart.push({
          product: {
            id: item.id,
            brand: item.brand,
            name: item.name,
            price: item.price,
            sizes: item.sizes,
            image: item.image_url || "/gold-memoir.png",
            description: item.description,
            tagline: item.tagline || "",
            olfactory: item.olfactory_group
          },
          quantity: 1,
          selectedSize: defaultSize
        });
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      
      // Update count
      const count = cart.reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);
      setCartCount(count);
      
      triggerToast(`Added ${item.name} (${defaultSize}) to your Selection.`);
    }
  };

  const formatCurrency = (amount: number) => {
    const rates: Record<string, number> = {
      AED: 1, SAR: 1.02, QAR: 0.99, KWD: 0.084, BHD: 0.10,
      OMR: 0.11, USD: 0.272, EUR: 0.25, GBP: 0.21, INR: 22.8
    };
    const symbols: Record<string, string> = {
      AED: "AED", SAR: "SAR", QAR: "QAR", KWD: "KWD", BHD: "BHD",
      OMR: "OMR", USD: "$", EUR: "€", GBP: "£", INR: "₹"
    };
    const rate = rates[activeCurrency] || 1;
    const symbol = symbols[activeCurrency] || "AED";
    return `${symbol} ${(amount * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredItems = wishlistItems.filter(item => item.wishlist_type === activeTab);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0702] flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-[10px] tracking-[0.3em] text-[#EAE3DB]/50 uppercase font-black">
          Unlocking Scent Vault...
        </span>
      </div>
    );
  }

  // Not Logged In Screen
  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[#070200] text-white flex flex-col justify-between font-sans-luxury relative overflow-hidden">
        {/* Decorative ambient background glows */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-radial from-amber-900/20 via-transparent to-transparent blur-[120px] pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-radial from-orange-950/15 via-transparent to-transparent blur-[120px] pointer-events-none z-0" />

        {/* Header */}
        <header className="w-full border-b border-white/5 bg-black/45 backdrop-blur-md z-10 relative">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <Link href="/" className="text-[14px] tracking-[0.35em] text-amber-400 font-extrabold uppercase hover:opacity-85 transition-opacity">
              GHARIB
            </Link>
            <Link href="/" className="flex items-center gap-2 text-[10px] tracking-widest text-neutral-400 hover:text-white uppercase font-bold transition-colors">
              <Home className="w-4 h-4 text-amber-500/80" />
              <span>Back Home</span>
            </Link>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-grow flex items-center justify-center z-10 px-6 py-16 relative">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-md w-full bg-neutral-950/80 border border-amber-900/20 backdrop-blur-lg p-10 text-center relative rounded-none"
          >
            <div className="absolute inset-1 border border-white/[0.02] pointer-events-none" />
            <div className="w-16 h-16 rounded-full border border-amber-600/30 bg-amber-950/20 flex items-center justify-center mx-auto mb-6">
              <Heart className="w-6 h-6 text-amber-500" />
            </div>

            <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-2">
              SCENT ARCHIVE ACCESS
            </span>
            <h1 className="text-2xl font-serif-luxury tracking-widest uppercase mb-4 text-[#EAE3DB]">
              Scent Vault Locked
            </h1>
            <p className="text-xs text-neutral-400 tracking-widest uppercase leading-relaxed mb-8">
              Your personal fragrance curations and wishlists are kept secure. Please sign in to access your Scent Vault.
            </p>

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => router.push("/signin?redirect=/wishlist")}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black tracking-[0.25em] uppercase py-4 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Maison
              </button>
              <Link 
                href="/" 
                className="w-full border border-neutral-800 hover:border-amber-600/40 text-neutral-400 hover:text-amber-500 text-[10px] font-black tracking-[0.25em] uppercase py-4 transition-all text-center"
              >
                Explore Scent Collections
              </Link>
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-white/5 bg-black/60 py-6 z-10 relative">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <span className="text-[8px] tracking-[0.2em] text-neutral-500 uppercase font-bold">
              © {new Date().getFullYear()} GHARIB. ALL RIGHTS RESERVED.
            </span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#070200] text-white flex flex-col justify-between font-sans-luxury overflow-x-hidden">
      
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-radial from-amber-900/10 via-transparent to-transparent blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-radial from-orange-950/8 via-transparent to-transparent blur-[140px] pointer-events-none z-0" />

      {/* Toast Alert Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 bg-[#1a0f07] border border-amber-600/40 text-amber-100 text-[10px] tracking-[0.2em] uppercase font-bold py-4 px-6 shadow-[0_12px_40px_rgba(0,0,0,0.8)] z-50 rounded-none flex items-center gap-3 max-w-[400px]"
          >
            <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="w-full border-b border-white/5 bg-black/45 backdrop-blur-md z-10 relative">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-[14px] tracking-[0.35em] text-amber-400 font-extrabold uppercase hover:opacity-85 transition-all">
            GHARIB
          </Link>
          
          <div className="flex items-center gap-8">
            <Link href="/" className="text-[10px] tracking-widest text-neutral-400 hover:text-white uppercase font-bold transition-all flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
            <Link href="/customer/dashboard" className="text-[10px] tracking-widest text-neutral-400 hover:text-white uppercase font-bold transition-all flex items-center gap-1.5">
              <span>Account</span>
            </Link>
            <div className="relative text-neutral-400 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
              <ShoppingBag className="w-[18px] h-[18px]" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-black text-[8px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-16 z-10 relative">
        
        {/* Title / Headline Section */}
        <div className="text-center mb-16">
          <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-2 animate-pulse">
            ✦ SCENT ARCHIVE VAULT ✦
          </span>
          <h1 className="text-3xl md:text-5xl font-serif-luxury tracking-widest uppercase text-[#EAE3DB]">
            Your Wishlist Archive
          </h1>
          <p className="text-xs text-neutral-400 tracking-widest uppercase max-w-md mx-auto mt-4 leading-relaxed">
            Curate and store your custom olfactory releases. Access your Favorites and Buy Later selections.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex justify-center mb-12">
          <div className="bg-neutral-950/90 border border-white/5 p-1.5 flex gap-2 w-full max-w-[500px]">
            <button
              onClick={() => setActiveTab("favorite")}
              className={`flex-1 py-3.5 text-center text-[10px] tracking-[0.25em] font-black uppercase flex items-center justify-center gap-2.5 transition-all duration-300 ${
                activeTab === "favorite" 
                  ? "bg-amber-600/10 border border-amber-600/40 text-amber-400 shadow-sm" 
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              <Heart className="w-4 h-4" />
              Favorites ({wishlistItems.filter(item => item.wishlist_type === "favorite").length})
            </button>

            <button
              onClick={() => setActiveTab("buy_later")}
              className={`flex-1 py-3.5 text-center text-[10px] tracking-[0.25em] font-black uppercase flex items-center justify-center gap-2.5 transition-all duration-300 ${
                activeTab === "buy_later" 
                  ? "bg-amber-600/10 border border-amber-600/40 text-amber-400 shadow-sm" 
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              Save to Buy Later ({wishlistItems.filter(item => item.wishlist_type === "buy_later").length})
            </button>
          </div>
        </div>

        {/* Dynamic Display Grid */}
        <AnimatePresence mode="wait">
          {filteredItems.length === 0 ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="py-20 text-center border border-white/5 bg-neutral-950/40 flex flex-col items-center justify-center max-w-xl mx-auto"
            >
              {activeTab === "favorite" ? (
                <Heart className="w-8 h-8 text-neutral-600 mb-4 animate-pulse" />
              ) : (
                <Bookmark className="w-8 h-8 text-neutral-600 mb-4 animate-pulse" />
              )}
              <h3 className="text-md font-serif-luxury tracking-widest uppercase mb-2 text-neutral-300">
                {activeTab === "favorite" ? "No Favorites Saved" : "Save to Buy Later is Empty"}
              </h3>
              <p className="text-xs text-neutral-500 tracking-widest uppercase leading-relaxed max-w-xs mx-auto mb-6">
                Explore our catalog page and save your favorite selections here.
              </p>
              <Link 
                href="/" 
                className="border border-amber-600/35 hover:border-amber-500 text-amber-400 hover:text-white text-[9px] tracking-[0.25em] uppercase px-8 py-3.5 font-black transition-all"
              >
                EXPLORE BOTTLES
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {filteredItems.map(item => (
                <div 
                  key={item.id}
                  className="bg-neutral-950/60 border border-white/5 flex flex-col justify-between relative group hover:border-amber-600/35 transition-all duration-300"
                >
                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveItem(item.id, activeTab)}
                    className="absolute top-4 right-4 text-neutral-500 hover:text-red-400 transition-colors p-1.5 z-20 bg-black/60 border border-white/5 rounded-full"
                    title="Remove Scent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Move/Switch List Button */}
                  <button
                    onClick={() => handleMoveItem(
                      item.id, 
                      activeTab, 
                      activeTab === "favorite" ? "buy_later" : "favorite"
                    )}
                    className="absolute top-4 left-4 text-neutral-500 hover:text-amber-500 transition-colors p-1.5 z-20 bg-black/60 border border-white/5 rounded-full flex items-center gap-1"
                    title={activeTab === "favorite" ? "Move to Save to Buy Later" : "Move to Favorites"}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>

                  {/* Image Area */}
                  <div className="w-full aspect-square bg-[#120a05]/40 flex items-center justify-center p-0 relative overflow-hidden border-b border-white/5">
                    <img 
                      src={item.image_url} 
                      className="w-full h-full object-cover filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform duration-500"
                      onError={(e: any) => {
                        e.target.src = "/catalog_initio_oud.png";
                      }}
                      alt={item.name} 
                    />
                  </div>

                  {/* Text Details */}
                  <div className="p-4 flex-grow flex flex-col justify-between text-left bg-[#0a0401] transition-all duration-500 font-sans-luxury">
                    <div>
                      <span className="text-[8px] tracking-[0.25em] font-extrabold text-amber-500 uppercase block mb-1">
                        {item.brand}
                      </span>
                      <h3 className="text-[13px] font-bold text-[#EAE3DB] uppercase tracking-wider line-clamp-1 group-hover:text-amber-400 transition-colors duration-300 font-sans-luxury">
                        {item.name}
                      </h3>
                      <p className="text-[8px] text-neutral-500 tracking-widest uppercase mt-0.5">
                        Olfactory: {item.olfactory_group}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/10">
                      <span className="text-[13px] font-serif font-extrabold text-amber-200 tracking-widest">
                        {formatCurrency(parseFloat(item.price) || 0)}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {/* Basket Icon Button with Slide-Up Hover Effect */}
                        <button
                          onClick={() => handleAddToBag(item)}
                          className="w-7 h-7 flex items-center justify-center border border-white/20 hover:border-amber-400 text-[#EAE3DB] hover:text-amber-400 bg-transparent hover:bg-white/5 transition-all duration-300 rounded-none cursor-pointer active:scale-95 group/basket overflow-hidden relative"
                          title="Add to Basket"
                        >
                          <div className="relative w-3.5 h-3.5 overflow-hidden flex flex-col justify-center items-center">
                            <svg
                              className="w-3.5 h-3.5 absolute transition-all duration-300 transform group-hover/basket:-translate-y-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                            <svg
                              className="w-3.5 h-3.5 absolute text-amber-400 transition-all duration-300 transform translate-y-5 group-hover/basket:translate-y-0"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                          </div>
                        </button>

                        {/* Buy Now Text Button with Shine and Slide Background Effect */}
                        <button
                          onClick={() => {
                            handleAddToBag(item);
                            router.push("/checkout");
                          }}
                          className="bg-amber-600 text-white text-[8px] font-black tracking-[0.2em] hover:tracking-[0.28em] uppercase px-3 py-1.5 transition-all duration-500 rounded-none cursor-pointer border border-amber-600 active:scale-95 shadow-sm relative overflow-hidden group/buynow flex items-center justify-center"
                        >
                          {/* Background gradient slide-up fill */}
                          <span className="absolute inset-0 bg-gradient-to-r from-amber-850 to-amber-700 translate-y-full group-hover/buynow:translate-y-0 transition-transform duration-500 ease-out z-0"></span>
                          {/* Shine Sweep Reflection */}
                          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-[150%] group-hover/buynow:translate-x-[150%] transition-transform duration-1000 ease-in-out z-0"></span>
                          
                          <span className="relative z-10">BUY NOW</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-black/60 py-6 z-10 relative">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[8px] tracking-[0.2em] text-neutral-500 uppercase font-bold">
            © {new Date().getFullYear()} GHARIB. ALL RIGHTS RESERVED.
          </span>
          <div className="flex items-center gap-4 text-[8px] tracking-[0.2em] text-neutral-500 font-bold uppercase">
            <span className="hover:text-amber-500 transition-colors cursor-pointer">PRIVACY STATEMENT</span>
            <span>•</span>
            <span className="hover:text-amber-500 transition-colors cursor-pointer">TERMS OF SERVICE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
