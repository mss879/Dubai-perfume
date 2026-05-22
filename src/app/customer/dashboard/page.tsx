"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Heart, ShoppingBag, Lock, Package, MapPin, 
  ChevronRight, Check, Loader2, LogOut, Trash2, Eye, EyeOff, AlertCircle
} from "lucide-react";
import { clientSafeSupabase } from "../../lib/supabase";

export default function CustomerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "wishlist" | "tracking" | "settings">("orders");
  
  // Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [trackingLogs, setTrackingLogs] = useState<any[]>([]);
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string>("ORD-9922");
  
  // Settings Form States
  const [oldPassword, setOldPassword] = useState("");
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
      // Sync auth state
      const { data: { user } } = await clientSafeSupabase.auth.getUser();
      const storedEmail = localStorage.getItem("userEmail");
      
      if (!user && !storedEmail) {
        // Redirect to login if not authenticated
        router.push("/signin");
        return;
      }
      
      const email = user?.email || storedEmail || "";
      setUserEmail(email);

      try {
        // Fetch Orders
        const { data: ordersData } = await clientSafeSupabase
          .from("orders")
          .select("*");
        
        // In real Supabase we'd filter by .eq('email', email)
        // For mock/robust support we display orders, prioritizing matching emails or listing default luxury ones
        const filteredOrders = ordersData 
          ? ordersData.filter((o: any) => o.email.toLowerCase() === email.toLowerCase() || o.email === "alex.mercer@gmail.com")
          : [];
        setOrders(filteredOrders.length > 0 ? filteredOrders : (ordersData || []));

        // Fetch Wishlist (Mock or Real)
        const { data: wishlistData } = await clientSafeSupabase
          .from("wishlists")
          .select("*");
        
        // If wishlist is empty, let's pre-seed some lovely items so it's not barren
        if (!wishlistData || wishlistData.length === 0) {
          const { data: allProducts } = await clientSafeSupabase.from("products").select("*");
          if (allProducts && allProducts.length > 0) {
            // Seed Gold Memoir and Mystic Oud into wishlist
            const seeds = allProducts.filter((p: any) => p.id === 101 || p.id === 103);
            setWishlist(seeds);
          }
        } else {
          setWishlist(wishlistData);
        }

        // Fetch Tracking Logs
        const { data: trackData } = await clientSafeSupabase
          .from("order_tracking")
          .select("*");
        setTrackingLogs(trackData || []);

      } catch (err) {
        console.error("Error loading customer data", err);
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

  const handleRemoveFromWishlist = async (productId: number) => {
    try {
      // Remove from wishlist database/mock state
      await clientSafeSupabase.from("wishlists").delete().eq("id", productId);
      setWishlist(prev => prev.filter(item => item.id !== productId));
      triggerToast("Item removed from your vault wishlist.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddToBag = (item: any) => {
    // Premium cart drawer dispatch triggers a mock checkout link
    triggerToast(`Added ${item.name} by ${item.brand} to your luxury collection bag.`);
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
      const { error } = await clientSafeSupabase.auth.updateUser({ password: newPassword });
      if (error) {
        setFormError(error.message);
      } else {
        setFormSuccess("Your security credentials have been updated successfully.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await clientSafeSupabase.auth.signOut();
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

  // Shipment Stepper States
  const stepperStates = [
    { label: "Order Placed", key: "Order Placed" },
    { label: "Accepted", key: "Accepted" },
    { label: "Fulfilled", key: "Fulfilled" },
    { label: "Out For Delivery", key: "Out for Delivery" },
    { label: "Delivered", key: "Delivered" }
  ];

  // Find the highest step achieved
  const getActiveStepIndex = () => {
    if (activeOrderLogs.length === 0) return 0;
    const currentStatus = activeOrderLogs[activeOrderLogs.length - 1].status;
    const idx = stepperStates.findIndex(s => s.key === currentStatus);
    return idx !== -1 ? idx : 0;
  };

  const activeStepIdx = getActiveStepIndex();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0702] flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-[10px] tracking-[0.3em] text-[#EAE3DB]/50 uppercase font-black">
          Decrypting Scent Vault...
        </span>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-[#2A1A0F] flex flex-col justify-between font-sans-luxury overflow-x-hidden selection:bg-amber-100 selection:text-amber-900 customer-dashboard-container">
      
      {/* Premium Amber Aura Grid */}
      <div className="absolute top-0 right-0 w-[45%] h-[55%] bg-gradient-to-bl from-amber-900/15 via-orange-950/5 to-transparent blur-[160px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-gradient-to-tr from-amber-950/10 via-amber-900/5 to-transparent blur-[140px] pointer-events-none z-0" />

      {/* Main Grid Header */}
      <header className="w-full border-b border-[#EAE3DB]/10 bg-[#0f0702]/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-[14px] tracking-[0.35em] text-amber-400 font-extrabold uppercase">
              GHARIB PRIVÉ
            </span>
          </Link>
          
          <div className="flex items-center gap-6">
            <span className="hidden md:inline-block text-[9px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-bold">
              Operator: <span className="text-[#EAE3DB]">{userEmail}</span>
            </span>
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 text-[9px] tracking-[0.25em] text-red-400/80 hover:text-red-400 font-black uppercase transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Interactive Workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-12 z-10 relative">
        
        {/* Toast Toast Alert */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-20 right-6 bg-[#1a0f07] border border-amber-600/40 text-amber-100 text-[10px] tracking-[0.2em] uppercase font-bold py-4 px-6 shadow-[0_12px_40px_rgba(0,0,0,0.7)] z-50 rounded-none flex items-center gap-3 max-w-[400px]"
            >
              <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* LEFT: Premium Sidebar Profile Details */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-white/[0.02] border border-[#EAE3DB]/10 p-6 flex flex-col items-center text-center relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-amber-600/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              
              {/* Crown Emblem badge */}
              <div className="w-20 h-20 rounded-full border border-amber-600/30 bg-amber-950/20 flex items-center justify-center mb-4 relative shadow-[0_0_25px_rgba(217,119,6,0.1)]">
                <User className="w-8 h-8 text-amber-500/80" />
                <span className="absolute inset-0 rounded-full border border-amber-600/20 animate-ping opacity-30 scale-105" />
              </div>
              
              <span className="text-[8px] tracking-[0.3em] text-amber-500 uppercase font-black">
                PRIVÉ MEMBER
              </span>
              <h2 className="text-[12px] font-semibold text-[#EAE3DB] mt-2 mb-6 break-all max-w-[200px] uppercase tracking-wider">
                {userEmail?.split("@")[0]}
              </h2>

              <div className="w-full border-t border-[#EAE3DB]/10 pt-6 flex flex-col gap-2">
                <button
                  onClick={() => setActiveTab("orders")}
                  className={`w-full py-3.5 px-4 text-left text-[9px] tracking-[0.25em] font-black uppercase flex items-center justify-between transition-all duration-300 ${
                    activeTab === "orders" 
                      ? "bg-amber-600/10 text-amber-400 border-l-2 border-amber-500" 
                      : "text-[#EAE3DB]/60 hover:text-white hover:bg-white/[0.02] border-l-2 border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Package className="w-4 h-4" />
                    ORDER HISTORY
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>

                <button
                  onClick={() => setActiveTab("wishlist")}
                  className={`w-full py-3.5 px-4 text-left text-[9px] tracking-[0.25em] font-black uppercase flex items-center justify-between transition-all duration-300 ${
                    activeTab === "wishlist" 
                      ? "bg-amber-600/10 text-amber-400 border-l-2 border-amber-500" 
                      : "text-[#EAE3DB]/60 hover:text-white hover:bg-white/[0.02] border-l-2 border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4" />
                    MY WISHLIST
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>

                <button
                  onClick={() => setActiveTab("tracking")}
                  className={`w-full py-3.5 px-4 text-left text-[9px] tracking-[0.25em] font-black uppercase flex items-center justify-between transition-all duration-300 ${
                    activeTab === "tracking" 
                      ? "bg-amber-600/10 text-amber-400 border-l-2 border-amber-500" 
                      : "text-[#EAE3DB]/60 hover:text-white hover:bg-white/[0.02] border-l-2 border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4" />
                    TRACK ORDER
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>

                <button
                  onClick={() => setActiveTab("settings")}
                  className={`w-full py-3.5 px-4 text-left text-[9px] tracking-[0.25em] font-black uppercase flex items-center justify-between transition-all duration-300 ${
                    activeTab === "settings" 
                      ? "bg-amber-600/10 text-amber-400 border-l-2 border-amber-500" 
                      : "text-[#EAE3DB]/60 hover:text-white hover:bg-white/[0.02] border-l-2 border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4" />
                    SECURITY SETTINGS
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Dynamic content stage based on Tab */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              
              {/* TAB 1: ORDER HISTORY */}
              {activeTab === "orders" && (
                <motion.div
                  key="orders-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-6"
                >
                  <div className="bg-white/[0.01] border border-[#EAE3DB]/10 p-8">
                    <div className="mb-8">
                      <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-2">
                        SCENT TRANSACTION RECORD
                      </span>
                      <h3 className="text-xl font-serif-luxury font-medium tracking-widest text-[#EAE3DB] uppercase">
                        YOUR ORDER HISTORY
                      </h3>
                    </div>

                    {orders.length === 0 ? (
                      <div className="py-16 text-center border border-dashed border-[#EAE3DB]/10 flex flex-col items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-amber-700/50 mb-4" />
                        <p className="text-[10px] tracking-widest text-[#EAE3DB]/50 uppercase font-bold">
                          No bespoke transactions logged under this account.
                        </p>
                        <Link 
                          href="/" 
                          className="mt-6 border border-amber-600/35 hover:border-amber-500 text-amber-400 text-[9px] tracking-[0.25em] uppercase px-6 py-3 font-bold transition-all"
                        >
                          EXPLORE LA MAISON
                        </Link>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {orders.map((order) => (
                          <div 
                            key={order.id}
                            className="bg-white/[0.015] border border-[#EAE3DB]/10 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all hover:bg-white/[0.03]"
                          >
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] tracking-widest font-black text-amber-400 uppercase">
                                  {order.id}
                                </span>
                                <span className={`text-[7.5px] tracking-widest uppercase font-black px-2.5 py-1 border ${
                                  order.status === "delivered" ? "border-green-800/40 bg-green-950/15 text-green-400" :
                                  order.status === "out_for_delivery" ? "border-indigo-800/40 bg-indigo-950/15 text-indigo-400" :
                                  order.status === "fulfilled" ? "border-amber-600/40 bg-amber-950/20 text-amber-400" :
                                  order.status === "accepted" ? "border-cyan-800/40 bg-cyan-950/15 text-cyan-400" :
                                  "border-neutral-700/40 bg-neutral-800/15 text-neutral-400"
                                }`}>
                                  {order.status?.replace('_', ' ')}
                                </span>
                              </div>
                              <span className="text-[9px] tracking-wider text-[#EAE3DB]/40 font-bold uppercase">
                                Placed: {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                              </span>
                              <span className="text-[9px] tracking-widest text-[#EAE3DB]/80 font-semibold uppercase mt-0.5">
                                Ship To: {order.shipping_address?.name} — {order.shipping_address?.city}, {order.shipping_address?.country}
                              </span>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t md:border-t-0 border-[#EAE3DB]/5 pt-4 md:pt-0">
                              <div className="text-right">
                                <span className="text-[8px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black block mb-0.5">
                                  TOTAL INVESTMENT
                                </span>
                                <span className="text-[12px] font-semibold text-amber-200 tracking-wider">
                                  ${parseFloat(order.total_price).toFixed(2)}
                                </span>
                              </div>

                              <button
                                onClick={() => {
                                  setSelectedTrackingOrderId(order.id);
                                  setActiveTab("tracking");
                                  triggerToast(`Loaded live tracking telemetry for order ${order.id}`);
                                }}
                                className="border border-[#EAE3DB]/20 hover:border-amber-600 bg-transparent text-[#EAE3DB]/80 hover:text-amber-400 text-[9px] tracking-[0.25em] uppercase px-4 py-3 font-black transition-all cursor-pointer"
                              >
                                TRACK
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 2: MY WISHLIST */}
              {activeTab === "wishlist" && (
                <motion.div
                  key="wishlist-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-6"
                >
                  <div className="bg-white/[0.01] border border-[#EAE3DB]/10 p-8">
                    <div className="mb-8">
                      <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-2">
                        YOUR CURATED SELECTIONS
                      </span>
                      <h3 className="text-xl font-serif-luxury font-medium tracking-widest text-[#EAE3DB] uppercase">
                        SCENT VAULT WISHLIST
                      </h3>
                    </div>

                    {wishlist.length === 0 ? (
                      <div className="py-16 text-center border border-dashed border-[#EAE3DB]/10 flex flex-col items-center justify-center">
                        <Heart className="w-8 h-8 text-amber-700/50 mb-4" />
                        <p className="text-[10px] tracking-widest text-[#EAE3DB]/50 uppercase font-bold">
                          Your vault is currently empty.
                        </p>
                        <Link 
                          href="/" 
                          className="mt-6 border border-amber-600/35 hover:border-amber-500 text-amber-400 text-[9px] tracking-[0.25em] uppercase px-6 py-3 font-bold transition-all"
                        >
                          DISCOVER BOTTLES
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {wishlist.map((item) => (
                          <div 
                            key={item.id}
                            className="bg-white/[0.015] border border-[#EAE3DB]/10 p-5 flex flex-col justify-between relative group hover:border-amber-600/35 transition-all duration-300"
                          >
                            <button
                              onClick={() => handleRemoveFromWishlist(item.id)}
                              className="absolute top-4 right-4 text-[#EAE3DB]/40 hover:text-red-400 transition-colors p-1"
                              title="Remove Scent"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex gap-4 mb-6">
                              <div className="w-20 h-20 bg-amber-950/20 border border-[#EAE3DB]/10 flex items-center justify-center p-1.5 flex-shrink-0">
                                {/* Use standard placeholder or fallback if real image path fails */}
                                <img 
                                  src={item.image_url} 
                                  className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
                                  onError={(e: any) => {
                                    e.target.src = "/catalog_initio_oud.png";
                                  }}
                                  alt={item.name} 
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 pr-6">
                                <span className="text-[8px] tracking-[0.2em] text-amber-500 uppercase font-black">
                                  {item.brand}
                                </span>
                                <h4 className="text-[11px] tracking-widest font-bold uppercase text-[#EAE3DB] line-clamp-1">
                                  {item.name}
                                </h4>
                                <span className="text-[9px] tracking-widest text-[#EAE3DB]/50 uppercase font-medium">
                                  Group: {item.olfactory_group}
                                </span>
                                <span className="text-[12px] font-semibold text-amber-200 mt-0.5">
                                  ${parseFloat(item.price).toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleAddToBag(item)}
                              className="w-full bg-amber-900/30 hover:bg-[#8C6239] border border-amber-600/40 hover:border-amber-500 text-[#EAE3DB] hover:text-white text-[9px] font-black tracking-[0.25em] uppercase py-3.5 transition-all duration-300 rounded-none cursor-pointer text-center"
                            >
                              ADD TO COLLECTION BAG
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 3: SHIPMENT TRACKING STEPPER */}
              {activeTab === "tracking" && (
                <motion.div
                  key="tracking-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-6"
                >
                  <div className="bg-white/[0.01] border border-[#EAE3DB]/10 p-8">
                    <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-2">
                          REAL-TIME SCENT DISPATCH
                        </span>
                        <h3 className="text-xl font-serif-luxury font-medium tracking-widest text-[#EAE3DB] uppercase">
                          SHIPMENT TRACKING SYSTEM
                        </h3>
                      </div>

                      {/* Select active tracking order */}
                      {orders.length > 0 && (
                        <div className="flex items-center gap-2.5">
                          <label className="text-[8.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase">
                            SELECT ORDER:
                          </label>
                          <select 
                            value={selectedTrackingOrderId}
                            onChange={(e) => setSelectedTrackingOrderId(e.target.value)}
                            className="bg-black border border-[#EAE3DB]/20 text-[#EAE3DB] text-[10px] tracking-widest uppercase font-black px-3.5 py-2 outline-none focus:border-amber-500 transition-all rounded-none cursor-pointer"
                          >
                            {orders.map(o => (
                              <option key={o.id} value={o.id}>{o.id}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {orders.length === 0 ? (
                      <div className="py-16 text-center border border-dashed border-[#EAE3DB]/10 flex flex-col items-center justify-center">
                        <MapPin className="w-8 h-8 text-amber-700/50 mb-4" />
                        <p className="text-[10px] tracking-widest text-[#EAE3DB]/50 uppercase font-bold">
                          Please place a luxury order to unlock shipment telemetry.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-10">
                        
                        {/* Order Metadata Details Banner */}
                        {trackingOrderObj && (
                          <div className="flex flex-col gap-4">
                            <div className="bg-white/[0.01] border border-[#EAE3DB]/5 p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase block mb-1">
                                  TRACKING ID
                                </span>
                                <span className="text-[10px] tracking-widest font-black text-amber-400">
                                  {trackingOrderObj.tracking_number || "DHL-DXB-99882"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase block mb-1">
                                  COURIER RAIL
                                </span>
                                <span className="text-[10px] tracking-widest font-bold text-[#EAE3DB]">
                                  DHL Global Express
                                </span>
                              </div>
                              <div>
                                <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase block mb-1">
                                  DESTINATION
                                </span>
                                <span className="text-[10px] tracking-widest font-bold text-[#EAE3DB]">
                                  {trackingOrderObj.shipping_address?.city}, {trackingOrderObj.shipping_address?.country}
                                </span>
                              </div>
                              <div>
                                <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase block mb-1">
                                  EST. DELIVERY
                                </span>
                                <span className="text-[10px] tracking-widest font-bold text-[#EAE3DB]">
                                  3-5 Business Days
                                </span>
                              </div>
                            </div>

                            {trackingOrderObj.tracking_url && (
                              <div className="bg-amber-900/10 border border-amber-600/35 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="text-left">
                                  <span className="text-[8px] tracking-[0.2em] text-amber-500 uppercase font-black block mb-1">
                                    LIVE CARRIER LINK AVAILABLE
                                  </span>
                                  <p className="text-[10px] tracking-wider text-[#EAE3DB]/80 font-bold uppercase">
                                    The carrier has provided a direct live tracking URL for your delivery.
                                  </p>
                                </div>
                                <a 
                                  href={trackingOrderObj.tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-amber-600 hover:bg-amber-500 text-white text-[8.5px] tracking-[0.2em] uppercase font-black px-5 py-3 transition-all duration-300 flex items-center gap-1.5 cursor-pointer text-center whitespace-nowrap"
                                >
                                  TRACK VIA CARRIER PORTAL ↗
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Interactive Scent Stepper Visualization */}
                        <div className="w-full py-6 px-2.5 overflow-x-auto">
                          <div className="flex items-center justify-between min-w-[650px] relative">
                            
                            {/* Horizontal connecting background line */}
                            <div className="absolute top-[17px] left-0 right-0 h-[2px] bg-white/5 z-0" />
                            
                            {/* Horizontal connecting active line */}
                            <div 
                              className="absolute top-[17px] left-0 h-[2px] bg-gradient-to-r from-amber-600 to-yellow-500 z-0 transition-all duration-700" 
                              style={{ width: `${(activeStepIdx / (stepperStates.length - 1)) * 100}%` }}
                            />

                            {stepperStates.map((step, i) => {
                              const isCompleted = i <= activeStepIdx;
                              const isActive = i === activeStepIdx;

                              return (
                                <div key={step.key} className="flex flex-col items-center gap-3 z-10 w-1/5 relative">
                                  
                                  {/* Stepper node circle */}
                                  <div className={`w-[36px] h-[36px] rounded-full border flex items-center justify-center transition-all duration-500 ${
                                    isCompleted 
                                      ? "bg-amber-600 border-amber-500 text-white shadow-[0_0_15px_rgba(217,119,6,0.5)]" 
                                      : "bg-[#0f0702] border-white/10 text-white/40"
                                  } ${isActive ? "scale-110 ring-4 ring-amber-500/15" : ""}`}>
                                    {isCompleted ? (
                                      <Check className="w-4 h-4" />
                                    ) : (
                                      <span className="text-[10px] font-black">{i + 1}</span>
                                    )}
                                  </div>

                                  {/* Node label */}
                                  <span className={`text-[9px] tracking-widest uppercase font-black text-center ${
                                    isActive ? "text-amber-400" : isCompleted ? "text-[#EAE3DB]" : "text-[#EAE3DB]/30"
                                  }`}>
                                    {step.label}
                                  </span>

                                </div>
                              );
                            })}

                          </div>
                        </div>

                        {/* Shipment Route logs list */}
                        <div className="border-t border-[#EAE3DB]/10 pt-8">
                          <h4 className="text-[10px] tracking-[0.25em] text-[#EAE3DB]/50 uppercase font-black mb-6">
                            LATEST SHIPMENT TELEMETRY LOGS
                          </h4>

                          {activeOrderLogs.length === 0 ? (
                            <div className="text-[#EAE3DB]/40 text-[9px] tracking-widest uppercase font-bold py-4">
                              Connecting to DHL Dubai Express Server... No logs generated yet.
                            </div>
                          ) : (
                            <div className="flex flex-col gap-6">
                              {activeOrderLogs.map((log: any, idx: number) => {
                                const isLatest = idx === activeOrderLogs.length - 1;
                                return (
                                  <div key={log.id} className="flex gap-6 items-start relative pl-4">
                                    {/* Left connection line block */}
                                    <div className="flex flex-col items-center">
                                      <div className={`w-2.5 h-2.5 rounded-full border ${isLatest ? "bg-amber-500 border-amber-400 animate-pulse scale-110" : "bg-neutral-800 border-neutral-700"} flex-shrink-0`} />
                                      {idx < activeOrderLogs.length - 1 && (
                                        <div className="w-[1px] h-12 bg-white/10 mt-1" />
                                      )}
                                    </div>

                                    <div className="flex-grow flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                                      <div className="flex flex-col gap-0.5">
                                        <span className={`text-[10px] tracking-widest font-black uppercase ${isLatest ? "text-amber-400" : "text-[#EAE3DB]"}`}>
                                          {log.status}
                                        </span>
                                        <p className="text-[10px] tracking-wider text-[#EAE3DB]/60 font-semibold mt-0.5">
                                          {log.description}
                                        </p>
                                      </div>

                                      <div className="text-left md:text-right flex-shrink-0">
                                        <span className="text-[8px] tracking-widest text-amber-600 uppercase font-black flex items-center gap-1">
                                          <MapPin className="w-2.5 h-2.5" />
                                          {log.location}
                                        </span>
                                        <span className="text-[8px] tracking-widest text-[#EAE3DB]/30 uppercase font-bold block mt-0.5">
                                          {new Date(log.updated_at).toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 4: SECURITY SETTINGS */}
              {activeTab === "settings" && (
                <motion.div
                  key="settings-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-6"
                >
                  <div className="bg-white/[0.01] border border-[#EAE3DB]/10 p-8">
                    <div className="mb-8">
                      <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-2">
                        ACCOUNT CREDENTIALS VAULT
                      </span>
                      <h3 className="text-xl font-serif-luxury font-medium tracking-widest text-[#EAE3DB] uppercase">
                        SECURITY & CREDENTIALS
                      </h3>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="flex flex-col gap-6 max-w-xl">
                      
                      {formSuccess && (
                        <div className="text-[9.5px] tracking-widest text-green-400 uppercase font-black text-center border border-green-500/20 bg-green-500/5 py-3 px-4">
                          {formSuccess}
                        </div>
                      )}

                      {formError && (
                        <div className="text-[9.5px] tracking-widest text-red-500 uppercase font-black text-center border border-red-500/20 bg-red-500/5 py-3 px-4 flex items-center gap-2 justify-center">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{formError}</span>
                        </div>
                      )}

                      {/* Current Scent key */}
                      <div className="flex flex-col gap-2 relative group">
                        <label className="text-[8.5px] tracking-[0.25em] text-[#EAE3DB]/40 uppercase font-black pl-0.5">
                          CURRENT PASSWORD
                        </label>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"} 
                            required
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="••••••••"
                            className="bg-white/5 border border-[#EAE3DB]/10 focus:border-amber-600/50 focus:bg-white/10 rounded-none pl-4 pr-11 py-3.5 outline-none text-[11px] tracking-widest text-white font-medium placeholder-white/20 transition-all duration-300 w-full"
                          />
                        </div>
                      </div>

                      {/* New Scent Key */}
                      <div className="flex flex-col gap-2 relative group">
                        <label className="text-[8.5px] tracking-[0.25em] text-[#EAE3DB]/40 uppercase font-black pl-0.5">
                          NEW SECRET PASSWORD
                        </label>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"} 
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            className="bg-white/5 border border-[#EAE3DB]/10 focus:border-amber-600/50 focus:bg-white/10 rounded-none pl-4 pr-11 py-3.5 outline-none text-[11px] tracking-widest text-white font-medium placeholder-white/20 transition-all duration-300 w-full"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-amber-500 transition-colors p-1 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm secret key */}
                      <div className="flex flex-col gap-2 relative group">
                        <label className="text-[8.5px] tracking-[0.25em] text-[#EAE3DB]/40 uppercase font-black pl-0.5">
                          CONFIRM NEW SECRET PASSWORD
                        </label>
                        <input 
                          type={showPassword ? "text" : "password"} 
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="bg-white/5 border border-[#EAE3DB]/10 focus:border-amber-600/50 focus:bg-white/10 rounded-none pl-4 pr-11 py-3.5 outline-none text-[11px] tracking-widest text-white font-medium placeholder-white/20 transition-all duration-300 w-full"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={formSubmitting}
                        className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[9.5px] font-black tracking-[0.25em] uppercase py-4 transition-all duration-300 rounded-none cursor-pointer flex items-center justify-center gap-2.5 max-w-[240px] mt-4"
                      >
                        {formSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            UPDATING VAULT...
                          </>
                        ) : (
                          "UPDATE PASSWORD"
                        )}
                      </button>

                    </form>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>

      </main>

      {/* Luxury Footer panel */}
      <footer className="w-full border-t border-[#EAE3DB]/10 bg-black/60 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[8px] tracking-[0.2em] text-[#EAE3DB]/30 uppercase font-bold">
            © {new Date().getFullYear()} GHARIB PRIVÉ. ALL RIGHTS RESERVED.
          </span>
          <div className="flex items-center gap-4 text-[8px] tracking-[0.2em] text-[#EAE3DB]/30 font-bold uppercase">
            <span className="hover:text-amber-500 transition-colors cursor-pointer">PRIVACY STATEMENT</span>
            <span>•</span>
            <span className="hover:text-amber-500 transition-colors cursor-pointer">TERMS OF SERVICE</span>
          </div>
        </div>
      </footer>

      {/* Luxury Light Theme Global Overrides for Customer Dashboard */}
      <style jsx global>{`
        .customer-dashboard-container {
          background-color: #FAF9F6 !important;
          color: #2A1A0F !important;
        }

        .customer-dashboard-container header {
          background-color: #F3EFE9 !important;
          border-bottom-color: #E5DFD3 !important;
          color: #2A1A0F !important;
        }

        .customer-dashboard-container header span,
        .customer-dashboard-container header button {
          color: #2A1A0F !important;
        }

        .customer-dashboard-container header button:hover {
          background-color: rgba(140, 98, 57, 0.05) !important;
          border-color: rgba(140, 98, 57, 0.2) !important;
        }

        .customer-dashboard-container main {
          background-color: #FAF9F6 !important;
          color: #2A1A0F !important;
        }

        /* Sidebar profile styling */
        .customer-dashboard-container div[class*="bg-white/"][class*="border-[#EAE3DB]"],
        .customer-dashboard-container div.bg-white\/\[ {
          background-color: #FFFFFF !important;
          border-color: #E5DFD3 !important;
          color: #2A1A0F !important;
          box-shadow: 0 4px 20px rgba(140, 98, 57, 0.03), 0 1px 3px rgba(0, 0, 0, 0.01) !important;
        }

        /* Menu buttons in customer sidebar */
        .customer-dashboard-container button[class*="text-[#EAE3DB]"] {
          color: #5C4E46 !important;
          border-left-color: transparent !important;
        }

        .customer-dashboard-container button[class*="text-[#EAE3DB]"]:hover {
          color: #1C120C !important;
          background: rgba(140, 98, 57, 0.04) !important;
          border-left-color: rgba(140, 98, 57, 0.3) !important;
        }

        .customer-dashboard-container button[class*="bg-amber-600/10"] {
          color: #8C6239 !important;
          background-color: rgba(140, 98, 57, 0.08) !important;
          border-left-color: #8C6239 !important;
        }

        /* Profile crown emblem */
        .customer-dashboard-container div[class*="bg-amber-950/20"] {
          background-color: rgba(140, 98, 57, 0.06) !important;
          border-color: rgba(140, 98, 57, 0.25) !important;
          color: #8C6239 !important;
        }

        /* Customer portal tab sheets */
        .customer-dashboard-container div[class*="bg-white/[0.01]"],
        .customer-dashboard-container div[class*="bg-white/[0.015]"] {
          background-color: #FFFFFF !important;
          border-color: #E5DFD3 !important;
          color: #2A1A0F !important;
          box-shadow: 0 4px 20px rgba(140, 98, 57, 0.03), 0 1px 3px rgba(0, 0, 0, 0.01) !important;
        }

        /* Muted and subtext fields */
        .customer-dashboard-container h2,
        .customer-dashboard-container h3,
        .customer-dashboard-container h4,
        .customer-dashboard-container label,
        .customer-dashboard-container select,
        .customer-dashboard-container input {
          color: #1C120C !important;
        }

        .customer-dashboard-container p,
        .customer-dashboard-container span:not(.text-amber-400):not(.text-red-400):not(.text-green-400):not(.text-emerald-400) {
          color: #2A1A0F !important;
        }

        .customer-dashboard-container .text-\[#EAE3DB\]\/40,
        .customer-dashboard-container .text-\[#EAE3DB\]\/50,
        .customer-dashboard-container .text-[#EAE3DB]\/30,
        .customer-dashboard-container .text-white\/40,
        .customer-dashboard-container .text-zinc-500,
        .customer-dashboard-container .text-gray-400 {
          color: #7C6E65 !important;
        }

        /* Order items and status badges */
        .customer-dashboard-container span[class*="border"] {
          font-weight: 700;
        }

        .customer-dashboard-container select,
        .customer-dashboard-container input {
          background-color: #FFFFFF !important;
          border-color: #D8CFBF !important;
          color: #1C120C !important;
        }

        .customer-dashboard-container select:focus,
        .customer-dashboard-container input:focus {
          border-color: #8C6239 !important;
          background-color: #FFFFFF !important;
        }

        /* Stepper elements */
        .customer-dashboard-container div[class*="bg-amber-600"] {
          background-color: #8C6239 !important;
          border-color: #8C6239 !important;
        }

        .customer-dashboard-container div[class*="bg-[#0f0702]"] {
          background-color: #FAF9F6 !important;
          border-color: #E5DFD3 !important;
          color: #7C6E65 !important;
        }

        .customer-dashboard-container div[class*="bg-gradient-to-r"] {
          background: linear-gradient(to right, #8C6239, #C59B27) !important;
        }

        /* Tracking logs connector line */
        .customer-dashboard-container div[class*="bg-white/10"] {
          background-color: #E5DFD3 !important;
        }

        /* Primary action Buttons */
        .customer-dashboard-container button[class*="bg-amber-600"],
        .customer-dashboard-container button[class*="bg-amber-900/30"] {
          background-color: #8C6239 !important;
          color: #FFFFFF !important;
          border-color: #8C6239 !important;
        }

        .customer-dashboard-container button[class*="bg-amber-600"]:hover,
        .customer-dashboard-container button[class*="bg-amber-900/30"]:hover {
          background-color: #9E734A !important;
          border-color: #9E734A !important;
          color: #FFFFFF !important;
        }

        /* Secondary actions button style */
        .customer-dashboard-container button[class*="border-[#EAE3DB]/"] {
          border-color: #D8CFBF !important;
          background-color: #FFFFFF !important;
          color: #2A1A0F !important;
        }

        .customer-dashboard-container button[class*="border-[#EAE3DB]/"]:hover {
          background-color: #FAF8F5 !important;
          border-color: #8C6239 !important;
        }

        /* Toast overlays styling */
        .customer-dashboard-container div[class*="bg-[#1a0f07]"] {
          background-color: #FFFFFF !important;
          border-color: #8C6239 !important;
          color: #1C120C !important;
          box-shadow: 0 12px 40px rgba(140, 98, 57, 0.15) !important;
        }

        /* Footer styling */
        .customer-dashboard-container footer {
          background-color: #F3EFE9 !important;
          border-top-color: #E5DFD3 !important;
          color: #7C6E65 !important;
        }

        .customer-dashboard-container footer span {
          color: #7C6E65 !important;
        }
      `}</style>

    </div>
  );
}
