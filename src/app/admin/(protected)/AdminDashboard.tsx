"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, ShoppingBag, Users, Percent, Gift, Package, Layers, 
  MapPin, ClipboardList, RefreshCw, Megaphone, FileText, Globe, 
  BarChart3, Plus, Trash2, Edit2, Search, ArrowUpRight, ArrowDownRight, 
  Check, X, AlertCircle, ShieldAlert, Loader2, Sparkles, Filter, Send
} from "lucide-react";
import { getBrowserSupabase } from "../../lib/supabase-browser";
import {
  ASSIGNABLE_ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  isCompletedOrder,
  isOpenOrder,
  orderStatusLabel,
} from "../../lib/orders";
import { 
  Bold, Italic, Underline, List, ListOrdered, 
  AlignLeft, AlignCenter, AlignRight, Code, Eye 
} from "lucide-react";

/**
 * Admin rows arrive from PostgREST without generated types, and the panel reads
 * dozens of shapes across a dozen tables. Rather than sprinkling `any` through
 * the file, the looseness is named once here and used everywhere.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Narrows an unknown thrown value to a displayable message. */
function errorMessage(err: unknown, fallback = "Unknown error"): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Escape a value for the printable report, which is assembled as raw HTML and
 * written into a print frame. Order ids, client names and addresses are all
 * customer-supplied, so none of them may reach that document unescaped.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A Date as "YYYY-MM-DD" in the viewer's own timezone.
 *
 * toISOString() would convert to UTC first, which in Dubai (UTC+4) yields
 * yesterday's date between midnight and 4am — long enough for a morning report
 * to silently omit the day it was run.
 */
function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-08-05" → "5 August 2026", for report headings. */
function longDate(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}


interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlValue, setHtmlValue] = useState(value);

  // Sync external value changes to contentEditable
  // Mirroring the incoming value into state belongs in render, not an effect
  // (an effect here re-rendered the whole editor on every keystroke).
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setHtmlValue(value);
  }

  // Writing into the contentEditable IS an external-system sync, so it stays.
  useEffect(() => {
    if (editorRef.current && !isHtmlMode) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value, isHtmlMode]);

  const handleInput = () => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      onChange(currentHtml);
      setHtmlValue(currentHtml);
    }
  };

  const execCommand = (command: string, arg: string = "") => {
    document.execCommand(command, false, arg);
    handleInput();
  };

  return (
    <div className="border border-white/[0.08] bg-white/5 w-full flex flex-col font-sans text-xs text-[#2A1A0F]">
      <style>{`
        .rich-text-content ul {
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .rich-text-content ol {
          list-style-type: decimal !important;
          padding-left: 1.5rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .rich-text-content u {
          text-decoration: underline !important;
        }
      `}</style>
      
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#0c0704] border-b border-white/[0.08]">
        <button
          type="button"
          onClick={() => execCommand("bold")}
          className="p-1.5 hover:bg-[#8C6239]/5 hover:text-[#8C6239] transition-colors cursor-pointer text-[#5C4E46]"
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("italic")}
          className="p-1.5 hover:bg-[#8C6239]/5 hover:text-[#8C6239] transition-colors cursor-pointer text-[#5C4E46]"
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("underline")}
          className="p-1.5 hover:bg-[#8C6239]/5 hover:text-[#8C6239] transition-colors cursor-pointer text-[#5C4E46]"
          title="Underline"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        
        <div className="w-[1px] h-4 bg-[#5C4E46]/10 mx-1" />

        <button
          type="button"
          onClick={() => execCommand("insertUnorderedList")}
          className="p-1.5 hover:bg-[#8C6239]/5 hover:text-[#8C6239] transition-colors cursor-pointer text-[#5C4E46]"
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("insertOrderedList")}
          className="p-1.5 hover:bg-[#8C6239]/5 hover:text-[#8C6239] transition-colors cursor-pointer text-[#5C4E46]"
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-[#5C4E46]/10 mx-1" />

        <button
          type="button"
          onClick={() => execCommand("justifyLeft")}
          className="p-1.5 hover:bg-[#8C6239]/5 hover:text-[#8C6239] transition-colors cursor-pointer text-[#5C4E46]"
          title="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("justifyCenter")}
          className="p-1.5 hover:bg-[#8C6239]/5 hover:text-[#8C6239] transition-colors cursor-pointer text-[#5C4E46]"
          title="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("justifyRight")}
          className="p-1.5 hover:bg-[#8C6239]/5 hover:text-[#8C6239] transition-colors cursor-pointer text-[#5C4E46]"
          title="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-[#5C4E46]/10 mx-1" />

        <button
          type="button"
          onClick={() => setIsHtmlMode(!isHtmlMode)}
          className={`p-1.5 hover:bg-[#8C6239]/5 transition-colors cursor-pointer ml-auto flex items-center gap-1 text-[9px] font-bold tracking-wider ${
            isHtmlMode ? "text-[#8C6239] bg-[#8C6239]/5" : "text-[#5C4E46]/60"
          }`}
          title="Toggle HTML Mode"
        >
          {isHtmlMode ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>PREVIEW</span>
            </>
          ) : (
            <>
              <Code className="w-3.5 h-3.5" />
              <span>HTML</span>
            </>
          )}
        </button>
      </div>

      {/* Editor / Textarea Container */}
      <div className="relative min-h-[140px] flex">
        {isHtmlMode ? (
          <textarea
            value={htmlValue}
            onChange={(e) => {
              setHtmlValue(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="HTML markup..."
            className="w-full min-h-[140px] p-4 bg-transparent outline-none border-none font-mono text-[11px] tracking-wider text-[#8C6239] resize-none placeholder-[#5C4E46]/30"
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onBlur={handleInput}
            className="w-full min-h-[140px] p-4 outline-none border-none overflow-y-auto text-xs tracking-wider text-[#2A1A0F] rich-text-content"
            style={{ minHeight: "140px" }}
          />
        )}
        {!value && !isHtmlMode && (
          <div className="absolute inset-0 p-4 pointer-events-none text-[#5C4E46]/30 select-none uppercase tracking-wider font-bold">
            {placeholder || "Describe scent narrative, top, and base notes..."}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = searchParams.get("tab") || "dashboard";

  // Data states
  const [products, setProducts] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [inventory, setInventory] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [discounts, setDiscounts] = useState<Row[]>([]);
  const [campaigns, setCampaigns] = useState<Row[]>([]);
  const [trackingLogs, setTrackingLogs] = useState<Row[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<Row[]>([]);
  const [orderItems, setOrderItems] = useState<Row[]>([]);
  const [inquiries, setInquiries] = useState<Row[]>([]);
  // Tables the panel renders but never used to query — these tabs were static markup.
  const [transfers, setTransfers] = useState<Row[]>([]);
  const [giftCards, setGiftCards] = useState<Row[]>([]);
  const [markets, setMarkets] = useState<Row[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<Row[]>([]);
  const [cmsPages, setCmsPages] = useState<Row[]>([]);
  const [blogPosts, setBlogPosts] = useState<Row[]>([]);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default to last 30 days
    return isoLocalDate(d);
  });
  const [endDate, setEndDate] = useState<string>(() => isoLocalDate(new Date()));

  // Page interaction states
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Collections states
  const [collections, setCollections] = useState<Row[]>([]);
  const [productCollections, setProductCollections] = useState<Row[]>([]);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [selectedManageCollection, setSelectedManageCollection] = useState<Row | null>(null);
  const [manageSearchTerm, setManageSearchTerm] = useState("");

  // Clean search filter when product mapping modal is closed
  // Clear the filter when the managed collection closes — adjusted during
  // render rather than in an effect, so there is no extra render pass.
  const [lastManagedCollection, setLastManagedCollection] = useState(selectedManageCollection);
  if (lastManagedCollection !== selectedManageCollection) {
    setLastManagedCollection(selectedManageCollection);
    if (!selectedManageCollection) {
      setManageSearchTerm("");
    }
  }
  
  // New Collection Form States
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newCollectionCoverImage, setNewCollectionCoverImage] = useState("/campaign-gold.png");
  const [newCollectionType, setNewCollectionType] = useState("manual");
  const [newCollectionRuleTag, setNewCollectionRuleTag] = useState("");

  // Drawer/Modal forms states
  const [selectedOrder, setSelectedOrder] = useState<Row | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Row | null>(null);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [showAddGiftCard, setShowAddGiftCard] = useState(false);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [fulfillmentOrderId, setFulfillmentOrderId] = useState<string | null>(null);
  const [packingChargesInput, setPackingChargesInput] = useState("");

  // "Out for delivery" prompts for the courier tracking number, which is sent
  // to the customer in the dispatch email.
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchOrderId, setDispatchOrderId] = useState<string | null>(null);
  const [trackingNumberInput, setTrackingNumberInput] = useState("");
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);

  // Invoice drawer's own tracking fields, seeded when the drawer opens.
  const [drawerTrackingNumber, setDrawerTrackingNumber] = useState("");
  const [drawerTrackingUrl, setDrawerTrackingUrl] = useState("");
  
  // New Scent Product Form
  const [newProductName, setNewProductName] = useState("");
  const [newProductBrand, setNewProductBrand] = useState("GHARIB");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductCost, setNewProductCost] = useState("");
  const [newProductMarginInput, setNewProductMarginInput] = useState("");
  
  // Overhauled sizes and tags
  const [selectedSizesList, setSelectedSizesList] = useState<string[]>(["50ml", "100ml"]);
  const [customSizeInput, setCustomSizeInput] = useState("");
  const [newProductTags, setNewProductTags] = useState("");
  const [newProductOlfactory, setNewProductOlfactory] = useState("Woody & Oud");
  const [newProductTagline, setNewProductTagline] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductTopNotes, setNewProductTopNotes] = useState("");
  const [newProductHeartNotes, setNewProductHeartNotes] = useState("");
  const [newProductBaseNotes, setNewProductBaseNotes] = useState("");
  
  // New Product Collection Mapping & Quick Creator States
  const [newProductSelectedCollections, setNewProductSelectedCollections] = useState<string[]>([]);
  const [quickCollectionTitle, setQuickCollectionTitle] = useState("");
  const [showCollectionsDropdown, setShowCollectionsDropdown] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  // New Discount Form
  const [discCode, setDiscCode] = useState("");
  const [discType, setDiscType] = useState("percentage");
  const [discValue, setDiscValue] = useState("");
  const [discMinReq, setDiscMinReq] = useState("0");
  const [discEndsAt, setDiscEndsAt] = useState("");
  const [discUsageLimit, setDiscUsageLimit] = useState("");
  const [discSubmitting, setDiscSubmitting] = useState(false);

  // New Gift Card Form
  const [giftCode, setGiftCode] = useState("");
  const [giftBalance, setGiftBalance] = useState("");
  const [giftCustomer, setGiftCustomer] = useState("");

  // Edit stock overrides
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState("");

  // Customer memorandum notes + client dossier drawer
  const [editingNoteCustomerId, setEditingNoteCustomerId] = useState<string | null>(null);
  const [editingNoteVal, setEditingNoteVal] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Row | null>(null);

  // Stock transfer composer
  const [showAddTransfer, setShowAddTransfer] = useState(false);
  const [transferOrigin, setTransferOrigin] = useState("Main Warehouse");
  const [transferDestination, setTransferDestination] = useState("");
  const [transferLines, setTransferLines] = useState<Row[]>([]);
  const [transferProductId, setTransferProductId] = useState("");
  const [transferSize, setTransferSize] = useState("");
  const [transferQty, setTransferQty] = useState("1");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Collection editor
  const [editingCollection, setEditingCollection] = useState<Row | null>(null);
  const [editColTitle, setEditColTitle] = useState("");
  const [editColDescription, setEditColDescription] = useState("");
  const [editColCover, setEditColCover] = useState("");
  const [editColType, setEditColType] = useState("manual");
  const [editColRuleTag, setEditColRuleTag] = useState("");
  const [editColSaving, setEditColSaving] = useState(false);
  const [editColUploading, setEditColUploading] = useState(false);

  // Inquiry reply desk
  const [replyingInquiry, setReplyingInquiry] = useState<Row | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<"all" | "new" | "answered">("all");

  // Quick seed loader
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // One parallel round of reads instead of 18 sequential round-trips.
        // Every table the panel renders is loaded here — the transfers, gift
        // card, markets, analytics and CMS tabs used to display hardcoded
        // markup instead of querying at all.
        // Star-selects on purpose: naming columns would fail the whole read on
        // any deployment that has not applied the newest migration yet, so newly
        // added columns (orders.phone) arrive on their own once it is applied.
        const db = getBrowserSupabase();
        const table = (name: string) => db.from(name).select("*");
        const [
          pRes, oRes, iRes, cRes, dRes, camRes, tRes, abRes, oiRes, colRes,
          pcRes, inqRes, trRes, gcRes, mkRes, aeRes, cmsRes, bpRes,
        ] = await Promise.all([
          table("products"), table("orders"), table("inventory"), table("customers"),
          table("discounts"), table("marketing_campaigns"), table("order_tracking"),
          table("abandoned_carts"), table("order_items"), table("collections"),
          table("product_collections"), table("contact_inquiries"), table("transfers"),
          table("gift_cards"), table("markets"), table("analytics_events"),
          table("cms_pages"), table("blog_posts"),
        ]);

        setProducts(pRes.data || []);
        setOrders(oRes.data || []);
        setInventory(iRes.data || []);
        setCustomers(cRes.data || []);
        setDiscounts(dRes.data || []);
        setCampaigns(camRes.data || []);
        setTrackingLogs(tRes.data || []);
        setAbandonedCarts(abRes.data || []);
        setOrderItems(oiRes.data || []);
        setCollections(colRes.data || []);
        setProductCollections(pcRes.data || []);
        setInquiries(inqRes.data || []);
        setTransfers(trRes.data || []);
        setGiftCards(gcRes.data || []);
        setMarkets(mkRes.data || []);
        setAnalyticsEvents(aeRes.data || []);
        setCmsPages(cmsRes.data || []);
        setBlogPosts(bpRes.data || []);
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

  /**
   * Runs the abandoned-cart recovery job by hand.
   *
   * The same endpoint a scheduler calls hourly (see migration 45). It is safe
   * to press twice: a cart is stamped as reminded the moment it is claimed, so
   * a second run within the same hour finds nothing left to send.
   */
  const sendCartRecovery = async () => {
    if (sendingRecovery) return;
    setSendingRecovery(true);
    try {
      const res = await fetch("/api/cart-recovery", { method: "POST" });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        error?: string;
      } | null;

      if (res.ok && json?.ok) {
        const sent = json.sent ?? 0;
        const failed = json.failed ?? 0;
        triggerToast(
          sent === 0 && failed === 0
            ? "NO CARTS ARE DUE A REMINDER RIGHT NOW"
            : `${sent} REMINDER${sent === 1 ? "" : "S"} SENT${failed > 0 ? ` — ${failed} FAILED` : ""}`
        );
      } else {
        triggerToast((json?.error || "RECOVERY RUN FAILED").toUpperCase());
      }
    } catch {
      triggerToast("COULD NOT REACH THE RECOVERY ENDPOINT");
    } finally {
      setSendingRecovery(false);
    }
  };

  const convertToWebP = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (file.type === "image/webp") {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context is not available"));
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Failed to convert image to blob"));
              return;
            }
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const webpFile = new File([blob], `${baseName.replace(/\s+/g, "_")}.webp`, {
              type: "image/webp",
              lastModified: Date.now()
            });
            resolve(webpFile);
          }, "image/webp", 0.85);
        };
        img.onerror = () => {
          reject(new Error("Failed to load image element"));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (uploadedImages.length + files.length > 5) {
      triggerToast("You can upload a maximum of 5 images.");
      return;
    }

    triggerToast("Uploading image(s) to Supabase...");

    for (let file of files) {
      try {
        if (file.type !== "image/webp") {
          try {
            file = await convertToWebP(file);
          } catch (webpErr) {
            console.error("WebP conversion failed, using original file", webpErr);
          }
        }
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const { data, error } = await getBrowserSupabase().storage
          .from("product-images")
          .upload(fileName, file);

        if (error) {
          triggerToast(`Upload failed: ${error.message}`);
          continue;
        }

        const { data: urlData } = getBrowserSupabase().storage
          .from("product-images")
          .getPublicUrl(fileName);
        const publicUrl = urlData?.publicUrl;
        
        if (publicUrl) {
          setUploadedImages(prev => [...prev, publicUrl]);
          triggerToast(`Successfully uploaded ${file.name}`);
        } else {
          triggerToast("Failed to retrieve public URL from Supabase.");
        }
      } catch (err) {
        console.error("Supabase storage upload error:", err);
        triggerToast(`Upload error: ${errorMessage(err, "Unknown error")}`);
      }
    }
  };

  const moveImage = (index: number, direction: "left" | "right") => {
    if (direction === "left" && index === 0) return;
    if (direction === "right" && index === uploadedImages.length - 1) return;

    const newImages = [...uploadedImages];
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    
    // Swap items
    const temp = newImages[index];
    newImages[index] = newImages[targetIndex];
    newImages[targetIndex] = temp;
    
    setUploadedImages(newImages);
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
    const cost = parseFloat(newProductCost) || 0;
    const sizes = selectedSizesList;
    const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 110;
    const parsedTags = newProductTags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);

    const mainImageUrl = uploadedImages.length > 0 ? uploadedImages[0] : "/catalog_initio_oud.png";
    const newPerfume = {
      id: nextId,
      brand: newProductBrand.toUpperCase(),
      name: newProductName,
      price: price,
      cost_price: cost,
      sizes: sizes,
      image_url: mainImageUrl,
      image_urls: uploadedImages,
      description: newProductDescription || "An avante-garde olfactory masterpiece designed for elite collections.",
      tagline: newProductTagline || "Signature Extrait",
      olfactory_group: newProductOlfactory,
      tags: parsedTags,
      is_new: true,
      is_bestseller: false,
      is_featured_large: false,
      top_notes: newProductTopNotes.split(",").map(n => n.trim()).filter(Boolean),
      heart_notes: newProductHeartNotes.split(",").map(n => n.trim()).filter(Boolean),
      base_notes: newProductBaseNotes.split(",").map(n => n.trim()).filter(Boolean)
    };

    try {
      await getBrowserSupabase().from("products").insert(newPerfume);
      
      // Update inventory listings for this new product
      const newInventoryRows = sizes.map(size => ({
        product_id: nextId,
        size: size,
        stock_level: 50,
        low_stock_threshold: 10
      }));
      await getBrowserSupabase().from("inventory").insert(newInventoryRows);

      // Add custom collection mappings
      if (newProductSelectedCollections.length > 0) {
        const mappingRows = newProductSelectedCollections.map(colId => ({
          product_id: nextId,
          collection_id: colId
        }));
        await getBrowserSupabase().from("product_collections").insert(mappingRows);
      }

      setProducts(prev => [newPerfume, ...prev]);
      setInventory(prev => [...newInventoryRows, ...prev]);

      // Refetch mapping states since local storage/trigger mapped matching smart collections automatically!
      const { data: pcData } = await getBrowserSupabase().from("product_collections").select("*");
      setProductCollections(pcData || []);

      triggerToast(`Successfully registered ${newProductName} under brand ${newProductBrand}.`);
      setShowAddProduct(false);
      
      // Reset inputs
      setNewProductName("");
      setNewProductPrice("");
      setNewProductCost("");
      setNewProductMarginInput("");
      setNewProductTagline("");
      setNewProductDescription("");
      setNewProductTags("");
      setSelectedSizesList(["50ml", "100ml"]);
      setNewProductSelectedCollections([]);
      setUploadedImages([]);
      setNewProductTopNotes("");
      setNewProductHeartNotes("");
      setNewProductBaseNotes("");
    } catch (err) {
      triggerToast("Failed to write to database kernel.");
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      await handleUpdateProduct();
    } else {
      await handleCreateProduct(e);
    }
  };

  const handleStartAddProduct = () => {
    setEditingProduct(null);
    setNewProductName("");
    setNewProductPrice("");
    setNewProductCost("");
    setNewProductMarginInput("");
    setNewProductTagline("");
    setNewProductDescription("");
    setNewProductTags("");
    setSelectedSizesList(["50ml", "100ml"]);
    setNewProductSelectedCollections([]);
    setUploadedImages([]);
    setNewProductTopNotes("");
    setNewProductHeartNotes("");
    setNewProductBaseNotes("");
    setShowAddProduct(true);
  };

  const handleStartEditProduct = (prod: Row) => {
    setEditingProduct(prod);
    setNewProductBrand(prod.brand);
    setNewProductName(prod.name);
    setNewProductPrice(String(prod.price));
    setNewProductCost(String(prod.cost_price || ""));
    const priceVal = parseFloat(String(prod.price)) || 0;
    const costVal = parseFloat(String(prod.cost_price)) || 0;
    if (priceVal > 0) {
      const margin = Math.round(((priceVal - costVal) / priceVal) * 100);
      setNewProductMarginInput(margin.toString());
    } else {
      setNewProductMarginInput("");
    }
    setNewProductTagline(prod.tagline || "");
    setNewProductDescription(prod.description || "");
    setNewProductTags(prod.tags ? prod.tags.join(", ") : "");
    setNewProductOlfactory(prod.olfactory_group || "Woody & Oud");
    setSelectedSizesList(prod.sizes || []);
    setNewProductTopNotes(prod.top_notes ? prod.top_notes.join(", ") : "");
    setNewProductHeartNotes(prod.heart_notes ? prod.heart_notes.join(", ") : "");
    setNewProductBaseNotes(prod.base_notes ? prod.base_notes.join(", ") : "");
    
    // Find collection mappings for this product
    const productMappings = productCollections
      .filter((pc: Row) => pc.product_id === prod.id)
      .map((pc: Row) => pc.collection_id);
    setNewProductSelectedCollections(productMappings);
    
    // If product has image_urls array, load it; otherwise fallback to single image_url
    setUploadedImages(prod.image_urls && prod.image_urls.length > 0 ? prod.image_urls : (prod.image_url ? [prod.image_url] : []));
    
    setShowAddProduct(true);
  };

  const handleUpdateProduct = async () => {
    // Guards every `editingProduct.id` read below. Without this the handler
    // threw a TypeError if it was ever reached with no product loaded.
    if (!editingProduct) {
      triggerToast("No product is open for editing.");
      return;
    }
    if (!newProductName || !newProductPrice) {
      triggerToast("Missing required perfume attributes.");
      return;
    }
    if (selectedSizesList.length === 0) {
      triggerToast("Please specify at least one flacon size.");
      return;
    }

    const price = parseFloat(newProductPrice);
    const cost = parseFloat(newProductCost) || 0;
    const sizes = selectedSizesList;
    const parsedTags = newProductTags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const mainImageUrl = uploadedImages.length > 0 ? uploadedImages[0] : "/catalog_initio_oud.png";

    const updatedPerfume = {
      ...editingProduct,
      brand: newProductBrand.toUpperCase(),
      name: newProductName,
      price: price,
      cost_price: cost,
      sizes: sizes,
      image_url: mainImageUrl,
      image_urls: uploadedImages,
      description: newProductDescription || "An avante-garde olfactory masterpiece designed for elite collections.",
      tagline: newProductTagline || "Signature Extrait",
      olfactory_group: newProductOlfactory,
      tags: parsedTags,
      top_notes: newProductTopNotes.split(",").map(n => n.trim()).filter(Boolean),
      heart_notes: newProductHeartNotes.split(",").map(n => n.trim()).filter(Boolean),
      base_notes: newProductBaseNotes.split(",").map(n => n.trim()).filter(Boolean)
    };

    try {
      // 1. Update products table in Supabase
      const { error: prodErr } = await getBrowserSupabase()
        .from("products")
        .update(updatedPerfume)
        .eq("id", editingProduct.id);

      if (prodErr) throw prodErr;

      // 2. Update inventory records
      await getBrowserSupabase().from("inventory").delete().eq("product_id", editingProduct.id);
      const newInventoryRows = sizes.map(size => ({
        product_id: editingProduct.id,
        size: size,
        stock_level: 50,
        low_stock_threshold: 10
      }));
      await getBrowserSupabase().from("inventory").insert(newInventoryRows);

      // 3. Update collection mappings
      await getBrowserSupabase().from("product_collections").delete().eq("product_id", editingProduct.id);
      if (newProductSelectedCollections.length > 0) {
        const mappingRows = newProductSelectedCollections.map(colId => ({
          product_id: editingProduct.id,
          collection_id: colId
        }));
        await getBrowserSupabase().from("product_collections").insert(mappingRows);
      }

      // Update local states
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedPerfume : p));
      setInventory(prev => [
        ...newInventoryRows,
        ...prev.filter(inv => inv.product_id !== editingProduct.id)
      ]);

      // Refetch mapping states
      const { data: pcData } = await getBrowserSupabase().from("product_collections").select("*");
      setProductCollections(pcData || []);

      triggerToast(`Successfully updated ${newProductName}.`);
      setShowAddProduct(false);
      setEditingProduct(null);

      // Reset inputs
      setNewProductName("");
      setNewProductPrice("");
      setNewProductCost("");
      setNewProductMarginInput("");
      setNewProductTagline("");
      setNewProductDescription("");
      setNewProductTags("");
      setSelectedSizesList(["50ml", "100ml"]);
      setNewProductSelectedCollections([]);
      setUploadedImages([]);
      setNewProductTopNotes("");
      setNewProductHeartNotes("");
      setNewProductBaseNotes("");
    } catch (err) {
      console.error("Update failed:", err);
      triggerToast(`Failed to update product: ${errorMessage(err, "Database write error")}`);
    }
  };

  const getProductsInCollection = (collectionId: string) => {
    const mappings = productCollections.filter((pc: Row) => pc.collection_id === collectionId);
    return products.filter((p: Row) => mappings.some((m: Row) => m.product_id === p.id));
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
      await getBrowserSupabase().from("collections").insert(newCol);
      setCollections(prev => [...prev, newCol]);
      
      // Sync mappings state immediately
      const { data: pcData } = await getBrowserSupabase().from("product_collections").select("*");
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

  const handleQuickCreateCollection = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!quickCollectionTitle.trim()) {
      triggerToast("Collection title cannot be empty.");
      return;
    }
    const title = quickCollectionTitle.trim();
    const id = title.toLowerCase().replace(/\s+/g, "-");
    
    // Check if collection already exists
    if (collections.some(c => c.id === id)) {
      triggerToast("Collection already exists.");
      return;
    }

    const newCol = {
      id,
      title,
      description: "A quick collection created during product registration.",
      cover_image: "/campaign-gold.png",
      type: "manual",
      rules: []
    };

    try {
      await getBrowserSupabase().from("collections").insert(newCol);
      setCollections(prev => [...prev, newCol]);
      
      // Auto-select this collection
      setNewProductSelectedCollections(prev => [...prev, id]);
      
      triggerToast(`Successfully created & selected collection: ${title}`);
      setQuickCollectionTitle("");
    } catch (err) {
      triggerToast("Failed to create quick collection.");
    }
  };

  // Add Discount Action
  /**
   * Register a promotional code.
   *
   * `id` is deliberately absent: discounts.id is a SERIAL, and the old code
   * sent `discounts.length + 1`, which collides with an existing row as soon
   * as anything has been deleted. Migration 48 resyncs the sequence that those
   * client-supplied ids left behind.
   *
   * The expiry and usage cap are real controls, not decoration — place_order()
   * and validate_discount() both refuse a code past `ends_at` or at its
   * `usage_limit` (migration 44).
   */
  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (discSubmitting) return;

    const code = discCode.toUpperCase().replace(/\s+/g, "");
    const value = parseFloat(discValue);

    if (!code || !Number.isFinite(value) || value <= 0) {
      triggerToast("Please input a code and a discount value above zero.");
      return;
    }
    if (discType === "percentage" && value > 100) {
      triggerToast("A percentage discount cannot exceed 100%.");
      return;
    }

    const usageLimit = discUsageLimit.trim() ? parseInt(discUsageLimit, 10) : null;
    if (usageLimit !== null && (!Number.isFinite(usageLimit) || usageLimit < 1)) {
      triggerToast("Redemption cap must be a whole number of at least 1.");
      return;
    }

    // A date input gives a bare day; the code stays live to the end of it.
    const endsAt = discEndsAt ? new Date(`${discEndsAt}T23:59:59`).toISOString() : null;
    if (endsAt && new Date(endsAt) < new Date()) {
      triggerToast("That expiry date is already in the past.");
      return;
    }

    setDiscSubmitting(true);
    try {
      const { data, error } = await getBrowserSupabase()
        .from("discounts")
        .insert({
          code,
          title: `${code} Campaign`,
          type: discType,
          value,
          min_requirement: parseFloat(discMinReq) || 0.0,
          ends_at: endsAt,
          usage_limit: usageLimit,
          usage_count: 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setDiscounts(prev => [data, ...prev]);
      triggerToast(`Registered discount code ${code} successfully.`);
      setShowAddDiscount(false);
      setDiscCode("");
      setDiscValue("");
      setDiscMinReq("0");
      setDiscEndsAt("");
      setDiscUsageLimit("");
    } catch (err) {
      const msg = errorMessage(err, "");
      triggerToast(
        msg.includes("duplicate") || msg.includes("unique")
          ? `The code ${code} already exists.`
          : `Discount registration failed. ${msg}`.trim()
      );
    } finally {
      setDiscSubmitting(false);
    }
  };

  /** Switch a code on or off. Checkout reads is_active on every redemption. */
  const handleToggleDiscount = async (disc: Row) => {
    const next = !disc.is_active;
    try {
      const { error } = await getBrowserSupabase()
        .from("discounts")
        .update({ is_active: next })
        .eq("id", disc.id);
      if (error) throw error;

      setDiscounts(prev => prev.map(d => (d.id === disc.id ? { ...d, is_active: next } : d)));
      triggerToast(`${disc.code} is now ${next ? "active" : "paused"}.`);
    } catch (err) {
      triggerToast(`Could not update ${disc.code}. ${errorMessage(err, "")}`.trim());
    }
  };

  /**
   * Delete a code for real.
   *
   * The old handler only dropped the row from React state and toasted
   * "Deregistered" — the code stayed in the table and stayed redeemable at
   * checkout, and it reappeared on the next refresh.
   */
  const handleDeleteDiscount = async (disc: Row) => {
    if (!confirm(`Permanently delete the code ${disc.code}? Shoppers will no longer be able to redeem it.`)) {
      return;
    }
    try {
      const { error } = await getBrowserSupabase().from("discounts").delete().eq("id", disc.id);
      if (error) throw error;

      setDiscounts(prev => prev.filter(d => d.id !== disc.id));
      triggerToast(`Deleted discount ${disc.code}.`);
    } catch (err) {
      triggerToast(`Could not delete ${disc.code}. ${errorMessage(err, "")}`.trim());
    }
  };

  // Generate Gift Card Action
  // Gift card issuing is deferred — this does not persist anything yet.
  const handleCreateGiftCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftCode || !giftBalance) {
      triggerToast("Specify card code and allocation balance.");
      return;
    }
    triggerToast(`Gift Card [${giftCode.toUpperCase()}] allocated with AED ${parseFloat(giftBalance).toFixed(2)} for ${giftCustomer || "Anonymous"}.`);
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
      await getBrowserSupabase()
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
  /**
   * Status changes go through /api/admin/order-status, which re-verifies the
   * admin server-side, writes the status and timeline entry, and emails the
   * customer on "out for delivery" and "delivered". The status is no longer
   * written straight from the browser, so the notification can never be
   * skipped by whoever changed it.
   */
  const handleUpdateOrderStatus = async (
    orderId: string,
    nextStatus: string,
    packingChargesVal?: number,
    trackingNumberVal?: string
  ) => {
    try {
      const res = await fetch("/api/admin/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          status: nextStatus,
          ...(trackingNumberVal ? { trackingNumber: trackingNumberVal } : {}),
          ...(packingChargesVal !== undefined ? { packingCharges: packingChargesVal } : {}),
        }),
      });
      const payload = await res.json();

      if (!res.ok) {
        triggerToast(payload?.error || "Status update failed.");
        return;
      }

      const patch: Row = { status: nextStatus };
      if (packingChargesVal !== undefined) patch.packing_charges = packingChargesVal;
      if (payload.trackingNumber) patch.tracking_number = payload.trackingNumber;

      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...patch } : o)));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, ...patch });
      }
      if (payload.timeline) {
        setTrackingLogs(prev => [
          ...prev,
          {
            id: Date.now(),
            order_id: orderId,
            ...payload.timeline,
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      triggerToast(
        payload.emailed
          ? `Order ${orderId} set to ${nextStatus} — customer notified at ${payload.emailed}.`
          : `Order ${orderId} set to ${nextStatus}.`
      );
    } catch {
      triggerToast("Status synchronization failed.");
    }
  };

  const handleDeleteInquiry = async (inqId: string) => {
    try {
      const { error } = await getBrowserSupabase()
        .from("contact_inquiries")
        .delete()
        .eq("id", inqId);

      if (error) throw error;

      setInquiries(prev => prev.filter(inq => inq.id !== inqId));
      triggerToast("Inquiry logged entry removed successfully.");
    } catch (err) {
      triggerToast("Failed to remove inquiry entry.");
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     CUSTOMER DOSSIER
     ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Save the operator's note against a client.
   *
   * customers.note has existed since migration 04 and the admin FOR ALL policy
   * since 10 — the column was rendered read-only purely because nothing ever
   * wrote it.
   */
  const handleSaveCustomerNote = async (customerId: string) => {
    if (savingNote) return;
    setSavingNote(true);
    const note = editingNoteVal.trim();

    try {
      const { error } = await getBrowserSupabase()
        .from("customers")
        .update({ note, updated_at: new Date().toISOString() })
        .eq("id", customerId);

      if (error) throw error;

      setCustomers(prev => prev.map(c => (c.id === customerId ? { ...c, note } : c)));
      setSelectedCustomer(prev => (prev && prev.id === customerId ? { ...prev, note } : prev));
      setEditingNoteCustomerId(null);
      setEditingNoteVal("");
      triggerToast("Client memorandum saved.");
    } catch (err) {
      triggerToast(`Could not save the memorandum. ${errorMessage(err, "")}`.trim());
    } finally {
      setSavingNote(false);
    }
  };

  /**
   * Close the dossier, abandoning any unsaved note draft that belongs to it.
   *
   * The drawer and the inline cell editor share one draft so a note saved in
   * either place lands in both. Without this, closing the drawer mid-edit left
   * that client's row in the table sitting in edit mode holding the orphaned
   * draft.
   */
  const closeCustomerDossier = () => {
    if (selectedCustomer && editingNoteCustomerId === selectedCustomer.id) {
      setEditingNoteCustomerId(null);
      setEditingNoteVal("");
    }
    setSelectedCustomer(null);
  };

  /** Every order this client has placed, newest first. */
  const getCustomerOrders = (customer: Row) =>
    orders
      .filter(o => o.customer_id === customer.id || o.email === customer.email)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  /* ══════════════════════════════════════════════════════════════════════════
     STOCK TRANSFERS
     ══════════════════════════════════════════════════════════════════════════ */

  const addTransferLine = () => {
    const productId = parseInt(transferProductId, 10);
    const qty = parseInt(transferQty, 10);
    const product = products.find(p => p.id === productId);

    if (!product) {
      triggerToast("Choose a fragrance to add to the manifest.");
      return;
    }
    if (!transferSize) {
      triggerToast("Choose a size for this line.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      triggerToast("Quantity must be at least 1.");
      return;
    }

    // Merge rather than duplicate: two lines for the same flacon and size read
    // as an error on a packing slip.
    setTransferLines(prev => {
      const at = prev.findIndex(l => l.product_id === productId && l.size === transferSize);
      if (at !== -1) {
        const next = [...prev];
        next[at] = { ...next[at], quantity: next[at].quantity + qty };
        return next;
      }
      return [
        ...prev,
        {
          product_id: productId,
          name: product.name,
          brand: product.brand,
          size: transferSize,
          quantity: qty,
        },
      ];
    });

    setTransferQty("1");
  };

  const resetTransferForm = () => {
    setShowAddTransfer(false);
    setTransferOrigin("Main Warehouse");
    setTransferDestination("");
    setTransferLines([]);
    setTransferProductId("");
    setTransferSize("");
    setTransferQty("1");
  };

  /**
   * Record a stock movement.
   *
   * transfers.id is a VARCHAR primary key with no default, so the reference is
   * minted here. The date prefix keeps the list sorting sensibly by eye, and
   * the random tail keeps two transfers raised in the same minute apart.
   */
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferSubmitting) return;

    if (!transferOrigin.trim() || !transferDestination.trim()) {
      triggerToast("An origin and a destination are both required.");
      return;
    }
    if (transferOrigin.trim() === transferDestination.trim()) {
      triggerToast("Origin and destination must differ.");
      return;
    }
    if (transferLines.length === 0) {
      triggerToast("Add at least one line to the manifest.");
      return;
    }

    setTransferSubmitting(true);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
    const newTransfer = {
      id: `XFER-${stamp}-${tail}`,
      origin: transferOrigin.trim(),
      destination: transferDestination.trim(),
      status: "pending",
      items: transferLines,
    };

    try {
      const { data, error } = await getBrowserSupabase()
        .from("transfers")
        .insert(newTransfer)
        .select()
        .single();

      if (error) throw error;

      setTransfers(prev => [data, ...prev]);
      triggerToast(`Raised stock transfer ${newTransfer.id}.`);
      resetTransferForm();
    } catch (err) {
      triggerToast(`Could not raise the transfer. ${errorMessage(err, "")}`.trim());
    } finally {
      setTransferSubmitting(false);
    }
  };

  /**
   * Move a transfer along its lifecycle: pending → in_transit → completed,
   * or cancelled from either.
   *
   * Deliberately does NOT touch inventory. public.inventory is keyed on
   * (product_id, size) with no location column, so stock is a single global
   * pool — moving a case between the warehouse and a boutique does not change
   * how many bottles the business holds. Decrementing anything here would
   * invent a shortage. The transfer is a logistics record; if per-location
   * stock is ever wanted, inventory needs a location key first.
   */
  const handleTransferStatus = async (xfer: Row, nextStatus: string) => {
    try {
      const { error } = await getBrowserSupabase()
        .from("transfers")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", xfer.id);

      if (error) throw error;

      setTransfers(prev =>
        prev.map(t => (t.id === xfer.id ? { ...t, status: nextStatus } : t))
      );
      triggerToast(`Transfer ${xfer.id} is now ${nextStatus.replace(/_/g, " ")}.`);
    } catch (err) {
      triggerToast(`Could not update the transfer. ${errorMessage(err, "")}`.trim());
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     COLLECTION EDITOR
     ══════════════════════════════════════════════════════════════════════════ */

  const openCollectionEditor = (col: Row) => {
    setEditingCollection(col);
    setEditColTitle(String(col.title || ""));
    setEditColDescription(String(col.description || ""));
    setEditColCover(String(col.cover_image || ""));
    setEditColType(String(col.type || "manual"));
    // The composer only ever writes a single tag rule, so the editor shows the
    // first one rather than pretending to handle a rule list it cannot build.
    setEditColRuleTag(
      Array.isArray(col.rules) && col.rules.length > 0 ? String(col.rules[0]?.value || "") : ""
    );
  };

  const handleEditCollectionCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditColUploading(true);
    try {
      const db = getBrowserSupabase();
      const path = `covers/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error } = await db.storage.from("collection-covers").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      const { data } = db.storage.from("collection-covers").getPublicUrl(path);
      setEditColCover(data.publicUrl);
      triggerToast("Cover image uploaded.");
    } catch (err) {
      triggerToast(`Cover upload failed. ${errorMessage(err, "")}`.trim());
    } finally {
      setEditColUploading(false);
      e.target.value = "";
    }
  };

  /**
   * Save an edited collection.
   *
   * Switching a collection to automated, or changing its tag, re-derives the
   * membership immediately — the mapping rows are what the storefront reads,
   * so leaving them stale would show the old products under the new rule.
   */
  const handleUpdateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection || editColSaving) return;

    const title = editColTitle.trim();
    if (!title) {
      triggerToast("A collection needs a title.");
      return;
    }

    const tag = editColRuleTag.trim().toLowerCase();
    if (editColType === "automated" && !tag) {
      triggerToast("An automated collection needs a tag to match on.");
      return;
    }

    setEditColSaving(true);
    const rules = editColType === "automated" ? [{ field: "tag", relation: "equals", value: tag }] : [];

    try {
      const db = getBrowserSupabase();
      const { error } = await db
        .from("collections")
        .update({
          title,
          description: editColDescription.trim(),
          cover_image: editColCover || "/campaign-gold.png",
          type: editColType,
          rules,
        })
        .eq("id", editingCollection.id);

      if (error) throw error;

      if (editColType === "automated") {
        await db.from("product_collections").delete().eq("collection_id", editingCollection.id);
        const matched = products.filter(p => Array.isArray(p.tags) && p.tags.includes(tag));
        if (matched.length > 0) {
          const { error: mapError } = await db
            .from("product_collections")
            .insert(matched.map(p => ({ product_id: p.id, collection_id: editingCollection.id })));
          if (mapError) throw mapError;
        }
        const { data: pcData } = await db.from("product_collections").select("*");
        setProductCollections(pcData || []);
      }

      setCollections(prev =>
        prev.map(c =>
          c.id === editingCollection.id
            ? {
                ...c,
                title,
                description: editColDescription.trim(),
                cover_image: editColCover || "/campaign-gold.png",
                type: editColType,
                rules,
              }
            : c
        )
      );

      triggerToast(`Updated collection: ${title}`);
      setEditingCollection(null);
    } catch (err) {
      triggerToast(`Could not save the collection. ${errorMessage(err, "")}`.trim());
    } finally {
      setEditColSaving(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     INQUIRY DESK
     ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Both inquiry writes go through /api/admin/inquiry-reply, which re-verifies
   * the admin, sends the mail with the server-held Resend key, and only then
   * marks the row answered.
   */
  const postInquiryUpdate = async (payload: Row) => {
    const res = await fetch("/api/admin/inquiry-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || "The request was refused.");
    }
    return json as Row;
  };

  const handleSetInquiryStatus = async (inq: Row, status: "new" | "answered") => {
    try {
      const json = await postInquiryUpdate({ inquiryId: inq.id, status });
      setInquiries(prev =>
        prev.map(i =>
          i.id === inq.id
            ? { ...i, status, answered_at: json.answeredAt ?? (status === "answered" ? new Date().toISOString() : null) }
            : i
        )
      );
      triggerToast(status === "answered" ? "Marked as answered." : "Reopened as a new inquiry.");
    } catch (err) {
      triggerToast(errorMessage(err, "Could not update the inquiry."));
    }
  };

  const handleSendInquiryReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingInquiry || replySubmitting) return;

    const reply = replyText.trim();
    if (reply.length < 2) {
      triggerToast("Write a reply before sending.");
      return;
    }

    setReplySubmitting(true);
    try {
      const json = await postInquiryUpdate({ inquiryId: replyingInquiry.id, reply });
      const inquiryId = replyingInquiry.id;

      setInquiries(prev =>
        prev.map(i =>
          i.id === inquiryId
            ? {
                ...i,
                status: json.status ?? "answered",
                answered_at: json.answeredAt ?? new Date().toISOString(),
                admin_reply: reply,
                replied_by: json.repliedBy ?? null,
              }
            : i
        )
      );

      triggerToast(
        typeof json.warning === "string"
          ? String(json.warning)
          : `Reply sent to ${json.emailed}.`
      );
      setReplyingInquiry(null);
      setReplyText("");
    } catch (err) {
      triggerToast(errorMessage(err, "The reply could not be sent."));
    } finally {
      setReplySubmitting(false);
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
    // Shared helpers so no status falls between the two buckets — previously
    // "out_for_delivery" and "processing" counted as neither.
    const pendingOrders = periodOrders.filter(o => isOpenOrder(o.status));
    const completedOrders = periodOrders.filter(o => isCompletedOrder(o.status));
    
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

    const bestSeller = products.find(p => p.id === bestSellerId) || { name: "No Sales Recorded", brand: "Gharib" };
    
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

  /**
   * Set the reporting window to a whole number of calendar months ending with
   * the current one. `months = 1` is this month to date.
   *
   * Day 1 of (this month - n + 1) through today. Constructing the start from
   * (year, month - n + 1, 1) lets Date normalise a negative month index across
   * the year boundary, so "last 12 months" in January is not a special case.
   */
  const applyMonthPeriod = (months: number) => {
    const now = new Date();
    setStartDate(isoLocalDate(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)));
    setEndDate(isoLocalDate(now));
  };

  /** The whole of the calendar month before this one. */
  const applyPreviousMonth = () => {
    const now = new Date();
    setStartDate(isoLocalDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
    // Day 0 of this month is the last day of the previous one.
    setEndDate(isoLocalDate(new Date(now.getFullYear(), now.getMonth(), 0)));
  };

  /**
   * Render the period's figures as a PDF.
   *
   * Done through the browser's own print pipeline rather than a PDF library:
   * "Save as PDF" is a destination in every print dialog on every platform the
   * owner uses, and it keeps a megabyte of renderer out of the admin bundle.
   * The document is written into an off-screen iframe so the dashboard itself
   * is not what gets printed, and so no popup blocker is involved.
   */
  const handleDownloadPDF = () => {
    const {
      periodOrders,
      totalRevenue,
      ordersCount,
      aov,
      totalItemsSold,
      bestSellerName,
      bestSellerBrand,
      pendingOrdersCount,
      pendingValue,
      completedOrdersCount,
      completedValue,
    } = reportData;

    if (periodOrders.length === 0) {
      triggerToast("No orders in this period to report on.");
      return;
    }

    const aed = (n: number) =>
      `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const rows = periodOrders
      .map(o => {
        let clientName = String(o.email || "");
        let place = "";
        if (o.shipping_address) {
          try {
            const addr =
              typeof o.shipping_address === "string"
                ? JSON.parse(o.shipping_address)
                : o.shipping_address;
            clientName = addr.name || clientName;
            place = [addr.city, addr.country].filter(Boolean).join(", ");
          } catch {
            /* An unparseable address just prints blank. */
          }
        }
        const placed = o.created_at
          ? new Date(o.created_at).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—";

        return `<tr>
          <td class="mono">${escapeHtml(o.id)}</td>
          <td>${escapeHtml(clientName)}<br><span class="muted">${escapeHtml(o.email)}</span></td>
          <td>${escapeHtml(place || "—")}</td>
          <td>${escapeHtml(orderStatusLabel(o.status))}</td>
          <td class="num">${escapeHtml(aed(parseFloat(String(o.total_price || 0)) || 0))}</td>
          <td>${escapeHtml(placed)}</td>
        </tr>`;
      })
      .join("");

    const kpi = (label: string, value: string, note: string) => `
      <div class="kpi">
        <span class="kpi-label">${escapeHtml(label)}</span>
        <span class="kpi-value">${escapeHtml(value)}</span>
        <span class="kpi-note">${escapeHtml(note)}</span>
      </div>`;

    const generatedOn = new Date().toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const doc = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Gharib Executive Report ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Helvetica, Arial, sans-serif; color:#1C120C; font-size:10px; }
  .wordmark { font-family: Georgia, 'Times New Roman', serif; font-size:20px; letter-spacing:.28em;
              text-transform:uppercase; margin:0 0 4px; }
  header { border-bottom:1.5px solid #1C120C; padding-bottom:12px; margin-bottom:18px; }
  .eyebrow { font-size:7.5px; letter-spacing:.28em; text-transform:uppercase; color:#7C6E65; margin:0 0 10px; }
  h1 { font-family: Georgia,'Times New Roman',serif; font-size:15px; font-weight:normal;
       letter-spacing:.08em; text-transform:uppercase; margin:0 0 6px; }
  .period { font-size:9.5px; color:#5C4E46; margin:0; }
  .kpis { display:flex; gap:10px; margin-bottom:20px; }
  .kpi { flex:1; border:1px solid #E5DFD3; border-top:2px solid #8C6239; padding:10px 11px; }
  .kpi-label { display:block; font-size:6.5px; letter-spacing:.2em; text-transform:uppercase;
               color:#7C6E65; margin-bottom:6px; }
  .kpi-value { display:block; font-size:14px; font-weight:bold; color:#8C6239; margin-bottom:4px; }
  .kpi-note { display:block; font-size:7px; letter-spacing:.08em; text-transform:uppercase; color:#7C6E65; }
  h2 { font-size:8px; letter-spacing:.25em; text-transform:uppercase; margin:0 0 8px;
       padding-bottom:6px; border-bottom:1px solid #E5DFD3; }
  table { width:100%; border-collapse:collapse; }
  thead { display:table-header-group; }
  th { text-align:left; font-size:6.5px; letter-spacing:.18em; text-transform:uppercase;
       color:#7C6E65; background:#F3EFE9; padding:7px 6px; border-bottom:1px solid #E5DFD3; }
  td { padding:7px 6px; border-bottom:1px solid #EFEAE0; font-size:8.5px; vertical-align:top; }
  tr { page-break-inside: avoid; }
  .num { text-align:right; white-space:nowrap; font-weight:bold; color:#8C6239; }
  .mono { font-family:'SF Mono',Menlo,Consolas,monospace; font-weight:bold; color:#8C6239; }
  .muted { color:#9A8E84; font-size:7.5px; }
  tfoot td { border-top:1.5px solid #1C120C; border-bottom:none; font-weight:bold;
             font-size:9.5px; padding-top:9px; }
  .split { display:flex; gap:10px; margin-bottom:20px; }
  .split > div { flex:1; border:1px solid #E5DFD3; padding:10px 11px; }
  .split .kpi-value { font-size:12px; }
  footer { margin-top:22px; padding-top:10px; border-top:1px solid #E5DFD3;
           font-size:7px; letter-spacing:.12em; text-transform:uppercase; color:#9A8E84;
           display:flex; justify-content:space-between; }
</style></head>
<body>
  <header>
    <p class="wordmark">Gharib</p>
    <p class="eyebrow">Financial &amp; Performance Metrics</p>
    <h1>Executive Report</h1>
    <p class="period">${escapeHtml(longDate(startDate))} &nbsp;—&nbsp; ${escapeHtml(longDate(endDate))}</p>
  </header>

  <div class="kpis">
    ${kpi("Period gross revenue", aed(totalRevenue), `${ordersCount} transactions`)}
    ${kpi("Average order value", aed(aov), "Per transaction")}
    ${kpi("Bottles sold", `${totalItemsSold}`, "Units decanted")}
    ${kpi("Best seller", bestSellerName, `House of ${bestSellerBrand}`)}
  </div>

  <div class="split">
    <div>
      <span class="kpi-label">Open / in progress</span>
      <span class="kpi-value">${escapeHtml(aed(pendingValue))}</span>
      <span class="kpi-note">${escapeHtml(String(pendingOrdersCount))} orders awaiting completion</span>
    </div>
    <div>
      <span class="kpi-label">Completed</span>
      <span class="kpi-value">${escapeHtml(aed(completedValue))}</span>
      <span class="kpi-note">${escapeHtml(String(completedOrdersCount))} orders delivered</span>
    </div>
  </div>

  <h2>Transaction ledger</h2>
  <table>
    <thead><tr>
      <th>Order</th><th>Client</th><th>Destination</th><th>Status</th>
      <th style="text-align:right">Total</th><th>Placed</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="4">Total — ${escapeHtml(String(ordersCount))} orders</td>
      <td class="num">${escapeHtml(aed(totalRevenue))}</td>
      <td></td>
    </tr></tfoot>
  </table>

  <footer>
    <span>Gharib Perfumes — Dubai, UAE</span>
    <span>Generated ${escapeHtml(generatedOn)}</span>
  </footer>
</body></html>`;

    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";

    // srcdoc + onload rather than document.write: the load event is the signal
    // that the stylesheet has been applied, and printing before that yields an
    // unstyled page.
    frame.onload = () => {
      const view = frame.contentWindow;
      if (!view) {
        frame.remove();
        triggerToast("Could not open the print view.");
        return;
      }
      // The frame must outlive print() — Chrome and Safari return from it
      // immediately while the dialog is still open, so removing it there would
      // cancel the job. afterprint fires for both "save" and "cancel".
      const cleanup = () => window.setTimeout(() => frame.remove(), 500);
      view.addEventListener("afterprint", cleanup, { once: true });
      view.focus();
      view.print();
      // Firefox blocks on print() and may never fire afterprint on the frame.
      window.setTimeout(() => {
        if (document.body.contains(frame)) frame.remove();
      }, 60000);
    };

    frame.srcdoc = doc;
    document.body.appendChild(frame);
    triggerToast(`Prepared the PDF for ${startDate} to ${endDate}. Choose "Save as PDF".`);
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
                  31,580 AED
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
                          <div className="flex flex-col items-end">
                            <span>{parseFloat(order.total_price).toLocaleString()} AED</span>
                            {order.currency && order.currency !== "AED" && order.converted_total && (
                              <span className="text-[8px] text-[#EAE3DB]/40 tracking-wider mt-0.5 uppercase">
                                ({order.converted_total})
                              </span>
                            )}
                          </div>
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
                              onClick={() => {
                                setSelectedOrder(order);
                                setDrawerTrackingNumber(String(order.tracking_number || ""));
                                setDrawerTrackingUrl(String(order.tracking_url || ""));
                              }}
                              className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] text-[8px] tracking-[0.2em] font-black uppercase px-3 py-1.5 transition-all cursor-pointer"
                            >
                              VIEW INVOICE
                            </button>
                            
                            {/* Fast status updater dropdown */}
                            <select 
                              value={order.status}
                              onChange={(e) => {
                                const nextStatus = e.target.value;
                                if (nextStatus === "fulfilled") {
                                  setFulfillmentOrderId(order.id);
                                  setPackingChargesInput("");
                                  setShowFulfillmentModal(true);
                                } else if (nextStatus === "out_for_delivery") {
                                  // A courier reference is required before the
                                  // customer is told the parcel is on its way.
                                  setDispatchOrderId(order.id);
                                  setTrackingNumberInput(String(order.tracking_number || ""));
                                  setShowDispatchModal(true);
                                } else {
                                  handleUpdateOrderStatus(order.id, nextStatus);
                                }
                              }}
                              className="bg-black border border-white/[0.08] text-[#EAE3DB] text-[8px] tracking-widest font-black uppercase px-2 py-1 outline-none cursor-pointer"
                            >
                              {ASSIGNABLE_ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {ORDER_STATUS_LABELS[status].toUpperCase()}
                                </option>
                              ))}
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
                          {/* Cash on delivery is arranged by phone, so the courier desk needs it one tap away. */}
                          {selectedOrder.phone ? (
                            <a
                              href={`tel:${String(selectedOrder.phone).replace(/[^\d+]/g, "")}`}
                              className="text-[8px] text-amber-500/80 hover:text-amber-400 block mt-1"
                            >
                              {selectedOrder.phone}
                            </a>
                          ) : (
                            <span className="text-[8px] text-[#EAE3DB]/25 block mt-1">PHONE NOT CAPTURED</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/30 uppercase block mb-1">SHIPPING LINE</span>
                          <span className="text-[#EAE3DB] font-bold block">{selectedOrder.shipping_address?.street}</span>
                          <span className="text-[#EAE3DB] block">{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.country}</span>
                        </div>
                      </div>

                      {/* Line items exactly as the order recorded them — this is the packing list. */}
                      <div>
                        <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/30 uppercase block mb-3">ITEMIZED DECANTS</span>
                        {orderItems.filter(item => item.order_id === selectedOrder.id).length === 0 ? (
                          <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                            <span className="text-[#EAE3DB]/40">No line items recorded for this order</span>
                          </div>
                        ) : (
                          orderItems.filter(item => item.order_id === selectedOrder.id).map(item => (
                            <div key={item.id} className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                              <span>
                                {products.find(p => p.id === item.product_id)?.name || `Product #${item.product_id}`}
                                <span className="text-[8px] text-[#EAE3DB]/40"> ({item.size}) × {item.quantity}</span>
                              </span>
                              <span className="font-sans text-[#EAE3DB]/80 font-bold">
                                {((parseFloat(item.unit_price) || 0) * (Number(item.quantity) || 0)).toLocaleString()} AED
                              </span>
                            </div>
                          ))
                        )}
                        {selectedOrder.packing_charges !== undefined && parseFloat(selectedOrder.packing_charges) > 0 && (
                          <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                            <span className="text-[#EAE3DB]/60">Packing Charges</span>
                            <span className="font-sans text-amber-500/80 font-bold">{parseFloat(selectedOrder.packing_charges).toLocaleString()} AED</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-2.5 border-b border-white/[0.03]">
                          <span className="font-bold text-[#EAE3DB]">Grand Total</span>
                          <div className="flex flex-col items-end">
                            <span className="font-sans text-amber-200 font-black">
                              {(parseFloat(selectedOrder.total_price) + (parseFloat(selectedOrder.packing_charges) || 0)).toLocaleString()} AED
                            </span>
                            {selectedOrder.currency && selectedOrder.currency !== "AED" && selectedOrder.converted_total && (
                              <span className="text-[8px] text-[#EAE3DB]/40 tracking-wider mt-0.5 uppercase">
                                ({selectedOrder.converted_total})
                              </span>
                            )}
                          </div>
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
                            value={drawerTrackingNumber}
                            onChange={(e) => setDrawerTrackingNumber(e.target.value)}
                            placeholder="e.g. DHL-DXB-99882"
                            className="bg-black border border-white/[0.08] text-white text-[9px] tracking-widest px-3 py-2 outline-none w-full font-bold uppercase"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-amber-500 font-black uppercase">
                            CARRIER TRACKING URL (OPTIONAL)
                          </label>
                          <input 
                            type="text" 
                            value={drawerTrackingUrl}
                            onChange={(e) => setDrawerTrackingUrl(e.target.value)}
                            placeholder="e.g. https://www.dhl.com/..."
                            className="bg-black border border-white/[0.08] text-white text-[9px] tracking-widest px-3 py-2 outline-none w-full font-medium"
                          />
                        </div>

                        <button 
                          onClick={async () => {
                            const trackingNumber = drawerTrackingNumber.trim();
                            const trackingUrl = drawerTrackingUrl.trim();

                            try {
                              const { error } = await getBrowserSupabase()
                                .from("orders")
                                .update({
                                  tracking_number: trackingNumber || null,
                                  tracking_url: trackingUrl || null
                                })
                                .eq("id", selectedOrder.id);

                              if (error) throw error;

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
                            } catch {
                              triggerToast("Failed to write tracking updates to database.");
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

            {/* ORDER FULFILLMENT MODAL */}
            <AnimatePresence>
              {showFulfillmentModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-[#090503] border border-amber-600/30 w-full max-w-[420px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
                  >
                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />
                    
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-500 uppercase">
                        FULFILL ORDER — {fulfillmentOrderId}
                      </h4>
                      <button 
                        onClick={() => setShowFulfillmentModal(false)}
                        className="text-[#EAE3DB]/40 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-6 text-[10px] tracking-wider font-semibold uppercase">
                      <p className="text-[#EAE3DB]/80 tracking-widest leading-relaxed">
                        Please specify the packing charges for this order before marking it as fulfilled.
                      </p>

                      <div className="flex flex-col gap-2">
                        <label className="text-[7.5px] tracking-widest text-amber-500 font-black uppercase">
                          PACKING CHARGES (AED)
                        </label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={packingChargesInput}
                          onChange={(e) => setPackingChargesInput(e.target.value)}
                          placeholder="e.g. 15.00"
                          className="bg-black border border-white/[0.08] text-white text-[9px] tracking-widest px-3 py-2.5 outline-none w-full font-bold uppercase"
                          autoFocus
                        />
                      </div>

                      <div className="flex gap-4">
                        <button 
                          onClick={() => setShowFulfillmentModal(false)}
                          className="w-1/2 border border-white/10 text-white hover:bg-white/5 text-[8.5px] tracking-[0.2em] uppercase font-black py-3.5 transition-all cursor-pointer"
                        >
                          CANCEL
                        </button>
                        <button 
                          onClick={async () => {
                            const charges = parseFloat(packingChargesInput) || 0;
                            if (fulfillmentOrderId) {
                              await handleUpdateOrderStatus(fulfillmentOrderId, "fulfilled", charges);
                              setShowFulfillmentModal(false);
                            }
                          }}
                          className="w-1/2 bg-amber-600 text-white hover:bg-amber-500 text-[8.5px] tracking-[0.2em] uppercase font-black py-3.5 transition-all cursor-pointer"
                        >
                          FULFILL ORDER
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* OUT FOR DELIVERY — TRACKING NUMBER MODAL */}
            <AnimatePresence>
              {showDispatchModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-[#090503] border border-amber-600/30 w-full max-w-[420px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-500 uppercase">
                        DISPATCH — {dispatchOrderId}
                      </h4>
                      <button
                        onClick={() => setShowDispatchModal(false)}
                        className="text-[#EAE3DB]/40 hover:text-white"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const tracking = trackingNumberInput.trim();
                        if (!tracking || !dispatchOrderId) return;
                        setDispatchSubmitting(true);
                        await handleUpdateOrderStatus(
                          dispatchOrderId,
                          "out_for_delivery",
                          undefined,
                          tracking
                        );
                        setDispatchSubmitting(false);
                        setShowDispatchModal(false);
                        setTrackingNumberInput("");
                      }}
                      className="flex flex-col gap-6 text-[10px] tracking-wider font-semibold uppercase"
                    >
                      <p className="text-[#EAE3DB]/80 tracking-widest leading-relaxed normal-case">
                        Enter the courier tracking number. The customer is emailed that their
                        order is out for delivery, with this reference included.
                      </p>

                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor="dispatch-tracking"
                          className="text-[7.5px] tracking-widest text-amber-500 font-black uppercase"
                        >
                          TRACKING NUMBER
                        </label>
                        <input
                          id="dispatch-tracking"
                          type="text"
                          required
                          value={trackingNumberInput}
                          onChange={(e) => setTrackingNumberInput(e.target.value)}
                          placeholder="e.g. ARX-4471902-AE"
                          className="bg-black border border-white/[0.08] text-white text-[9px] tracking-widest px-3 py-2.5 outline-none w-full font-bold uppercase"
                          autoFocus
                        />
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setShowDispatchModal(false)}
                          className="w-1/2 border border-white/10 text-white hover:bg-white/5 text-[8.5px] tracking-[0.2em] uppercase font-black py-3.5 transition-all cursor-pointer"
                        >
                          CANCEL
                        </button>
                        <button
                          type="submit"
                          disabled={dispatchSubmitting || !trackingNumberInput.trim()}
                          className="w-1/2 bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 text-[8.5px] tracking-[0.2em] uppercase font-black py-3.5 transition-all cursor-pointer"
                        >
                          {dispatchSubmitting ? "SENDING…" : "DISPATCH & NOTIFY"}
                        </button>
                      </div>
                    </form>
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
                  onClick={handleStartAddProduct}
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
                    <th className="p-4 text-right">COST PRICE</th>
                    <th className="p-4 text-right">EST. PROFIT</th>
                    <th className="p-4 text-center">BADGES</th>
                    <th className="p-4 pr-6 text-center">MANAGEMENT</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#EAE3DB]/30 font-black tracking-widest">
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
                                onError={(e: Row) => {
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
                          {parseFloat(p.price).toLocaleString()} AED
                        </td>
                        <td className="p-4 text-right text-[#EAE3DB]/60 font-medium font-sans">
                          {p.cost_price ? `${parseFloat(p.cost_price).toLocaleString()} AED` : "0.00 AED"}
                        </td>
                        <td className="p-4 text-right font-bold font-sans">
                          <div className="flex flex-col items-end">
                            <span className={(parseFloat(p.price) - (p.cost_price || 0)) >= 0 ? "text-emerald-400" : "text-red-400"}>
                              {(parseFloat(p.price) - (p.cost_price || 0)).toLocaleString()} AED
                            </span>
                            {parseFloat(p.price) > 0 && (
                              <span className={`text-[7px] tracking-wider mt-0.5 ${(parseFloat(p.price) - (p.cost_price || 0)) >= 0 ? "text-emerald-500/60" : "text-red-500/60"}`}>
                                {Math.round(((parseFloat(p.price) - (p.cost_price || 0)) / parseFloat(p.price)) * 100)}% MARGIN
                              </span>
                            )}
                          </div>
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
                           <div className="flex items-center justify-center gap-2">
                             <button
                               onClick={() => handleStartEditProduct(p)}
                               className="text-[#EAE3DB]/30 hover:text-amber-500 transition-colors p-1 cursor-pointer"
                               title="Edit Product"
                             >
                               <Edit2 className="w-4 h-4" />
                             </button>
                             <button
                               onClick={async () => {
                                 try {
                                   await getBrowserSupabase().from("products").delete().eq("id", p.id);
                                   await getBrowserSupabase().from("inventory").delete().eq("product_id", p.id);
                                   await getBrowserSupabase().from("product_collections").delete().eq("product_id", p.id);
                                   setProducts(prev => prev.filter(prod => prod.id !== p.id));
                                   triggerToast(`Deregistered perfume ${p.name} from global catalogue.`);
                                 } catch (err) {
                                   setProducts(prev => prev.filter(prod => prod.id !== p.id));
                                   triggerToast(`Deregistered perfume ${p.name} locally.`);
                                 }
                               }}
                               className="text-[#EAE3DB]/30 hover:text-red-400 transition-colors p-1 cursor-pointer"
                               title="Delete Product"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
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
                      setEditingProduct(null);
                    }
                  }}
                  className="fixed top-0 bottom-0 right-0 left-0 lg:left-[280px] bg-black/85 z-50 overflow-y-auto p-6 md:p-12 flex justify-center items-start cursor-pointer"
                >
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-[#090503] border border-amber-600/35 w-full max-w-[1400px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative cursor-default my-8"
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[14px] tracking-[0.3em] font-black text-amber-400 uppercase">
                        {editingProduct ? "EDIT LUXURY SCENT" : "ADD NEW LUXURY SCENT"}
                      </h4>
                      <button onClick={() => { setShowAddProduct(false); setEditingProduct(null); }} className="text-[#EAE3DB]/40 hover:text-white cursor-pointer">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleFormSubmit} className="flex flex-col gap-5 text-[11px] tracking-wider font-semibold uppercase">
                      
                      {/* Row 1: Brand and Scent Name */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">BRAND DESIGNATION</label>
                          <input 
                            type="text" 
                            value={newProductBrand}
                            onChange={(e) => setNewProductBrand(e.target.value)}
                            required
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-xs tracking-wider text-white"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">SCENT COLLECTION NAME</label>
                          <input 
                            type="text" 
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            required
                            placeholder="e.g. Amber Royale"
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-xs tracking-wider text-white placeholder-[#EAE3DB]/20"
                          />
                        </div>
                      </div>

                      {/* Row 2: Base Price, Cost Price, Target Margin, Olfactory Group */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">DECANT BASE PRICE (AED)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={newProductPrice}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewProductPrice(val);
                              const priceVal = parseFloat(val) || 0;
                              const costVal = parseFloat(newProductCost) || 0;
                              if (priceVal > 0) {
                                const margin = Math.round(((priceVal - costVal) / priceVal) * 100);
                                setNewProductMarginInput(margin.toString());
                              } else {
                                setNewProductMarginInput("");
                              }
                            }}
                            required
                            placeholder="195.00"
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-xs tracking-wider text-white"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">DECANT COST PRICE (AED)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={newProductCost}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewProductCost(val);
                              const costVal = parseFloat(val) || 0;
                              const marginVal = parseFloat(newProductMarginInput) || 0;
                              if (newProductMarginInput && marginVal < 100) {
                                const price = costVal / (1 - marginVal / 100);
                                setNewProductPrice(price.toFixed(2));
                              } else {
                                const priceVal = parseFloat(newProductPrice) || 0;
                                if (priceVal > 0) {
                                  const margin = Math.round(((priceVal - costVal) / priceVal) * 100);
                                  setNewProductMarginInput(margin.toString());
                                }
                              }
                            }}
                            required
                            placeholder="95.00"
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-xs tracking-wider text-white"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">TARGET MARGIN (%)</label>
                          <input 
                            type="number" 
                            step="1"
                            value={newProductMarginInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewProductMarginInput(val);
                              const marginVal = parseFloat(val);
                              const costVal = parseFloat(newProductCost) || 0;
                              if (!isNaN(marginVal) && marginVal < 100 && costVal > 0) {
                                const price = costVal / (1 - marginVal / 100);
                                setNewProductPrice(price.toFixed(2));
                              }
                            }}
                            placeholder="50"
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-xs tracking-wider text-white"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">OLFATIVE NOTE GROUP</label>
                          <select
                            value={newProductOlfactory}
                            onChange={(e) => setNewProductOlfactory(e.target.value)}
                            className="bg-[#090503] border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-xs tracking-wider text-white cursor-pointer"
                          >
                            <option value="Woody & Oud">WOODY & OUD</option>
                            <option value="Floral & Sweet">FLORAL & SWEET</option>
                            <option value="Fresh & Aquatic">FRESH & AQUATIC</option>
                            <option value="Amber & Oriental">AMBER & ORIENTAL</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 3: Marketing Tagline and Search Tags */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">MARKETING TAGLINE</label>
                          <input 
                            type="text" 
                            value={newProductTagline}
                            onChange={(e) => setNewProductTagline(e.target.value)}
                            placeholder="e.g. Celestial Oud Accord"
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-xs tracking-wider text-white placeholder-[#EAE3DB]/20"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">SEARCH TAGS (COMMA SEPARATED)</label>
                          <input 
                            type="text" 
                            value={newProductTags}
                            onChange={(e) => setNewProductTags(e.target.value)}
                            placeholder="e.g. memoir, noble, wood, oud"
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-[10px] tracking-widest text-white placeholder-[#EAE3DB]/20"
                          />
                        </div>
                      </div>

                      {/* Row 3.2: Fragrance Notes (Top, Heart, Base) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">TOP NOTES (COMMA SEPARATED)</label>
                          <input 
                            type="text" 
                            value={newProductTopNotes}
                            onChange={(e) => setNewProductTopNotes(e.target.value)}
                            placeholder="e.g. Saffron, Cinnamon, Bergamot"
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-[10px] tracking-widest text-white placeholder-[#EAE3DB]/20"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">HEART NOTES (COMMA SEPARATED)</label>
                          <input 
                            type="text" 
                            value={newProductHeartNotes}
                            onChange={(e) => setNewProductHeartNotes(e.target.value)}
                            placeholder="e.g. Rose, Jasmine, Clove"
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-[10px] tracking-widest text-white placeholder-[#EAE3DB]/20"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">BASE NOTES (COMMA SEPARATED)</label>
                          <input 
                            type="text" 
                            value={newProductBaseNotes}
                            onChange={(e) => setNewProductBaseNotes(e.target.value)}
                            placeholder="e.g. Amber, Oud, Sandalwood, Vanilla"
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-[10px] tracking-widest text-white placeholder-[#EAE3DB]/20"
                          />
                        </div>
                      </div>

                      {/* Row 3.5: Product Images Upload and Ordering */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">
                          PRODUCT IMAGES (UP TO 5 IMAGES — ARRANGE DISPLAY ORDER)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                          {uploadedImages.map((imgUrl, index) => (
                            <div 
                              key={imgUrl} 
                              className="group relative aspect-[3/4] bg-white/5 border border-white/[0.08] hover:border-amber-600/50 flex flex-col justify-between overflow-hidden shadow-md transition-all duration-300"
                            >
                              {/* Thumbnail */}
                              <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center p-2">
                                <img 
                                  src={imgUrl} 
                                  alt={`Product image ${index + 1}`}
                                  className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                                />
                                {index === 0 && (
                                  <span className="absolute top-2 left-2 bg-[#8C6239] text-white text-[7px] font-black tracking-widest px-2 py-0.5 uppercase shadow-sm">
                                    Primary
                                  </span>
                                )}
                              </div>
                              
                              {/* Reorder and Delete Toolbar */}
                              <div className="flex justify-between items-center bg-[#0c0704] border-t border-white/[0.08] p-1.5 text-xs text-[#5C4E46]">
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveImage(index, "left")}
                                    disabled={index === 0}
                                    className={`p-1 transition-colors ${
                                      index === 0 ? "opacity-30 cursor-not-allowed" : "hover:text-[#8C6239] hover:bg-[#8C6239]/5 cursor-pointer"
                                    }`}
                                    title="Move Left"
                                  >
                                    ←
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveImage(index, "right")}
                                    disabled={index === uploadedImages.length - 1}
                                    className={`p-1 transition-colors ${
                                      index === uploadedImages.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:text-[#8C6239] hover:bg-[#8C6239]/5 cursor-pointer"
                                    }`}
                                    title="Move Right"
                                  >
                                    →
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== index))}
                                  className="p-1 hover:text-red-400 hover:bg-red-950/10 transition-colors cursor-pointer"
                                  title="Delete Image"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          
                          {/* Upload Placeholder Slot */}
                          {uploadedImages.length < 5 && (
                            <label className="aspect-[3/4] border border-dashed border-white/[0.15] hover:border-amber-600/50 hover:bg-[#8C6239]/2 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer gap-2 select-none group relative">
                              <Plus className="w-6 h-6 text-[#5C4E46] group-hover:text-[#8C6239] transition-colors" />
                              <span className="text-[8px] tracking-[0.2em] text-[#5C4E46] group-hover:text-[#8C6239] font-black uppercase text-center px-2">
                                UPLOAD IMAGE
                              </span>
                              <input 
                                type="file" 
                                accept="image/*"
                                multiple
                                onChange={handleImageFileChange}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Row 4: Flacon Sizes */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">FLACON SIZES (SELECT PROTOCOL)</label>
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
                                className={`px-4 py-2 text-[10px] font-black tracking-widest transition-all cursor-pointer ${
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
                            className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase text-[10px] tracking-widest flex-1 text-white placeholder-[#EAE3DB]/20"
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
                            className="bg-[#8C6239] hover:bg-[#9E734A] text-white text-[10px] font-black tracking-widest px-5 py-3 flex-shrink-0 cursor-pointer"
                          >
                            + ADD CUSTOM
                          </button>
                        </div>
                        
                        {selectedSizesList.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="text-[8px] text-[#EAE3DB]/40 font-black self-center mr-1">SELECTED:</span>
                            {selectedSizesList.map(size => (
                              <span 
                                key={size} 
                                onClick={() => setSelectedSizesList(prev => prev.filter(s => s !== size))}
                                className="text-[8px] border border-amber-600/35 bg-amber-950/20 text-amber-400 px-2.5 py-1 font-black tracking-widest uppercase cursor-pointer hover:bg-red-950/30 hover:border-red-500/20 hover:text-red-400 flex items-center gap-1"
                                title="Click to remove"
                              >
                                {size} <X className="w-1.5 h-1.5" />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Row 4.5: Associated Collections & Quick Creation */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                        {/* Column 1: Choose Existing Collection Dropdown */}
                        <div className="flex flex-col gap-1.5 relative">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">
                            ASSOCIATED COLLECTIONS
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowCollectionsDropdown(!showCollectionsDropdown)}
                              className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase w-full text-xs tracking-wider text-white text-left flex justify-between items-center cursor-pointer"
                            >
                              <span>
                                {newProductSelectedCollections.length === 0
                                  ? "SELECT COLLECTIONS..."
                                  : `${newProductSelectedCollections.length} COLLECTION(S) SELECTED`}
                              </span>
                              <Filter className="w-3.5 h-3.5 text-amber-500" />
                            </button>

                            {showCollectionsDropdown && (
                              <>
                                {/* Backdrop to dismiss the dropdown */}
                                <div 
                                  className="fixed inset-0 z-40 cursor-default" 
                                  onClick={() => setShowCollectionsDropdown(false)}
                                />
                                <div className="absolute left-0 right-0 mt-1 bg-[#090503] border border-amber-600/35 z-50 max-h-[220px] overflow-y-auto shadow-2xl p-2 flex flex-col gap-1">
                                  {collections.map(col => {
                                    const isSelected = newProductSelectedCollections.includes(col.id);
                                    const isAutomated = col.type === "automated";
                                    return (
                                      <div
                                        key={col.id}
                                        onClick={() => {
                                          if (isAutomated) return; // cannot manually assign to automated collection
                                          if (isSelected) {
                                            setNewProductSelectedCollections(prev => prev.filter(id => id !== col.id));
                                          } else {
                                            setNewProductSelectedCollections(prev => [...prev, col.id]);
                                          }
                                        }}
                                        className={`flex items-center justify-between px-3 py-2 text-[10px] tracking-widest font-black uppercase transition-all select-none cursor-pointer ${
                                          isAutomated 
                                            ? "opacity-40 cursor-not-allowed" 
                                            : isSelected
                                              ? "bg-amber-950/30 border border-amber-600/35 text-amber-400"
                                              : "hover:bg-white/5 text-[#EAE3DB]/70 hover:text-white border border-transparent"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isAutomated}
                                            onChange={() => {}} // handled by parent div click
                                            className="accent-amber-500 cursor-pointer pointer-events-none"
                                          />
                                          <span>{col.title}</span>
                                        </div>
                                        {isAutomated && (
                                          <span className="text-[6.5px] border border-amber-500/20 bg-amber-950/20 text-amber-500/80 px-1 py-0.5 font-bold tracking-widest uppercase">
                                            Auto
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                          
                          {/* Mini tags showing selected collections */}
                          {newProductSelectedCollections.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {newProductSelectedCollections.map(colId => {
                                const col = collections.find(c => c.id === colId);
                                return (
                                  <span
                                    key={colId}
                                    onClick={() => setNewProductSelectedCollections(prev => prev.filter(id => id !== colId))}
                                    className="text-[8px] border border-amber-600/35 bg-amber-950/20 text-amber-400 px-2 py-0.5 font-black tracking-widest uppercase cursor-pointer hover:bg-red-950/30 hover:border-red-500/20 hover:text-red-400 flex items-center gap-1"
                                    title="Click to remove"
                                  >
                                    {col?.title || colId} <X className="w-1.5 h-1.5" />
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Column 2: Quick Create Collection */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">
                            QUICK CREATE COLLECTION
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={quickCollectionTitle}
                              onChange={(e) => setQuickCollectionTitle(e.target.value)}
                              placeholder="e.g. Summer Gold Vault"
                              className="bg-white/5 border border-white/[0.08] px-4 py-3 outline-none focus:border-amber-500 font-bold uppercase text-[10px] tracking-widest flex-1 text-white placeholder-[#EAE3DB]/20"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleQuickCreateCollection(e)}
                              className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black tracking-widest px-5 py-3 cursor-pointer transition-all"
                            >
                              + CREATE
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Row 5: Olfactory Story Details */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9.5px] tracking-[0.18em] text-[#EAE3DB]/40 font-black">
                          OLFACTORY STORY DETAILS
                        </label>
                        <RichTextEditor 
                          value={newProductDescription}
                          onChange={setNewProductDescription}
                          placeholder="Describe scent narrative, top, and base notes..."
                        />
                      </div>

                      {/* Row 6: Dynamic Telemetry Banner */}
                      <div className="bg-[#120a06] border border-amber-900/30 p-4 flex items-center justify-between rounded-none mb-1">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-[#EAE3DB]/40 tracking-[0.18em] font-black uppercase">ESTIMATED NET PROFIT PER UNIT</span>
                          <span className={`text-base font-bold font-sans ${(parseFloat(newProductPrice) || 0) - (parseFloat(newProductCost) || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {((parseFloat(newProductPrice) || 0) - (parseFloat(newProductCost) || 0)).toFixed(2)} AED
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] text-[#EAE3DB]/40 tracking-[0.18em] font-black uppercase">MARGIN YIELD</span>
                          <span className={`text-base font-bold font-sans ${(parseFloat(newProductPrice) || 0) - (parseFloat(newProductCost) || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {(parseFloat(newProductPrice) || 0) > 0 ? Math.round((((parseFloat(newProductPrice) || 0) - (parseFloat(newProductCost) || 0)) / (parseFloat(newProductPrice) || 1)) * 100) : 0}%
                          </span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-black tracking-[0.25em] py-4 w-full mt-4 cursor-pointer transition-all"
                      >
                        {editingProduct ? "SAVE CHANGES" : "PUBLISH TO GLOBAL CATALOGUE"}
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
          <div className="flex flex-col gap-6 max-w-4xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  LOGISTICS BACKPLANE
                </span>
                <h2 className="text-xl font-serif-luxury text-[#1C120C] uppercase tracking-wider">
                  STOCK TRANSFERS
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[7px] border border-amber-600/35 bg-amber-500/10 text-amber-800 px-2 py-1 font-black">
                  {transfers.length} RECORDED
                </span>
                <button
                  onClick={() => setShowAddTransfer(true)}
                  className="bg-black hover:bg-amber-950 text-white text-[8.5px] tracking-[0.25em] font-black uppercase px-4 py-3 flex items-center gap-2 rounded-none transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  RAISE TRANSFER
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {transfers.length === 0 ? (
                <div className="border border-dashed border-[#E5DFD3] p-8 text-center bg-white">
                  <span className="text-[9px] tracking-widest text-[#7C6E65] font-bold uppercase">
                    No stock transfers recorded yet.
                  </span>
                </div>
              ) : (
                transfers.map((xfer) => {
                  const lines = Array.isArray(xfer.items) ? xfer.items : [];
                  const status = String(xfer.status || "pending");
                  const done = status === "completed";
                  const cancelled = status === "cancelled";
                  const units = lines.reduce(
                    (sum: number, l: Row) => sum + (parseInt(String(l.quantity), 10) || 0),
                    0
                  );

                  return (
                    <div
                      key={String(xfer.id)}
                      className="bg-white border border-[#E5DFD3] p-5 shadow-[0_4px_20px_rgba(140,98,57,0.02)]"
                    >
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] tracking-widest font-black text-amber-800 uppercase font-mono">
                            {String(xfer.id)}
                          </span>
                          <span className="text-[9px] text-[#2A1A0F] font-bold uppercase tracking-wider">
                            {String(xfer.origin || "—")}
                            <span className="text-[#7C6E65] mx-2">→</span>
                            {String(xfer.destination || "—")}
                          </span>
                          <span className="text-[8px] text-[#7C6E65] font-bold uppercase tracking-wider">
                            {lines.length} line{lines.length === 1 ? "" : "s"} · {units} unit{units === 1 ? "" : "s"}
                            {xfer.created_at
                              ? ` · raised ${new Date(xfer.created_at).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}`
                              : ""}
                          </span>
                        </div>

                        <span
                          className={`text-[8px] border px-2.5 py-1 font-black uppercase tracking-widest shrink-0 ${
                            done
                              ? "border-green-600/35 bg-green-500/10 text-green-700"
                              : cancelled
                                ? "border-[#b91c1c]/30 bg-[#b91c1c]/5 text-[#b91c1c]"
                                : "border-amber-600/35 bg-amber-500/10 text-amber-800"
                          }`}
                        >
                          {status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Manifest */}
                      {lines.length > 0 && (
                        <div className="border-t border-dashed border-[#E5DFD3] pt-3 mb-4 flex flex-col gap-1.5">
                          {lines.map((l: Row, idx: number) => (
                            <div
                              key={idx}
                              className="flex justify-between gap-4 text-[9px] font-bold uppercase tracking-wider"
                            >
                              <span className="text-[#2A1A0F]">
                                {l.brand} {l.name}
                                <span className="text-[#7C6E65] ml-1.5">({l.size})</span>
                              </span>
                              <span className="text-amber-800 whitespace-nowrap">QTY {l.quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Lifecycle actions */}
                      {!done && !cancelled && (
                        <div className="flex flex-wrap gap-2 border-t border-[#E5DFD3] pt-3.5">
                          {status === "pending" && (
                            <button
                              onClick={() => handleTransferStatus(xfer, "in_transit")}
                              className="bg-amber-600 hover:bg-amber-500 text-white text-[7.5px] tracking-[0.2em] font-black uppercase px-3.5 py-2 cursor-pointer transition-all"
                            >
                              MARK IN TRANSIT
                            </button>
                          )}
                          <button
                            onClick={() => handleTransferStatus(xfer, "completed")}
                            className="bg-green-800 hover:bg-green-700 text-white text-[7.5px] tracking-[0.2em] font-black uppercase px-3.5 py-2 cursor-pointer transition-all"
                          >
                            MARK COMPLETED
                          </button>
                          <button
                            onClick={() => handleTransferStatus(xfer, "cancelled")}
                            className="border border-[#b91c1c]/25 hover:border-[#b91c1c]/50 text-[#b91c1c] hover:bg-[#b91c1c]/5 text-[7.5px] tracking-[0.2em] font-black uppercase px-3.5 py-2 cursor-pointer transition-all"
                          >
                            CANCEL
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* ── RAISE TRANSFER MODAL ──────────────────────────────────── */}
            <AnimatePresence>
              {showAddTransfer && (
                <div
                  onClick={(e) => {
                    if (e.target === e.currentTarget) resetTransferForm();
                  }}
                  className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-[#090503] border border-amber-600/35 w-full max-w-[560px] max-h-[88vh] overflow-y-auto p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-400 uppercase">
                        RAISE STOCK TRANSFER
                      </h4>
                      <button
                        onClick={resetTransferForm}
                        className="text-[#EAE3DB]/40 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateTransfer} className="flex flex-col gap-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase">
                            ORIGIN LOCATION
                          </label>
                          <input
                            type="text"
                            value={transferOrigin}
                            onChange={(e) => setTransferOrigin(e.target.value)}
                            placeholder="e.g. Main Warehouse"
                            required
                            className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-[10px] tracking-wider text-white placeholder-[#EAE3DB]/20"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase">
                            DESTINATION
                          </label>
                          <input
                            type="text"
                            value={transferDestination}
                            onChange={(e) => setTransferDestination(e.target.value)}
                            placeholder="e.g. Dubai Mall Boutique"
                            required
                            className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-[10px] tracking-wider text-white placeholder-[#EAE3DB]/20"
                          />
                        </div>
                      </div>

                      {/* Manifest composer */}
                      <div className="border-t border-white/[0.06] pt-5">
                        <span className="text-[7.5px] tracking-[0.25em] text-amber-500 font-black uppercase block mb-3">
                          MANIFEST LINES
                        </span>

                        <div className="flex flex-col gap-3 mb-4">
                          <select
                            value={transferProductId}
                            onChange={(e) => {
                              setTransferProductId(e.target.value);
                              const p = products.find(pr => String(pr.id) === e.target.value);
                              setTransferSize(Array.isArray(p?.sizes) && p.sizes.length > 0 ? p.sizes[0] : "");
                            }}
                            className="bg-[#090503] border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-[10px] tracking-wider text-white cursor-pointer"
                          >
                            <option value="">SELECT A FRAGRANCE…</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.brand} — {p.name}
                              </option>
                            ))}
                          </select>

                          <div className="grid grid-cols-[1fr_100px_auto] gap-3">
                            <select
                              value={transferSize}
                              onChange={(e) => setTransferSize(e.target.value)}
                              disabled={!transferProductId}
                              className="bg-[#090503] border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-[10px] tracking-wider text-white cursor-pointer disabled:opacity-40"
                            >
                              <option value="">SIZE…</option>
                              {(products.find(p => String(p.id) === transferProductId)?.sizes || []).map(
                                (s: string) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                )
                              )}
                            </select>

                            <input
                              type="number"
                              min="1"
                              value={transferQty}
                              onChange={(e) => setTransferQty(e.target.value)}
                              placeholder="QTY"
                              className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-[10px] tracking-wider text-white placeholder-[#EAE3DB]/20"
                            />

                            <button
                              type="button"
                              onClick={addTransferLine}
                              className="border border-amber-600/40 hover:bg-amber-600 hover:text-white text-amber-400 text-[8px] tracking-[0.2em] font-black uppercase px-4 cursor-pointer transition-all"
                            >
                              ADD
                            </button>
                          </div>
                        </div>

                        {transferLines.length === 0 ? (
                          <div className="border border-dashed border-white/[0.08] p-5 text-center">
                            <span className="text-[8px] tracking-widest text-[#EAE3DB]/30 font-black uppercase">
                              No lines on this manifest yet.
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {transferLines.map((l, idx) => (
                              <div
                                key={`${l.product_id}-${l.size}`}
                                className="bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5 flex justify-between items-center gap-3"
                              >
                                <span className="text-[9px] font-bold uppercase tracking-wider text-[#EAE3DB] min-w-0 truncate">
                                  {l.brand} {l.name}
                                  <span className="text-[#EAE3DB]/40 ml-1.5">({l.size})</span>
                                </span>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-[9px] font-bold text-amber-400 whitespace-nowrap">
                                    QTY {l.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTransferLines(prev => prev.filter((_, i) => i !== idx))
                                    }
                                    className="text-[#EAE3DB]/30 hover:text-red-400 cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={transferSubmitting}
                        className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[9px] font-black tracking-[0.25em] py-4 w-full mt-1 uppercase cursor-pointer transition-all"
                      >
                        {transferSubmitting ? "RAISING…" : "RAISE TRANSFER"}
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
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
                  EXCLUSIVE VAULT
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

            {/* Gift Card Display Matrix — read from public.gift_cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {giftCards.length === 0 ? (
                <div className="col-span-full border border-dashed border-white/[0.08] p-8 text-center">
                  <span className="text-[9px] tracking-widest text-[#EAE3DB]/40 font-bold uppercase">
                    No gift cards issued yet.
                  </span>
                </div>
              ) : (
                giftCards.map((card) => {
                  const balance = parseFloat(String(card.balance ?? 0)) || 0;
                  const initial = parseFloat(String(card.initial_value ?? 0)) || 0;
                  const active = card.is_active !== false;
                  const expires = card.expires_at
                    ? new Date(String(card.expires_at)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "No expiry";
                  return (
                    <div key={String(card.code)} className="bg-[#0e0703] border border-amber-600/35 p-6 relative group overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex justify-between items-start mb-6">
                        <span className="text-[8px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black">
                          {active ? "ACTIVE ASSET" : "DEACTIVATED"}
                        </span>
                        <Gift className={`w-5 h-5 ${active ? "text-amber-500" : "text-[#EAE3DB]/25"}`} />
                      </div>
                      <h4 className="text-[14px] tracking-[0.25em] font-bold text-[#EAE3DB] mb-2 uppercase">
                        {String(card.code)}
                      </h4>
                      <span className="text-2xl font-serif-luxury text-amber-200 tracking-wider font-semibold block mb-4">
                        AED {balance.toFixed(2)}
                      </span>
                      <div className="border-t border-white/[0.04] pt-4 text-[8.5px] tracking-wider text-[#EAE3DB]/40 font-bold uppercase flex justify-between gap-3">
                        <span>Issued: <span className="text-white">AED {initial.toFixed(2)}</span></span>
                        <span>{expires}</span>
                      </div>
                    </div>
                  );
                })
              )}
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
                          placeholder="e.g. SPECIAL-SCENT"
                          required
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">INITIAL BALANCE (AED)</label>
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
                  MEMBER LIST
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
                    <th className="p-4">OPERATOR MEMORANDUM NOTES</th>
                    <th className="p-4 pr-6 text-center">DOSSIER</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#EAE3DB]/30 font-black tracking-widest">
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

                        {/* Memorandum — editable in place */}
                        <td className="p-4 max-w-[280px]">
                          {editingNoteCustomerId === c.id ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={editingNoteVal}
                                onChange={(e) => setEditingNoteVal(e.target.value)}
                                rows={3}
                                autoFocus
                                placeholder="Preferences, allergies, concierge instructions…"
                                className="bg-white/5 border border-amber-600/35 focus:border-amber-500 px-3 py-2 outline-none w-full normal-case font-sans tracking-normal text-[11px] text-[#EAE3DB] placeholder-[#EAE3DB]/25 resize-y"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveCustomerNote(c.id)}
                                  disabled={savingNote}
                                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[7.5px] tracking-[0.2em] font-black uppercase px-3 py-1.5 cursor-pointer transition-all"
                                >
                                  {savingNote ? "SAVING…" : "SAVE"}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNoteCustomerId(null);
                                    setEditingNoteVal("");
                                  }}
                                  className="border border-white/[0.08] hover:border-white/20 text-[#EAE3DB]/50 text-[7.5px] tracking-[0.2em] font-black uppercase px-3 py-1.5 cursor-pointer transition-all"
                                >
                                  CANCEL
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingNoteCustomerId(c.id);
                                setEditingNoteVal(String(c.note || ""));
                              }}
                              title="Click to edit this memorandum"
                              className="group/note text-left w-full flex items-start gap-2 cursor-pointer"
                            >
                              <span className="text-[#EAE3DB]/60 group-hover/note:text-[#EAE3DB]/90 normal-case italic font-sans text-[11px] tracking-normal line-clamp-2 transition-colors">
                                {c.note || "No memorandum recorded."}
                              </span>
                              <Edit2 className="w-3 h-3 text-[#EAE3DB]/20 group-hover/note:text-amber-500 shrink-0 mt-0.5 transition-colors" />
                            </button>
                          )}
                        </td>

                        <td className="p-4 pr-6 text-center">
                          <button
                            onClick={() => setSelectedCustomer(c)}
                            className="border border-white/[0.08] hover:border-amber-500 hover:text-amber-400 text-[#EAE3DB]/60 text-[7.5px] tracking-[0.2em] font-black uppercase px-3 py-1.5 cursor-pointer transition-all"
                          >
                            VIEW
                          </button>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── CLIENT DOSSIER DRAWER ─────────────────────────────────── */}
            <AnimatePresence>
              {selectedCustomer && (
                <div
                  onClick={(e) => {
                    if (e.target === e.currentTarget) closeCustomerDossier();
                  }}
                  className="fixed inset-0 bg-black/85 z-50 flex justify-end"
                >
                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "tween", duration: 0.3 }}
                    className="bg-[#090503] border-l border-amber-600/25 w-full max-w-[560px] h-full overflow-y-auto p-8"
                  >
                    <div className="flex items-start justify-between mb-8">
                      <div>
                        <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1.5">
                          CLIENT DOSSIER
                        </span>
                        <h3 className="text-lg font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                          {selectedCustomer.first_name} {selectedCustomer.last_name}
                        </h3>
                        <span className="text-[9px] text-amber-500/70 lowercase font-bold tracking-normal">
                          {selectedCustomer.email}
                        </span>
                      </div>
                      <button
                        onClick={closeCustomerDossier}
                        className="text-[#EAE3DB]/40 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Standing figures */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                      {[
                        {
                          label: "LIFETIME VALUE",
                          value: `${parseFloat(String(selectedCustomer.total_spent || 0)).toFixed(2)}`,
                          suffix: "AED",
                        },
                        {
                          label: "ORDERS",
                          value: String(getCustomerOrders(selectedCustomer).length),
                          suffix: "PLACED",
                        },
                        {
                          label: "TELEPHONE",
                          value: selectedCustomer.phone || "—",
                          suffix: "ON FILE",
                        },
                      ].map((stat) => (
                        <div key={stat.label} className="bg-white/[0.02] border border-white/[0.05] p-3.5">
                          <span className="text-[6.5px] tracking-[0.2em] text-[#EAE3DB]/35 uppercase font-black block mb-2">
                            {stat.label}
                          </span>
                          <span className="text-[13px] text-amber-200 font-bold font-sans block truncate">
                            {stat.value}
                          </span>
                          <span className="text-[6.5px] tracking-[0.18em] text-[#EAE3DB]/30 uppercase font-black">
                            {stat.suffix}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Memorandum, editable here too */}
                    <div className="mb-8">
                      <span className="text-[8px] tracking-[0.25em] text-amber-500 uppercase font-black block mb-3 border-b border-white/[0.05] pb-2.5">
                        OPERATOR MEMORANDUM
                      </span>
                      <textarea
                        value={
                          editingNoteCustomerId === selectedCustomer.id
                            ? editingNoteVal
                            : String(selectedCustomer.note || "")
                        }
                        onChange={(e) => {
                          setEditingNoteCustomerId(selectedCustomer.id);
                          setEditingNoteVal(e.target.value);
                        }}
                        rows={4}
                        placeholder="Preferences, allergies, concierge instructions…"
                        className="bg-white/[0.03] border border-white/[0.08] focus:border-amber-500 px-4 py-3 outline-none w-full font-sans text-[12px] leading-relaxed text-[#EAE3DB] placeholder-[#EAE3DB]/25 resize-y"
                      />
                      <button
                        onClick={() => handleSaveCustomerNote(selectedCustomer.id)}
                        disabled={savingNote || editingNoteCustomerId !== selectedCustomer.id}
                        className="mt-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[8px] tracking-[0.25em] font-black uppercase px-5 py-2.5 cursor-pointer transition-all"
                      >
                        {savingNote ? "SAVING…" : "SAVE MEMORANDUM"}
                      </button>
                    </div>

                    {/* Order history */}
                    <div>
                      <span className="text-[8px] tracking-[0.25em] text-amber-500 uppercase font-black block mb-3 border-b border-white/[0.05] pb-2.5">
                        ORDER HISTORY
                      </span>
                      <div className="flex flex-col gap-2.5">
                        {getCustomerOrders(selectedCustomer).length === 0 ? (
                          <p className="text-[9px] tracking-widest text-[#EAE3DB]/35 font-bold uppercase py-4">
                            No orders recorded for this client.
                          </p>
                        ) : (
                          getCustomerOrders(selectedCustomer).map((o) => (
                            <div
                              key={o.id}
                              className="bg-white/[0.02] border border-white/[0.05] p-3.5 flex justify-between items-center gap-4"
                            >
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-[10px] font-mono font-black text-amber-400 tracking-wider">
                                  {o.id}
                                </span>
                                <span className="text-[8px] text-[#EAE3DB]/40 font-bold uppercase tracking-wider">
                                  {o.created_at
                                    ? new Date(o.created_at).toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })
                                    : "Unknown date"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[7px] border border-amber-600/35 bg-amber-500/10 text-amber-300 px-2 py-1 font-black tracking-widest uppercase">
                                  {orderStatusLabel(o.status)}
                                </span>
                                <span className="text-[11px] text-amber-200 font-bold font-sans whitespace-nowrap">
                                  {parseFloat(String(o.total_price || 0)).toLocaleString()} AED
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
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

              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
                {/* Manual run of the hourly recovery job (migration 45). */}
                <button
                  onClick={sendCartRecovery}
                  disabled={sendingRecovery}
                  className="bg-black hover:bg-amber-950 disabled:opacity-50 text-white text-[9px] font-black tracking-[0.25em] uppercase px-5 py-3 transition-all duration-300 rounded-none flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingRecovery ? "SENDING…" : "SEND DUE REMINDERS"}
                </button>

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
                            {Array.isArray(ac.cart_items) ? ac.cart_items.map((item: Row, idx: number) => (
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
                          <div className="flex flex-col items-end">
                            <span>{parseFloat(String(ac.total_price || 0)).toLocaleString()} AED</span>
                            {ac.currency && ac.currency !== "AED" && ac.converted_total && (
                              <span className="text-[7.5px] text-[#7C6E65]/60 tracking-wider mt-0.5 uppercase">
                                ({ac.converted_total})
                              </span>
                            )}
                          </div>
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

                        {/* Reminders sent, from migration 45. A cart shows a
                            stage only once the job has actually mailed it. */}
                        <td className="p-4 pr-6 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[8px] font-black tracking-[0.2em] uppercase text-[#7C6E65]">
                              {ac.converted
                                ? "RECOVERED"
                                : ac.recovery_opted_out
                                  ? "OPTED OUT"
                                  : Number(ac.recovery_stage) > 0
                                    ? `${ac.recovery_stage} OF 3 SENT`
                                    : "NO REMINDER YET"}
                            </span>
                            {ac.last_recovery_at && (
                              <span className="text-[7.5px] font-sans text-[#7C6E65]/60 tracking-wider normal-case">
                                {new Date(ac.last_recovery_at).toLocaleString()}
                              </span>
                            )}
                          </div>
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

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleDownloadPDF}
                    className="bg-amber-700 hover:bg-amber-600 text-white text-[9px] font-black tracking-[0.25em] uppercase px-5 py-3.5 transition-all duration-300 rounded-none shadow-[0_4px_15px_rgba(140,98,57,0.25)] flex items-center gap-2 cursor-pointer h-[38px]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    EXPORT PDF
                  </button>

                  <button
                    onClick={handleDownloadCSV}
                    className="bg-black hover:bg-amber-950 text-white text-[9px] font-black tracking-[0.25em] uppercase px-5 py-3.5 transition-all duration-300 rounded-none shadow-[0_4px_15px_rgba(0,0,0,0.15)] flex items-center gap-2 cursor-pointer h-[38px]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    EXPORT CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar-month shortcuts. The date inputs above stay the source
                of truth — these only move them. */}
            <div className="flex flex-wrap items-center gap-2.5 -mt-2">
              <span className="text-[7.5px] tracking-[0.28em] text-[#7C6E65] uppercase font-black mr-1">
                QUICK PERIOD
              </span>
              {[
                { label: "THIS MONTH", run: () => applyMonthPeriod(1) },
                { label: "LAST MONTH", run: applyPreviousMonth },
                { label: "LAST 3 MONTHS", run: () => applyMonthPeriod(3) },
                { label: "LAST 6 MONTHS", run: () => applyMonthPeriod(6) },
                { label: "LAST 12 MONTHS", run: () => applyMonthPeriod(12) },
                {
                  label: "YEAR TO DATE",
                  run: () => applyMonthPeriod(new Date().getMonth() + 1),
                },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={preset.run}
                  className="border border-[#D8CFBF] bg-white hover:border-amber-600 hover:text-amber-800 text-[7.5px] tracking-[0.2em] font-black uppercase text-[#5C4E46] px-3 py-2 transition-all cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Gross Sales */}
              <div className="bg-white border border-[#E5DFD3] p-5 shadow-[0_4px_20px_rgba(140,98,57,0.02)] relative">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-600" />
                <span className="text-[7.5px] tracking-[0.2em] text-[#7C6E65] uppercase font-black block mb-2">PERIOD GROSS REVENUE</span>
                <span className="text-2xl font-black font-sans text-amber-800 tracking-tight">
                  {reportData.totalRevenue.toLocaleString()} AED
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
                  {Math.round(reportData.aov).toLocaleString()} AED
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
                                {orderStatusLabel(o.status)}
                              </span>
                            </td>

                            <td className="p-4 text-right text-amber-800 font-bold font-sans text-xs">
                              <div className="flex flex-col items-end">
                                <span>{parseFloat(String(o.total_price || 0)).toLocaleString()} AED</span>
                                {o.currency && o.currency !== "AED" && o.converted_total && (
                                  <span className="text-[7.5px] text-[#7C6E65]/60 tracking-wider mt-0.5 uppercase">
                                    ({o.converted_total})
                                  </span>
                                )}
                              </div>
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
                    <th className="p-4 text-center">MIN PURCHASE</th>
                    <th className="p-4 text-center">REDEMPTIONS</th>
                    <th className="p-4 text-center">EXPIRES</th>
                    <th className="p-4 text-center">STATUS</th>
                    <th className="p-4 pr-6 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {discounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#EAE3DB]/30 font-black tracking-widest">
                        NO PROMOTIONAL CODES REGISTERED
                      </td>
                    </tr>
                  ) : (
                    discounts.map((disc) => {
                      const limit = disc.usage_limit == null ? null : Number(disc.usage_limit);
                      const used = Number(disc.usage_count) || 0;
                      const exhausted = limit !== null && used >= limit;
                      const expired = disc.ends_at ? new Date(disc.ends_at) < new Date() : false;
                      // What a shopper would actually experience, which is not
                      // the is_active flag alone — place_order() also refuses a
                      // code that is past its date or at its cap.
                      const live = disc.is_active && !expired && !exhausted;

                      return (
                        <tr key={disc.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                          <td className="p-4 pl-6 text-amber-400 font-black">{disc.code}</td>
                          <td className="p-4">
                            {disc.type === "percentage" ? `${disc.value}% OFF` : `AED ${disc.value} OFF`}
                          </td>
                          <td className="p-4 text-center text-[#EAE3DB]/50 font-sans">
                            {parseFloat(String(disc.min_requirement || 0)) > 0
                              ? `AED ${parseFloat(String(disc.min_requirement)).toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="p-4 text-center font-sans">
                            <span className={exhausted ? "text-red-400 font-bold" : "text-amber-100"}>
                              {used}
                              {limit !== null ? ` / ${limit}` : ""}
                            </span>
                            {exhausted && (
                              <span className="block text-[6.5px] tracking-widest text-red-400/70 font-black mt-0.5">
                                CAP REACHED
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center font-sans text-[9px]">
                            {disc.ends_at ? (
                              <span className={expired ? "text-red-400 font-bold" : "text-[#EAE3DB]/60"}>
                                {new Date(disc.ends_at).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            ) : (
                              <span className="text-[#EAE3DB]/30">NO EXPIRY</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`text-[7px] tracking-widest px-2.5 py-1 border font-black ${
                                live
                                  ? "border-green-800/40 bg-green-950/15 text-green-400"
                                  : "border-neutral-700/40 bg-neutral-800/15 text-neutral-400"
                              }`}
                            >
                              {live
                                ? "REDEEMABLE"
                                : !disc.is_active
                                  ? "PAUSED"
                                  : expired
                                    ? "EXPIRED"
                                    : "EXHAUSTED"}
                            </span>
                          </td>
                          <td className="p-4 pr-6">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleToggleDiscount(disc)}
                                title={disc.is_active ? "Pause this code" : "Reactivate this code"}
                                className={`text-[7px] tracking-[0.2em] font-black uppercase px-2.5 py-1.5 border cursor-pointer transition-all ${
                                  disc.is_active
                                    ? "border-white/[0.08] text-[#EAE3DB]/50 hover:border-amber-500 hover:text-amber-400"
                                    : "border-green-800/40 text-green-400 hover:bg-green-950/30"
                                }`}
                              >
                                {disc.is_active ? "PAUSE" : "ACTIVATE"}
                              </button>
                              <button
                                onClick={() => handleDeleteDiscount(disc)}
                                title="Delete this code permanently"
                                className="text-[#EAE3DB]/30 hover:text-red-400 transition-colors p-1 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
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
                            <option value="fixed_amount">FIXED DEDUCTION (AED)</option>
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
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">MINIMUM BASKET INVESTMENT (AED)</label>
                        <input
                          type="number"
                          value={discMinReq}
                          onChange={(e) => setDiscMinReq(e.target.value)}
                          placeholder="e.g. 100.00"
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">
                            EXPIRY DATE (OPTIONAL)
                          </label>
                          <input
                            type="date"
                            value={discEndsAt}
                            onChange={(e) => setDiscEndsAt(e.target.value)}
                            className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-white cursor-pointer"
                          />
                          <span className="text-[6.5px] tracking-widest text-[#EAE3DB]/25 font-bold uppercase">
                            Valid to the end of that day
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black">
                            REDEMPTION CAP (OPTIONAL)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={discUsageLimit}
                            onChange={(e) => setDiscUsageLimit(e.target.value)}
                            placeholder="Unlimited"
                            className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full placeholder-[#EAE3DB]/20"
                          />
                          <span className="text-[6.5px] tracking-widest text-[#EAE3DB]/25 font-bold uppercase">
                            Total uses across all clients
                          </span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={discSubmitting}
                        className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[9px] font-black tracking-[0.25em] py-4 w-full mt-4 cursor-pointer transition-all"
                      >
                        {discSubmitting ? "REGISTERING…" : "GENERATE ACTIVE PROMO KEY"}
                      </button>

                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* ========================================================
            TAB: HOMEPAGE EDITOR (TOP-RIGHT PRODUCT ICONS & HERO SLIDER)
            ======================================================== */}
        {currentTab === "homepage" && (
          <div className="flex flex-col gap-8 font-sans-luxury">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
              <div>
                <span className="text-[9px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  STORE FRONT CONTROL DESK
                </span>
                <h2 className="text-2xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider flex items-center gap-3">
                  HOMEPAGE EDITOR <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 font-sans-luxury font-bold">HERO ICONS CONTROL</span>
                </h2>
                <p className="text-xs text-[#EAE3DB]/60 mt-1 max-w-2xl">
                  Manage the featured top-right product icons, miniature bottle carousel, prices, descriptions, and display order shown on the main homepage.
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-[10px] tracking-widest uppercase text-[#EAE3DB]/60 bg-white/[0.03] border border-white/[0.08] px-4 py-2 font-bold">
                  Active Hero Items: <strong className="text-amber-400 font-extrabold">{products.filter((p: Row) => p.is_hero).length}</strong>
                </span>
              </div>
            </div>

            {/* Active Hero Products Carousel Control Cards */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-serif-luxury text-[#EAE3DB] tracking-wider uppercase flex items-center gap-2">
                  <span>✦</span> Active Homepage Top-Right Product Icons (In Display Order)
                </h3>
              </div>

              {products.filter((p: Row) => p.is_hero).length === 0 ? (
                <div className="bg-[#090503] border border-amber-900/20 p-8 text-center flex flex-col items-center">
                  <p className="text-xs text-[#EAE3DB]/60 uppercase tracking-widest mb-4">No hero products currently selected. Add products from the catalog below.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {products
                    .filter((p: Row) => p.is_hero)
                    .sort((a: Row, b: Row) => (a.hero_order || 0) - (b.hero_order || 0))
                    .map((item: Row, idx: number) => (
                      <div 
                        key={item.id} 
                        className="bg-[#090503] border border-amber-500/20 p-5 flex flex-col justify-between relative group hover:border-amber-500/50 transition-all duration-300 shadow-lg"
                      >
                        {/* Order Badge */}
                        <div className="absolute top-3 left-3 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 tracking-widest uppercase z-10">
                          #{idx + 1} HERO ICON
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={async () => {
                            try {
                              const { error } = await getBrowserSupabase()
                                .from("products")
                                .update({ is_hero: false })
                                .eq("id", item.id);
                              if (error) throw error;
                              setProducts(prev => prev.map(p => p.id === item.id ? { ...p, is_hero: false } : p));
                              triggerToast(`Removed "${item.name}" from homepage hero products.`);
                            } catch (err) {
                              triggerToast(`Failed to update hero status: ${errorMessage(err)}`);
                            }
                          }}
                          className="absolute top-3 right-3 text-[#EAE3DB]/40 hover:text-red-400 text-xs font-bold transition-colors p-1"
                          title="Remove from Hero"
                        >
                          ✕
                        </button>

                        {/* Product Image Stage */}
                        <div className="w-full h-36 relative mt-6 mb-4 flex items-center justify-center bg-black/40 border border-white/[0.04]">
                          <Image
                            src={item.image_url || "/gold-memoir.png"}
                            alt={item.name}
                            fill
                            className="object-contain p-2"
                          />
                        </div>

                        {/* Product Details */}
                        <div className="flex flex-col gap-1.5 mb-4">
                          <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest truncate">
                            {item.tagline || item.brand || "PRIVÉ COLLECTION"}
                          </span>
                          <h4 className="text-sm font-semibold text-[#EAE3DB] uppercase tracking-wide truncate">
                            {item.name}
                          </h4>
                          <span className="text-xs font-bold text-[#EAE3DB] tracking-widest">
                            AED {parseFloat(String(item.price)).toFixed(2)}
                          </span>
                          <p className="text-[10px] text-[#EAE3DB]/50 line-clamp-2 leading-relaxed mt-1">
                            {item.description || "No description set."}
                          </p>
                        </div>

                        {/* Order Reorder Controls & Edit Button */}
                        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              disabled={idx === 0}
                              onClick={async () => {
                                const heroList = products.filter((p: Row) => p.is_hero).sort((a: Row, b: Row) => (a.hero_order || 0) - (b.hero_order || 0));
                                if (idx <= 0) return;
                                const prevItem = heroList[idx - 1];
                                const currentOrder = item.hero_order || (idx + 1);
                                const targetOrder = prevItem.hero_order || idx;
                                
                                await getBrowserSupabase().from("products").update({ hero_order: targetOrder }).eq("id", item.id);
                                await getBrowserSupabase().from("products").update({ hero_order: currentOrder }).eq("id", prevItem.id);
                                
                                setProducts(prev => prev.map(p => {
                                  if (p.id === item.id) return { ...p, hero_order: targetOrder };
                                  if (p.id === prevItem.id) return { ...p, hero_order: currentOrder };
                                  return p;
                                }));
                                triggerToast("Reordered homepage hero products.");
                              }}
                              className="w-7 h-7 bg-white/[0.04] hover:bg-amber-500 hover:text-black text-[#EAE3DB] text-xs font-bold flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              title="Move Left/Up"
                            >
                              ←
                            </button>
                            <button
                              disabled={idx === products.filter((p: Row) => p.is_hero).length - 1}
                              onClick={async () => {
                                const heroList = products.filter((p: Row) => p.is_hero).sort((a: Row, b: Row) => (a.hero_order || 0) - (b.hero_order || 0));
                                if (idx >= heroList.length - 1) return;
                                const nextItem = heroList[idx + 1];
                                const currentOrder = item.hero_order || (idx + 1);
                                const targetOrder = nextItem.hero_order || (idx + 2);

                                await getBrowserSupabase().from("products").update({ hero_order: targetOrder }).eq("id", item.id);
                                await getBrowserSupabase().from("products").update({ hero_order: currentOrder }).eq("id", nextItem.id);

                                setProducts(prev => prev.map(p => {
                                  if (p.id === item.id) return { ...p, hero_order: targetOrder };
                                  if (p.id === nextItem.id) return { ...p, hero_order: currentOrder };
                                  return p;
                                }));
                                triggerToast("Reordered homepage hero products.");
                              }}
                              className="w-7 h-7 bg-white/[0.04] hover:bg-amber-500 hover:text-black text-[#EAE3DB] text-xs font-bold flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              title="Move Right/Down"
                            >
                              →
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              setEditingProduct(item);
                            }}
                            className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-black px-2.5 py-1.5 transition-all"
                          >
                            EDIT DETAILS
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Catalog Selector: Toggle Hero Status for any product */}
            <div className="bg-[#090503] border border-white/[0.06] p-6 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4 mb-6">
                <div>
                  <h4 className="text-sm font-serif-luxury text-[#EAE3DB] tracking-wider uppercase">
                    Catalog Product Hero Selector
                  </h4>
                  <p className="text-[11px] text-[#EAE3DB]/50">
                    Toggle any catalog fragrance to feature it on the homepage top-right hero section.
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Search products by title or brand..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-black/50 border border-white/10 text-xs text-white px-4 py-2 w-full sm:w-72 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[9px] font-extrabold tracking-widest text-[#EAE3DB]/50 uppercase">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Brand & Name</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Tagline</th>
                      <th className="py-3 px-4">Hero Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {products
                      .filter((p: Row) => 
                        !searchTerm || 
                        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        p.brand.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((prod: Row) => {
                        const isHero = !!prod.is_hero;
                        return (
                          <tr key={prod.id} className="hover:bg-white/[0.01] transition-colors text-xs text-[#EAE3DB]">
                            <td className="py-3 px-4">
                              <div className="w-10 h-12 relative bg-black/40 border border-white/5">
                                <Image
                                  src={prod.image_url || "/gold-memoir.png"}
                                  alt={prod.name}
                                  fill
                                  className="object-contain p-1"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">{prod.brand}</span>
                                <span className="font-semibold text-white">{prod.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono">
                              AED {parseFloat(String(prod.price)).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-[10px] text-[#EAE3DB]/60">
                              {prod.tagline || "—"}
                            </td>
                            <td className="py-3 px-4">
                              {isHero ? (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold tracking-widest px-2.5 py-1 uppercase">
                                  ACTIVE HERO #{prod.hero_order || "—"}
                                </span>
                              ) : (
                                <span className="bg-white/[0.03] text-[#EAE3DB]/40 text-[9px] font-bold tracking-widest px-2.5 py-1 uppercase border border-white/5">
                                  STANDARD CATALOG
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={async () => {
                                  const nextState = !isHero;
                                  const maxOrder = Math.max(...products.filter((p: Row) => p.is_hero).map((p: Row) => p.hero_order || 0), 0);
                                  const newOrder = nextState ? maxOrder + 1 : 0;

                                  try {
                                    const { error } = await getBrowserSupabase()
                                      .from("products")
                                      .update({ is_hero: nextState, hero_order: newOrder })
                                      .eq("id", prod.id);

                                    if (error) throw error;

                                    setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, is_hero: nextState, hero_order: newOrder } : p));
                                    triggerToast(nextState ? `Added "${prod.name}" to homepage hero icons.` : `Removed "${prod.name}" from homepage hero.`);
                                  } catch (err) {
                                    triggerToast(`Failed to update hero status: ${errorMessage(err)}`);
                                  }
                                }}
                                className={`text-[9px] font-black tracking-widest px-3 py-1.5 uppercase transition-all ${
                                  isHero 
                                    ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-black"
                                }`}
                              >
                                {isHero ? "REMOVE FROM HERO" : "+ SET AS HERO"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
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
              {/* Editorial articles — public.blog_posts */}
              <div className="bg-[#090503] border border-white/[0.04] p-6">
                <div className="flex justify-between items-center mb-6 border-b border-white/[0.04] pb-4">
                  <h4 className="text-[10px] tracking-[0.2em] text-amber-500 font-black uppercase">
                    EDITORIAL BLOG ARTICLES
                  </h4>
                  <span className="text-[8px] text-[#EAE3DB]/40 font-bold uppercase">
                    {blogPosts.length} total
                  </span>
                </div>
                <div className="flex flex-col gap-4">
                  {blogPosts.length === 0 ? (
                    <p className="text-[9px] tracking-widest text-[#EAE3DB]/40 font-bold uppercase py-4">
                      No articles in the database yet.
                    </p>
                  ) : (
                    blogPosts.map((post) => (
                      <div key={String(post.id)} className="bg-white/[0.01] border border-white/[0.03] p-4 flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <span className="text-[8px] tracking-widest text-[#EAE3DB]/40 font-black block mb-1">
                            {post.is_published ? "PUBLISHED" : "DRAFT"}
                          </span>
                          <h5 className="text-[11px] tracking-widest text-[#EAE3DB] font-bold uppercase mb-1 truncate">
                            {String(post.title)}
                          </h5>
                          <span className="text-[8px] text-[#EAE3DB]/40 font-bold">/blogs/{String(post.slug)}</span>
                        </div>
                        <a
                          href={`/blogs/${String(post.slug)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[8px] border border-white/[0.08] hover:border-amber-500 hover:text-amber-400 px-3 py-1.5 font-bold uppercase shrink-0"
                        >
                          VIEW
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Static pages — public.cms_pages */}
              <div className="bg-[#090503] border border-white/[0.04] p-6">
                <div className="flex justify-between items-center mb-6 border-b border-white/[0.04] pb-4">
                  <h4 className="text-[10px] tracking-[0.2em] text-amber-500 font-black uppercase">
                    STATIC CMS PAGES
                  </h4>
                  <span className="text-[8px] text-[#EAE3DB]/40 font-bold uppercase">
                    {cmsPages.length} total
                  </span>
                </div>
                <div className="flex flex-col gap-4">
                  {cmsPages.length === 0 ? (
                    <p className="text-[9px] tracking-widest text-[#EAE3DB]/40 font-bold uppercase py-4">
                      No CMS pages in the database yet.
                    </p>
                  ) : (
                    cmsPages.map((page) => (
                      <div key={String(page.id)} className="bg-white/[0.01] border border-white/[0.03] p-4">
                        <span className="text-[8px] tracking-widest text-[#EAE3DB]/40 font-black block mb-1">
                          {page.is_published ? "PUBLISHED" : "DRAFT"}
                        </span>
                        <h5 className="text-[11px] tracking-widest text-[#EAE3DB] font-bold uppercase mb-1">
                          {String(page.title)}
                        </h5>
                        <span className="text-[8px] text-[#EAE3DB]/40 font-bold">/{String(page.slug)}</span>
                      </div>
                    ))
                  )}
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

            {/* Markets table — read from public.markets */}
            <div className="bg-white/[0.015] border border-white/[0.04] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black bg-white/[0.01]">
                    <th className="p-4 pl-6">REGION DESIGNATION</th>
                    <th className="p-4">BASE CURRENCY</th>
                    <th className="p-4 text-center">REGIONS COVERED</th>
                    <th className="p-4 text-right">PRICE COEFFICIENT</th>
                    <th className="p-4 pr-6 text-center">MARKET STATUS</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {markets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[9px] text-[#EAE3DB]/40 font-bold">
                        No markets configured yet.
                      </td>
                    </tr>
                  ) : (
                    markets.map((mkt) => {
                      const regions = Array.isArray(mkt.regions) ? mkt.regions : [];
                      const active = mkt.is_active !== false;
                      const coeff = parseFloat(String(mkt.price_adjustment_coefficient ?? 1)) || 1;
                      return (
                        <tr key={String(mkt.id)} className="border-b border-white/[0.04]">
                          <td className="p-4 pl-6 font-bold text-amber-400">{String(mkt.name || "—")}</td>
                          <td className="p-4">
                            {String(mkt.currency_code || "")} {mkt.currency_symbol ? `(${String(mkt.currency_symbol)})` : ""}
                          </td>
                          <td className="p-4 text-center text-[#EAE3DB]/60">
                            {regions.length > 0 ? `${regions.length} REGION${regions.length === 1 ? "" : "S"}` : "—"}
                          </td>
                          <td className="p-4 text-right text-[#EAE3DB] font-bold font-sans">
                            {coeff.toFixed(2)} × AED
                          </td>
                          <td className="p-4 pr-6 text-center">
                            <span className={`text-[8px] border px-2.5 py-1 font-black ${
                              active
                                ? "border-green-600/35 bg-green-500/10 text-green-700"
                                : "border-white/[0.08] bg-white/[0.02] text-[#EAE3DB]/40"
                            }`}>
                              {active ? "ACTIVE" : "DISABLED"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB: ANALYTICS REPORTS
            ======================================================== */}
        {currentTab === "analytics" && (() => {
          // Derived from public.analytics_events and the live order book —
          // these figures used to be hardcoded ("14,200 Operators").
          const sessionsFor = (type: string) =>
            new Set(
              analyticsEvents
                .filter((ev) => String(ev.event_type) === type)
                .map((ev) => String(ev.session_id))
            ).size;

          const funnel = [
            { label: "Storefront visits", count: sessionsFor("view") },
            { label: "Added to bag", count: sessionsFor("cart_add") },
            { label: "Reached checkout", count: sessionsFor("checkout") },
            { label: "Completed purchases", count: orders.length || sessionsFor("purchase") },
          ];
          const top = funnel[0].count || 1;

          // Olfactory share: real sold units where we have them, else the
          // catalogue's own composition (labelled as such, never as sales).
          const soldByGroup: Record<string, number> = {};
          orderItems.forEach((item) => {
            const prod = products.find((pr) => pr.id === item.product_id);
            const group = String(prod?.olfactory_group || "").trim();
            if (group) soldByGroup[group] = (soldByGroup[group] || 0) + (Number(item.quantity) || 0);
          });
          const usingSales = Object.keys(soldByGroup).length > 0;
          const groupTally = usingSales ? soldByGroup : products.reduce((acc: Record<string, number>, pr) => {
            const group = String(pr.olfactory_group || "").trim();
            if (group) acc[group] = (acc[group] || 0) + 1;
            return acc;
          }, {});
          const groupTotal = Object.values(groupTally).reduce((a, b) => a + b, 0) || 1;
          const palette = ["#e6a86c", "#d97706", "#78350f", "#b45309", "#8C6239", "#5C4E46"];
          const groups = Object.entries(groupTally)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, n], i) => ({ name, n, pct: (n / groupTotal) * 100, color: palette[i % palette.length] }));

          const CIRC = 2 * Math.PI * 40;
          let offset = 0;

          return (
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
                <h4 className="text-[10px] tracking-[0.2em] text-amber-500 uppercase font-black mb-6">
                  VISITATION FUNNEL
                </h4>
                {analyticsEvents.length === 0 && orders.length === 0 ? (
                  <p className="text-[9px] tracking-widest text-[#EAE3DB]/40 font-bold uppercase py-6">
                    No analytics events recorded yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4 text-[10px] font-bold tracking-wider uppercase">
                    {funnel.map((stage, i) => {
                      const pct = Math.min(100, (stage.count / top) * 100);
                      return (
                        <div key={stage.label}>
                          <div className={`flex justify-between mb-1.5 ${i === funnel.length - 1 ? "text-amber-400" : ""}`}>
                            <span>{i + 1}. {stage.label} ({pct.toFixed(1)}%)</span>
                            <span className="text-[#EAE3DB]/50">{stage.count.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-3 bg-white/5 relative">
                            <div
                              className={`absolute top-0 left-0 bottom-0 ${i === funnel.length - 1 ? "bg-amber-500" : "bg-amber-600"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Scent profiles share */}
              <div className="bg-white/[0.015] border border-white/[0.04] p-6">
                <h4 className="text-[10px] tracking-[0.2em] text-amber-500 uppercase font-black mb-2">
                  OLFACTORY DISTRIBUTION
                </h4>
                <p className="text-[8px] tracking-widest text-[#EAE3DB]/35 font-bold uppercase mb-6">
                  {usingSales ? "By units sold" : "By catalogue composition — no sales recorded yet"}
                </p>

                {groups.length === 0 ? (
                  <p className="text-[9px] tracking-widest text-[#EAE3DB]/40 font-bold uppercase py-6">
                    No olfactory data available.
                  </p>
                ) : (
                  <div className="flex items-center gap-8 py-2 flex-wrap">
                    <svg className="w-36 h-36" viewBox="0 0 100 100">
                      {groups.map((g) => {
                        const len = (g.pct / 100) * CIRC;
                        const dash = `${len} ${CIRC - len}`;
                        const thisOffset = offset;
                        offset += len;
                        return (
                          <circle
                            key={g.name}
                            cx="50" cy="50" r="40" fill="none"
                            stroke={g.color} strokeWidth="15"
                            strokeDasharray={dash}
                            strokeDashoffset={-thisOffset}
                            transform="rotate(-90 50 50)"
                          />
                        );
                      })}
                    </svg>

                    <div className="flex flex-col gap-3.5 text-[9px] tracking-widest font-black uppercase text-[#EAE3DB]/60">
                      {groups.map((g) => (
                        <div key={g.name} className="flex items-center gap-2">
                          <div className="w-3 h-3" style={{ backgroundColor: g.color }} />
                          <span>{g.name} ({g.pct.toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
          );
        })()}

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
                          onError={(e: Row) => { e.target.src = "/campaign-gold.png"; }}
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
                          {col.rules.map((rule: Row, idx: number) => (
                            <span key={idx} className="text-[#EAE3DB]/80 block font-mono">
                              • Product {rule.field} {rule.relation} &apos;{rule.value}&apos;
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
                        onClick={() => openCollectionEditor(col)}
                        className="border border-amber-600/30 hover:border-amber-500 hover:bg-amber-950/20 text-amber-400 text-[7.5px] tracking-[0.2em] font-black uppercase py-2.5 px-3 transition-all cursor-pointer flex items-center gap-1.5 justify-center flex-1"
                        title="Edit this collection"
                      >
                        <Edit2 className="w-3 h-3" />
                        EDIT
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to deregister this collection?`)) {
                            try {
                              await getBrowserSupabase().from("collections").delete().eq("id", col.id);
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

            {/* ── EDIT COLLECTION MODAL ─────────────────────────────────── */}
            <AnimatePresence>
              {editingCollection && (
                <div
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setEditingCollection(null);
                  }}
                  className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-[#090503] border border-amber-600/35 w-full max-w-[520px] max-h-[88vh] overflow-y-auto p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-400 uppercase">
                          EDIT COLLECTION
                        </h4>
                        <span className="text-[8px] tracking-widest text-[#EAE3DB]/35 font-bold uppercase font-mono">
                          {String(editingCollection.id)}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingCollection(null)}
                        className="text-[#EAE3DB]/40 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleUpdateCollection} className="flex flex-col gap-5">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase">
                          COLLECTION TITLE
                        </label>
                        <input
                          type="text"
                          value={editColTitle}
                          onChange={(e) => setEditColTitle(e.target.value)}
                          required
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold uppercase w-full text-[11px] tracking-wider text-white"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase">
                          DESCRIPTION
                        </label>
                        <textarea
                          value={editColDescription}
                          onChange={(e) => setEditColDescription(e.target.value)}
                          rows={3}
                          placeholder="A curated luxury selection."
                          className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 w-full font-sans text-[12px] leading-relaxed text-[#EAE3DB] placeholder-[#EAE3DB]/25 resize-y"
                        />
                      </div>

                      {/* Cover */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase">
                          COVER IMAGE
                        </label>
                        <div className="flex gap-3 items-start">
                          <div className="w-24 h-24 bg-amber-950/10 border border-white/[0.06] overflow-hidden shrink-0">
                            <img
                              src={editColCover || "/campaign-gold.png"}
                              alt="Collection cover"
                              className="w-full h-full object-cover"
                              onError={(e: Row) => {
                                e.target.src = "/campaign-gold.png";
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-2 flex-1">
                            <label
                              className={`border border-dashed border-white/[0.12] hover:border-amber-500 text-center py-3 text-[7.5px] tracking-[0.2em] font-black uppercase transition-all ${
                                editColUploading
                                  ? "opacity-50 cursor-wait text-[#EAE3DB]/40"
                                  : "cursor-pointer text-[#EAE3DB]/50 hover:text-amber-400"
                              }`}
                            >
                              {editColUploading ? "UPLOADING…" : "UPLOAD NEW COVER"}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleEditCollectionCover}
                                disabled={editColUploading}
                                className="hidden"
                              />
                            </label>
                            <input
                              type="text"
                              value={editColCover}
                              onChange={(e) => setEditColCover(e.target.value)}
                              placeholder="/campaign-gold.png"
                              className="bg-white/5 border border-white/[0.08] px-3 py-2 outline-none focus:border-amber-500 w-full font-sans text-[10px] text-[#EAE3DB]/70 placeholder-[#EAE3DB]/20"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Curation mode */}
                      <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase">
                          CURATION MODE
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: "manual", label: "MANUAL", note: "Hand-picked flacons" },
                            { id: "automated", label: "AUTOMATED", note: "Matched by tag" },
                          ].map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => setEditColType(mode.id)}
                              className={`border p-3 text-left transition-all cursor-pointer ${
                                editColType === mode.id
                                  ? "border-amber-500 bg-amber-950/25"
                                  : "border-white/[0.08] hover:border-white/20"
                              }`}
                            >
                              <span
                                className={`text-[9px] tracking-[0.2em] font-black uppercase block mb-1 ${
                                  editColType === mode.id ? "text-amber-400" : "text-[#EAE3DB]/60"
                                }`}
                              >
                                {mode.label}
                              </span>
                              <span className="text-[7px] tracking-wider text-[#EAE3DB]/35 font-bold uppercase">
                                {mode.note}
                              </span>
                            </button>
                          ))}
                        </div>

                        {editColType === "automated" && (
                          <div className="flex flex-col gap-1.5 mt-2">
                            <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase">
                              MATCH PRODUCTS TAGGED
                            </label>
                            <input
                              type="text"
                              value={editColRuleTag}
                              onChange={(e) => setEditColRuleTag(e.target.value)}
                              placeholder="e.g. oud"
                              className="bg-white/5 border border-white/[0.08] px-3.5 py-2.5 outline-none focus:border-amber-500 font-bold w-full text-[10px] tracking-widest text-white placeholder-[#EAE3DB]/20 lowercase"
                            />
                            <span className="text-[7px] tracking-wider text-amber-500/60 font-bold uppercase mt-1">
                              {
                                products.filter(
                                  (p) =>
                                    Array.isArray(p.tags) &&
                                    p.tags.includes(editColRuleTag.trim().toLowerCase())
                                ).length
                              }{" "}
                              fragrance(s) currently carry this tag — membership is rewritten on save
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => setEditingCollection(null)}
                          className="border border-white/[0.08] hover:border-white/20 text-[#EAE3DB]/50 text-[9px] font-black tracking-[0.25em] py-4 flex-1 uppercase cursor-pointer transition-all"
                        >
                          CANCEL
                        </button>
                        <button
                          type="submit"
                          disabled={editColSaving || editColUploading}
                          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[9px] font-black tracking-[0.25em] py-4 flex-[2] uppercase cursor-pointer transition-all"
                        >
                          {editColSaving ? "SAVING…" : "SAVE COLLECTION"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

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
                                    try {
                                      triggerToast("Uploading cover to Supabase...");
                                      let uploadFile = file;
                                      if (file.type !== "image/webp") {
                                        try {
                                          uploadFile = await convertToWebP(file);
                                        } catch (webpErr) {
                                          console.error("WebP conversion failed, using original file", webpErr);
                                        }
                                      }
                                      const fileExt = uploadFile.name.split('.').pop();
                                      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
                                      const filePath = `covers/${fileName}`;

                                      const { data, error } = await getBrowserSupabase().storage
                                        .from('collection-covers')
                                        .upload(filePath, uploadFile);

                                      if (error) {
                                        triggerToast(`Upload failed: ${error.message}`);
                                        return;
                                      }

                                      const { data: { publicUrl } } = getBrowserSupabase().storage
                                        .from('collection-covers')
                                        .getPublicUrl(filePath);

                                      if (publicUrl) {
                                        setNewCollectionCoverImage(publicUrl);
                                        triggerToast("Uploaded directly to Supabase storage!");
                                      } else {
                                        triggerToast("Failed to retrieve public URL from Supabase.");
                                      }
                                    } catch (err) {
                                      console.error("Storage upload failed", err);
                                      triggerToast(`Upload error: ${errorMessage(err, "Unknown error")}`);
                                    }
                                  };

                                  uploadToSupabase();
                                }}
                              />
                              {newCollectionCoverImage && !newCollectionCoverImage.startsWith("/") && !newCollectionCoverImage.startsWith("data:") ? (
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
                            (pc: Row) => pc.product_id === prod.id && pc.collection_id === selectedManageCollection.id
                          );
                          return (
                            <div 
                              key={prod.id} 
                              onClick={async () => {
                                try {
                                  if (isAssigned) {
                                    await getBrowserSupabase()
                                      .from("product_collections")
                                      .delete()
                                      .match({ product_id: prod.id, collection_id: selectedManageCollection.id });
                                    setProductCollections(prev => prev.filter(
                                      (pc: Row) => !(pc.product_id === prod.id && pc.collection_id === selectedManageCollection.id)
                                    ));
                                    triggerToast(`Deregistered ${prod.name} from collection.`);
                                  } else {
                                    const newMapping = { product_id: prod.id, collection_id: selectedManageCollection.id };
                                    await getBrowserSupabase().from("product_collections").insert(newMapping);
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

        {/* ========================================================
            TAB: INQUIRIES LOG
            ======================================================== */}
        {currentTab === "inquiries" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[8px] tracking-[0.35em] text-amber-500 uppercase font-black block mb-1">
                  CUSTOMER MESSAGES
                </span>
                <h2 className="text-xl font-serif-luxury text-[#EAE3DB] uppercase tracking-wider">
                  INQUIRIES LOG
                </h2>
              </div>

              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
                {/* Answered / unanswered filter */}
                <div className="flex border border-white/[0.08]">
                  {([
                    { id: "all", label: "ALL" },
                    { id: "new", label: "UNANSWERED" },
                    { id: "answered", label: "ANSWERED" },
                  ] as const).map((f) => {
                    const count =
                      f.id === "all"
                        ? inquiries.length
                        : inquiries.filter(
                            (i) => (i.status === "answered" ? "answered" : "new") === f.id
                          ).length;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setInquiryStatusFilter(f.id)}
                        className={`text-[7.5px] tracking-[0.2em] font-black uppercase px-3.5 py-2.5 transition-all cursor-pointer ${
                          inquiryStatusFilter === f.id
                            ? "bg-amber-600 text-white"
                            : "text-[#EAE3DB]/50 hover:text-amber-400"
                        }`}
                      >
                        {f.label} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE3DB]/30">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter inquiries by name, email..."
                    className="bg-white/[0.02] border border-white/[0.08] focus:border-amber-500/50 rounded-none pl-10 pr-4 py-2.5 text-[9px] tracking-widest text-[#EAE3DB] outline-none placeholder-[#EAE3DB]/20 w-full font-bold uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Inquiries Table */}
            <div className="bg-white/[0.015] border border-white/[0.04] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[8.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black bg-white/[0.01]">
                    <th className="p-4 pl-6">DATE RECEIVED</th>
                    <th className="p-4">CUSTOMER DETAILS</th>
                    <th className="p-4">SUBJECT / INQUIRY</th>
                    <th className="p-4">MESSAGE</th>
                    <th className="p-4 text-center">STATUS</th>
                    <th className="p-4 pr-6 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] tracking-wider font-semibold uppercase text-[#EAE3DB]/80">
                  {(() => {
                    const term = searchTerm.toLowerCase();
                    const filteredInquiries = inquiries
                      .filter(inq => {
                        // Rows written before migration 48 have no status at
                        // all; those read as unanswered rather than vanishing
                        // from both filters.
                        const status = inq.status === "answered" ? "answered" : "new";
                        return inquiryStatusFilter === "all" || status === inquiryStatusFilter;
                      })
                      .filter(inq =>
                        (inq.name || "").toLowerCase().includes(term) ||
                        (inq.email || "").toLowerCase().includes(term) ||
                        (inq.subject || "").toLowerCase().includes(term) ||
                        (inq.message || "").toLowerCase().includes(term)
                      );

                    if (filteredInquiries.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-[#EAE3DB]/30 font-black tracking-widest">
                            NO CUSTOMER MESSAGES FOUND
                          </td>
                        </tr>
                      );
                    }

                    return filteredInquiries.map((inq) => {
                      const answered = inq.status === "answered";
                      return (
                        <tr
                          key={inq.id}
                          className={`border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors ${
                            answered ? "opacity-60" : ""
                          }`}
                        >
                          <td className="p-4 pl-6 text-[#EAE3DB]/50">
                            {new Date(inq.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-[#EAE3DB]">{inq.name}</span>
                              <span className="text-[8.5px] text-amber-500 lowercase tracking-normal font-medium">{inq.email}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="border border-amber-600/35 bg-amber-950/20 text-amber-400 text-[7px] tracking-widest font-black uppercase px-2 py-0.5 inline-block">
                              {inq.subject}
                            </span>
                          </td>
                          <td className="p-4 max-w-sm normal-case font-medium tracking-normal text-[11px] leading-relaxed text-[#EAE3DB]/70">
                            {inq.message}
                            {inq.admin_reply && (
                              <div className="mt-2.5 border-l-2 border-amber-600/40 pl-3 py-1">
                                <span className="text-[7px] tracking-[0.2em] text-amber-500/70 font-black uppercase block mb-1">
                                  REPLIED{inq.replied_by ? ` BY ${inq.replied_by}` : ""}
                                </span>
                                <span className="text-[10.5px] text-[#EAE3DB]/50 italic">
                                  {inq.admin_reply}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="p-4 text-center">
                            <span
                              className={`inline-block text-[7px] tracking-widest px-2.5 py-1 border font-black uppercase whitespace-nowrap ${
                                answered
                                  ? "border-green-800/40 bg-green-950/15 text-green-400"
                                  : "border-amber-600/35 bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {answered ? "ANSWERED" : "AWAITING REPLY"}
                            </span>
                            {answered && inq.answered_at && (
                              <span className="block text-[7px] text-[#EAE3DB]/30 font-bold mt-1.5 normal-case tracking-normal font-sans">
                                {new Date(inq.answered_at).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </td>

                          <td className="p-4 pr-6">
                            <div className="flex flex-col items-stretch gap-1.5 min-w-[110px]">
                              <button
                                onClick={() => {
                                  setReplyingInquiry(inq);
                                  setReplyText("");
                                }}
                                className="text-amber-400 hover:text-white hover:bg-amber-600 text-[8px] tracking-widest font-bold uppercase transition-all bg-amber-950/20 border border-amber-600/30 px-2.5 py-1.5 cursor-pointer inline-flex items-center gap-1.5 justify-center"
                              >
                                <Send className="w-3 h-3" />
                                REPLY
                              </button>

                              <button
                                onClick={() => handleSetInquiryStatus(inq, answered ? "new" : "answered")}
                                className="text-[#EAE3DB]/50 hover:text-[#EAE3DB] text-[8px] tracking-widest font-bold uppercase transition-all border border-white/[0.08] hover:border-white/20 px-2.5 py-1.5 cursor-pointer"
                              >
                                {answered ? "REOPEN" : "MARK ANSWERED"}
                              </button>

                              <button
                                onClick={() => handleDeleteInquiry(inq.id)}
                                className="text-red-400/80 hover:text-red-400 text-[8px] tracking-widest font-bold uppercase transition-all bg-red-950/10 border border-red-500/10 hover:border-red-500/25 px-2.5 py-1.5 cursor-pointer inline-flex items-center gap-1 justify-center"
                              >
                                <Trash2 className="w-3 h-3" />
                                REMOVE
                              </button>
                            </div>
                          </td>
                         </tr>
                       );
                     });
                   })()}
                 </tbody>
               </table>
             </div>

            {/* ── REPLY MODAL ───────────────────────────────────────────── */}
            <AnimatePresence>
              {replyingInquiry && (
                <div
                  onClick={(e) => {
                    if (e.target === e.currentTarget && !replySubmitting) setReplyingInquiry(null);
                  }}
                  className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-[#090503] border border-amber-600/35 w-full max-w-[560px] max-h-[88vh] overflow-y-auto p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500" />

                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h4 className="text-[12px] tracking-[0.3em] font-black text-amber-400 uppercase mb-1">
                          REPLY TO ENQUIRY
                        </h4>
                        <span className="text-[9px] text-[#EAE3DB]/50 font-bold">
                          {replyingInquiry.name}
                          <span className="text-amber-500/70 lowercase ml-1.5 tracking-normal">
                            {replyingInquiry.email}
                          </span>
                        </span>
                      </div>
                      <button
                        onClick={() => setReplyingInquiry(null)}
                        disabled={replySubmitting}
                        className="text-[#EAE3DB]/40 hover:text-white cursor-pointer disabled:opacity-30"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* What they wrote */}
                    <div className="bg-white/[0.02] border border-white/[0.05] p-4 mb-5">
                      <span className="text-[7px] tracking-[0.25em] text-[#EAE3DB]/35 font-black uppercase block mb-2">
                        {replyingInquiry.subject}
                      </span>
                      <p className="text-[11.5px] leading-relaxed text-[#EAE3DB]/70 font-sans">
                        {replyingInquiry.message}
                      </p>
                    </div>

                    <form onSubmit={handleSendInquiryReply} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[7.5px] tracking-widest text-[#EAE3DB]/40 font-black uppercase">
                          YOUR REPLY
                        </label>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={7}
                          autoFocus
                          maxLength={5000}
                          placeholder="Write the reply the client will receive by email…"
                          className="bg-white/[0.03] border border-white/[0.08] focus:border-amber-500 px-4 py-3 outline-none w-full font-sans text-[12px] leading-relaxed text-[#EAE3DB] placeholder-[#EAE3DB]/25 resize-y"
                        />
                        <span className="text-[7px] tracking-wider text-[#EAE3DB]/25 font-bold uppercase">
                          Sent from the house address · marked answered once delivered
                        </span>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setReplyingInquiry(null)}
                          disabled={replySubmitting}
                          className="border border-white/[0.08] hover:border-white/20 text-[#EAE3DB]/50 text-[9px] font-black tracking-[0.25em] py-4 flex-1 uppercase cursor-pointer transition-all disabled:opacity-40"
                        >
                          CANCEL
                        </button>
                        <button
                          type="submit"
                          disabled={replySubmitting || !replyText.trim()}
                          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[9px] font-black tracking-[0.25em] py-4 flex-[2] uppercase cursor-pointer transition-all inline-flex items-center justify-center gap-2"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {replySubmitting ? "SENDING…" : "SEND REPLY"}
                        </button>
                      </div>
                    </form>
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

export default function AdminDashboard() {
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
