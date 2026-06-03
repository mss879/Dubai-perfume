"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lock, Mail, Phone, User, MapPin, Check, 
  ChevronRight, Loader2, CreditCard, ShoppingBag, ArrowLeft,
  CheckCircle2, Sparkles, Truck, ShieldCheck, AlertCircle
} from "lucide-react";
import { clientSafeSupabase } from "../lib/supabase";

interface CartItem {
  product: {
    id: number;
    brand: string;
    name: string;
    price: any;
    image_url: string;
  };
  quantity: number;
  selectedSize: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Currency Engine States
  const [activeCurrency, setActiveCurrency] = useState("AED");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
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
  });

  // Global Price Formatter Utility
  const formatCurrency = (aedAmount: number, targetCurrency: string = activeCurrency) => {
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
  };

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
  const [abandonedCartId, setAbandonedCartId] = useState<string | null>(null);

  // Helper to generate dynamic UUID for tracking session
  const generateUUID = () => {
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  useEffect(() => {
    // 1. Fetch user authentication state
    const syncUser = async () => {
      const { data: { user } } = await clientSafeSupabase.auth.getUser();
      const storedEmail = localStorage.getItem("userEmail");
      const storedId = localStorage.getItem("userId");

      const activeEmail = user?.email || storedEmail || "";
      const activeId = user?.id || storedId || null;

      setUserId(activeId);
      setUserEmail(activeEmail);
      if (activeEmail) {
        setEmail(activeEmail);
      }
    };
    syncUser();

    // 2. Fetch cart items
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("gharib_cart");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCartItems(parsed);
        } catch (e) {
          console.error(e);
        }
      }

      // Initialize or retrieve abandoned cart session ID
      let sessionCartId = sessionStorage.getItem("gharib_abandoned_cart_id");
      if (!sessionCartId) {
        sessionCartId = generateUUID();
        sessionStorage.setItem("gharib_abandoned_cart_id", sessionCartId);
      }
      setAbandonedCartId(sessionCartId);

      // 3. Load active currency and cached rates
      const storedCurrency = localStorage.getItem("gharib_active_currency");
      if (storedCurrency) {
        setActiveCurrency(storedCurrency);
      }
      const cachedRates = sessionStorage.getItem("gharib_exchange_rates");
      if (cachedRates) {
        setExchangeRates(JSON.parse(cachedRates));
      }
    }
    setLoading(false);
  }, []);

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
  }, [abandonedCartId, firstName, lastName, email, phone, street, city, country, postalCode, cartItems]);

  // Totals computation
  const getSubtotal = () => {
    return cartItems.reduce((sum, item) => {
      const priceVal = parseFloat(String(item.product.price).replace("$", "")) || 0;
      return sum + priceVal * item.quantity;
    }, 0);
  };

  const getShipping = () => {
    const sub = getSubtotal();
    return sub > 250 || sub === 0 ? 0 : 25; // Free shipping over $250
  };

  const getTotal = () => {
    return getSubtotal() + getShipping();
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    if (cartItems.length === 0) {
      setErrorMsg("Your luxury collection bag is currently empty.");
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
        localStorage.removeItem("gharib_cart"); // Flush cart
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected system conflict occurred. Order processing failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
        <span className="text-[10px] tracking-[0.3em] text-[#2A1A0F]/50 uppercase font-black">
          SECURE CHECKOUT BACKPLANE...
        </span>
      </div>
    );
  }

  // Render checkout completion screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#2A1A0F] font-sans-luxury flex items-center justify-center p-6 select-none relative overflow-hidden">
        
        {/* Confetti golden glow ring elements */}
        <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-amber-500/5 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] bg-yellow-600/5 rounded-full blur-[150px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[500px] bg-white border border-[#E5DFD3] p-8 shadow-[0_20px_60px_rgba(140,98,57,0.05)] text-center relative group"
        >
          {/* Gilded corners */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-amber-600" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-amber-600" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-amber-600" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-amber-600" />

          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6 relative">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <Sparkles className="w-4 h-4 text-amber-500 absolute top-0 right-0 animate-bounce" />
          </div>

          <span className="text-[8px] tracking-[0.3em] text-amber-600 font-black uppercase block mb-1">
            TRANSACTION AUTHORIZED
          </span>
          <h1 className="text-2xl font-serif-luxury font-medium tracking-[0.1em] text-[#1C120C] uppercase mb-4">
            THANK YOU FOR YOUR ORDER
          </h1>

          <div className="bg-[#F3EFE9] border border-[#E5DFD3] p-5 my-6">
            <span className="text-[7.5px] tracking-widest text-[#7C6E65] font-black uppercase block mb-1">
              EXCLUSIVE REFERENCE CODE
            </span>
            <span className="text-lg font-black text-amber-800 tracking-[0.15em] uppercase font-mono">
              {orderSuccess}
            </span>
            <p className="text-[9px] tracking-widest text-[#5C4E46] uppercase font-semibold leading-relaxed mt-3 max-w-sm mx-auto">
              Our scent curators are already blending your selected extract de parfums. Tracking details will update live on your portal account.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link 
              href="/customer/dashboard?tab=tracking"
              className="bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black tracking-[0.25em] uppercase px-6 py-4 transition-all text-decoration-none"
            >
              TRACK ORDER LIVE
            </Link>
            <Link 
              href="/"
              className="border border-[#D8CFBF] hover:border-amber-600 bg-white text-[#2A1A0F] text-[9px] font-black tracking-[0.25em] uppercase px-6 py-4 transition-all text-decoration-none"
            >
              RETURN TO BOUTIQUE
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#2A1A0F] font-sans-luxury flex flex-col justify-between selection:bg-amber-100 selection:text-amber-900">
      
      {/* Top Simple Secure Nav */}
      <header className="w-full border-b border-[#E5DFD3] bg-[#F3EFE9] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[9px] tracking-[0.3em] text-[#7C6E65] hover:text-amber-600 uppercase font-black transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> BACK TO STORE
          </Link>

          <span className="text-[11px] tracking-[0.35em] text-[#1C120C] font-extrabold uppercase select-none">
            GHARIB CHECKOUT
          </span>

          <span className="text-[8.5px] tracking-[0.25em] text-amber-700 font-black flex items-center gap-1.5 select-none">
            <Lock className="w-3.5 h-3.5" /> SECURE CONCIERGE
          </span>
        </div>
      </header>

      {/* Main Form workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
          
          {/* LEFT 3 Columns: Checkout Form details */}
          <form onSubmit={handlePlaceOrder} className="lg:col-span-3 flex flex-col gap-8">
            
            {errorMsg && (
              <div className="text-[9.5px] tracking-widest text-red-600 uppercase font-black text-center border border-red-500/20 bg-red-500/5 py-4 px-6 flex items-center gap-2 justify-center leading-relaxed">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Stage 1: Customer Contact details */}
            <div className="bg-white border border-[#E5DFD3] p-6 shadow-[0_4px_20px_rgba(140,98,57,0.02)] relative">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-600" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-600" />
              
              <h3 className="text-[11px] tracking-[0.25em] text-amber-700 font-black uppercase mb-6 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-[9px] text-amber-800">1</span>
                CONTACT INFORMATION
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                    FIRST NAME
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C6E65]/50">
                      <User className="w-4 h-4" />
                    </span>
                    <input 
                      type="text" 
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Alex"
                      className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 pl-11 pr-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C120C] font-medium placeholder-[#A59B90] transition-all w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                    LAST NAME
                  </label>
                  <input 
                    type="text" 
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Mercer"
                    className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C120C] font-medium placeholder-[#A59B90] transition-all w-full"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C6E65]/50">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex.mercer@gmail.com"
                      className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 pl-11 pr-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C120C] font-medium placeholder-[#A59B90] transition-all w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                    PHONE NUMBER
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C6E65]/50">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input 
                      type="tel" 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+971 50 123 4567"
                      className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 pl-11 pr-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C120C] font-medium placeholder-[#A59B90] transition-all w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 2: Shipping Destination details */}
            <div className="bg-white border border-[#E5DFD3] p-6 shadow-[0_4px_20px_rgba(140,98,57,0.02)] relative">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-600" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-600" />

              <h3 className="text-[11px] tracking-[0.25em] text-amber-700 font-black uppercase mb-6 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-[9px] text-amber-800">2</span>
                SHIPPING DESTINATION
              </h3>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                    STREET ADDRESS
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C6E65]/50">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <input 
                      type="text" 
                      required
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Sheikh Zayed Road, Apt 1402"
                      className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 pl-11 pr-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C120C] font-medium placeholder-[#A59B90] transition-all w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                      CITY
                    </label>
                    <input 
                      type="text" 
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Dubai"
                      className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C120C] font-medium placeholder-[#A59B90] transition-all w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                      COUNTRY
                    </label>
                    <select 
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C120C] font-bold uppercase transition-all w-full cursor-pointer"
                    >
                      <option value="United Arab Emirates">United Arab Emirates</option>
                      <option value="Saudi Arabia">Saudi Arabia</option>
                      <option value="Qatar">Qatar</option>
                      <option value="Kuwait">Kuwait</option>
                      <option value="Oman">Oman</option>
                      <option value="Bahrain">Bahrain</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Switzerland">Switzerland</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="Italy">Italy</option>
                      <option value="Spain">Spain</option>
                      <option value="Netherlands">Netherlands</option>
                      <option value="Belgium">Belgium</option>
                      <option value="Sweden">Sweden</option>
                      <option value="Norway">Norway</option>
                      <option value="Japan">Japan</option>
                      <option value="South Korea">South Korea</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Australia">Australia</option>
                      <option value="New Zealand">New Zealand</option>
                      <option value="Hong Kong">Hong Kong</option>
                      <option value="Turkey">Turkey</option>
                      <option value="Egypt">Egypt</option>
                      <option value="Jordan">Jordan</option>
                      <option value="Lebanon">Lebanon</option>
                      <option value="Morocco">Morocco</option>
                      <option value="India">India</option>
                      <option value="China">China</option>
                      <option value="Malaysia">Malaysia</option>
                      <option value="Thailand">Thailand</option>
                      <option value="Brazil">Brazil</option>
                      <option value="Mexico">Mexico</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                      POSTAL / ZIP CODE
                    </label>
                    <input 
                      type="text" 
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="00000 / Zip Code"
                      className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 px-4 py-3.5 outline-none text-[11px] tracking-widest text-[#1C120C] font-medium placeholder-[#A59B90] transition-all w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 3: Secure Payment methods */}
            <div className="bg-white border border-[#E5DFD3] p-6 shadow-[0_4px_20px_rgba(140,98,57,0.02)] relative">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-600" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-600" />

              <h3 className="text-[11px] tracking-[0.25em] text-amber-700 font-black uppercase mb-6 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-[9px] text-amber-800">3</span>
                SECURE PAYMENT CHANNELS
              </h3>

              {/* Toggle switch */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cod")}
                  className={`py-4 border text-[9px] tracking-[0.25em] font-black uppercase transition-all duration-300 rounded-none flex flex-col items-center gap-2 cursor-pointer ${
                    paymentMethod === "cod" 
                      ? "border-amber-600 bg-amber-950/[0.04] text-amber-800" 
                      : "border-[#D8CFBF] hover:border-amber-600 bg-white text-[#5C4E46]"
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  CASH ON DELIVERY (COD)
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`py-4 border text-[9px] tracking-[0.25em] font-black uppercase transition-all duration-300 rounded-none flex flex-col items-center gap-2 cursor-pointer ${
                    paymentMethod === "card" 
                      ? "border-amber-600 bg-amber-950/[0.04] text-amber-800" 
                      : "border-[#D8CFBF] hover:border-amber-600 bg-white text-[#5C4E46]"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  CREDIT / DEBIT CARD
                </button>
              </div>

              <AnimatePresence mode="wait">
                {paymentMethod === "cod" ? (
                  <motion.div
                    key="cod-instructions"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-[#F3EFE9] border border-[#E5DFD3] p-4 text-[9px] tracking-widest text-[#5C4E46] uppercase font-bold leading-relaxed"
                  >
                    ✦ Exclusive Cash on Delivery service active for your region. Rest assured, you will pay our luxury white-glove shipping concierge in cash or via mobile terminal upon receiving your temperature-guaranteed cargo.
                  </motion.div>
                ) : (
                  <motion.div
                    key="card-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-6 pt-2"
                  >
                    {/* Interactive Glimmering Gold Card */}
                    <div className="w-full max-w-[340px] h-[190px] mx-auto bg-gradient-to-tr from-[#9B773C] via-[#DFBF83] to-[#A88243] border border-[#D5B06B] shadow-[0_12px_30px_rgba(184,134,11,0.2)] p-6 flex flex-col justify-between text-amber-900 font-sans tracking-widest relative overflow-hidden select-none mb-4 group">
                      {/* Diagonal shine line */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[7.5px] font-black tracking-[0.25em] uppercase text-amber-950/70">
                          LA MAISON GHARIB
                        </span>
                        <ShieldCheck className="w-5 h-5 text-amber-950/80" />
                      </div>

                      <div className="flex flex-col gap-1.5 my-2">
                        <span className="text-[6.5px] text-amber-950/60 uppercase font-black">CARD NUMBER</span>
                        <span className="font-mono text-base font-bold tracking-widest text-amber-950">
                          {cardNumber || "••••  ••••  ••••  ••••"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[6px] text-amber-950/60 uppercase font-black">CARD HOLDER</span>
                          <span className="text-[9px] font-black uppercase text-amber-950 truncate max-w-[170px]">
                            {cardName || "YOUR NAME"}
                          </span>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex flex-col gap-1 text-center">
                            <span className="text-[6px] text-amber-950/60 uppercase font-black">EXPIRES</span>
                            <span className="text-[9px] font-bold text-amber-950">
                              {cardExpiry || "MM/YY"}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 text-center">
                            <span className="text-[6px] text-amber-950/60 uppercase font-black">CVV</span>
                            <span className="text-[9px] font-bold text-amber-950">
                              {cardCvv || "•••"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                          CARD NUMBER
                        </label>
                        <input 
                          type="text" 
                          required={paymentMethod === "card"}
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) => {
                            // auto space credit card formatting
                            const val = e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
                            setCardNumber(val);
                          }}
                          placeholder="4242 4242 4242 4242"
                          className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 px-4 py-3 outline-none text-[11px] tracking-widest text-[#1C120C] font-semibold transition-all w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                          CARD HOLDER NAME
                        </label>
                        <input 
                          type="text" 
                          required={paymentMethod === "card"}
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="e.g. Alex Mercer"
                          className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 px-4 py-3 outline-none text-[11px] tracking-widest text-[#1C120C] font-semibold transition-all w-full uppercase"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                          EXPIRY DATE
                        </label>
                        <input 
                          type="text" 
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
                          className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 px-4 py-3 outline-none text-[11px] tracking-widest text-[#1C120C] font-semibold transition-all w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-[8.5px] tracking-[0.25em] text-[#7C6E65] uppercase font-black pl-0.5">
                          SECURITY CODE (CVV)
                        </label>
                        <input 
                          type="password" 
                          required={paymentMethod === "card"}
                          maxLength={3}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                          placeholder="123"
                          className="bg-white border border-[#D8CFBF] focus:border-amber-600 focus:bg-[#FAF9F6]/20 px-4 py-3 outline-none text-[11px] tracking-widest text-[#1C120C] font-semibold transition-all w-full"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Authorize button */}
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#8C6239] hover:bg-[#9E734A] disabled:opacity-50 text-white text-[10px] font-black tracking-[0.3em] uppercase py-5 transition-all duration-300 shadow-[0_6px_25px_rgba(140,98,57,0.15)] rounded-none cursor-pointer flex items-center justify-center gap-2.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AUTHENTICATING TRANSACTION...
                </>
              ) : (
                "AUTHORIZE BESPOKE SHIPMENT"
              )}
            </button>

          </form>

          {/* RIGHT 2 Columns: Cart breakdown summary */}
          <div className="lg:col-span-2 flex flex-col gap-6 sticky top-[92px]">
            
            <div className="bg-white border border-[#E5DFD3] p-6 shadow-[0_4px_20px_rgba(140,98,57,0.02)] relative">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-600" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-600" />

              <h3 className="text-[11px] tracking-[0.25em] text-[#1C120C] font-black uppercase mb-6 flex items-center gap-2.5">
                <ShoppingBag className="w-4.5 h-4.5 text-amber-700" />
                COLLECTION SUMMARY
              </h3>

              {cartItems.length === 0 ? (
                <div className="py-8 text-center text-[9px] tracking-widest text-[#7C6E65] uppercase font-bold">
                  Bespoke bag is empty.
                </div>
              ) : (
                <div className="flex flex-col gap-4 max-h-[360px] overflow-y-auto pr-1 mb-6 border-b border-[#E5DFD3] pb-6">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="flex gap-4 items-center justify-between">
                      <div className="flex gap-3 items-center">
                        <div className="w-12 h-12 bg-[#F3EFE9] border border-[#E5DFD3] p-1 flex-shrink-0 flex items-center justify-center">
                          <img 
                            src={item.product.image_url} 
                            className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
                            onError={(e: any) => {
                              e.target.src = "/catalog_initio_oud.png";
                            }}
                            alt={item.product.name} 
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[7.5px] tracking-widest text-[#7C6E65] font-black uppercase">{item.product.brand}</span>
                          <span className="text-[10px] tracking-widest font-black uppercase text-[#1C120C] line-clamp-1">{item.product.name}</span>
                          <span className="text-[8px] text-[#7C6E65] font-bold tracking-widest mt-0.5">SIZE: {item.selectedSize} &nbsp;•&nbsp; QTY: {item.quantity}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold font-sans text-amber-800 tracking-wider">
                        {formatCurrency((parseFloat(String(item.product.price).replace("$", "")) || 0) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Calculation stats */}
              <div className="flex flex-col gap-3 text-[9px] tracking-widest font-black uppercase border-b border-[#E5DFD3] pb-5 mb-5 text-[#5C4E46]">
                <div className="flex justify-between">
                  <span>CART SUB-TOTAL</span>
                  <span className="font-mono text-amber-900">{formatCurrency(getSubtotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span>WHITE-GLOVE SHIPPING</span>
                  <span className="font-mono text-amber-900">
                    {getShipping() === 0 ? "FREE" : formatCurrency(getShipping())}
                  </span>
                </div>
              </div>

              {/* Final Total */}
              <div className="flex justify-between items-center text-xs tracking-widest font-extrabold text-[#1C120C]">
                <span>TOTAL INVESTMENT</span>
                <span className="font-mono text-amber-800 text-lg font-black">
                  {formatCurrency(getTotal())}
                </span>
              </div>
            </div>

            <div className="bg-[#F3EFE9] border border-[#E5DFD3] p-4 text-[7.5px] tracking-[0.2em] text-[#7C6E65] uppercase font-bold text-center leading-relaxed">
              🛡️ ALL SECURE CHANNELS SECURED VIA MILITARY-GRADE AES-256 ENCRYPTION KEYS. DATA PRIVACY FULLY GUARANTEED.
            </div>

          </div>

        </div>
      </main>

      {/* Luxury Footer panel */}
      <footer className="w-full border-t border-[#E5DFD3] bg-[#F3EFE9] py-6 text-center select-none">
        <span className="text-[8px] tracking-[0.2em] text-[#7C6E65] uppercase font-bold">
          © {new Date().getFullYear()} GHARIB CHECKOUT HUB. ALL RIGHTS RESERVED.
        </span>
      </footer>

    </div>
  );
}
