"use client";

import { useState, useEffect, useMemo, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Truck, ShieldCheck, Droplet, Headphones, Minus, Plus } from "lucide-react";
import { clientSafeSupabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

interface ProductRecord {
  id: number;
  brand: string;
  name: string;
  price: number | string;
  sizes?: string[];
  image?: string;
  image_url?: string;
  image_urls?: string[];
  description?: string;
  tagline?: string;
  olfactory?: string;
  olfactory_group?: string;
  tags?: string[];
  top_notes?: string[];
  heart_notes?: string[];
  base_notes?: string[];
  is_new?: boolean;
  is_bestseller?: boolean;
  is_featured_large?: boolean;
}

interface ProductDetail extends ProductRecord {
  price: string;
  sizes: string[];
  image: string;
  images: string[];
  olfactory: string;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
}

interface RelatedProduct {
  id: number;
  brand: string;
  name: string;
  price: string;
  sizes: string[];
  image: string;
  description: string;
  tagline: string;
  olfactory: string;
}

interface CartEntry {
  product: {
    id: number;
    brand: string;
    name: string;
    price: string;
    sizes: string[];
    image: string;
    image_url?: string;
    description?: string;
    tagline?: string;
    olfactory?: string;
  };
  quantity: number;
  selectedSize: string;
}

const PRODUCT_FIELDS =
  "id, brand, name, price, sizes, image_url, image_urls, description, tagline, olfactory_group, is_new, is_bestseller, is_featured_large, tags, top_notes, heart_notes, base_notes";

// Normalises a Supabase array column that may be null, a non-array, or contain blanks.
const toArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];

