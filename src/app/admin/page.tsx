"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, ShoppingBag, Users, Percent, Gift, Package, Layers, 
  MapPin, ClipboardList, RefreshCw, Megaphone, FileText, Globe, 
  BarChart3, Plus, Trash2, Edit2, Search, ArrowUpRight, ArrowDownRight, 
  Check, X, AlertCircle, ShieldAlert, Loader2, Sparkles, Filter
} from "lucide-react";
import { clientSafeSupabase } from "../lib/supabase";

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = searchParams.get("tab") || "dashboard";

  // Data states
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [trackingLogs, setTrackingLogs] = useState<any[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default to last 30 days
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Page interaction states
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Collections states
  const [collections, setCollections] = useState<any[]>([]);
  const [productCollections, setProductCollections] = useState<any[]>([]);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [selectedManageCollection, setSelectedManageCollection] = useState<any | null>(null);
  const [manageSearchTerm, setManageSearchTerm] = useState("");

  // Clean search filter when product mapping modal is closed
  useEffect(() => {
    if (!selectedManageCollection) {
      setManageSearchTerm("");
    }
  }, [selectedManageCollection]);
  
  // New Collection Form States
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newCollectionCoverImage, setNewCollectionCoverImage] = useState("/campaign-gold.png");
  const [newCollectionType, setNewCollectionType] = useState("manual");
  const [newCollectionRuleTag, setNewCollectionRuleTag] = useState("");

  // Drawer/Modal forms states
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [showAddGiftCard, setShowAddGiftCard] = useState(false);
  
  // New Scent Product Form
  const [newProductName, setNewProductName] = useState("");
  const [newProductBrand, setNewProductBrand] = useState("GHARIB PRIVÉ");
  const [newProductPrice, setNewProductPrice] = useState("");
  
  // Overhauled sizes and tags
  const [selectedSizesList, setSelectedSizesList] = useState<string[]>(["50ml", "100ml"]);
  const [customSizeInput, setCustomSizeInput] = useState("");
  const [newProductTags, setNewProductTags] = useState("");
  const [newProductOlfactory, setNewProductOlfactory] = useState("Woody & Oud");
  const [newProductTagline, setNewProductTagline] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  
  // New Discount Form
  const [discCode, setDiscCode] = useState("");
  const [discType, setDiscType] = useState("percentage");
  const [discValue, setDiscValue] = useState("");
  const [discMinReq, setDiscMinReq] = useState("0");
  
  // New Gift Card Form
  const [giftCode, setGiftCode] = useState("");
  const [giftBalance, setGiftBalance] = useState("");
  const [giftCustomer, setGiftCustomer] = useState("");

  // Edit stock overrides
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState("");

  // Quick seed loader
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const { data: pData } = await clientSafeSupabase.from("products").select("*");
        const { data: oData } = await clientSafeSupabase.from("orders").select("*");
        const { data: iData } = await clientSafeSupabase.from("inventory").select("*");
        const { data: cData } = await clientSafeSupabase.from("customers").select("*");
        const { data: dData } = await clientSafeSupabase.from("discounts").select("*");
        const { data: camData } = await clientSafeSupabase.from("marketing_campaigns").select("*");
        const { data: tData } = await clientSafeSupabase.from("order_tracking").select("*");
        const { data: abData } = await clientSafeSupabase.from("abandoned_carts").select("*");
        const { data: oiData } = await clientSafeSupabase.from("order_items").select("*");
        const { data: colData } = await clientSafeSupabase.from("collections").select("*");
        const { data: pcData } = await clientSafeSupabase.from("product_collections").select("*");

        setProducts(pData || []);
        setOrders(oData || []);
        setInventory(iData || []);
        setCustomers(cData || []);
        setDiscounts(dData || []);
        setCampaigns(camData || []);
        setTrackingLogs(tData || []);
        setAbandonedCarts(abData || []);
        setOrderItems(oiData || []);
        setCollections(colData || []);
        setProductCollections(pcData || []);
      } catch (err) {
        console.error("Dashboard seed retrieval failure", err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Add Product Action
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice) {
      triggerToast("Missing required perfume attributes.");
      return;
    }
    if (selectedSizesList.length === 0) {
      triggerToast("Please specify at least one flacon size.");
      return;
    }

    const price = parseFloat(newProductPrice);
    const sizes = selectedSizesList;
    const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 110;
    const parsedTags = newProductTags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);

    const newPerfume = {
      id: nextId,
      brand: newProductBrand.toUpperCase(),
      name: newProductName,
      price: price,
      sizes: sizes,
      image_url: "/catalog_initio_oud.png", // Default premium template
      description: newProductDescription || "An avante-garde olfactory masterpiece designed for elite collections.",
      tagline: newProductTagline || "Signature Extrait",
      olfactory_group: newProductOlfactory,
      tags: parsedTags,
      is_new: true,
      is_bestseller: false,
      is_featured_large: false
    };

    try {
      await clientSafeSupabase.from("products").insert(newPerfume);
      
      // Update inventory listings for this new product
      const newInventoryRows = sizes.map(size => ({
        product_id: nextId,
        size: size,
        stock_level: 50,
        low_stock_threshold: 10
      }));
      await clientSafeSupabase.from("inventory").insert(newInventoryRows);

      setProducts(prev => [newPerfume, ...prev]);
      setInventory(prev => [...newInventoryRows, ...prev]);

      // Refetch mapping states since local storage/trigger mapped matching smart collections automatically!
      const { data: pcData } = await clientSafeSupabase.from("product_collections").select("*");
      setProductCollections(pcData || []);

      triggerToast(`Successfully registered ${newProductName} under brand ${newProductBrand}.`);
      setShowAddProduct(false);
      
      // Reset inputs
      setNewProductName("");
      setNewProductPrice("");
      setNewProductTagline("");
      setNewProductDescription("");
      setNewProductTags("");
      setSelectedSizesList(["50ml", "100ml"]);
    } catch (err) {
      triggerToast("Failed to write to database kernel.");
    }
  };

  const getProductsInCollection = (collectionId: string) => {
    const mappings = productCollections.filter((pc: any) => pc.collection_id === collectionId);
    return products.filter((p: any) => mappings.some((m: any) => m.product_id === p.id));
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionTitle) {
      triggerToast("Collection title is required.");
      return;
    }
    const id = newCollectionTitle.toLowerCase().replace(/\s+/g, "-");
    
    const rules = newCollectionType === "automated" 
      ? [{ field: "tag", relation: "equals", value: newCollectionRuleTag.trim().toLowerCase() }]
      : [];

    const newCol = {
      id,
      title: newCollectionTitle,
      description: newCollectionDescription || "A curated luxury selection.",
      cover_image: newCollectionCoverImage || "/campaign-gold.png",
      type: newCollectionType,
      rules
    };

    try {
      await clientSafeSupabase.from("collections").insert(newCol);
      setCollections(prev => [...prev, newCol]);
      
      // Sync mappings state immediately
      const { data: pcData } = await clientSafeSupabase.from("product_collections").select("*");
      setProductCollections(pcData || []);

      triggerToast(`Successfully created ${newCollectionType} collection: ${newCollectionTitle}`);
      setShowAddCollection(false);
      
      // Reset inputs
      setNewCollectionTitle("");
      setNewCollectionDescription("");
      setNewCollectionRuleTag("");
      setNewCollectionType("manual");
    } catch (err) {
      triggerToast("Failed to create collection.");
    }
  };

  // Add Discount Action
  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discCode || !discValue) {
      triggerToast("Please input a code and discount value.");
      return;
    }

    const value = parseFloat(discValue);
    const newPromo = {
      id: discounts.length + 1,
      code: discCode.toUpperCase().replace(/\s+/g, ""),
      title: `${discCode.toUpperCase()} Campaign`,
      type: discType,
      value: value,
      min_requirement: parseFloat(discMinReq) || 0.00,
      usage_limit: null,
      usage_count: 0,
      is_active: true
    };

    try {
      await clientSafeSupabase.from("discounts").insert(newPromo);
      setDiscounts(prev => [newPromo, ...prev]);
      triggerToast(`Registered discount code ${newPromo.code} successfully.`);
      setShowAddDiscount(false);
      setDiscCode("");
      setDiscValue("");
      setDiscMinReq("0");
    } catch (err) {
      triggerToast("Discount registration failed.");
    }
  };

  // Generate Gift Card Action
  const handleCreateGiftCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftCode || !giftBalance) {
      triggerToast("Specify card code and allocation balance.");
      return;
    }
    triggerToast(`Gift Card [${giftCode.toUpperCase()}] allocated with $${parseFloat(giftBalance).toFixed(2)} for ${giftCustomer || "Anonymous"}.`);
    setShowAddGiftCard(false);
    setGiftCode("");
    setGiftBalance("");
    setGiftCustomer("");
  };

  // Save Stock Edit Action
  const handleSaveStock = async (prodId: number, size: string) => {
    const numVal = parseInt(editingStockVal);
    if (isNaN(numVal)) {
      triggerToast("Invalid quantity format.");
      return;
    }

    try {
      await clientSafeSupabase
        .from("inventory")
        .update({ stock_level: numVal })
        .match({ product_id: prodId, size: size });

      setInventory(prev => prev.map(inv => {
        if (inv.product_id === prodId && inv.size === size) {
          return { ...inv, stock_level: numVal };
        }
        return inv;
      }));

      triggerToast(`Inventory stock adjusted successfully.`);
      setEditingStockId(null);
    } catch (err) {
      triggerToast("Failed to write quantity adjustment.");
    }
  };

  // Change Order Status Action
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: string) => {
    try {
      await clientSafeSupabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId);

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus });
      }

      // Add a visual tracking log for this update
      const newLog = {
        id: trackingLogs.length + 1,
        order_id: orderId,
        status: nextStatus === "accepted" ? "Accepted" : 
                nextStatus === "fulfilled" ? "Fulfilled" : 
                nextStatus === "out_for_delivery" ? "Out for Delivery" : 
                nextStatus === "delivered" ? "Delivered" : "Order Placed",
        location: nextStatus === "delivered" ? "Client Residence" :
                  nextStatus === "out_for_delivery" ? "Local Carrier Hub" : 
                  nextStatus === "fulfilled" ? "Dubai Distribution Port" : "Dubai Headquarters",
        description: nextStatus === "accepted" ? "Order has been reviewed and accepted by the administrative team." :
                     nextStatus === "fulfilled" ? "Your fragrance package has been carefully blended, packaged, and fulfilled by our scent curators." :
                     nextStatus === "out_for_delivery" ? "Your shipment is out for delivery with our express carrier." :
                     nextStatus === "delivered" ? "Your exclusive perfume package has been successfully delivered." : 
                     "Your exclusive order selection has been received.",
        updated_at: new Date().toISOString()
      };

      await clientSafeSupabase.from("order_tracking").insert(newLog);
      setTrackingLogs(prev => [...prev, newLog]);

      triggerToast(`Order ${orderId} upgraded to ${nextStatus}.`);
    } catch (err) {
      triggerToast("Status synchronization failed.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-[10px] tracking-[0.3em] text-[#EAE3DB]/50 uppercase font-black">
          Decrypting Shopify Core Databases...
        </span>
      </div>
    );
  }

  // Helper to filter and aggregate order details for executive reporting
  const generateExecutiveReport = () => {
    const periodOrders = orders.filter(o => {
      const orderDate = new Date(o.created_at);
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T23:59:59");
      return orderDate >= start && orderDate <= end;
    });

    const totalRevenue = periodOrders.reduce((sum, o) => sum + (parseFloat(String(o.total_price)) || 0), 0);
    const ordersCount = periodOrders.length;
    const aov = ordersCount > 0 ? totalRevenue / ordersCount : 0;

    // Filter statuses
    const pendingOrders = periodOrders.filter(o => o.status === "pending" || o.status === "accepted");
    const completedOrders = periodOrders.filter(o => o.status === "delivered" || o.status === "fulfilled" || o.status === "shipped");
    
    const pendingValue = pendingOrders.reduce((sum, o) => sum + (parseFloat(String(o.total_price)) || 0), 0);
    const completedValue = completedOrders.reduce((sum, o) => sum + (parseFloat(String(o.total_price)) || 0), 0);

    // Olfactory analytics / Best seller for this period
    const periodOrderIds = periodOrders.map(o => o.id);
    const periodItems = orderItems.filter(item => periodOrderIds.includes(item.order_id));
    
    // Calculate best selling product ID
    const productQuantities: { [key: number]: number } = {};
    periodItems.forEach(item => {
      productQuantities[item.product_id] = (productQuantities[item.product_id] || 0) + item.quantity;
    });

    let bestSellerId: number | null = null;
    let maxQty = 0;
    Object.keys(productQuantities).forEach(idStr => {
      const id = parseInt(idStr);
      if (productQuantities[id] > maxQty) {
        maxQty = productQuantities[id];
        bestSellerId = id;
      }
    });

    const bestSeller = products.find(p => p.id === bestSellerId) || { name: "No Sales Recorded", brand: "Gharib Privé" };
    
    return {
      periodOrders,
      totalRevenue,
      ordersCount,
      aov,
      pendingOrdersCount: pendingOrders.length,
      pendingValue,
      completedOrdersCount: completedOrders.length,
      completedValue,
      bestSellerName: bestSeller.name,
      bestSellerBrand: bestSeller.brand,
      totalItemsSold: periodItems.reduce((sum, item) => sum + item.quantity, 0)
    };
  };

  const reportData = generateExecutiveReport();

  const handleDownloadCSV = () => {
    const { periodOrders } = reportData;
    if (periodOrders.length === 0) {
      triggerToast("No orders available to export for this period.");
      return;
    }

    // Build CSV Headers
    let csvContent = "Order ID,Email,Total Price,Status,Recipient Name,Street,City,Country,Postal Code,Created At\n";

    // Build CSV Rows
    periodOrders.forEach(o => {
      let shippingName = "";
      let street = "";
      let city = "";
      let country = "";
      let postalCode = "";

      if (o.shipping_address) {
        try {
          const addr = typeof o.shipping_address === "string" ? JSON.parse(o.shipping_address) : o.shipping_address;
          shippingName = addr.name || "";
          street = addr.street || "";
          city = addr.city || "";
          country = addr.country || "";
          postalCode = addr.postal_code || "";
        } catch (e) {
          console.error(e);
        }
      }

      // Escape quotes and commas
      const cleanName = `"${shippingName.replace(/"/g, '""')}"`;
      const cleanStreet = `"${street.replace(/"/g, '""')}"`;
      const cleanCity = `"${city.replace(/"/g, '""')}"`;
      const cleanCountry = `"${country.replace(/"/g, '""')}"`;
      const cleanPostal = `"${postalCode.replace(/"/g, '""')}"`;

      csvContent += `${o.id},${o.email},${o.total_price},${o.status},${cleanName},${cleanStreet},${cleanCity},${cleanCountry},${cleanPostal},${o.created_at}\n`;
    });

    // Create Download Trigger
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Gharib_Prive_Executive_Report_${startDate}_to_${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerToast(`Successfully generated and downloaded CSV report for period: ${startDate} to ${endDate}`);
  };

  // Filter items based on active search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.olfactory_group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = orders.filter(o => 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = customers.filter(c => 
    c.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAbandonedCarts = abandonedCarts.filter(ac => 
    (ac.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ac.first_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ac.last_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ac.phone || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative z-10 w-full">
      
      {/* Dynamic Scent Alert Toasts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 bg-[#0c0502] border border-amber-500/40 text-amber-100 text-[10px] tracking-[0.2em] uppercase font-bold py-4.5 px-6 shadow-[0_12px_45px_rgba(0,0,0,0.85)] z-50 rounded-none flex items-center gap-3 max-w-[420px]"
          >
            <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW PANEL ROUTER */}
      <div className="flex flex-col gap-8">
        
        {/* ========================================================
            TAB: HOME DASHBOARD
            ======================================================== */}
        {currentTab === "dashboard" && (
          <div className="flex flex-col gap-8">
            
            {/* Operator Welcome Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  CORE BACKPLANE RUNNING
                </span>
                <h1 className="text-2xl font-serif-luxury font-medium text-[#EAE3DB] uppercase tracking-wider">
                  OPERATIONS DESK
                </h1>
              </div>
              
              <div className="bg-amber-950/15 border border-amber-600/25 px-4 py-2 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-[8px] tracking-[0.25em] text-amber-400 font-black uppercase">
                  LA MAISON PREMIUM METRICS
                </span>
              </div>
            </div>

            {/* Shopify KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="bg-white/[0.015] border border-white/[0.04] p-5.5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/[0.02] to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black">
                    GROSS REVENUE
                  </span>
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-2xl font-serif-luxury text-amber-200 tracking-wide font-medium">
                  $31,580.00
                </h3>
                <div className="flex items-center gap-1 mt-2 text-[9px] tracking-wider font-bold text-green-400 uppercase">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>+18.4% VS LAST MONTH</span>
                </div>
              </div>

              <div className="bg-white/[0.015] border border-white/[0.04] p-5.5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/[0.02] to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black">
                    TOTAL ORDERS
                  </span>
                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-2xl font-serif-luxury text-[#EAE3DB] tracking-wide font-medium">
                  428
                </h3>
                <div className="flex items-center gap-1 mt-2 text-[9px] tracking-wider font-bold text-green-400 uppercase">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>+9.2% VS LAST MONTH</span>
                </div>
              </div>

              <div className="bg-white/[0.015] border border-white/[0.04] p-5.5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/[0.02] to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black">
                    CONVERSION RATE
                  </span>
                  <Percent className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-2xl font-serif-luxury text-[#EAE3DB] tracking-wide font-medium">
                  3.42%
                </h3>
                <div className="flex items-center gap-1 mt-2 text-[9px] tracking-wider font-bold text-red-400 uppercase">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>-0.12% VS YESTERDAY</span>
                </div>
              </div>

              <div className="bg-white/[0.015] border border-white/[0.04] p-5.5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/[0.02] to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black">
                    ACTIVE VISITORS
                  </span>
                  <Users className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-2xl font-serif-luxury text-amber-200 tracking-wide font-medium animate-pulse">
                  24
                </h3>
                <div className="flex items-center gap-1 mt-2 text-[9px] tracking-wider font-bold text-amber-500 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span>LIVE TRAFFIC ONLINE</span>
                </div>
              </div>

            </div>

            {/* Quick Scent SVG Revenue Chart & Operator Notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* SVG vector chart mapping months */}
              <div className="lg:col-span-2 bg-white/[0.015] border border-white/[0.04] p-6">
                <h4 className="text-[10px] tracking-[0.2em] text-[#EAE3DB]/50 uppercase font-black mb-6">
                  LA MAISON REVENUE PROJECTION (ROLLING 6 MONTHS)
                </h4>
                <div className="w-full h-[220px] relative flex items-end">
                  <svg className="w-full h-full" viewBox="0 0 500 200">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d97706" stopOpacity="0.25"/>
                        <stop offset="100%" stopColor="#d97706" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    
                    {/* Horizontal grid lines */}
                    <line x1="20" y1="30" x2="480" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                    <line x1="20" y1="80" x2="480" y2="80" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                    <line x1="20" y1="130" x2="480" y2="130" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                    <line x1="20" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5"/>

                    {/* Polyline chart nodes */}
                    <path 
                      d="M 30 150 Q 110 110 190 120 T 350 50 T 470 35" 
                      fill="none" 
                      stroke="#f59e0b" 
                      strokeWidth="2.5" 
                    />
                    
                    <path 
                      d="M 30 150 Q 110 110 190 120 T 350 50 T 470 35 L 470 170 L 30 170 Z" 
                      fill="url(#chartGrad)" 
                    />

                    {/* Nodes labels */}
                    <circle cx="30" cy="150" r="4" fill="#fbbf24" stroke="#070301" strokeWidth="1"/>
                    <circle cx="190" cy="120" r="4" fill="#fbbf24" stroke="#070301" strokeWidth="1"/>
                    <circle cx="350" cy="50" r="4" fill="#fbbf24" stroke="#070301" strokeWidth="1"/>
                    <circle cx="470" cy="35" r="4" fill="#fbbf24" stroke="#070301" strokeWidth="1"/>
                  </svg>
                  
                  {/* Visual Months axis */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between px-6 text-[8px] tracking-widest text-[#EAE3DB]/30 uppercase font-black select-none">
                    <span>JAN</span>
                    <span>FEB</span>
                    <span>MAR</span>
                    <span>APR</span>
                    <span>MAY</span>
                    <span>JUN</span>
                  </div>
                </div>
              </div>

              {/* Real-time system alert feed */}
              <div className="bg-[#090503] border border-white/[0.04] p-6 flex flex-col justify-between">
                <div>
                  <h4 className="text-[10px] tracking-[0.2em] text-amber-500 uppercase font-black mb-4">
                    OPERATIONAL EVENTS REGISTER
                  </h4>
                  <div className="flex flex-col gap-3.5">
                    
                    <div className="border-l-2 border-amber-600 pl-3 py-1 flex flex-col gap-0.5">
                      <span className="text-[9px] tracking-widest text-[#EAE3DB] font-black uppercase">
                        PENDING APPROVAL — ORD-9924
                      </span>
                      <p className="text-[8.5px] text-[#EAE3DB]/50 uppercase font-bold">
                        Customer Layla Hasan is awaiting checkout verification.
                      </p>
                    </div>

                    <div className="border-l-2 border-yellow-500 pl-3 py-1 flex flex-col gap-0.5">
                      <span className="text-[9px] tracking-widest text-[#EAE3DB] font-black uppercase">
                        LOW STOCK TELEMETRY ALERT
                      </span>
                      <p className="text-[8.5px] text-[#EAE3DB]/50 uppercase font-bold">
                        Mystic Oud (100ml) is below safety levels (8 units remaining).
                      </p>
                    </div>

                    <div className="border-l-2 border-green-500 pl-3 py-1 flex flex-col gap-0.5">
                      <span className="text-[9px] tracking-widest text-[#EAE3DB] font-black uppercase">
                        PURCHASE ORDER IN TRANSIT
                      </span>
                      <p className="text-[8.5px] text-[#EAE3DB]/50 uppercase font-bold">
                        Glass flacons inbound from Grasse Labs (ETA 24 Hours).
                      </p>
                    </div>

                  </div>
                </div>

                <Link 
                  href="/admin?tab=orders" 
                  className="mt-8 border border-amber-600/35 hover:border-amber-500 text-amber-400 text-[8.5px] tracking-[0.25em] font-black uppercase py-3 text-center transition-all block decoration-none"
                >
                  RESOLVE PENDING EVENTS
                </Link>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================
            TAB: ORDERS REGISTRY
            ======================================================== */}
        {currentTab === "orders" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  OPERATIONS DATABASE
                </span>
                <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                  ORDERS REGISTRY
                </h2>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE3DB]/30">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by Order ID or Client email..."
                  className="bg-white/[0.02] border border-white/[0.08] focus:border-amber-500/50 rounded-none pl-10 pr-4 py-2.5 text-[9px] tracking-widest text-[#EAE3DB] outline-none placeholder-[#EAE3DB]/20 w-full font-bold uppercase"
                />
              </div>
            </div>

            {/* Orders Table list */}
            <div className="bg-white/[0.015] border border-white/[0.04] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black bg-white/[0.01]">
                    <th className="p-4 pl-6">ORDER ID</th>
                    <th className="p-4">CLIENT NAME & EMAIL</th>
                    <th className="p-4">DATE PLACED</th>
                    <th className="p-4 text-right">TOTAL PRICE</th>
                    <th className="p-4 text-center">STATUS BADGE</th>
                    <th className="p-4 pr-6 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#EAE3DB]/30 font-black tracking-widest">
                        NO TRANSACTION RECORDS ALIGN WITH FILTER
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                        <td className="p-4 pl-6 text-amber-400 font-black">{order.id}</td>
                        <td className="p-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[#EAE3DB] font-bold">{order.shipping_address?.name}</span>
                            <span className="text-[8px] text-[#EAE3DB]/40 font-bold tracking-widest lowercase">{order.email}</span>
                          </div>
                        </td>
                        <td className="p-4 text-[#EAE3DB]/50">
                          {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </td>
                        <td className="p-4 text-right text-amber-200 font-bold font-sans">
                          ${parseFloat(order.total_price).toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-[7px] tracking-widest px-2.5 py-1 border font-black ${
                            order.status === "delivered" ? "border-green-800/40 bg-green-950/15 text-green-400" :
                            order.status === "out_for_delivery" ? "border-indigo-800/40 bg-indigo-950/15 text-indigo-400" :
                            order.status === "fulfilled" ? "border-amber-600/40 bg-amber-950/20 text-amber-400" :
                            order.status === "accepted" ? "border-cyan-800/40 bg-cyan-950/15 text-cyan-400" :
                            "border-neutral-700/40 bg-neutral-800/15 text-neutral-400"
                          }`}>
                            {order.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] text-[8px] tracking-[0.2em] font-black uppercase px-3 py-1.5 transition-all cursor-pointer"
                            >
                              VIEW INVOICE
                            </button>
                            
                            {/* Fast status updater dropdown */}
                            <select 
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                              className="bg-black border border-white/[0.08] text-[#EAE3DB] text-[8px] tracking-widest font-black uppercase px-2 py-1 outline-none cursor-pointer"
                            >
                              <option value="pending">PENDING (ORDER PLACED)</option>
                              <option value="accepted">ACCEPTED</option>
                              <option value="fulfilled">FULFILLED</option>
                              <option value="out_for_delivery">OUT FOR DELIVERY</option>
                              <option value="delivered">DELIVERED</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ORDER INVOICE MODAL SHEET */}
            <AnimatePresence>
              {selectedOrder && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-[#090503] border border-amber-600/30 w-full max-w-[500px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
                  >
                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />
                    
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-500 uppercase">
                        INVOICE TELEMETRY — {selectedOrder.id}
                      </h4>
                      <button 
                        onClick={() => setSelectedOrder(null)}
                        className="text-[#EAE3DB]/40 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-6 text-[10px] tracking-wider font-semibold uppercase">
                      
                      <div className="border-b border-white/[0.05] pb-4 flex justify-between">
                        <div>
                          <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/30 uppercase block mb-1">CLIENT BILLING</span>
                          <span className="text-[#EAE3DB] font-bold block">{selectedOrder.shipping_address?.name}</span>
                          <span className="lowercase text-[8px] text-[#EAE3DB]/50 block">{selectedOrder.email}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/30 uppercase block mb-1">SHIPPING LINE</span>
                          <span className="text-[#EAE3DB] font-bold block">{selectedOrder.shipping_address?.street}</span>
                          <span className="text-[#EAE3DB] block">{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.country}</span>
                        </div>
                      </div>

                      {/* Items Mock details */}
                      <div>
                        <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/30 uppercase block mb-3">ITEMIZED DECANTS</span>
                        <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                          <span>Bespoke Extrait signature decant (100ml)</span>
                          <span className="font-sans text-amber-200">${parseFloat(selectedOrder.total_price).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Tracking assignment */}
                      <div className="flex flex-col gap-4 bg-white/[0.01] border border-white/[0.04] p-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-amber-500 font-black uppercase">
                            SHIPMENT TELEMETRY TRACKING NUMBER
                          </label>
                          <input 
                            type="text" 
                            defaultValue={selectedOrder.tracking_number || ""}
                            placeholder="e.g. DHL-DXB-99882"
                            className="bg-black border border-white/[0.08] text-white text-[9px] tracking-widest px-3 py-2 outline-none w-full font-bold uppercase"
                            id="drawer-tracking-input"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-amber-500 font-black uppercase">
                            CARRIER TRACKING URL (OPTIONAL)
                          </label>
                          <input 
                            type="text" 
                            defaultValue={selectedOrder.tracking_url || ""}
                            placeholder="e.g. https://www.dhl.com/..."
                            className="bg-black border border-white/[0.08] text-white text-[9px] tracking-widest px-3 py-2 outline-none w-full font-medium"
                            id="drawer-tracking-url-input"
                          />
                        </div>

                        <button 
                          onClick={async () => {
                            const inputNum = document.getElementById("drawer-tracking-input") as HTMLInputElement;
                            const inputUrl = document.getElementById("drawer-tracking-url-input") as HTMLInputElement;
                            if (inputNum && inputUrl) {
                              const trackingNumber = inputNum.value.trim();
                              const trackingUrl = inputUrl.value.trim();
                              
                              try {
                                await clientSafeSupabase
                                  .from("orders")
                                  .update({ 
                                    tracking_number: trackingNumber || null,
                                    tracking_url: trackingUrl || null 
                                  })
                                  .eq("id", selectedOrder.id);
                                  
                                setOrders(prev => prev.map(o => o.id === selectedOrder.id 
                                  ? { ...o, tracking_number: trackingNumber || null, tracking_url: trackingUrl || null } 
                                  : o
                                ));
                                
                                setSelectedOrder({ 
                                  ...selectedOrder, 
                                  tracking_number: trackingNumber || null, 
                                  tracking_url: trackingUrl || null 
                                });
                                
                                triggerToast(`Tracking credentials saved for order ${selectedOrder.id}`);
                              } catch (err) {
                                triggerToast("Failed to write tracking updates to database.");
                              }
                            }
                          }}
                          className="w-full bg-amber-600 text-white hover:bg-amber-500 text-[8.5px] tracking-[0.2em] uppercase font-black py-3 mt-1 cursor-pointer transition-all"
                        >
                          SAVE TRACKING DETAILS
                        </button>
                      </div>

                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* ========================================================
            TAB: PRODUCTS & COLLECTIONS
            ======================================================== */}
        {currentTab === "products" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  PRODUCT CATALOGUE BASE
                </span>
                <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                  PRODUCTS & COLLECTIONS
                </h2>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                {/* Search Bar */}
                <div className="relative w-full md:w-60">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE3DB]/30">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search perfumes or brands..."
                    className="bg-white/[0.02] border border-white/[0.08] focus:border-amber-500/50 rounded-none pl-10 pr-4 py-2 text-[9px] tracking-widest text-[#EAE3DB] outline-none placeholder-[#EAE3DB]/20 w-full font-bold uppercase"
                  />
                </div>

                <button
                  onClick={() => setShowAddProduct(true)}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-[8.5px] tracking-[0.25em] font-black uppercase px-4 py-3 flex items-center gap-2 rounded-none transition-all flex-shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ADD PRODUCT
                </button>
              </div>
            </div>

            {/* Products grid table */}
            <div className="bg-white/[0.015] border border-white/[0.04] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black bg-white/[0.01]">
                    <th className="p-4 pl-6">SCENT FLACON</th>
                    <th className="p-4">OLFACTORY GROUP</th>
                    <th className="p-4 text-center">AVAILABLE SIZES</th>
                    <th className="p-4 text-right">BASE PRICE</th>
                    <th className="p-4 text-center">BADGES</th>
                    <th className="p-4 pr-6 text-center">MANAGEMENT</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#EAE3DB]/30 font-black tracking-widest">
                        NO PERFUMES FOUND MATCHING SEARCH PROTOCOL
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                        
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-amber-950/20 border border-white/[0.04] flex items-center justify-center p-1.5">
                              <img 
                                src={p.image_url} 
                                className="w-full h-full object-contain"
                                onError={(e: any) => {
                                  e.target.src = "/catalog_initio_oud.png";
                                }}
                                alt={p.name} 
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] text-amber-500 font-black tracking-widest">{p.brand}</span>
                              <span className="text-[#EAE3DB] font-bold">{p.name}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-amber-100">{p.olfactory_group}</td>
                        <td className="p-4 text-center text-[#EAE3DB]/50">
                          {p.sizes.join(" • ")}
                        </td>
                        <td className="p-4 text-right text-amber-200 font-bold font-sans">
                          ${parseFloat(p.price).toFixed(2)}
                        </td>
                        
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {p.is_new && (
                              <span className="text-[6.5px] border border-amber-600/35 bg-amber-950/20 text-amber-400 px-2 py-0.5 font-black tracking-widest">NEW</span>
                            )}
                            {p.is_bestseller && (
                              <span className="text-[6.5px] border border-yellow-600/30 bg-yellow-950/15 text-yellow-400 px-2 py-0.5 font-black tracking-widest">BESTSELLER</span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 pr-6 text-center">
                          <button
                            onClick={() => {
                              setProducts(prev => prev.filter(prod => prod.id !== p.id));
                              triggerToast(`Deregistered perfume ${p.name} from global catalogue.`);
                            }}
                            className="text-[#EAE3DB]/30 hover:text-red-400 transition-colors p-1"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ADD PRODUCT DRAWER MODAL */}
            <AnimatePresence>
              {showAddProduct && (
                <div 
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setShowAddProduct(false);
                    }
                  }}
                  className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6 cursor-pointer"
                >
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-[#090503] border border-amber-600/35 w-full max-w-[500px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative cursor-default"
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-400 uppercase">
                        ADD NEW LUXURY SCENT
                      </h4>
                      <button onClick={() => setShowAddProduct(false)} className="text-[#EAE3DB]/40 hover:text-white cursor-pointer">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateProduct} className="flex flex-col gap-4 text-[10px] tracking-wider font-semibold uppercase">
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">BRAND DESIGNATION</label>
                          <input 
                            type="text" 
                            value={newProductBrand}
                            onChange={(e) => setNewProductBrand(e.target.value)}
                            required
                            className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">SCENT COLLECTION NAME</label>
                          <input 
                            type="text" 
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            required
                            placeholder="e.g. Amber Royale"
                            className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">DECANT BASE PRICE ($)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={newProductPrice}
                            onChange={(e) => setNewProductPrice(e.target.value)}
                            required
                            placeholder="195.00"
                            className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">OLFATIVE NOTE GROUP</label>
                          <select
                            value={newProductOlfactory}
                            onChange={(e) => setNewProductOlfactory(e.target.value)}
                            className="bg-[#090503] border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-white cursor-pointer"
                          >
                            <option value="Woody & Oud">WOODY & OUD</option>
                            <option value="Floral & Sweet">FLORAL & SWEET</option>
                            <option value="Fresh & Aquatic">FRESH & AQUATIC</option>
                            <option value="Amber & Oriental">AMBER & ORIENTAL</option>
                          </select>
                        </div>
                      </div>

                      {/* Overhauled flacon sizes with visual pills and custom input */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">FLACON SIZES (SELECT PROTOCOL)</label>
                        <div className="flex flex-wrap gap-2 mb-1">
                          {["30ml", "50ml", "75ml", "90ml", "100ml", "250ml"].map(size => {
                            const isSelected = selectedSizesList.includes(size);
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedSizesList(prev => prev.filter(s => s !== size));
                                  } else {
                                    setSelectedSizesList(prev => [...prev, size]);
                                  }
                                }}
                                className={`px-3 py-1.5 text-[8px] font-black tracking-widest transition-all cursor-pointer ${
                                  isSelected 
                                    ? "bg-[#8C6239] text-white border border-[#8C6239]" 
                                    : "bg-white/5 text-[#EAE3DB]/60 border border-white/[0.08] hover:border-amber-600/35 hover:text-white"
                                }`}
                              >
                                {size}
                              </button>
                            );
                          })}
                        </div>
                        
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="CUSTOM SIZE (E.G. 15ML)"
                            value={customSizeInput}
                            onChange={(e) => setCustomSizeInput(e.target.value)}
                            className="bg-white/5 border border-white/[0.08] px-3.5 py-2 outline-none focus:border-amber-500 font-bold uppercase text-[8.5px] tracking-widest flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = customSizeInput.trim().toUpperCase();
                              if (val && !selectedSizesList.includes(val)) {
                                setSelectedSizesList(prev => [...prev, val]);
                                setCustomSizeInput("");
                              }
                            }}
                            className="bg-[#8C6239] hover:bg-[#9E734A] text-white text-[8px] font-black tracking-widest px-4 py-2 flex-shrink-0 cursor-pointer"
                          >
                            + ADD CUSTOM
                          </button>
                        </div>
                        
                        {selectedSizesList.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="text-[7px] text-[#EAE3DB]/40 font-black self-center mr-1">SELECTED:</span>
                            {selectedSizesList.map(size => (
                              <span 
                                key={size} 
                                onClick={() => setSelectedSizesList(prev => prev.filter(s => s !== size))}
                                className="text-[6.5px] border border-amber-600/35 bg-amber-950/20 text-amber-400 px-2 py-0.5 font-black tracking-widest uppercase cursor-pointer hover:bg-red-950/30 hover:border-red-500/20 hover:text-red-400 flex items-center gap-1"
                                title="Click to remove"
                              >
                                {size} <X className="w-1.5 h-1.5" />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Product Tags input for automated collection matching */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">SEARCH TAGS (COMMA SEPARATED)</label>
                        <input 
                          type="text" 
                          value={newProductTags}
                          onChange={(e) => setNewProductTags(e.target.value)}
                          placeholder="e.g. memoir, noble, wood, oud"
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-[9px] tracking-widest placeholder-[#EAE3DB]/20"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">MARKETING TAGLINE</label>
                        <input 
                          type="text" 
                          value={newProductTagline}
                          onChange={(e) => setNewProductTagline(e.target.value)}
                          placeholder="e.g. Celestial Oud Accord"
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">OLFACRY STORY DETAILS</label>
                        <textarea 
                          value={newProductDescription}
                          onChange={(e) => setNewProductDescription(e.target.value)}
                          placeholder="Describe scent narrative, top, and base notes..."
                          rows={3}
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full resize-none font-sans"
                        />
                      </div>

                      <button
                        type="submit"
                        className="bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black tracking-[0.25em] py-4 w-full mt-4 cursor-pointer"
                      >
                        PUBLISH TO GLOBAL CATALOGUE
                      </button>

                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* ========================================================
            TAB: INVENTORY TRACKER
            ======================================================== */}
        {currentTab === "inventory" && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                SHOPIFY FLACON REGISTER
              </span>
              <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                INVENTORY TRACKER
              </h2>
            </div>

            {/* Inventory table */}
            <div className="bg-white/[0.015] border border-white/[0.04] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black bg-white/[0.01]">
                    <th className="p-4 pl-6">SCENT ELEMENT</th>
                    <th className="p-4 text-center">SIZE VARIANT</th>
                    <th className="p-4 text-center">QUANTITY LEVEL</th>
                    <th className="p-4 text-center">SAFETY THRESHOLD</th>
                    <th className="p-4 text-center">STATUS</th>
                    <th className="p-4 pr-6 text-center">STOCK ADJUSTMENT</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {inventory.map((inv, index) => {
                    const productObj = products.find(p => p.id === inv.product_id);
                    if (!productObj) return null;
                    
                    const isLowStock = inv.stock_level <= inv.low_stock_threshold;
                    const compositeId = `${inv.product_id}-${inv.size}`;
                    const isEditing = editingStockId === compositeId;

                    return (
                      <tr key={index} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                        
                        <td className="p-4 pl-6 font-bold text-[#EAE3DB]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7.5px] text-amber-500 font-black tracking-widest">{productObj.brand}</span>
                            <span>{productObj.name}</span>
                          </div>
                        </td>

                        <td className="p-4 text-center text-amber-100">{inv.size}</td>
                        
                        <td className="p-4 text-center">
                          {isEditing ? (
                            <input 
                              type="number" 
                              defaultValue={inv.stock_level}
                              onChange={(e) => setEditingStockVal(e.target.value)}
                              className="bg-black border border-amber-600 text-white text-[10px] w-20 px-2 py-1 text-center font-bold"
                              id={`stock-input-${compositeId}`}
                            />
                          ) : (
                            <span className={`font-black ${isLowStock ? "text-red-400" : "text-amber-200"}`}>
                              {inv.stock_level} UNITS
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-center text-[#EAE3DB]/40">
                          {inv.low_stock_threshold} UNITS
                        </td>

                        <td className="p-4 text-center">
                          <span className={`text-[7px] tracking-widest font-black px-2.5 py-1 border ${
                            isLowStock 
                              ? "border-red-800/40 bg-red-950/15 text-red-400" 
                              : "border-green-800/40 bg-green-950/15 text-green-400"
                          }`}>
                            {isLowStock ? "LOW SAFETY STOCK" : "IN STOCK SECUR"}
                          </span>
                        </td>

                        <td className="p-4 pr-6 text-center">
                          {isEditing ? (
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleSaveStock(inv.product_id, inv.size)}
                                className="bg-amber-600 hover:bg-amber-500 text-white text-[7.5px] tracking-widest font-black uppercase px-2.5 py-1.5 transition-all cursor-pointer"
                              >
                                SAVE
                              </button>
                              <button
                                onClick={() => setEditingStockId(null)}
                                className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[7.5px] tracking-widest font-black uppercase px-2.5 py-1.5 transition-all cursor-pointer"
                              >
                                CANCEL
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingStockId(compositeId);
                                setEditingStockVal(inv.stock_level.toString());
                              }}
                              className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] text-[8px] tracking-[0.2em] font-black uppercase px-3.5 py-1.5 transition-all cursor-pointer"
                            >
                              ADJUST
                            </button>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: STOCK TRANSFERS
            ======================================================== */}
        {currentTab === "transfers" && (
          <div className="bg-white border border-[#E5DFD3] p-6 shadow-[0_4px_20px_rgba(140,98,57,0.02)] max-w-3xl">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  LOGISTICS BACKPLANE
                </span>
                <h3 className="text-[12px] font-serif-luxury text-[#1C120C] uppercase tracking-wider">
                  STOCK TRANSFERS
                </h3>
              </div>
              <span className="text-[7px] border border-amber-600/35 bg-amber-500/10 text-amber-800 px-2 py-0.5 font-black">INTER-DEPOT</span>
            </div>

            <div className="flex flex-col gap-4">
              
              <div className="bg-[#FAF9F6] border border-[#E5DFD3] p-4 flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-widest font-black text-amber-800 uppercase font-mono">XFER-00129</span>
                  <span className="text-[8.5px] text-[#7C6E65] font-bold uppercase">From: Dubai Freezone Warehouse</span>
                  <span className="text-[8.5px] text-[#2A1A0F] font-bold uppercase">To: Jumeirah Luxury Scent Boutique</span>
                </div>
                <span className="text-[8px] border border-green-600/35 bg-green-500/10 text-green-700 px-2 py-1 font-bold">COMPLETED</span>
              </div>

              <div className="bg-[#FAF9F6] border border-[#E5DFD3] p-4 flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-widest font-black text-amber-800 uppercase font-mono">XFER-00130</span>
                  <span className="text-[8.5px] text-[#7C6E65] font-bold uppercase">From: Jebel Ali Depot</span>
                  <span className="text-[8.5px] text-[#2A1A0F] font-bold uppercase">To: Dubai Mall Scent Pavilion</span>
                </div>
                <span className="text-[8px] border border-blue-600/35 bg-blue-500/10 text-blue-700 px-2 py-1 font-bold">DISPATCHING</span>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================
            TAB: GIFT CARDS VAULT
            ======================================================== */}
        {currentTab === "gift_cards" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  PRIVÉ EXCLUSIVE VAULT
                </span>
                <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                  GIFT CARDS VAULT
                </h2>
              </div>

              <button
                onClick={() => setShowAddGiftCard(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white text-[8.5px] tracking-[0.25em] font-black uppercase px-4 py-3 flex items-center gap-2 rounded-none transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                CREATE GIFT CARD
              </button>
            </div>

            {/* Gift Card Display Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div className="bg-[#0e0703] border border-amber-600/35 p-6 relative group overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex justify-between items-start mb-6">
                  <span className="text-[8px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black">ACTIVE VIP ASSET</span>
                  <Gift className="w-5 h-5 text-amber-500" />
                </div>
                
                <h4 className="text-[14px] tracking-[0.25em] font-bold text-[#EAE3DB] mb-2 uppercase">
                  VIP-GOLDEN-GIFT-500
                </h4>
                
                <span className="text-2xl font-serif-luxury text-amber-200 tracking-wider font-semibold block mb-4">
                  $500.00
                </span>
                
                <div className="border-t border-white/[0.04] pt-4 text-[8.5px] tracking-wider text-[#EAE3DB]/40 font-bold uppercase">
                  Holder: <span className="text-white">layla.hasan@dubai.ae</span>
                </div>
              </div>

              <div className="bg-[#0e0703] border border-white/[0.04] p-6 relative group overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                  <span className="text-[8px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black">ACTIVE VIP ASSET</span>
                  <Gift className="w-5 h-5 text-amber-500/50" />
                </div>
                
                <h4 className="text-[14px] tracking-[0.25em] font-bold text-[#EAE3DB] mb-2 uppercase">
                  EID-SCENT-VAULT-200
                </h4>
                
                <span className="text-2xl font-serif-luxury text-amber-200 tracking-wider font-semibold block mb-4">
                  $200.00
                </span>
                
                <div className="border-t border-white/[0.04] pt-4 text-[8.5px] tracking-wider text-[#EAE3DB]/40 font-bold uppercase">
                  Holder: <span className="text-white">alex.mercer@gmail.com</span>
                </div>
              </div>

            </div>

            {/* ADD GIFT CARD MODAL */}
            <AnimatePresence>
              {showAddGiftCard && (
                <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-[#090503] border border-amber-600/35 w-full max-w-[420px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-400 uppercase">
                        CREATE GIFT CARD
                      </h4>
                      <button onClick={() => setShowAddGiftCard(false)} className="text-[#EAE3DB]/40 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateGiftCard} className="flex flex-col gap-4 text-[10px] tracking-wider font-semibold uppercase">
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">GIFT CARD KEY CODE</label>
                        <input 
                          type="text" 
                          value={giftCode}
                          onChange={(e) => setGiftCode(e.target.value)}
                          placeholder="e.g. SPECIAL-PRIVÉ-SCENT"
                          required
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">INITIAL BALANCE ($)</label>
                        <input 
                          type="number" 
                          value={giftBalance}
                          onChange={(e) => setGiftBalance(e.target.value)}
                          placeholder="300.00"
                          required
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">CLIENT EMAIL (OPTIONAL)</label>
                        <input 
                          type="email" 
                          value={giftCustomer}
                          onChange={(e) => setGiftCustomer(e.target.value)}
                          placeholder="client@vip.com"
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full lowercase"
                        />
                      </div>

                      <button
                        type="submit"
                        className="bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black tracking-[0.25em] py-4 w-full mt-4"
                      >
                        GENERATE GIFT CARD ASSET
                      </button>

                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* ========================================================
            TAB: CUSTOMERS CATALOG
            ======================================================== */}
        {currentTab === "customers" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  PRIVÉ MEMBER LIST
                </span>
                <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                  CUSTOMERS CATALOG
                </h2>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE3DB]/30">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by Client name or email..."
                  className="bg-white/[0.02] border border-white/[0.08] focus:border-amber-500/50 rounded-none pl-10 pr-4 py-2.5 text-[9px] tracking-widest text-[#EAE3DB] outline-none placeholder-[#EAE3DB]/20 w-full font-bold uppercase"
                />
              </div>
            </div>

            {/* Customers table */}
            <div className="bg-white/[0.015] border border-white/[0.04] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black bg-white/[0.01]">
                    <th className="p-4 pl-6">CLIENT NAME</th>
                    <th className="p-4">EMAIL PATHWAY</th>
                    <th className="p-4">TELEPHONE</th>
                    <th className="p-4 text-right">LIFETIME CLV INVESTMENT</th>
                    <th className="p-4 text-center">ORDER TICKETS</th>
                    <th className="p-4 pr-6">OPERATOR MEMORANDUM NOTES</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#EAE3DB]/30 font-black tracking-widest">
                        NO CLIENT PROFILES ALIGN WITH FILTER
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                        
                        <td className="p-4 pl-6 font-bold text-amber-400">
                          {c.first_name} {c.last_name}
                          {c.is_admin && (
                            <span className="text-[6.5px] border border-amber-600/35 bg-amber-950/20 text-amber-400 px-2 py-0.5 font-black tracking-widest ml-2">ADMIN</span>
                          )}
                        </td>

                        <td className="p-4 lowercase font-bold">{c.email}</td>
                        <td className="p-4 text-[#EAE3DB]/60">{c.phone || "No phone linked"}</td>
                        
                        <td className="p-4 text-right text-amber-200 font-bold font-sans">
                          ${parseFloat(c.total_spent).toFixed(2)}
                        </td>

                        <td className="p-4 text-center text-amber-100 font-bold font-sans">
                          {c.orders_count} ORDERS
                        </td>

                        <td className="p-4 pr-6 text-[#EAE3DB]/60 normal-case italic font-sans text-[11px] max-w-[250px] truncate">
                          {c.note}
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: ABANDONED CARTS REGISTRY
            ======================================================== */}
        {currentTab === "abandoned_carts" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  CONCIERGE RECOVERY PORTAL
                </span>
                <h2 className="text-xl font-serif-luxury text-[#1C120C] uppercase tracking-wider">
                  ABANDONED CARTS REGISTRY
                </h2>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7C6E65]/50">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by Client name or email..."
                  className="bg-white border border-[#D8CFBF] focus:border-amber-600 pl-10 pr-4 py-2.5 text-[9px] tracking-widest text-[#1C120C] outline-none placeholder-[#A59B90] w-full font-bold uppercase"
                />
              </div>
            </div>

            {/* Carts list */}
            <div className="bg-white border border-[#E5DFD3] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E5DFD3] text-[8.5px] tracking-[0.2em] text-[#7C6E65] uppercase font-black bg-[#F3EFE9]">
                    <th className="p-4 pl-6">CLIENT DETAILS</th>
                    <th className="p-4">CURATION ITEMS</th>
                    <th className="p-4">DESTINATION</th>
                    <th className="p-4 text-right">TOTAL ATTEMPTED</th>
                    <th className="p-4 text-center">FUNNEL STATUS</th>
                    <th className="p-4 text-center">ABANDONED DATE</th>
                    <th className="p-4 pr-6 text-center">RECOVERY ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#2A1A0F]/80">
                  {filteredAbandonedCarts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#7C6E65]/50 font-black tracking-widest">
                        NO ABANDONED SESSIONS RECORDED
                      </td>
                    </tr>
                  ) : (
                    filteredAbandonedCarts.map((ac) => (
                      <tr key={ac.id} className="border-b border-[#E5DFD3] hover:bg-amber-950/[0.01] transition-colors">
                        
                        <td className="p-4 pl-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-[#1C120C]">
                              {ac.first_name || "Anonymous"} {ac.last_name || ""}
                            </span>
                            <span className="lowercase text-[9px] text-[#7C6E65] mt-0.5">{ac.email}</span>
                            <span className="text-[8px] text-[#7C6E65] mt-0.5">{ac.phone || "No phone linked"}</span>
                          </div>
                        </td>

                        <td className="p-4 max-w-[280px]">
                          <div className="flex flex-col gap-1.5 font-sans normal-case text-[11px] text-[#5C4E46]">
                            {Array.isArray(ac.cart_items) ? ac.cart_items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between gap-4 border-b border-dashed border-[#E5DFD3] pb-1 last:border-b-0">
                                <span className="font-black text-[#1C120C] uppercase tracking-wider text-[9px]">
                                  {item.brand} {item.name} <span className="text-[8px] text-[#7C6E65]">({item.size})</span>
                                </span>
                                <span className="text-amber-800 font-bold text-[10px]">
                                  QTY {item.quantity} • ${item.unit_price}.00
                                </span>
                              </div>
                            )) : "Empty bag details"}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="flex flex-col text-[8.5px] text-[#7C6E65]">
                            {ac.shipping_address ? (
                              <>
                                <span className="truncate max-w-[150px] font-bold text-[#2A1A0F]">{ac.shipping_address.street}</span>
                                <span>{ac.shipping_address.city}, {ac.shipping_address.country}</span>
                              </>
                            ) : "No address specified"}
                          </div>
                        </td>
                        
                        <td className="p-4 text-right text-amber-800 font-bold font-sans text-xs">
                          ${parseFloat(String(ac.total_price || 0)).toFixed(2)}
                        </td>

                        <td className="p-4 text-center">
                          {ac.converted ? (
                            <span className="inline-block text-[7px] border border-green-600/35 bg-green-500/10 text-green-700 px-2.5 py-1 font-black tracking-widest">
                              CONVERTED ({ac.converted_order_id || "COMPLETED"})
                            </span>
                          ) : (
                            <span className="inline-block text-[7px] border border-amber-600/35 bg-amber-500/10 text-amber-800 px-2.5 py-1 font-black tracking-widest animate-pulse">
                              OUTSTANDING
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-center text-[#7C6E65] text-[9px] font-sans">
                          {ac.created_at ? new Date(ac.created_at).toLocaleString() : "Unknown"}
                        </td>

                        <td className="p-4 pr-6 text-center">
                          <button
                            onClick={() => triggerToast(`Recovery curation proposal dispatched to ${ac.email}!`)}
                            className="bg-amber-600 hover:bg-amber-500 text-white text-[8px] font-black tracking-[0.2em] uppercase px-3 py-2 cursor-pointer transition-all duration-300 rounded-none disabled:opacity-50"
                            disabled={ac.converted}
                          >
                            SEND PROPOSAL
                          </button>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: EXECUTIVE REPORTS
            ======================================================== */}
        {currentTab === "reports" && (
          <div className="flex flex-col gap-8">
            
            {/* Header with quick selectors */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  FINANCIAL & PERFORMANCE METRICS
                </span>
                <h2 className="text-xl font-serif-luxury text-[#1C120C] uppercase tracking-wider">
                  EXECUTIVE REPORTS ENGINE
                </h2>
              </div>

              {/* Date pickers and Export action */}
              <div className="flex flex-wrap items-end gap-6 w-full lg:w-auto">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[7.5px] tracking-widest text-[#7C6E65] uppercase font-black pl-0.5">START DATE</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white border border-[#D8CFBF] focus:border-amber-600 px-3.5 py-2.5 text-[9px] tracking-[0.2em] text-[#1C120C] font-extrabold outline-none cursor-pointer uppercase rounded-none"
                    />
                  </div>
                  <span className="text-[8px] font-black text-[#7C6E65] mt-4">TO</span>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[7.5px] tracking-widest text-[#7C6E65] uppercase font-black pl-0.5">END DATE</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-white border border-[#D8CFBF] focus:border-amber-600 px-3.5 py-2.5 text-[9px] tracking-[0.2em] text-[#1C120C] font-extrabold outline-none cursor-pointer uppercase rounded-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleDownloadCSV}
                  className="bg-black hover:bg-amber-950 text-white text-[9px] font-black tracking-[0.25em] uppercase px-5 py-3.5 transition-all duration-300 rounded-none shadow-[0_4px_15px_rgba(0,0,0,0.15)] flex items-center gap-2 cursor-pointer h-[38px] items-center"
                >
                  <FileText className="w-3.5 h-3.5" />
                  EXPORT EXCEL CSV
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Gross Sales */}
              <div className="bg-white border border-[#E5DFD3] p-5 shadow-[0_4px_20px_rgba(140,98,57,0.02)] relative">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-600" />
                <span className="text-[7.5px] tracking-[0.2em] text-[#7C6E65] uppercase font-black block mb-2">PERIOD GROSS REVENUE</span>
                <span className="text-2xl font-black font-sans text-amber-800 tracking-tight">
                  ${reportData.totalRevenue.toLocaleString()}.00
                </span>
                <p className="text-[8px] text-[#7C6E65] tracking-widest uppercase font-bold mt-2.5">
                  FROM {reportData.ordersCount} REGISTERED TRANSACTIONS
                </p>
              </div>

              {/* Card 2: AOV */}
              <div className="bg-white border border-[#E5DFD3] p-5 shadow-[0_4px_20px_rgba(140,98,57,0.02)] relative">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-600" />
                <span className="text-[7.5px] tracking-[0.2em] text-[#7C6E65] uppercase font-black block mb-2">AVERAGE ORDER VALUE (AOV)</span>
                <span className="text-2xl font-black font-sans text-amber-800 tracking-tight">
                  ${Math.round(reportData.aov)}.00
                </span>
                <p className="text-[8px] text-[#7C6E65] tracking-widest uppercase font-bold mt-2.5">
                  AVERAGE INVESTMENT VALUE PER SCENT
                </p>
              </div>

              {/* Card 3: Items Sold */}
              <div className="bg-white border border-[#E5DFD3] p-5 shadow-[0_4px_20px_rgba(140,98,57,0.02)] relative">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-600" />
                <span className="text-[7.5px] tracking-[0.2em] text-[#7C6E65] uppercase font-black block mb-2">DECANTED BOTTLES SOLD</span>
                <span className="text-2xl font-black font-sans text-amber-800 tracking-tight">
                  {reportData.totalItemsSold} UNITS
                </span>
                <p className="text-[8px] text-[#7C6E65] tracking-widest uppercase font-bold mt-2.5">
                  {reportData.ordersCount} COMPLETED DELIVERIES / PROCESSES
                </p>
              </div>

              {/* Card 4: Best Seller Scent */}
              <div className="bg-white border border-[#E5DFD3] p-5 shadow-[0_4px_20px_rgba(140,98,57,0.02)] relative">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-600" />
                <span className="text-[7.5px] tracking-[0.2em] text-[#7C6E65] uppercase font-black block mb-2">OLFACTORY BEST-SELLER</span>
                <span className="text-sm font-black text-[#1C120C] uppercase tracking-widest truncate block mt-1.5">
                  {reportData.bestSellerName}
                </span>
                <p className="text-[8px] text-[#7C6E65] tracking-widest uppercase font-bold mt-2">
                  BY THE HOUSE OF {reportData.bestSellerBrand}
                </p>
              </div>

            </div>

            {/* Financial Performance breakdown table */}
            <div className="flex flex-col gap-4">
              <span className="text-[9px] tracking-[0.25em] text-[#1C120C] font-black uppercase">
                TRANSACTION LEDGER DETAILS ({startDate} TO {endDate})
              </span>

              <div className="bg-white border border-[#E5DFD3] overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#E5DFD3] text-[8.5px] tracking-[0.2em] text-[#7C6E65] uppercase font-black bg-[#F3EFE9]">
                      <th className="p-4 pl-6">ORDER REFERENCE ID</th>
                      <th className="p-4">CLIENT IDENTITY</th>
                      <th className="p-4">FULFILLMENT DESTINATION</th>
                      <th className="p-4 text-center">ORDER STATUS</th>
                      <th className="p-4 text-right">TOTAL TRANSACTION</th>
                      <th className="p-4 pr-6 text-center">CREATION DATE</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#2A1A0F]/80">
                    {reportData.periodOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#7C6E65]/50 font-black tracking-widest">
                          NO TRANSACTIONS RECORDED DURING THIS PERIOD
                        </td>
                      </tr>
                    ) : (
                      reportData.periodOrders.map((o) => {
                        let clientName = o.email;
                        let shippingCity = "";
                        let shippingCountry = "";

                        if (o.shipping_address) {
                          try {
                            const addr = typeof o.shipping_address === "string" ? JSON.parse(o.shipping_address) : o.shipping_address;
                            clientName = addr.name || o.email;
                            shippingCity = addr.city || "";
                            shippingCountry = addr.country || "";
                          } catch (e) {
                            console.error(e);
                          }
                        }

                        return (
                          <tr key={o.id} className="border-b border-[#E5DFD3] hover:bg-amber-950/[0.01] transition-colors">
                            
                            <td className="p-4 pl-6 font-bold text-amber-800 font-mono tracking-widest text-[11px]">
                              {o.id}
                            </td>

                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-[#1C120C]">{clientName}</span>
                                <span className="lowercase text-[9px] text-[#7C6E65] mt-0.5">{o.email}</span>
                              </div>
                            </td>

                            <td className="p-4">
                              <span className="text-[#2A1A0F] font-bold">
                                {shippingCity ? `${shippingCity}, ${shippingCountry}` : "No address specified"}
                              </span>
                            </td>

                            <td className="p-4 text-center">
                              <span className={`inline-block text-[7px] border px-2.5 py-1 font-black tracking-widest ${
                                o.status === "delivered" 
                                  ? "border-green-600/35 bg-green-500/10 text-green-700"
                                  : o.status === "pending"
                                  ? "border-amber-600/35 bg-amber-500/10 text-amber-800"
                                  : "border-yellow-600/35 bg-yellow-500/10 text-yellow-800"
                              }`}>
                                {o.status}
                              </span>
                            </td>

                            <td className="p-4 text-right text-amber-800 font-bold font-sans text-xs">
                              ${parseFloat(String(o.total_price || 0)).toFixed(2)}
                            </td>

                            <td className="p-4 pr-6 text-center text-[#7C6E65] text-[9px] font-sans">
                              {o.created_at ? new Date(o.created_at).toLocaleString() : "Unknown"}
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================
            TAB: MARKETING CAMPAIGNS
            ======================================================== */}
        {currentTab === "marketing" && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                AD CORE CAMPAIGNS
              </span>
              <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                MARKETING CAMPAIGNS
              </h2>
            </div>

            {/* Campaign lists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {campaigns.map((camp) => (
                <div key={camp.id} className="bg-white/[0.015] border border-white/[0.04] p-5.5 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[8px] tracking-[0.2em] text-amber-500 uppercase font-black">{camp.channel}</span>
                    <span className={`text-[6.5px] tracking-widest px-2 py-0.5 border font-black ${
                      camp.status === "active" ? "border-green-800/40 bg-green-950/15 text-green-400" : "border-neutral-700/40 bg-neutral-800/15 text-neutral-400"
                    }`}>{camp.status}</span>
                  </div>

                  <h4 className="text-[11px] tracking-widest font-black text-[#EAE3DB] uppercase mb-4">
                    {camp.name}
                  </h4>

                  <div className="grid grid-cols-2 gap-4 border-t border-white/[0.04] pt-4 text-[9px] tracking-wider text-[#EAE3DB]/60 font-bold uppercase">
                    <div>
                      <span className="text-[7.5px] text-[#EAE3DB]/30 block mb-0.5">BUDGET ALLOC</span>
                      <span className="font-sans text-[#EAE3DB] font-bold">${parseFloat(camp.budget).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[7.5px] text-[#EAE3DB]/30 block mb-0.5">ATTRIB SALES</span>
                      <span className="font-sans text-amber-200 font-bold">${parseFloat(camp.attributed_sales).toFixed(2)}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-[7.5px] text-[#EAE3DB]/30 block mb-0.5">IMPRESSIONS</span>
                      <span className="font-sans text-[#EAE3DB] font-bold">{camp.impressions.toLocaleString()}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-[7.5px] text-[#EAE3DB]/30 block mb-0.5">CLICKS REGISTER</span>
                      <span className="font-sans text-[#EAE3DB] font-bold">{camp.clicks.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: DISCOUNT CODES
            ======================================================== */}
        {currentTab === "discounts" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  PROMOTIONAL VAULT KEY
                </span>
                <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                  DISCOUNT CODES
                </h2>
              </div>

              <button
                onClick={() => setShowAddDiscount(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white text-[8.5px] tracking-[0.25em] font-black uppercase px-4 py-3 flex items-center gap-2 rounded-none transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                GENERATE DISCOUNT
              </button>
            </div>

            {/* Discount Codes Table */}
            <div className="bg-white/[0.015] border border-white/[0.04] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black bg-white/[0.01]">
                    <th className="p-4 pl-6">PROMO CODE</th>
                    <th className="p-4">DEDUCTION RATIO</th>
                    <th className="p-4 text-center">MIN PURCHASE REQUIREMENT</th>
                    <th className="p-4 text-center">USAGE TICKET METRICS</th>
                    <th className="p-4 text-center">STATUS BADGE</th>
                    <th className="p-4 pr-6 text-center">DISMISS</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {discounts.map((disc) => (
                    <tr key={disc.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                      <td className="p-4 pl-6 text-amber-400 font-black">{disc.code}</td>
                      <td className="p-4">
                        {disc.type === "percentage" ? `${disc.value}% OFF` : `$${disc.value} OFF`}
                      </td>
                      <td className="p-4 text-center text-[#EAE3DB]/50 font-sans">
                        ${parseFloat(disc.min_requirement).toFixed(2)}
                      </td>
                      <td className="p-4 text-center text-amber-100 font-sans">
                        {disc.usage_count} REDEMPTIONS
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-[7px] tracking-widest px-2.5 py-1 border font-black ${
                          disc.is_active ? "border-green-800/40 bg-green-950/15 text-green-400" : "border-neutral-700/40 bg-neutral-800/15 text-neutral-400"
                        }`}>{disc.is_active ? "PROMO ACTIVE" : "EXPIRED"}</span>
                      </td>
                      <td className="p-4 pr-6 text-center">
                        <button
                          onClick={() => {
                            setDiscounts(prev => prev.filter(d => d.id !== disc.id));
                            triggerToast(`Deregistered discount ${disc.code}.`);
                          }}
                          className="text-[#EAE3DB]/30 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ADD DISCOUNT MODAL */}
            <AnimatePresence>
              {showAddDiscount && (
                <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-[#090503] border border-amber-600/35 w-full max-w-[420px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-400 uppercase">
                        GENERATE DISCOUNT CODE
                      </h4>
                      <button onClick={() => setShowAddDiscount(false)} className="text-[#EAE3DB]/40 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateDiscount} className="flex flex-col gap-4 text-[10px] tracking-wider font-semibold uppercase">
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">PROMOTIONAL CODE</label>
                        <input 
                          type="text" 
                          value={discCode}
                          onChange={(e) => setDiscCode(e.target.value)}
                          placeholder="e.g. DUBAISUMMER20"
                          required
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">REDUCTION RATIO TYPE</label>
                          <select
                            value={discType}
                            onChange={(e) => setDiscType(e.target.value)}
                            className="bg-[#090503] border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-white cursor-pointer"
                          >
                            <option value="percentage">PERCENTAGE (%)</option>
                            <option value="fixed_amount">FIXED DEDUCTION ($)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">DEDUCTION MAGNITUDE</label>
                          <input 
                            type="number" 
                            value={discValue}
                            onChange={(e) => setDiscValue(e.target.value)}
                            placeholder="e.g. 15"
                            required
                            className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">MINIMUM BASKET INVESTMENT ($)</label>
                        <input 
                          type="number" 
                          value={discMinReq}
                          onChange={(e) => setDiscMinReq(e.target.value)}
                          placeholder="e.g. 100.00"
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                        />
                      </div>

                      <button
                        type="submit"
                        className="bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black tracking-[0.25em] py-4 w-full mt-4"
                      >
                        GENERATE ACTIVE PROMO KEY
                      </button>

                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* ========================================================
            TAB: CMS PAGES & CONTENT
            ======================================================== */}
        {currentTab === "content" && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                CMS BACKPLANE DESK
              </span>
              <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                CMS PAGES & CONTENT
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Blog articles editorial */}
              <div className="bg-[#090503] border border-white/[0.04] p-6">
                <div className="flex justify-between items-center mb-6 border-b border-white/[0.04] pb-4">
                  <h4 className="text-[10px] tracking-[0.2em] text-amber-500 font-black uppercase">EDITORIAL BLOG ARTICLES</h4>
                  <button className="text-[8px] border border-white/[0.08] hover:border-amber-500 hover:text-amber-400 px-3 py-1.5 font-bold uppercase">NEW BLOG DRAFT</button>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="bg-white/[0.01] border border-white/[0.03] p-4 flex justify-between items-start">
                    <div>
                      <span className="text-[8px] tracking-widest text-[#EAE3DB]/40 font-black block mb-1">CMS PUBLISHED</span>
                      <h5 className="text-[11px] tracking-widest text-[#EAE3DB] font-bold uppercase mb-1">The Ritual of Scent layering</h5>
                      <p className="text-[9px] text-[#EAE3DB]/60 lowercase max-w-[280px] truncate">Understanding noble agarwood formulations...</p>
                    </div>
                    <Edit2 className="w-4 h-4 text-[#EAE3DB]/30 hover:text-amber-500 cursor-pointer" />
                  </div>

                  <div className="bg-white/[0.01] border border-white/[0.03] p-4 flex justify-between items-start">
                    <div>
                      <span className="text-[8px] tracking-widest text-amber-500/70 font-black block mb-1">CMS DRAFT RESERV</span>
                      <h5 className="text-[11px] tracking-widest text-[#EAE3DB] font-bold uppercase mb-1">Bespoke Amber Droplets from Grasse</h5>
                      <p className="text-[9px] text-[#EAE3DB]/60 lowercase max-w-[280px] truncate">Unveiling our summer alchemy catalog...</p>
                    </div>
                    <Edit2 className="w-4 h-4 text-[#EAE3DB]/30 hover:text-amber-500 cursor-pointer" />
                  </div>
                </div>
              </div>

              {/* CMS pages */}
              <div className="bg-[#090503] border border-white/[0.04] p-6">
                <div className="flex justify-between items-center mb-6 border-b border-white/[0.04] pb-4">
                  <h4 className="text-[10px] tracking-[0.2em] text-amber-500 font-black uppercase">CORE STAT PAGES</h4>
                  <button className="text-[8px] border border-white/[0.08] hover:border-amber-500 hover:text-amber-400 px-3 py-1.5 font-bold uppercase">NEW STAT PAGE</button>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="bg-white/[0.01] border border-white/[0.03] p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] tracking-widest text-[#EAE3DB] font-bold uppercase">About La Maison Privé</span>
                      <span className="text-[7.5px] text-green-400 font-bold block mt-1 tracking-widest">LIVE PAGE ACTIVE</span>
                    </div>
                    <Edit2 className="w-4 h-4 text-[#EAE3DB]/30 hover:text-amber-500 cursor-pointer" />
                  </div>

                  <div className="bg-white/[0.01] border border-white/[0.03] p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] tracking-widest text-[#EAE3DB] font-bold uppercase">Shipping & Scent Guarding Protocols</span>
                      <span className="text-[7.5px] text-green-400 font-bold block mt-1 tracking-widest">LIVE PAGE ACTIVE</span>
                    </div>
                    <Edit2 className="w-4 h-4 text-[#EAE3DB]/30 hover:text-amber-500 cursor-pointer" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================
            TAB: GLOBAL MARKETS
            ======================================================== */}
        {currentTab === "markets" && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                MULTINATIONAL PARAMETERS
              </span>
              <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                GLOBAL REGIONS & MARKETS
              </h2>
            </div>

            {/* Markets table */}
            <div className="bg-white/[0.015] border border-white/[0.04] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black bg-white/[0.01]">
                    <th className="p-4 pl-6">REGION DESIGNATION</th>
                    <th className="p-4">BASE CURRENCY</th>
                    <th className="p-4 text-center">LOCALIZATION LANGUAGE</th>
                    <th className="p-4 text-right">EXCHANGE CONVERSION SCALE</th>
                    <th className="p-4 pr-6 text-center">MARKET STATUS</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  
                  <tr className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 pl-6 font-bold text-amber-400">MIDDLE EAST GULF (UAE)</td>
                    <td className="p-4">AED (United Arab Emirates Dirham)</td>
                    <td className="p-4 text-center text-[#EAE3DB]/60">ARABIC / ENGLISH</td>
                    <td className="p-4 text-right text-[#EAE3DB] font-bold font-sans">1.00 AED BASE</td>
                    <td className="p-4 pr-6 text-center">
                      <span className="text-[6.5px] border border-green-800/40 bg-green-950/15 text-green-400 px-2 py-0.5 font-black tracking-widest">ACTIVE MARKET</span>
                    </td>
                  </tr>

                  <tr className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 pl-6 font-bold text-[#EAE3DB]">UNITED STATES (USA)</td>
                    <td className="p-4">USD (United States Dollar)</td>
                    <td className="p-4 text-center text-[#EAE3DB]/60">ENGLISH</td>
                    <td className="p-4 text-right text-amber-200 font-bold font-sans">0.27 USD SCALE</td>
                    <td className="p-4 pr-6 text-center">
                      <span className="text-[6.5px] border border-green-800/40 bg-green-950/15 text-green-400 px-2 py-0.5 font-black tracking-widest">ACTIVE MARKET</span>
                    </td>
                  </tr>

                  <tr className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 pl-6 font-bold text-[#EAE3DB]">EUROPE UNION (EU)</td>
                    <td className="p-4">EUR (Euro)</td>
                    <td className="p-4 text-center text-[#EAE3DB]/60">FRENCH / GERMAN</td>
                    <td className="p-4 text-right text-amber-200 font-bold font-sans">0.25 EUR SCALE</td>
                    <td className="p-4 pr-6 text-center">
                      <span className="text-[6.5px] border border-green-800/40 bg-green-950/15 text-green-400 px-2 py-0.5 font-black tracking-widest">ACTIVE MARKET</span>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: ANALYTICS REPORTS
            ======================================================== */}
        {currentTab === "analytics" && (
          <div className="flex flex-col gap-8">
            <div>
              <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                OPERATIONAL CHARTS & TELEMETRY
              </span>
              <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                ANALYTICS REPORTS
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Funnel conversion */}
              <div className="bg-white/[0.015] border border-white/[0.04] p-6">
                <h4 className="text-[10px] tracking-[0.2em] text-amber-500 uppercase font-black mb-6">CURATED VISITATION FUNNEL SCALE</h4>
                
                <div className="flex flex-col gap-4 text-[10px] font-bold tracking-wider uppercase">
                  
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span>1. Storefront Visitors (100%)</span>
                      <span className="text-[#EAE3DB]/50">14,200 Operators</span>
                    </div>
                    <div className="w-full h-3 bg-white/5 relative">
                      <div className="absolute top-0 left-0 bottom-0 bg-amber-600 w-full" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span>2. Perfume Selection clicks (56%)</span>
                      <span className="text-[#EAE3DB]/50">7,952 Operators</span>
                    </div>
                    <div className="w-full h-3 bg-white/5 relative">
                      <div className="absolute top-0 left-0 bottom-0 bg-amber-600/70 w-[56%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span>3. Added to curation bag (18%)</span>
                      <span className="text-[#EAE3DB]/50">2,556 Operators</span>
                    </div>
                    <div className="w-full h-3 bg-white/5 relative">
                      <div className="absolute top-0 left-0 bottom-0 bg-amber-600/50 w-[18%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1.5 text-amber-400">
                      <span>4. Completed secure purchases (3.4%)</span>
                      <span className="text-amber-200">482 Transactions</span>
                    </div>
                    <div className="w-full h-3 bg-white/5 relative">
                      <div className="absolute top-0 left-0 bottom-0 bg-amber-500 w-[3.4%]" />
                    </div>
                  </div>

                </div>
              </div>

              {/* Scent profiles share */}
              <div className="bg-white/[0.015] border border-white/[0.04] p-6">
                <h4 className="text-[10px] tracking-[0.2em] text-amber-500 uppercase font-black mb-6">OLFACTORY PREFERENCE DISTRIB</h4>
                
                <div className="flex items-center gap-8 py-2">
                  <svg className="w-36 h-36" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e6a86c" strokeWidth="15" strokeDasharray="140 110" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#d97706" strokeWidth="15" strokeDasharray="70 180" strokeDashoffset="140" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#78350f" strokeWidth="15" strokeDasharray="40 210" strokeDashoffset="210" />
                  </svg>

                  <div className="flex flex-col gap-3.5 text-[9px] tracking-widest font-black uppercase text-[#EAE3DB]/60">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#e6a86c]" />
                      <span>Woody & Oud (55%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#d97706]" />
                      <span>Amber & Oriental (28%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#78350f]" />
                      <span>Fresh & Floral (17%)</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================
            TAB: COLLECTIONS REGISTRY
            ======================================================== */}
        {currentTab === "collections" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  COLLECTION MATRIX CONTROL
                </span>
                <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                  COLLECTIONS REGISTRY
                </h2>
              </div>

              <button
                onClick={() => setShowAddCollection(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white text-[8.5px] tracking-[0.25em] font-black uppercase px-4 py-3 flex items-center gap-2 rounded-none transition-all flex-shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                CREATE NEW COLLECTION
              </button>
            </div>

            {/* Collections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {collections.map(col => {
                const associatedProducts = getProductsInCollection(col.id);
                return (
                  <div key={col.id} className="bg-white/[0.015] border border-white/[0.04] p-5 flex flex-col justify-between relative group hover:border-amber-600/25 transition-all">
                    
                    <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-amber-500/40" />
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-amber-500/40" />
                    
                    <div>
                      {/* Image cover */}
                      <div className="w-full h-32 bg-amber-950/10 border border-white/[0.03] mb-4 overflow-hidden relative">
                        <img 
                          src={col.cover_image || "/campaign-gold.png"}
                          alt={col.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          onError={(e: any) => { e.target.src = "/campaign-gold.png"; }}
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                          <span className={`text-[6.5px] font-black tracking-widest px-2 py-0.5 border ${
                            (col.type || "manual") === "automated"
                              ? "border-amber-600/35 bg-amber-950/80 text-amber-400"
                              : "border-white/[0.08] bg-black/80 text-white"
                          }`}>
                            {(col.type || "manual").toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 mb-3">
                        <h4 className="text-[11px] tracking-wider text-[#EAE3DB] font-serif-luxury font-bold uppercase">{col.title}</h4>
                        <p className="text-[9px] text-[#EAE3DB]/60 font-sans tracking-wide leading-relaxed line-clamp-2">
                          {col.description || "A curated luxury selection."}
                        </p>
                      </div>

                      {/* Matching rules if automated */}
                      {(col.type || "manual") === "automated" && col.rules && col.rules.length > 0 && (
                        <div className="bg-white/[0.02] border border-white/[0.04] p-2.5 mb-4 text-[7.5px] font-black tracking-wider uppercase flex flex-col gap-1">
                          <span className="text-amber-500/70">AUTOMATION LOGIC STATUS:</span>
                          {col.rules.map((rule: any, idx: number) => (
                            <span key={idx} className="text-[#EAE3DB]/80 block font-mono">
                              • Product {rule.field} {rule.relation} '{rule.value}'
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Associated Products feedback list */}
                      <div className="flex flex-col gap-1.5 border-t border-white/[0.04] pt-3.5 mb-5">
                        <div className="flex justify-between items-center text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">
                          <span>LINKED PRODUCTS ({associatedProducts.length})</span>
                        </div>
                        
                        <div className="flex -space-x-2.5 overflow-hidden py-1">
                          {associatedProducts.slice(0, 5).map(prod => (
                            <div 
                              key={prod.id} 
                              className="inline-block h-6 w-6 rounded-full ring-2 ring-[#070301] bg-[#090503] overflow-hidden"
                              title={`${prod.brand} - ${prod.name}`}
                            >
                              <img className="h-full w-full object-contain" src={prod.image_url} alt={prod.name} />
                            </div>
                          ))}
                          {associatedProducts.length > 5 && (
                            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 ring-2 ring-[#070301] text-[6.5px] font-bold text-amber-500">
                              +{associatedProducts.length - 5}
                            </div>
                          )}
                          {associatedProducts.length === 0 && (
                            <span className="text-[7px] text-[#EAE3DB]/30 font-black italic block">
                              NO MAPPED FLACONS FOUND
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {(col.type || "manual") === "manual" && (
                        <button
                          onClick={() => setSelectedManageCollection(col)}
                          className="bg-white/5 hover:bg-white/10 text-white border border-white/[0.08] text-[7.5px] tracking-[0.2em] font-black uppercase py-2.5 px-3 flex-1 transition-all cursor-pointer"
                        >
                          MANAGE PRODUCTS
                        </button>
                      )}
                      
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to deregister this collection?`)) {
                            try {
                              await clientSafeSupabase.from("collections").delete().eq("id", col.id);
                              setCollections(prev => prev.filter(c => c.id !== col.id));
                              triggerToast(`Successfully removed collection: ${col.title}`);
                            } catch (err) {
                              triggerToast("Failed to delete collection from database.");
                            }
                          }
                        }}
                        className="border border-[#b91c1c]/20 hover:border-[#b91c1c]/40 text-[#b91c1c] hover:bg-[#b91c1c]/5 text-[7.5px] tracking-[0.2em] font-black uppercase py-2.5 px-3 cursor-pointer transition-all"
                        title="Remove Collection"
                      >
                        DELETE
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* ADD COLLECTION DRAWER MODAL */}
            <AnimatePresence>
              {showAddCollection && (
                <div 
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setShowAddCollection(false);
                    }
                  }}
                  className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6 cursor-pointer"
                >
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-[#090503] border border-amber-600/35 w-full max-w-[500px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-400 uppercase">
                        CREATE NEW SCENT VAULT
                      </h4>
                      <button onClick={() => setShowAddCollection(false)} className="text-[#EAE3DB]/40 hover:text-white cursor-pointer">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateCollection} className="flex flex-col gap-4 text-[10px] tracking-wider font-semibold uppercase">
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">COLLECTION TITLE</label>
                        <input 
                          type="text" 
                          value={newCollectionTitle}
                          onChange={(e) => setNewCollectionTitle(e.target.value)}
                          required
                          placeholder="e.g. Royal Oud Vault"
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">COLLECTION DESCRIPTION</label>
                        <textarea 
                          value={newCollectionDescription}
                          onChange={(e) => setNewCollectionDescription(e.target.value)}
                          placeholder="Describe this exclusive scent curation narrative..."
                          rows={3}
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full resize-none font-sans"
                        />
                      </div>

                      {/* Cover Image Upload & Custom Selection Console */}
                      <div className="flex flex-col gap-3">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">COLLECTION COVER IMAGE SOURCE</label>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* File Uploader */}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[7px] text-amber-500/70 font-black">UPLOAD COVER ART FILE</span>
                            <label className="bg-white/5 border-2 border-dashed border-white/[0.08] hover:border-amber-500/50 p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer relative h-28 select-none transition-all">
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;

                                  const uploadToSupabase = async () => {
                                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                                    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                                    const isRealActive = supabaseUrl && supabaseAnonKey;
                                    
                                    if (isRealActive) {
                                      try {
                                        triggerToast("Uploading to Supabase Vault...");
                                        const fileExt = file.name.split('.').pop();
                                        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
                                        const filePath = `covers/${fileName}`;

                                        const { data, error } = await clientSafeSupabase.storage
                                          .from('collection-covers')
                                          .upload(filePath, file);

                                        if (error) throw error;

                                        const { data: { publicUrl } } = clientSafeSupabase.storage
                                          .from('collection-covers')
                                          .getPublicUrl(filePath);

                                        setNewCollectionCoverImage(publicUrl);
                                        triggerToast("Uploaded directly to Supabase storage!");
                                        return;
                                      } catch (err) {
                                        console.error("Storage upload failed, falling back to Base64", err);
                                      }
                                    }

                                    // Fallback to Base64
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setNewCollectionCoverImage(reader.result as string);
                                      triggerToast("Luxury cover art loaded (Base64 offline mode).");
                                    };
                                    reader.readAsDataURL(file);
                                  };

                                  uploadToSupabase();
                                }}
                              />
                              {newCollectionCoverImage && newCollectionCoverImage.startsWith("data:") ? (
                                <div className="absolute inset-1 bg-[#090503] flex items-center justify-center p-1.5 border border-[#8C6239]/20">
                                  <img 
                                    src={newCollectionCoverImage} 
                                    alt="Upload preview" 
                                    className="w-full h-full object-cover" 
                                  />
                                </div>
                              ) : (
                                <>
                                  <span className="text-[18px] text-amber-500/55">+</span>
                                  <span className="text-[7.5px] text-[#EAE3DB]/60 tracking-widest font-black uppercase text-center">SELECT IMAGE</span>
                                </>
                              )}
                            </label>
                          </div>

                          {/* Presets and custom URL */}
                          <div className="flex flex-col justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[7px] text-[#EAE3DB]/50 font-black">CHOOSE LUXURY PRESET</span>
                              <select
                                value={newCollectionCoverImage.startsWith("data:") ? "/campaign-gold.png" : newCollectionCoverImage}
                                onChange={(e) => setNewCollectionCoverImage(e.target.value)}
                                className="bg-[#090503] border border-white/[0.08] px-3.5 py-2.5 text-[8.5px] outline-none focus:border-amber-500 font-bold uppercase w-full text-white cursor-pointer"
                              >
                                <option value="/campaign-gold.png">GOLD AMBIANCE</option>
                                <option value="/campaign-purple.png">ROYAL PURPLE</option>
                                <option value="/campaign-red-black.png">NOIR CARMINE</option>
                                <option value="/campaign-silver.png">ARGENT LUSTRE</option>
                              </select>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                              <span className="text-[7px] text-[#EAE3DB]/50 font-black">OR PASTE WEB URL</span>
                              <input 
                                type="text"
                                placeholder="HTTPS://STORE.COM/IMAGE.PNG"
                                value={newCollectionCoverImage.startsWith("data:") ? "" : newCollectionCoverImage}
                                onChange={(e) => setNewCollectionCoverImage(e.target.value)}
                                className="bg-white/5 border border-white/[0.08] px-3.5 py-2 text-[8px] outline-none focus:border-amber-500 font-bold uppercase w-full text-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Collection Type Method */}
                      <div className="flex grid grid-cols-1 gap-1.5">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">METHOD (ADD TYPE)</label>
                          <select
                            value={newCollectionType}
                            onChange={(e) => setNewCollectionType(e.target.value)}
                            className="bg-[#090503] border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-white cursor-pointer"
                          >
                            <option value="manual">MANUAL (SHOPIFY DIRECT)</option>
                            <option value="automated">AUTOMATED (SMART TAG MATCH)</option>
                          </select>
                        </div>
                      </div>

                      {/* Automated Rules field */}
                      {newCollectionType === "automated" && (
                        <div className="border border-amber-600/30 bg-amber-950/10 p-4 flex flex-col gap-3">
                          <span className="text-[8px] tracking-[0.2em] text-amber-400 font-black block">AUTOMATION PROTOCOL RULES</span>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[7px] tracking-widest text-[#EAE3DB]/40 font-black">MATCH PRODUCTS THAT MATCH THE FOLLOWING TAG</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. oud"
                              value={newCollectionRuleTag}
                              onChange={(e) => setNewCollectionRuleTag(e.target.value)}
                              className="bg-white/5 border border-white/[0.08] px-3 py-2 outline-none focus:border-amber-500 font-bold uppercase text-[9px] tracking-widest w-full"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black tracking-[0.25em] py-4 w-full mt-4 cursor-pointer"
                      >
                        PUBLISH COLLECTION TO STACK
                      </button>

                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* MANAGE MANUAL COLLECTION PRODUCTS OVERLAY MODAL */}
            <AnimatePresence>
              {selectedManageCollection && (
                <div 
                  onClick={() => setSelectedManageCollection(null)}
                  className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6 cursor-pointer"
                >
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#090503] border border-amber-600/35 w-full max-w-[500px] max-h-[85vh] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative cursor-default flex flex-col justify-between"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-400 uppercase">
                          MANAGE SCENT ASSIGNMENT
                        </h4>
                        <button onClick={() => setSelectedManageCollection(null)} className="text-[#EAE3DB]/40 hover:text-white cursor-pointer">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <span className="text-[8px] text-[#EAE3DB]/40 font-black block tracking-widest uppercase mb-5">
                        VAULT COLLECTION: {selectedManageCollection.title.toUpperCase()} (MANUAL)
                      </span>

                      {/* Search Bar */}
                      <div className="relative w-full mb-4">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE3DB]/30">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input 
                          type="text" 
                          value={manageSearchTerm}
                          onChange={(e) => setManageSearchTerm(e.target.value)}
                          placeholder="SEARCH SCENTS OR BRANDS..."
                          className="bg-white/[0.02] border border-white/[0.08] focus:border-amber-500/50 rounded-none pl-9 pr-4 py-2 text-[9px] tracking-widest text-[#EAE3DB] outline-none placeholder-[#EAE3DB]/20 w-full font-bold uppercase"
                        />
                      </div>

                      {/* Product list checklist */}
                      <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[38vh] pr-2 scrollbar-thin">
                        {products
                          .filter(prod => 
                            prod.name.toLowerCase().includes(manageSearchTerm.toLowerCase()) ||
                            prod.brand.toLowerCase().includes(manageSearchTerm.toLowerCase())
                          )
                          .map(prod => {
                          const isAssigned = productCollections.some(
                            (pc: any) => pc.product_id === prod.id && pc.collection_id === selectedManageCollection.id
                          );
                          return (
                            <div 
                              key={prod.id} 
                              onClick={async () => {
                                try {
                                  if (isAssigned) {
                                    await clientSafeSupabase
                                      .from("product_collections")
                                      .delete()
                                      .match({ product_id: prod.id, collection_id: selectedManageCollection.id });
                                    setProductCollections(prev => prev.filter(
                                      (pc: any) => !(pc.product_id === prod.id && pc.collection_id === selectedManageCollection.id)
                                    ));
                                    triggerToast(`Deregistered ${prod.name} from collection.`);
                                  } else {
                                    const newMapping = { product_id: prod.id, collection_id: selectedManageCollection.id };
                                    await clientSafeSupabase.from("product_collections").insert(newMapping);
                                    setProductCollections(prev => [...prev, newMapping]);
                                    triggerToast(`Successfully assigned ${prod.name} to collection.`);
                                  }
                                } catch (err) {
                                  triggerToast("Assignment database write failed.");
                                }
                              }}
                              className={`flex items-center justify-between p-3 border transition-all cursor-pointer ${
                                isAssigned 
                                  ? "border-amber-600/40 bg-amber-950/10" 
                                  : "border-white/[0.04] hover:bg-white/[0.02]"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-amber-950/20 border border-white/[0.04] p-1 flex items-center justify-center">
                                  <img src={prod.image_url} alt={prod.name} className="w-full h-full object-contain" />
                                </div>
                                <div className="flex flex-col text-left">
                                  <span className="text-[7.5px] text-amber-500 font-bold uppercase tracking-wider">{prod.brand}</span>
                                  <span className="text-[#EAE3DB] text-[9.5px] uppercase font-bold tracking-wider">{prod.name}</span>
                                </div>
                              </div>
                              
                              <div className={`w-4 h-4 border flex items-center justify-center ${
                                isAssigned 
                                  ? "border-[#8C6239] bg-[#8C6239] text-white" 
                                  : "border-white/[0.08]"
                              }`}>
                                {isAssigned && <Check className="w-3 h-3" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedManageCollection(null)}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black tracking-[0.25em] py-3.5 w-full mt-6 cursor-pointer"
                    >
                      SAVE SCENT MAPPINGS
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070301] flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-[10px] tracking-[0.3em] text-[#EAE3DB]/50 uppercase font-black">
          Decrypting Scent Backplane...
        </span>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
