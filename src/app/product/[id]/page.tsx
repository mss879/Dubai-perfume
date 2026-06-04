"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { 
  ArrowLeft, ShoppingBag, Heart, Plus, Minus, 
  Loader2, Check, HelpCircle, ChevronDown, ShieldCheck, Truck
} from "lucide-react";
import { clientSafeSupabase } from "../../lib/supabase";
import gsap from "gsap";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductPage({ params }: ProductPageProps) {
  const resolvedParams = use(params);
  const productId = parseInt(resolvedParams.id, 10);
  const router = useRouter();

  // Component States
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [activeCurrency, setActiveCurrency] = useState("AED");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // GSAP Ref bindings
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const activeImageRef = useRef<HTMLDivElement>(null);
  const textStaggerRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        // Query products from Supabase
        const { data: dbProducts, error } = await clientSafeSupabase
          .from("products")
          .select("*");
        
        let foundProduct = null;
        if (dbProducts && !error) {
          foundProduct = dbProducts.find((p: any) => p.id === productId);
        }

        // Fallback to static seed data if not found or DB failure
        if (!foundProduct) {
          const SEED_PRODUCTS = [
            { id: 101, brand: "GHARIB", name: "Gold Memoir", price: 745.00, sizes: ["50ml", "100ml"], image_url: "/gold-memoir.png", description: "Elevate your everyday moments with our luxurious fragrances that transform routine into a sensory journey of pleasure and luxury.", tagline: "Aurum Noble Edition", olfactory_group: "Woody & Oud", tags: ["wood", "oud"], top_notes: ["Saffron", "Cinnamon", "Bergamot"], heart_notes: ["Rose", "Jasmine", "Clove"], base_notes: ["Amber", "Agarwood (Oud)", "Sandalwood", "Vanilla"] },
            { id: 102, brand: "GHARIB", name: "Enchanted Blooms", price: 437.00, sizes: ["30ml", "50ml"], image_url: "/enchanted-blooms.png", description: "A floral-centric perfume inspired by a magical garden with a delicate bouquet of blooming jasmine, fresh peony, and soft vanilla highlights.", tagline: "Aura Floral Collection", olfactory_group: "Floral & Sweet", tags: ["floral"], top_notes: ["Pear", "Red Berries", "Jasmine"], heart_notes: ["Peony", "Freesia", "Orange Blossom"], base_notes: ["Vanilla", "White Musk", "Patchouli"] },
            { id: 103, brand: "GHARIB", name: "Mystic Oud", price: 620.00, sizes: ["50ml", "100ml"], image_url: "/mystic-oud.png", description: "An oriental fragrance that combines the richness of exotic spices, warm agarwood, and rare dark cardamom for a mysterious, timeless appeal.", tagline: "Royal Spice Reserve", olfactory_group: "Woody & Oud", tags: ["wood", "oud"], top_notes: ["Saffron", "Nutmeg", "Cardamom"], heart_notes: ["Oud", "Incense", "Myrrh"], base_notes: ["Leather", "Amber", "Patchouli", "Cedarwood"] },
            { id: 104, brand: "GHARIB", name: "Ocean Breeze", price: 532.00, sizes: ["50ml", "100ml"], image_url: "/ocean-breeze.png", description: "A fresh marine experience blending salty sea minerals, crushed mint leaves, amberwood, and bright Italian bergamot for clean coastal refinement.", tagline: "Aquamarine Coast Line", olfactory_group: "Fresh & Aquatic", tags: ["fresh", "aquatic"], top_notes: ["Italian Bergamot", "Mint Leaves", "Lemon"], heart_notes: ["Sea Salt", "Lavender", "Geranium"], base_notes: ["Amberwood", "Vetiver", "White Musk"] },
            { id: 1, brand: "INITIO PARFUMS PRIVES", name: "Oud for greatness", price: 1215.00, sizes: ["50ml", "90ml"], image_url: "/catalog_initio_oud.png", description: "A highly concentrated woody fragrance with saffron, lavender, and nutmeg, dry down to heavy dark agarwood oud.", tagline: "Sacred Geometry", olfactory_group: "Woody & Oud", tags: ["wood", "oud"], top_notes: ["Saffron", "Nutmeg", "Lavender"], heart_notes: ["Oud (Agarwood)"], base_notes: ["Patchouli", "Musk"] },
            { id: 2, brand: "JULIETTE HAS A GUN", name: "Juliette", price: 360.00, sizes: ["30ml", "50ml"], image_url: "/catalog_juliette_gun.png", description: "A beautiful floral-sensual blend that balances elegant red berries, white blossoms, and sweet woods.", tagline: "Femme Fatale Signature", olfactory_group: "Floral & Sweet", tags: ["floral"], top_notes: ["Red Berries", "Jasmine Sambac"], heart_notes: ["Centifolia Rose", "White Blossoms"], base_notes: ["Sweet Woods", "Amber", "Musk"] },
            { id: 3, brand: "RABANNE", name: "Phantom", price: 440.00, sizes: ["50ml", "100ml"], image_url: "/catalog_rabanne_phantom.png", description: "A fresh, futuristic composition featuring notes of lavender, creamy patchouli, vanilla, and sparkling vetiver.", tagline: "Metallic Modern Scent", olfactory_group: "Fresh & Aquatic", tags: ["fresh", "aquatic"], top_notes: ["Lavender", "Lemon Peel"], heart_notes: ["Patchouli", "Creamy Apple", "Smoke"], base_notes: ["Vanilla", "Vetiver"] },
            { id: 4, brand: "HFC", name: "Devil's intrigue", price: 1358.00, sizes: ["75ml"], image_url: "/catalog_hfc_devils.png", description: "Deep, dramatic amber oriental profile combining warm vanilla, fine sandalwood, and exotic floral touches.", tagline: "Hypnotic Indulgence", olfactory_group: "Amber & Oriental", tags: ["amber", "orient"], top_notes: ["White Tea", "Osmanthus"], heart_notes: ["Orange Blossom", "Sandalwood"], base_notes: ["Cashmere Wood", "Vanilla", "Dry Amber"] },
            { id: 5, brand: "TOM FORD", name: "Lost Cherry eau de parfum", price: 1196.00, sizes: ["30ml", "50ml", "100ml"], image_url: "/catalog_tom_ford_cherry.png", description: "A contrasting scent that reveals a tempting dichotomy of playful, candy-like gleam on the outside and luscious flesh on the inside.", tagline: "Gourmand Masterpiece", olfactory_group: "Floral & Sweet", tags: ["floral", "sweet"], top_notes: ["Black Cherry", "Bitter Almond", "Cherry Liqueur"], heart_notes: ["Griotte Syrup", "Turkish Rose", "Jasmine Sambac"], base_notes: ["Tonka Bean", "Roasted Cocoa", "Sandalwood", "Vetiver", "Cedarwood"] },
            { id: 6, brand: "MOSCHINO", name: "Toy Boy", price: 158.00, sizes: ["30ml", "50ml", "100ml"], image_url: "/catalog_moschino_teddy.png", description: "A unique, masculine fragrance blending dark woods, pink pepper, rose notes, and resinous amber highlights.", tagline: "Playful Sophistication", olfactory_group: "Woody & Oud", tags: ["wood", "oud"], top_notes: ["Pink Pepper", "Pear", "Indonesian Nutmeg"], heart_notes: ["Rose", "Flax Flowers", "Magnolia"], base_notes: ["Haitian Vetiver", "Sandalwood", "Cashmeran", "Amber"] },
            { id: 7, brand: "FILIPPO SORCINELLI", name: "Epicentro", price: 1196.00, sizes: ["50ml", "100ml"], image_url: "/catalog_sorcinelli_epicentro.png", description: "Epicentro is an artistic perfume that represents a deep volcanic impact. Topped with a heavy raw silver metal crumpled sculpture.", tagline: "Artistic Volcanic Shudder", olfactory_group: "Fresh & Aquatic", tags: ["fresh", "aquatic"], top_notes: ["Volcanic Silt", "Italian Bergamot"], heart_notes: ["Deep Sea Minerals", "Warm Earth", "Rust"], base_notes: ["Driftwood", "Dry Cedarwood"] },
            { id: 8, brand: "FILIPPO SORCINELLI", name: "Eio_non_ho_mani_che_mi_accarezzino_il_volto", price: 862.00, sizes: ["100ml"], image_url: "/catalog_sorcinelli_leather.png", description: "An avante-garde olfactory masterpiece encased in a bottle wrapped dramatically in draped, textured organic matte black leather folds.", tagline: "Gothic Draped Incense", olfactory_group: "Amber & Oriental", tags: ["amber", "orient"], top_notes: ["Clerics Cassock", "Incense Smoke"], heart_notes: ["Organic Dark Leather", "Petrichor"], base_notes: ["Gothic Resin", "Myrrh", "Warm Amber"] },
            { id: 9, brand: "MARC-ANTOINE BARROIS", name: "Ganymede Extrait", price: 1170.00, sizes: ["30ml", "50ml"], image_url: "/catalog_marc_barrois.png", description: "Deeply woody and metallic masterpiece with leather, saffron, mandarin, and heavy warm immortelle.", tagline: "Cosmic Leather Harmony", olfactory_group: "Woody & Oud", tags: ["wood", "oud"], top_notes: ["Mandarin Orange", "Saffron"], heart_notes: ["Violet Leaves", "Immortelle Flower"], base_notes: ["Suede Leather", "Akigalawood"] }
          ];
          foundProduct = SEED_PRODUCTS.find((p: any) => p.id === productId);
        }

        if (foundProduct) {
          // Parse values for dynamic page
          const formattedProduct = {
            ...foundProduct,
            image: foundProduct.image_url || foundProduct.image || "/catalog_initio_oud.png",
            images: foundProduct.image_urls || (foundProduct.image_url ? [foundProduct.image_url] : [foundProduct.image || ""]),
            price: String(foundProduct.price),
            sizes: foundProduct.sizes || ["50ml", "100ml"],
            olfactory: foundProduct.olfactory_group || "Woody & Oud",
            top_notes: foundProduct.top_notes || [],
            heart_notes: foundProduct.heart_notes || [],
            base_notes: foundProduct.base_notes || []
          };
          setProduct(formattedProduct);
          setActiveImage(formattedProduct.image);
          setSelectedSize(formattedProduct.sizes[0]);
          
          // Check if in wishlist
          if (typeof window !== "undefined") {
            const userId = localStorage.getItem("userId") || "";
            const { data: wishlists } = await clientSafeSupabase.from("wishlists").select("*").match({
              customer_id: userId,
              product_id: formattedProduct.id,
              wishlist_type: "favorite"
            });
            if (wishlists && wishlists.length > 0) {
              setIsFav(true);
            }
          }
        }
      } catch (err) {
        console.error("Error loading product detail:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();

    // Load Local Storage Configuration (Cart, Currency)
    if (typeof window !== "undefined") {
      const savedCurrency = localStorage.getItem("gharib_active_currency") || "AED";
      setActiveCurrency(savedCurrency);

      const savedCart = localStorage.getItem("gharib_cart");
      if (savedCart) {
        try {
          const items = JSON.parse(savedCart);
          const count = items.reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);
          setCartCount(count);
        } catch (_) {}
      }
    }
  }, [productId]);

  // Entrance Animations Timeline
  useEffect(() => {
    if (loading || !product) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // Fade page entrance
      tl.fromTo(pageContainerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.6 });

      // Left Panel reveal
      tl.fromTo(
        leftPanelRef.current,
        { x: -50, opacity: 0 },
        { x: 0, opacity: 1, duration: 1.2, ease: "power4.out" },
        "-=0.4"
      );

      // Right Panel text stagger
      if (textStaggerRef.current) {
        tl.fromTo(
          Array.from(textStaggerRef.current.children),
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", stagger: 0.08 },
          "-=0.9"
        );
      }

      // FAQ Entrance reveal
      if (faqRef.current) {
        tl.fromTo(
          Array.from(faqRef.current.children),
          { y: 15, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", stagger: 0.1 },
          "-=0.5"
        );
      }

      // Detailed Scent Tiers scale-in stagger
      if (notesContainerRef.current) {
        const tiers = notesContainerRef.current.querySelectorAll(".scent-tier");
        const badges = notesContainerRef.current.querySelectorAll(".scent-badge");
        
        tl.fromTo(
          tiers,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power2.out", stagger: 0.15 },
          "-=0.8"
        );
        
        tl.fromTo(
          badges,
          { scale: 0.85, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.5)", stagger: 0.03 },
          "-=0.6"
        );
      }
    }, pageContainerRef);

    return () => ctx.revert();
  }, [loading, product]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Add Scent to Selection Cart
  const handleAddToSelection = () => {
    if (!product) return;
    setIsAdding(true);

    setTimeout(() => {
      if (typeof window !== "undefined") {
        const savedCart = localStorage.getItem("gharib_cart") || "[]";
        let cart = [];
        try {
          cart = JSON.parse(savedCart);
        } catch (_) {}

        const existingIdx = cart.findIndex(
          (item: any) => item.product.id === product.id && item.selectedSize === selectedSize
        );

        if (existingIdx > -1) {
          cart[existingIdx].quantity += quantity;
        } else {
          cart.push({
            product: {
              id: product.id,
              brand: product.brand,
              name: product.name,
              price: product.price,
              sizes: product.sizes,
              image: product.image,
              description: product.description,
              tagline: product.tagline,
              olfactory: product.olfactory
            },
            quantity: quantity,
            selectedSize: selectedSize
          });
        }

        localStorage.setItem("gharib_cart", JSON.stringify(cart));
        const newCount = cart.reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);
        setCartCount(newCount);

        setIsAdding(false);
        setAddedSuccess(true);
        triggerToast(`Added ${quantity}x ${product.name} (${selectedSize}) to Selection.`);
        setTimeout(() => setAddedSuccess(false), 2500);
      }
    }, 1200);
  };

  // Toggle Scent Wishlist Favorite
  const handleToggleFavorite = async () => {
    if (!product) return;
    try {
      const userId = localStorage.getItem("userId") || "";
      if (!userId) {
        triggerToast("Please log in to save to your Vault.");
        return;
      }

      if (isFav) {
        const { error } = await clientSafeSupabase
          .from("wishlists")
          .delete()
          .match({
            customer_id: userId,
            product_id: product.id,
            wishlist_type: "favorite"
          });
        if (!error) {
          setIsFav(false);
          triggerToast("Removed scent from your Scent Vault.");
        }
      } else {
        const { error } = await clientSafeSupabase
          .from("wishlists")
          .insert({
            customer_id: userId,
            product_id: product.id,
            wishlist_type: "favorite"
          });
        if (!error) {
          setIsFav(true);
          triggerToast("Secured scent in your Scent Vault!");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleThumbnailClick = (imgUrl: string) => {
    if (activeImage === imgUrl) return;
    
    // Smooth image transition using GSAP cross-fade scale bounce
    if (activeImageRef.current) {
      gsap.fromTo(
        activeImageRef.current,
        { opacity: 0.6, scale: 0.98 },
        { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }
      );
    }
    setActiveImage(imgUrl);
  };

  // Format local price conversion
  const formatCurrency = (aedAmount: number) => {
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
    return `${symbol} ${(aedAmount * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const faqs = [
    {
      q: "Shipping & Delivery details",
      a: "We offer complimentary express shipping across the GCC (1-2 business days) and globally (3-5 business days). Each order is hand-packed in our signature thermal-insulated coffret with temperature protection to preserve olfactory integrity during transport.",
      icon: <Truck className="w-4 h-4 text-amber-700" />
    },
    {
      q: "Returns & Scent Verification",
      a: "To ensure your absolute satisfaction, every order includes a matching 2ml sampler vial. We invite you to experience the sampler before opening the full bottle. Unopened flacons in original sealed packaging may be returned within 14 days for a full refund.",
      icon: <ShieldCheck className="w-4 h-4 text-amber-700" />
    },
    {
      q: "Authenticity & Decant Sourcing",
      a: "Every bottle is 100% authentic, directly sourced from authorized perfume houses or decanted by master curators at our flagship Dubai workshop. Each shipment includes a unique batch number card mapping its precise decanting logs.",
      icon: <HelpCircle className="w-4 h-4 text-amber-700" />
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-amber-700 animate-spin" />
        <span className="text-[9px] tracking-[0.3em] text-[#6C5F54]/70 uppercase font-black">
          Decrypting Olfactory Geometry...
        </span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white text-[#1C120C] flex flex-col justify-center items-center gap-6 p-6">
        <h1 className="text-2xl font-serif-luxury tracking-widest text-[#6C5F54]">Scent Not Discovered</h1>
        <p className="text-xs text-neutral-500 tracking-widest uppercase">The requested item does not exist in our curations.</p>
        <Link href="/" className="border border-amber-800/30 text-amber-800 text-[10px] tracking-widest uppercase py-3.5 px-8 hover:bg-amber-800 hover:text-white transition-all">
          Back to Catalogue
        </Link>
      </div>
    );
  }

  return (
    <div 
      ref={pageContainerRef}
      className="min-h-screen bg-white text-[#1C120C] flex flex-col justify-between font-sans-luxury relative overflow-x-hidden"
    >
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[55%] h-[55%] bg-radial from-amber-600/[0.03] via-transparent to-transparent blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] left-[-10%] w-[45%] h-[45%] bg-radial from-amber-500/[0.02] via-transparent to-transparent blur-[120px] pointer-events-none z-0" />

      {/* Floating Toast Message */}
      {toastMessage && (
        <div className="fixed top-6 right-6 bg-[#FFFFFF] border border-[#EAE3DB] text-[#1C120C] text-[10px] tracking-[0.2em] uppercase font-bold py-4 px-6 shadow-[0_15px_40px_rgba(28,18,12,0.08)] z-50 flex items-center gap-3 rounded-none">
          <Check className="w-3.5 h-3.5 text-amber-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="w-full border-b border-[#EAE3DB]/50 bg-white/90 backdrop-blur-md z-30 relative">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-[14px] tracking-[0.35em] text-[#1C120C] font-extrabold uppercase hover:opacity-85 transition-all">
            GHARIB
          </Link>
          
          <div className="flex items-center gap-8">
            <Link href="/" className="text-[10px] tracking-widest text-[#6C5F54] hover:text-[#1C120C] uppercase font-bold transition-all flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5 text-amber-700" />
              <span>Back Home</span>
            </Link>
            <div 
              onClick={() => router.push("/")} 
              className="relative text-[#6C5F54] hover:text-[#1C120C] transition-all flex items-center gap-1 cursor-pointer"
            >
              <ShoppingBag className="w-[18px] h-[18px]" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-600 text-white text-[8px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Product Template Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-12 md:py-20 z-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* LEFT PANEL: Sticky Visual Column & FAQ below image */}
          <div ref={leftPanelRef} className="lg:col-span-6 lg:sticky lg:top-[90px] flex flex-col gap-8">
            
            <div className="flex flex-col gap-6">
              {/* Primary Image Container */}
              <div 
                ref={imageContainerRef}
                className="relative w-full aspect-square bg-[#FFFFFF] border border-[#EAE3DB] flex items-center justify-center p-8 overflow-hidden rounded-none group/visual shadow-[0_8px_30px_rgba(28,18,12,0.02)]"
              >
                {/* Gold framing border details */}
                <div className="absolute inset-4 border border-[#EAE3DB] pointer-events-none transition-all duration-700"></div>
                <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-amber-600/35 pointer-events-none"></div>
                <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-amber-600/35 pointer-events-none"></div>
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-amber-600/35 pointer-events-none"></div>
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-amber-600/35 pointer-events-none"></div>

                {/* Luxury Badge */}
                <span className="absolute top-6 left-6 bg-[#1C120C] text-[#FAF9F6] text-[7.5px] font-black tracking-[0.35em] uppercase px-3 py-1.5 border border-white/5 select-none z-20">
                  ✦ EXCLUSIF ATELIER
                </span>

                {/* Main Image */}
                <div 
                  ref={activeImageRef} 
                  className="absolute inset-8 flex items-center justify-center transition-transform duration-[1200ms] ease-out group-hover/visual:scale-102"
                >
                  <Image
                    src={activeImage}
                    alt={product.name}
                    fill
                    className="object-contain filter drop-shadow-[0_15px_30px_rgba(28,18,12,0.06)]"
                    priority
                  />
                </div>
              </div>

              {/* Thumbnail Carousel Selector */}
              {product.images && product.images.length > 1 && (
                <div className="flex gap-4 overflow-x-auto py-2 pr-4 justify-start scrollbar-thin">
                  {product.images.map((imgUrl: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleThumbnailClick(imgUrl)}
                      className={`relative w-20 aspect-square flex-shrink-0 bg-[#FFFFFF] border transition-all duration-300 ${
                        activeImage === imgUrl 
                          ? "border-amber-600 shadow-[0_4px_12px_rgba(180,138,83,0.15)] scale-102" 
                          : "border-[#EAE3DB] opacity-60 hover:opacity-100 hover:border-amber-600/40"
                      }`}
                    >
                      <Image
                        src={imgUrl}
                        alt={`Thumbnail ${idx + 1}`}
                        fill
                        className="object-cover p-1.5"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* FAQ Accordion Section (Below Image) */}
            <div ref={faqRef} className="border-t border-[#EAE3DB] pt-8 flex flex-col gap-4 text-left">
              <span className="text-[9px] font-black tracking-[0.3em] text-[#8C8276] uppercase block mb-2">
                ✦ CLIENT SERVICE FAQS
              </span>

              {faqs.map((faq, idx) => (
                <div 
                  key={idx} 
                  className="border border-[#EAE3DB] bg-[#FFFFFF] transition-all duration-300 shadow-[0_2px_8px_rgba(28,18,12,0.01)]"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left cursor-pointer group hover:bg-neutral-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {faq.icon}
                      <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#1C120C]">
                        {faq.q}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#8C8276] transition-transform duration-300 ${
                      openFaq === idx ? "rotate-180 text-amber-700" : ""
                    }`} />
                  </button>

                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    openFaq === idx ? "max-h-[200px] border-t border-[#EAE3DB]/50" : "max-h-0"
                  }`}>
                    <div className="p-5 text-[11px] leading-relaxed text-[#6C5F54] font-medium tracking-wide">
                      {faq.a}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* RIGHT PANEL: Scrollable Scent Details & Controls */}
          <div ref={rightPanelRef} className="lg:col-span-6 text-left flex flex-col gap-10">
            
            {/* Header info */}
            <div ref={textStaggerRef} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black tracking-[0.3em] text-amber-800 uppercase px-2 py-0.5 border border-amber-600/25 bg-amber-600/5">
                  {product.olfactory}
                </span>
                {product.tags && product.tags.includes("new") && (
                  <span className="text-[9px] font-black tracking-[0.3em] text-[#8C8276] uppercase">
                    ✧ NEW ARRIVAL
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] tracking-[0.3em] font-extrabold text-[#8C8276] uppercase block mb-1">
                  {product.brand}
                </span>
                <h1 className="text-3xl md:text-5xl font-serif-luxury tracking-widest text-[#1C120C] uppercase leading-tight font-extrabold font-serif-luxury">
                  {product.name}
                </h1>
              </div>

              {product.tagline && (
                <p className="text-[11.5px] font-serif font-medium italic text-amber-700 tracking-widest pl-0.5">
                  &ldquo;{product.tagline}&rdquo;
                </p>
              )}

              <p className="text-[12.5px] leading-relaxed text-[#6C5F54] tracking-wider font-medium mt-2">
                {product.description}
              </p>

              {/* Olfactory Notes Architecture (Animated Stacked Scent Pyramid) */}
              {((product.top_notes && product.top_notes.length > 0) || 
                (product.heart_notes && product.heart_notes.length > 0) || 
                (product.base_notes && product.base_notes.length > 0)) && (
                <div 
                  ref={notesContainerRef} 
                  className="border-t border-[#EAE3DB]/50 pt-8 flex flex-col gap-6 text-left"
                >
                  <span className="text-[9px] font-black tracking-[0.3em] text-[#8C8276] uppercase block">
                    ✦ OLFACTORY NOTES ARCHITECTURE
                  </span>
                  
                  <div className="flex flex-col items-center gap-3 w-full">
                    {/* Top Notes (Apex) */}
                    {product.top_notes && product.top_notes.length > 0 && (
                      <div className="scent-tier w-full max-w-[340px] bg-white border border-[#EAE3DB]/60 p-4 text-center transition-all duration-300 hover:scale-[1.02] hover:border-amber-600/40 hover:shadow-[0_8px_20px_rgba(28,18,12,0.03)] relative group/tier">
                        {/* Elegant apex line indicator */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-[1px] bg-amber-600/45"></div>
                        <span className="text-[7.5px] font-black tracking-[0.3em] text-amber-800 uppercase block mb-2 select-none group-hover/tier:text-amber-600 transition-colors">
                          ✧ TOP NOTES (APEX)
                        </span>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {product.top_notes.map((note: string, i: number) => (
                            <span 
                              key={i} 
                              className="scent-badge text-[9.5px] tracking-wider font-bold text-[#1C120C] bg-neutral-50 border border-neutral-100 px-3 py-1 hover:border-amber-600/20 transition-all select-none"
                            >
                              {note}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Middle (Heart) Notes */}
                    {product.heart_notes && product.heart_notes.length > 0 && (
                      <div className="scent-tier w-full max-w-[420px] bg-white border border-[#EAE3DB]/60 p-4 text-center transition-all duration-300 hover:scale-[1.02] hover:border-amber-600/40 hover:shadow-[0_8px_20px_rgba(28,18,12,0.03)] group/tier">
                        <span className="text-[7.5px] font-black tracking-[0.3em] text-amber-800 uppercase block mb-2 select-none group-hover/tier:text-amber-600 transition-colors">
                          ✧ HEART NOTES (CORE)
                        </span>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {product.heart_notes.map((note: string, i: number) => (
                            <span 
                              key={i} 
                              className="scent-badge text-[9.5px] tracking-wider font-bold text-[#1C120C] bg-neutral-50 border border-neutral-100 px-3 py-1 hover:border-amber-600/20 transition-all select-none"
                            >
                              {note}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Base Notes */}
                    {product.base_notes && product.base_notes.length > 0 && (
                      <div className="scent-tier w-full max-w-[500px] bg-white border border-[#EAE3DB]/60 p-4 text-center transition-all duration-300 hover:scale-[1.02] hover:border-amber-600/40 hover:shadow-[0_8px_20px_rgba(28,18,12,0.03)] group/tier relative">
                        {/* Elegant base line indicator */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-16 h-[1px] bg-amber-600/45"></div>
                        <span className="text-[7.5px] font-black tracking-[0.3em] text-amber-800 uppercase block mb-2 select-none group-hover/tier:text-amber-600 transition-colors">
                          ✧ BASE NOTES (DRY DOWN)
                        </span>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {product.base_notes.map((note: string, i: number) => (
                            <span 
                              key={i} 
                              className="scent-badge text-[9.5px] tracking-wider font-bold text-[#1C120C] bg-neutral-50 border border-neutral-100 px-3 py-1 hover:border-amber-600/20 transition-all select-none"
                            >
                              {note}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Flacon Selection Controls */}
            <div className="border-t border-[#EAE3DB] pt-8 flex flex-col gap-6">
              {/* Flacon Sizes Selection */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[9px] font-black tracking-[0.3em] text-[#8C8276] uppercase block">
                  AVAILABLE SIZES
                </span>
                <div className="flex gap-3">
                  {product.sizes.map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`text-[10px] font-black tracking-[0.2em] uppercase px-6 py-3 border transition-all cursor-pointer ${
                        selectedSize === size
                          ? "bg-amber-600/10 border-amber-600 text-amber-700 shadow-sm"
                          : "border-[#EAE3DB] text-[#6C5F54] hover:border-amber-600/30 hover:text-[#1C120C]"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing section */}
              <div className="flex items-center justify-between py-5 border-y border-[#EAE3DB]">
                <div>
                  <span className="text-[9px] font-black tracking-[0.3em] text-[#8C8276] uppercase block mb-1">
                    TOTAL INVESTMENT
                  </span>
                  <span className="text-2xl font-serif font-extrabold text-[#1C120C] tracking-widest">
                    {formatCurrency(parseFloat(product.price.replace("$", "")) || 0)}
                  </span>
                </div>

                {/* Quantity Control Selector */}
                <div className="flex items-center border border-[#EAE3DB] bg-[#FFFFFF]">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center text-[#6C5F54] hover:text-[#1C120C] transition-colors cursor-pointer border-r border-[#EAE3DB] active:bg-neutral-50"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-12 text-center text-xs font-serif font-bold text-[#1C120C] select-none">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="w-10 h-10 flex items-center justify-center text-[#6C5F54] hover:text-[#1C120C] transition-colors cursor-pointer border-l border-[#EAE3DB] active:bg-neutral-50"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Action Trigger Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleAddToSelection}
                  disabled={isAdding || addedSuccess}
                  className="flex-grow bg-[#1C120C] text-[#FAF9F6] text-[10px] font-black tracking-[0.25em] uppercase h-14 transition-all duration-500 rounded-none cursor-pointer border border-[#1C120C] active:scale-[0.98] shadow-md relative overflow-hidden group/buynow flex items-center justify-center disabled:bg-neutral-200 disabled:border-neutral-200 disabled:text-neutral-400 disabled:cursor-default"
                >
                  {/* Background sweep effects */}
                  <span className="absolute inset-0 bg-gradient-to-r from-amber-900 to-amber-700 translate-y-full group-hover/buynow:translate-y-0 transition-transform duration-500 ease-out z-0"></span>
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-[150%] group-hover/buynow:translate-x-[150%] transition-transform duration-1000 ease-in-out z-0"></span>
                  
                  <span className="relative z-10 flex items-center gap-2">
                    {isAdding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#FAF9F6]" />
                        REGISTERING SELECTION...
                      </>
                    ) : addedSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-[#FAF9F6]" />
                        ADDED TO SELECTION
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        ADD TO SCENT SELECTION
                      </>
                    )}
                  </span>
                </button>

                {/* Scent Vault Favoriting Button */}
                <button
                  onClick={handleToggleFavorite}
                  className={`w-14 h-14 border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 ${
                    isFav 
                      ? "bg-red-50 border-red-200 text-red-500" 
                      : "border-[#EAE3DB] text-[#6C5F54] hover:border-amber-600/30 hover:text-amber-700"
                  }`}
                  title={isFav ? "Secure Scent in Vault" : "Remove from Scent Vault"}
                >
                  <Heart className={`w-4 h-4 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#EAE3DB]/50 bg-white py-6 z-10 relative">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[8px] tracking-[0.2em] text-[#6C5F54]/80 uppercase font-bold">
            © {new Date().getFullYear()} GHARIB. ALL RIGHTS RESERVED.
          </span>
          <div className="flex items-center gap-4 text-[8px] tracking-[0.2em] text-[#6C5F54]/85 font-bold uppercase">
            <span className="hover:text-amber-700 transition-colors cursor-pointer">PRIVACY STATEMENT</span>
            <span>•</span>
            <span className="hover:text-amber-700 transition-colors cursor-pointer">TERMS OF SERVICE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