export default function ProductPage({ params }: ProductPageProps) {
  const resolvedParams = use(params);
  const productId = parseInt(resolvedParams.id, 10);

  // Component States
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [activeCurrency] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("gharib_active_currency") || "AED"
      : "AED"
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<RelatedProduct[]>([]);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        if (Number.isNaN(productId)) {
          setProduct(null);
          setNotFound(true);
          return;
        }

        // Real catalogue rows — public.products (150 rows). No seed fallback.
        const { data: dbProducts, error } = await clientSafeSupabase
          .from("products")
          .select(PRODUCT_FIELDS);

        if (error) throw error;

        const productsList: ProductRecord[] = Array.isArray(dbProducts)
          ? (dbProducts as ProductRecord[])
          : [];
        const foundProduct = productsList.find((p) => Number(p.id) === productId) || null;

        // Related rail / cross-sell source
        setAllProducts(
          productsList.map((p) => ({
            id: p.id,
            brand: p.brand || "",
            name: p.name || "",
            price: String(p.price ?? ""),
            sizes: toArray(p.sizes),
            image: p.image_url || toArray(p.image_urls)[0] || "",
            description: p.description || "",
            tagline: p.tagline || "",
            olfactory: p.olfactory_group || ""
          }))
        );

        if (!foundProduct) {
          setProduct(null);
          setNotFound(true);
          return;
        }

        const galleryImages = (() => {
          const fromArray = toArray(foundProduct.image_urls);
          if (fromArray.length > 0) return fromArray;
          return foundProduct.image_url ? [foundProduct.image_url] : [];
        })();

        const formattedProduct: ProductDetail = {
          ...foundProduct,
          image: foundProduct.image_url || galleryImages[0] || "",
          images: galleryImages,
          price: String(foundProduct.price ?? ""),
          sizes: toArray(foundProduct.sizes),
          olfactory: foundProduct.olfactory_group || "",
          top_notes: toArray(foundProduct.top_notes),
          heart_notes: toArray(foundProduct.heart_notes),
          base_notes: toArray(foundProduct.base_notes)
        };

        setProduct(formattedProduct);
        setActiveImage(formattedProduct.image || galleryImages[0] || "");
        setSelectedSize(formattedProduct.sizes[0] || "");

        // Wishlist state for the signed-in customer
        if (typeof window !== "undefined") {
          const userId = localStorage.getItem("userId") || "";
          if (userId) {
            const { data: wishlists } = await clientSafeSupabase
              .from("wishlists")
              .select("*")
              .match({
                customer_id: userId,
                product_id: formattedProduct.id,
                wishlist_type: "favorite"
              });
            setIsFav(Array.isArray(wishlists) && wishlists.length > 0);
          }
        }
      } catch (err) {
        console.error("Error loading product detail:", err);
        setProduct(null);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Single one-shot fade + rise on entry (design-system §7)
  useEffect(() => {
    if (loading || !product) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [loading, product]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Shared cart writer — keeps the existing gharib_cart item shape
  const writeToCart = (
    item: {
      id: number;
      brand: string;
      name: string;
      price: string;
      sizes: string[];
      image: string;
      description?: string;
      tagline?: string;
      olfactory?: string;
    },
    size: string,
    qty: number
  ) => {
    if (typeof window === "undefined") return;
    const savedCart = localStorage.getItem("gharib_cart_v2") || "[]";
    let cart: CartEntry[] = [];
    try {
      cart = JSON.parse(savedCart);
    } catch {
      cart = [];
    }

    const existingIdx = cart.findIndex(
      (entry) => entry.product?.id === item.id && entry.selectedSize === size
    );

    if (existingIdx > -1) {
      cart[existingIdx].quantity += qty;
    } else {
      cart.push({
        product: {
          id: item.id,
          brand: item.brand,
          name: item.name,
          price: item.price,
          sizes: item.sizes,
          image: item.image,
          image_url: item.image,
          description: item.description,
          tagline: item.tagline,
          olfactory: item.olfactory
        },
        quantity: qty,
        selectedSize: size
      });
    }

    localStorage.setItem("gharib_cart_v2", JSON.stringify(cart));
  };

  // Add Scent to Selection Cart
  const handleAddToSelection = () => {
    if (!product) return;
    setIsAdding(true);

    setTimeout(() => {
      writeToCart(
        {
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
        selectedSize,
        quantity
      );

      setIsAdding(false);
      setAddedSuccess(true);
      triggerToast(`${product.name} — ${selectedSize} added to your bag`);
      setTimeout(() => setAddedSuccess(false), 2500);
    }, 700);
  };

  // Quick add from the related-products rail
  const handleQuickAdd = (item: RelatedProduct) => {
    const size = item.sizes?.[0] || "";
    writeToCart(item, size, 1);
    triggerToast(size ? `${item.name} — ${size} added to your bag` : `${item.name} added to your bag`);
  };

  // Toggle Scent Wishlist Favorite
  const handleToggleFavorite = async () => {
    if (!product) return;
    try {
      const userId = localStorage.getItem("userId") || "";
      if (!userId) {
        triggerToast("Please sign in to use your wishlist");
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
          triggerToast("Removed from your wishlist");
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
          triggerToast("Saved to your wishlist");
        }
      }
    } catch (err) {
      console.error(err);
    }
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

  const deliveryFrom = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }, []);

  const serviceNotes = [
    {
      q: "Shipping & delivery",
      a: "Complimentary express shipping across the GCC (1–2 business days) and worldwide (3–5 business days). Every order is hand-packed in a thermal-insulated coffret so the composition travels intact."
    },
    {
      q: "Returns & scent verification",
      a: "Each order includes a matching 2ml sampler vial — live with it before you open the flacon. Unopened bottles in sealed packaging may be returned within 14 days for a full refund."
    },
    {
      q: "Authenticity & sourcing",
      a: "Every bottle is sourced directly from authorised perfume houses or decanted by our curators in Dubai. Each shipment carries a batch card mapping its provenance."
    }
  ];

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const others = allProducts.filter((p) => p.id !== product.id);
    const sameFamily = others.filter((p) => p.olfactory === product.olfactory);
    const rest = others.filter((p) => p.olfactory !== product.olfactory);
    return [...sameFamily, ...rest].slice(0, 4);
  }, [allProducts, product]);

  // Quiet skeleton — flat #F5F5F5 blocks at the real aspect ratios, no motion.
  if (loading) {
    return (
      <div className="maison min-h-screen flex flex-col overflow-x-hidden">
        <AppHeader activePage="shop" />
        <main className="flex-grow">
          <div className="maison-container pt-8 pb-14 md:pt-12 md:pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-10 lg:gap-0 items-start">
              <div className="flex flex-col gap-4">
                <div className="w-full aspect-square bg-[var(--surface-2)]" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="w-full aspect-square bg-[var(--surface-2)]" />
                  <div className="w-full aspect-square bg-[var(--surface-2)]" />
                </div>
              </div>
              <div className="lg:pl-10 flex flex-col">
                <div className="h-3 w-28 bg-[var(--surface-2)]" />
                <div className="h-9 w-4/5 bg-[var(--surface-2)] mt-4" />
                <div className="h-3 w-40 bg-[var(--surface-2)] mt-4" />
                <div className="flex gap-3 mt-9">
                  <div className="w-[100px] h-[37px] bg-[var(--surface-2)]" />
                  <div className="w-[100px] h-[37px] bg-[var(--surface-2)]" />
                </div>
                <div className="h-12 w-full bg-[var(--surface-2)] mt-9" />
                <div className="h-24 w-full bg-[var(--surface-2)] mt-9" />
                <div className="h-3 w-full bg-[var(--surface-2)] mt-9" />
                <div className="h-3 w-11/12 bg-[var(--surface-2)] mt-3" />
                <div className="h-3 w-3/5 bg-[var(--surface-2)] mt-3" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product || notFound) {
    return (
      <div className="maison min-h-screen flex flex-col overflow-x-hidden">
        <AppHeader activePage="shop" />
        <main className="flex-grow flex flex-col items-center justify-center gap-6 px-5 py-32 text-center">
          <h1 className="maison-page-title">Fragrance not found</h1>
          <p className="text-[14px] font-light text-[#646464] max-w-[46ch]">
            This piece is no longer part of our curation, or the link you followed is out of date.
          </p>
          <Link href="/shop" className="maison-btn-outline h-12 px-10 mt-2 inline-flex items-center">
            Browse the catalogue
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const priceValue = parseFloat(String(product.price).replace("$", "")) || 0;
  const gallery: string[] = (product.images || []).filter(Boolean);
  const badgeLabel = product.is_featured_large
    ? "Iconic"
    : product.is_new || (product.tags && product.tags.includes("new"))
      ? "New"
      : product.is_bestseller
        ? "Best Seller"
        : null;

  const pyramid: { label: string; notes: string[] }[] = [
    { label: "Top", notes: product.top_notes || [] },
    { label: "Heart", notes: product.heart_notes || [] },
    { label: "Base", notes: product.base_notes || [] }
  ].filter((row) => row.notes.length > 0);

  const reassurance = [
    { Icon: Truck, label: "Complimentary delivery" },
    { Icon: ShieldCheck, label: "Guaranteed authentic" },
    { Icon: Droplet, label: "Complimentary samples" },
    { Icon: Headphones, label: "Responsive client care" }
  ];

  return (
    <div className="maison min-h-screen flex flex-col overflow-x-hidden">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-24 right-5 z-50 bg-[#121212] text-white text-[12px] tracking-[0.1em] uppercase px-5 py-4">
          {toastMessage}
        </div>
      )}

      <AppHeader activePage="shop" />

      <main
        className={`flex-grow transition-[opacity,transform] duration-[600ms] ease-out ${
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        {/* ── PDP core ─────────────────────────────────────────────── */}
        <div className="maison-container pt-8 pb-14 md:pt-12 md:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-10 lg:gap-0 items-start">

            {/* LEFT — media stage */}
            <div className="flex flex-col gap-4">
              <div className="relative w-full aspect-square bg-[var(--surface-2)]">
                {badgeLabel && (
                  <span className="absolute top-0 left-0 z-10 bg-black text-white text-[12px] leading-none tracking-[0.1em] uppercase px-4 py-2.5">
                    {badgeLabel}
                  </span>
                )}
                {(activeImage || product.image) && (
                  <Image
                    src={activeImage || product.image}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-contain p-12 md:p-20"
                    priority
                  />
                )}
              </div>

              {gallery.length > 1 && (
                <div className="grid grid-cols-2 gap-4">
                  {gallery.map((imgUrl: string, idx: number) => (
                    <button
                      key={`${imgUrl}-${idx}`}
                      type="button"
                      onClick={() => setActiveImage(imgUrl)}
                      aria-label={`View image ${idx + 1} of ${product.name}`}
                      className={`relative w-full aspect-square bg-[var(--surface-2)] cursor-pointer border transition-colors duration-300 ${
                        activeImage === imgUrl ? "border-black" : "border-transparent hover:border-[rgba(0,0,0,0.12)]"
                      }`}
                    >
                      <Image
                        src={imgUrl}
                        alt={`${product.name} — view ${idx + 1}`}
                        fill
                        sizes="(min-width: 1024px) 30vw, 50vw"
                        className="object-contain p-10 md:p-14"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT — info column */}
            <div className="lg:pl-10">
              {/* 1. Title */}
              <span className="maison-eyebrow block">{product.brand}</span>
              <h1 className="font-display text-[28px] md:text-[36px] leading-[1.1] tracking-[0.1em] uppercase text-black mt-3">
                {product.name}
              </h1>
              {product.olfactory && (
                <p className="text-[12px] tracking-[0.02em] uppercase text-[#646464] mt-3">
                  {product.olfactory}
                </p>
              )}

              {/* 2 + 3. Size swatches and price */}
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5 mt-9">
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((size: string) => {
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`w-[100px] h-[37px] bg-white text-black text-[12px] tracking-[0.08em] uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-300 ${
                          isSelected ? "border-2 border-black" : "border border-black hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        {size}
                        {isSelected && <Check className="w-3 h-3" strokeWidth={1.5} />}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[20px] font-medium leading-none text-black">
                  {formatCurrency(priceValue)}
                </span>
              </div>

              {/* 4. Delivery estimate */}
              <p className="text-[13px] font-light text-[#646464] mt-5">
                Delivery from {deliveryFrom}
              </p>

              {/* Quantity */}
              <div className="flex items-center justify-between border-t border-b border-[var(--line)] py-4 mt-6">
                <span className="maison-eyebrow">Quantity</span>
                <div className="flex items-center border border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="w-10 h-10 flex items-center justify-center text-black cursor-pointer transition-colors duration-300 hover:bg-[var(--surface-2)]"
                  >
                    <Minus className="w-3 h-3" strokeWidth={1.25} />
                  </button>
                  <span className="w-10 text-center text-[14px] font-light text-black select-none">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="Increase quantity"
                    className="w-10 h-10 flex items-center justify-center text-black cursor-pointer transition-colors duration-300 hover:bg-[var(--surface-2)]"
                  >
                    <Plus className="w-3 h-3" strokeWidth={1.25} />
                  </button>
                </div>
              </div>

              {/* 5. Add to cart + wishlist */}
              <button
                type="button"
                onClick={handleAddToSelection}
                disabled={isAdding || addedSuccess}
                className="maison-btn w-full h-12 mt-6"
              >
                {isAdding ? "Adding…" : addedSuccess ? "Added to cart" : "Add to cart"}
              </button>

              <div className="mt-5 text-center">
                <button type="button" onClick={handleToggleFavorite} className="maison-link cursor-pointer">
                  {isFav ? "In wishlist" : "Add to wishlist"}
                </button>
              </div>

              {/* 6. Offer panel */}
              <div className="bg-[var(--surface-2)] p-5 mt-9">
                <span className="maison-eyebrow block">Complimentary samples</span>
                <p className="text-[14px] font-light leading-relaxed text-black mt-2.5">
                  Two 2ml discovery vials accompany every order, so you may live with the composition
                  before opening your flacon.
                </p>
              </div>

              {/* 7. Reassurance grid */}
              <div className="grid grid-cols-2 gap-x-6 mt-9">
                {reassurance.map(({ Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 py-4 border-b border-[var(--line)]"
                  >
                    <Icon className="w-4 h-4 shrink-0 text-black" strokeWidth={1.25} />
                    <span className="text-[13px] font-light text-black leading-tight">{label}</span>
                  </div>
                ))}
              </div>

              {/* 8. Short description */}
              {product.description && (
                <p className="text-[15px] font-light leading-[1.6] text-black mt-9">
                  {product.description}
                </p>
              )}

              {/* 9. Accordions */}
              <div className="mt-10">
                <details className="maison-accordion">
                  <summary>Description</summary>
                  <div className="pb-6 text-[14px] font-light leading-[1.7] text-[rgba(0,0,0,0.75)] flex flex-col gap-3">
                    <p>{product.description}</p>
                    {product.tagline && <p>{product.tagline}.</p>}
                    {(product.olfactory || product.sizes.length > 0) && (
                      <p>
                        {product.olfactory}
                        {product.olfactory && product.sizes.length > 0 ? " composition, presented in " : ""}
                        {product.sizes.join(" and ")}.
                      </p>
                    )}
                  </div>
                </details>

                {pyramid.length > 0 && (
                  <details className="maison-accordion">
                    <summary>Olfactive pyramid</summary>
                    <div className="pb-6">
                      {pyramid.map((row, idx) => (
                        <div
                          key={row.label}
                          className={`flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-8 py-4 ${
                            idx > 0 ? "border-t border-[var(--line)]" : ""
                          }`}
                        >
                          <span className="maison-eyebrow sm:w-20 shrink-0">{row.label}</span>
                          <span className="text-[14px] font-light leading-relaxed text-black">
                            {row.notes.join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <details className="maison-accordion">
                  <summary>Ingredients</summary>
                  <div className="pb-6 text-[14px] font-light leading-[1.7] text-[rgba(0,0,0,0.75)]">
                    Alcohol Denat., Parfum (Fragrance), Aqua (Water), Limonene, Linalool, Coumarin,
                    Citral, Geraniol, Eugenol, Benzyl Salicylate. Full ingredient declaration is printed
                    on the outer carton of each flacon.
                  </div>
                </details>

                {relatedProducts.length > 0 && (
                  <details className="maison-accordion">
                    <summary>You may also like</summary>
                    <div className="pb-6 flex flex-col">
                      {relatedProducts.slice(0, 3).map((item) => (
                        <Link
                          key={item.id}
                          href={`/product/${item.id}`}
                          className="flex items-center gap-4 py-4 border-b border-[var(--line)] last:border-b-0"
                        >
                          <span className="relative w-16 h-16 shrink-0 bg-[var(--surface-2)]">
                            {item.image && (
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes="64px"
                                className="object-contain p-2"
                              />
                            )}
                          </span>
                          <span className="flex flex-col gap-1">
                            <span className="font-display text-[14px] tracking-[0.08em] uppercase text-black">
                              {item.name}
                            </span>
                            <span className="maison-price">
                              {formatCurrency(parseFloat(String(item.price).replace("$", "")) || 0)}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </details>
                )}

                <details className="maison-accordion">
                  <summary>Precautions for use</summary>
                  <div className="pb-6 text-[14px] font-light leading-[1.7] text-[rgba(0,0,0,0.75)]">
                    For external use only. Keep away from direct sunlight and heat sources. Avoid contact
                    with the eyes. Do not spray on jewellery, pearls or delicate fabrics. Keep out of the
                    reach of children. Flammable — do not use near an open flame.
                  </div>
                </details>

                {serviceNotes.map((note) => (
                  <details key={note.q} className="maison-accordion">
                    <summary>{note.q}</summary>
                    <div className="pb-6 text-[14px] font-light leading-[1.7] text-[rgba(0,0,0,0.75)]">
                      {note.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Pull-quote ───────────────────────────────────────────── */}
        <section className="maison-section border-t border-[var(--line)]">
          <div className="maison-container">
            <blockquote className="max-w-[46ch] mx-auto text-center">
              <p className="font-display italic text-[20px] md:text-[24px] leading-[1.5] tracking-[0.02em] text-black">
                {product.tagline
                  ? `“${product.tagline}.”`
                  : "“A fragrance is a memory you can wear — composed once, remembered always.”"}
              </p>
              <cite className="maison-eyebrow not-italic block mt-8">{product.brand}</cite>
            </blockquote>
          </div>
        </section>

        {/* ── Related products rail ────────────────────────────────── */}
        {relatedProducts.length > 0 && (
          <section className="maison-section border-t border-[var(--line)]">
            <div className="maison-container">
              <h2 className="maison-page-title text-center">You may also like</h2>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 mt-12 md:mt-16">
                {relatedProducts.map((item) => (
                  <div key={item.id} className="group flex flex-col">
                    <Link href={`/product/${item.id}`} className="maison-card-media block">
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 45vw"
                          className="object-contain p-4 md:p-6"
                        />
                      )}
                    </Link>

                    <Link href={`/product/${item.id}`} className="maison-card-title mt-6 block">
                      {item.name}
                    </Link>

                    <span className="maison-card-notes mt-2 block">{item.olfactory}</span>

                    <span className="maison-price mt-3 text-center block">
                      {formatCurrency(parseFloat(String(item.price).replace("$", "")) || 0)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleQuickAdd(item)}
                      className="maison-btn-outline w-full h-12 mt-5"
                    >
                      Add to cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
