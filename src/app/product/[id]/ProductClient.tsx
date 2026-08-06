"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Truck, ShieldCheck, Droplet, Headphones, Minus, Plus } from "lucide-react";
import { getBrowserSupabase } from "../../lib/supabase-browser";
import { useCart } from "../../lib/cart";
import { FREE_SHIPPING_NOTE, FREE_SHIPPING_THRESHOLD_AED } from "../../lib/shipping";
import { whatsappLink } from "../../lib/site";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import CartDrawer, { openCartDrawer } from "../../components/CartDrawer";
import ConciergeWidget from "../../components/concierge/ConciergeWidget";
import Price from "../../components/Price";

export interface ProductDetailProps {
  id: number;
  brand: string;
  name: string;
  priceAed: number;
  sizes: string[];
  image: string;
  images: string[];
  description: string;
  tagline: string;
  olfactory: string;
  tags: string[];
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  is_new: boolean;
  is_bestseller: boolean;
  is_featured_large: boolean;
}

export interface RelatedItemProps {
  id: number;
  brand: string;
  name: string;
  priceAed: number;
  sizes: string[];
  image: string;
  olfactory: string;
}

const serviceNotes = [
  {
    q: "Shipping & delivery",
    a: `Express shipping across the GCC (1–2 business days) and worldwide (3–5 business days), complimentary on orders over AED ${FREE_SHIPPING_THRESHOLD_AED}. Every order is hand-packed in a thermal-insulated coffret so the composition travels intact.`
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

export default function ProductClient({
  product,
  related
}: {
  product: ProductDetailProps;
  related: RelatedItemProps[];
}) {
  const router = useRouter();
  const { add } = useCart();

  // Component States
  const [activeImage, setActiveImage] = useState<string>(product.image || product.images[0] || "");
  const [selectedSize, setSelectedSize] = useState<string>(product.sizes[0] || "");
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);

  // Wishlist state for the signed-in customer
  useEffect(() => {
    let cancelled = false;
    const loadWishlist = async () => {
      try {
        const supabase = getBrowserSupabase();
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId || cancelled) return;
        const { data: wishlists } = await supabase
          .from("wishlists")
          .select("*")
          .match({
            customer_id: userId,
            product_id: product.id,
            wishlist_type: "favorite"
          });
        if (!cancelled) setIsFav(Array.isArray(wishlists) && wishlists.length > 0);
      } catch (err) {
        console.error("Error loading wishlist state:", err);
      }
    };
    loadWishlist();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  // Single one-shot fade + rise on entry (design-system §7)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Add Scent to Selection Cart
  const handleAddToSelection = () => {
    add(
      {
        id: product.id,
        brand: product.brand,
        name: product.name,
        price: product.priceAed,
        image_url: product.image
      },
      selectedSize,
      quantity
    );
    setAddedSuccess(true);
    openCartDrawer();
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  // Buy now — add the selection and go straight to checkout
  const handleBuyNow = () => {
    add(
      {
        id: product.id,
        brand: product.brand,
        name: product.name,
        price: product.priceAed,
        image_url: product.image
      },
      selectedSize,
      quantity
    );
    router.push("/checkout");
  };

  // Quick add from the related-products rail
  const handleQuickAdd = (item: RelatedItemProps) => {
    const size = item.sizes?.[0] || "";
    add(
      {
        id: item.id,
        brand: item.brand,
        name: item.name,
        price: item.priceAed,
        image_url: item.image
      },
      size,
      1
    );
    openCartDrawer();
  };

  // Toggle Scent Wishlist Favorite
  const handleToggleFavorite = async () => {
    try {
      const supabase = getBrowserSupabase();
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) {
        triggerToast("Please sign in to use your wishlist");
        return;
      }

      if (isFav) {
        const { error } = await supabase
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
        const { error } = await supabase
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
    { Icon: Truck, label: FREE_SHIPPING_NOTE },
    { Icon: ShieldCheck, label: "Guaranteed authentic" },
    { Icon: Droplet, label: "Complimentary samples" },
    { Icon: Headphones, label: "Responsive client care" }
  ];

  const sameMaison =
    related.length > 0 && related.every((item) => item.brand === product.brand);

  /* Empty until a number is configured, so the link simply does not render
     rather than pointing at a wa.me address the maison does not own. */
  const whatsappHref = whatsappLink(
    `Hello Gharib, I would like to enquire about ${product.brand} ${product.name}.`
  );

  return (
    <div className="maison min-h-screen flex flex-col overflow-x-hidden">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-24 right-5 z-50 bg-[#121212] text-white text-[12px] tracking-[0.1em] uppercase px-5 py-4">
          {toastMessage}
        </div>
      )}

      <AppHeader activePage="shop" />
      <CartDrawer />
      <ConciergeWidget />

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
                    preload
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
                <Price
                  amountAed={product.priceAed}
                  className="text-[20px] font-medium leading-none text-black"
                />
              </div>

              {/* 4. Delivery estimate */}
              <p className="text-[13px] font-light text-[#646464] mt-5">
                Delivery in 2–5 business days across the UAE
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

              {/* 5. Add to cart / buy now + wishlist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleAddToSelection}
                  disabled={addedSuccess}
                  className="maison-btn w-full h-12"
                >
                  {addedSuccess ? "Added to cart" : "Add to cart"}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="maison-btn-outline w-full h-12"
                >
                  Buy now
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                <button type="button" onClick={handleToggleFavorite} className="maison-link cursor-pointer">
                  {isFav ? "In wishlist" : "Add to wishlist"}
                </button>
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="maison-link"
                  >
                    Enquire on WhatsApp
                  </a>
                )}
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
                    Each composition is unique. The full ingredient declaration for this fragrance is
                    printed on its packaging.
                  </div>
                </details>

                {related.length > 0 && (
                  <details className="maison-accordion">
                    <summary>You may also like</summary>
                    <div className="pb-6 flex flex-col">
                      {related.slice(0, 3).map((item) => (
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
                            <Price amountAed={item.priceAed} className="maison-price" />
                          </span>
                        </Link>
                      ))}
                    </div>
                  </details>
                )}

                <details className="maison-accordion">
                  <summary>Precautions for use</summary>
                  <div className="pb-6 text-[14px] font-light leading-[1.7] text-[rgba(0,0,0,0.75)]">
                    As with all fine fragrance: for external use only. Keep away from direct sunlight
                    and heat sources, avoid contact with the eyes, and keep out of the reach of
                    children. Refer to the packaging for guidance specific to this composition.
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
        {related.length > 0 && (
          <section className="maison-section border-t border-[var(--line)]">
            <div className="maison-container">
              <h2 className="maison-page-title text-center">
                {sameMaison ? "From the same maison" : "You may also like"}
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 mt-12 md:mt-16">
                {related.map((item) => (
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

                    <Price amountAed={item.priceAed} className="maison-price mt-3 text-center block" />

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
