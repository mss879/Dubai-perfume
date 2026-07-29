"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Heart } from "lucide-react";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import { clientSafeSupabase } from "../lib/supabase";

interface CatalogProduct {
  id: number;
  brand: string;
  name: string;
  price: string;
  sizes: string[];
  image: string;
  images?: string[];
  isNew?: boolean;
  isBestSeller?: boolean;
  isFeaturedLarge?: boolean;
  description?: string;
  olfactory?: string;
  gender?: string;
}

interface CartItem {
  product: CatalogProduct;
  quantity: number;
  selectedSize: string;
}

/* Shapes returned by the Supabase tables this page reads. */
interface DbProductRow {
  id: number;
  brand: string;
  name: string;
  price: number | string;
  sizes?: string[] | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  is_new?: boolean;
  is_bestseller?: boolean;
  is_featured_large?: boolean;
  description?: string | null;
  olfactory_group?: string | null;
  tags?: string[] | null;
}

interface DbCollectionRow {
  id: string;
  title?: string;
  /* 'curated' | 'brand' | 'line' — see migration 24. Older rows default to 'curated'. */
  kind?: string | null;
  brand?: string | null;
  sort_order?: number | null;
}

interface DbProductCollectionRow {
  collection_id: string;
  product_id: number;
}

const OLFACTORY_FAMILIES = [
  { id: "Woody & Oud", label: "Woody & Oud" },
  { id: "Amber & Oriental", label: "Amber & Oriental" },
  { id: "Floral & Sweet", label: "Floral & Sweet" },
  { id: "Fresh & Aquatic", label: "Fresh & Aquatic" }
];

/* Sub-nav tabs that are pure filter state and own no database row. */
const GENDER_TABS: { label: string; gender: string | null }[] = [
  { label: "All fragrances", gender: null },
  { label: "For women", gender: "women" },
  { label: "For men", gender: "men" },
  { label: "Unisex", gender: "unisex" }
];

/* Display labels only. Every collection tab and option is built from the real
   `collections` rows — a standard id that has no row renders no tab. */
const STANDARD_COLLECTION_LABELS: Record<string, string> = {
  new: "New arrivals",
  bestsellers: "Best sellers",
  favorites: "Favourites",
  trending: "Trending"
};

const STANDARD_COLLECTION_ORDER = ["new", "bestsellers", "favorites", "trending"];

const GENDER_LABELS: Record<string, string> = {
  men: "For Men",
  women: "For Women",
  unisex: "Unisex"
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name-asc", label: "Alphabetical (A–Z)" },
  { value: "newest", label: "New releases first" }
];

const PAGE_SIZE = 12;

function ShopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL parameters sync
  const urlOlfactory = searchParams.get("olfactory");
  const urlGender = searchParams.get("gender");
  const urlBrand = searchParams.get("brand");
  const urlCollection = searchParams.get("collection");
  const urlSearch = searchParams.get("search") || "";
  const urlSort = searchParams.get("sort") || "featured";

  // Component State
  // The catalogue is entirely server-owned: start empty and paint a placeholder
  // grid until Supabase answers. Never seed the grid with local sample data.
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [collections, setCollections] = useState<DbCollectionRow[]>([]);
  const [productCollections, setProductCollections] = useState<DbProductCollectionRow[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // Active Filters
  const [selectedOlfactory, setSelectedOlfactory] = useState<string | null>(urlOlfactory);
  const [selectedGender, setSelectedGender] = useState<string | null>(urlGender);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(urlBrand);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(urlCollection);
  const [searchQuery, setSearchQuery] = useState<string>(urlSearch);
  const [sortBy, setSortBy] = useState<string>(urlSort);

  // UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [lastFilterSignature, setLastFilterSignature] = useState<string>(
    [urlSearch, urlOlfactory, urlGender, urlBrand, urlCollection, urlSort].join("|")
  );
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Sync state when the URL searchParams change (back/forward navigation, or a
  // link that arrives with filters pre-applied). Adjusting during render rather
  // than in an effect avoids a wasted pass with stale filters on screen.
  const urlSignature = searchParams.toString();
  const [lastUrlSignature, setLastUrlSignature] = useState<string>(urlSignature);
  if (urlSignature !== lastUrlSignature) {
    setLastUrlSignature(urlSignature);
    setSelectedOlfactory(urlOlfactory);
    setSelectedGender(urlGender);
    setSelectedBrand(urlBrand);
    setSelectedCollection(urlCollection);
    setSearchQuery(urlSearch);
    setSortBy(urlSort);
  }

  // Fetch products live from Supabase
  useEffect(() => {
    const loadShopData = async () => {
      try {
        setIsLoadingCatalog(true);
        const { data: dbProducts } = await clientSafeSupabase.from("products").select("*");
        const { data: dbCollections } = await clientSafeSupabase.from("collections").select("*");
        const { data: dbMappings } = await clientSafeSupabase.from("product_collections").select("*");

        if (dbProducts) {
          const mapped: CatalogProduct[] = (dbProducts as DbProductRow[]).map((p) => {
            let gender = "unisex";
            if (p.tags) {
              if (p.tags.includes("men") || p.tags.includes("man") || p.tags.includes("for men")) {
                gender = "men";
              } else if (p.tags.includes("women") || p.tags.includes("woman") || p.tags.includes("for women")) {
                gender = "women";
              }
            }
            return {
              id: p.id,
              brand: p.brand,
              name: p.name,
              price: String(p.price),
              sizes: p.sizes || ["50ml", "100ml"],
              image: p.image_url || "/catalog_initio_oud.png",
              images: p.image_urls || (p.image_url ? [p.image_url] : []),
              isNew: p.is_new,
              isBestSeller: p.is_bestseller,
              isFeaturedLarge: p.is_featured_large,
              description: p.description ?? undefined,
              olfactory: p.olfactory_group || "Woody & Oud",
              gender: gender
            };
          });
          setProducts(mapped);
        }

        if (dbCollections) setCollections(dbCollections);
        if (dbMappings) setProductCollections(dbMappings);
      } catch (err) {
        console.error("Shop page Supabase load error:", err);
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    loadShopData();
  }, []);

  // Lock the page behind the filter drawer
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = isFilterOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFilterOpen]);

  // Update URL helper
  const updateUrlFilters = (paramsToUpdate: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(paramsToUpdate).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const newQuery = params.toString();
    const newPath = newQuery ? `/shop?${newQuery}` : `/shop`;
    router.push(newPath, { scroll: false });
  };

  // Helper trigger for toast
  const triggerToast = (msg: string) => {
    setAddedToast(msg);
    setTimeout(() => setAddedToast(null), 3000);
  };

  // Filter products logic
  const filteredProducts = products.filter((prod) => {
    // Search query filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchBrand = prod.brand.toLowerCase().includes(q);
      const matchName = prod.name.toLowerCase().includes(q);
      const matchDesc = prod.description ? prod.description.toLowerCase().includes(q) : false;
      if (!matchBrand && !matchName && !matchDesc) return false;
    }

    // Olfactory filter
    if (selectedOlfactory && prod.olfactory !== selectedOlfactory) {
      return false;
    }

    // Gender filter
    if (selectedGender) {
      if (selectedGender !== "unisex" && prod.gender !== selectedGender && prod.gender !== "unisex") {
        return false;
      }
    }

    // Brand filter
    if (selectedBrand && prod.brand.toUpperCase() !== selectedBrand.toUpperCase()) {
      return false;
    }

    // Collection filter
    if (selectedCollection) {
      if (selectedCollection === "new" && !prod.isNew) return false;
      if (selectedCollection === "bestsellers" && !prod.isBestSeller) return false;
      if (selectedCollection === "trending" && (!prod.isBestSeller && !prod.isNew)) return false;
      if (selectedCollection === "favorites" && !favorites.includes(prod.id)) return false;
      if (selectedCollection !== "new" && selectedCollection !== "bestsellers" && selectedCollection !== "trending" && selectedCollection !== "favorites") {
        const allowedIds = productCollections
          .filter((pc) => pc.collection_id === selectedCollection)
          .map((pc) => pc.product_id);
        if (!allowedIds.includes(prod.id)) return false;
      }
    }

    return true;
  });

  // Sort products logic
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const priceA = parseFloat(a.price) || 0;
    const priceB = parseFloat(b.price) || 0;

    if (sortBy === "price-asc") return priceA - priceB;
    if (sortBy === "price-desc") return priceB - priceA;
    if (sortBy === "name-asc") return a.name.localeCompare(b.name);
    if (sortBy === "newest") return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
    return 0; // default featured
  });

  // ── Real collection rows, split by kind ──────────────────────────────────
  // 'curated' rows drive the sub-nav tabs and the collection select;
  // 'brand' rows only supply display names for the maison filter.
  const curatedCollections = [...collections]
    .filter((c) => (c.kind ?? "curated") === "curated")
    .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100));

  const brandCollections = collections.filter((c) => c.kind === "brand" && c.brand);

  // Collection select — real curated rows only, standard ids get a nicer label
  const collectionOptions: { id: string; label: string }[] = curatedCollections.map((c) => ({
    id: String(c.id),
    label: STANDARD_COLLECTION_LABELS[String(c.id)] || String(c.title || c.id)
  }));

  // A brand or line collection can arrive via URL (the brand pages link in with
  // one). Surface it in the select so the control never renders blank.
  const activeCollectionRow = selectedCollection
    ? collections.find((c) => String(c.id) === selectedCollection)
    : undefined;
  if (activeCollectionRow && !collectionOptions.some((o) => o.id === selectedCollection)) {
    collectionOptions.push({
      id: String(activeCollectionRow.id),
      label: String(activeCollectionRow.title || activeCollectionRow.id)
    });
  }

  // Label lookup spans every fetched row so a URL carrying any collection id
  // (brand or line pages link in with one) still shows a proper title.
  const collectionLabelFor = (id: string) => {
    const row = collections.find((c) => String(c.id) === id);
    if (!row) return id;
    return STANDARD_COLLECTION_LABELS[id] || String(row.title || id);
  };

  // Sub-nav tabs: filter-only tabs, then one tab per standard collection that
  // actually exists in the database.
  const categoryTabs: { key: string; label: string; gender: string | null; collection: string | null }[] = [
    ...GENDER_TABS.map((tab) => ({
      key: `gender-${tab.gender ?? "all"}`,
      label: tab.label,
      gender: tab.gender,
      collection: null
    })),
    ...STANDARD_COLLECTION_ORDER
      .filter((id) => curatedCollections.some((c) => String(c.id) === id))
      .map((id) => ({
        key: `collection-${id}`,
        label: STANDARD_COLLECTION_LABELS[id],
        gender: null,
        collection: id
      }))
  ];

  // Maison filter — values stay the product brand strings (URL compatible),
  // labels come from the matching 'brand' collection row when there is one.
  const brandOptions = Array.from(new Set(products.map((p) => p.brand)))
    .sort()
    .map((value) => {
      const row = brandCollections.find(
        (c) => String(c.brand).toUpperCase() === value.toUpperCase()
      );
      return { value, label: row ? String(row.title || value) : value };
    });

  const brandLabelFor = (value: string) =>
    brandOptions.find((b) => b.value.toUpperCase() === value.toUpperCase())?.label || value;

  // Reset the visible window whenever the result set changes
  const filterSignature = [
    searchQuery, selectedOlfactory, selectedGender, selectedBrand, selectedCollection, sortBy
  ].join("|");
  if (filterSignature !== lastFilterSignature) {
    setLastFilterSignature(filterSignature);
    setVisibleCount(PAGE_SIZE);
  }

  const visibleProducts = sortedProducts.slice(0, visibleCount);
  const hasMore = visibleCount < sortedProducts.length;

  // Reset all filters
  const resetAllFilters = () => {
    setSelectedOlfactory(null);
    setSelectedGender(null);
    setSelectedBrand(null);
    setSelectedCollection(null);
    setSearchQuery("");
    setSortBy("featured");
    router.push("/shop");
  };

  const isAnyFilterActive = !!(selectedOlfactory || selectedGender || selectedBrand || selectedCollection || searchQuery.trim());

  // Current collection name shown under the eyebrow
  const collectionTitle = (() => {
    if (searchQuery.trim()) return searchQuery.trim();
    if (selectedCollection) return collectionLabelFor(selectedCollection);
    if (selectedBrand) return brandLabelFor(selectedBrand);
    if (selectedOlfactory) return selectedOlfactory;
    if (selectedGender) return GENDER_LABELS[selectedGender] || selectedGender;
    return "All Fragrances";
  })();

  const eyebrowLabel = searchQuery.trim() ? "Search:" : "Collection:";

  const activeFilterChips: { key: string; label: string; clear: () => void }[] = [];
  if (searchQuery.trim()) {
    activeFilterChips.push({
      key: "search",
      label: `Search: ${searchQuery.trim()}`,
      clear: () => { setSearchQuery(""); updateUrlFilters({ search: null }); }
    });
  }
  if (selectedGender) {
    activeFilterChips.push({
      key: "gender",
      label: GENDER_LABELS[selectedGender] || selectedGender,
      clear: () => { setSelectedGender(null); updateUrlFilters({ gender: null }); }
    });
  }
  if (selectedOlfactory) {
    activeFilterChips.push({
      key: "olfactory",
      label: selectedOlfactory,
      clear: () => { setSelectedOlfactory(null); updateUrlFilters({ olfactory: null }); }
    });
  }
  if (selectedBrand) {
    activeFilterChips.push({
      key: "brand",
      label: brandLabelFor(selectedBrand),
      clear: () => { setSelectedBrand(null); updateUrlFilters({ brand: null }); }
    });
  }
  if (selectedCollection) {
    activeFilterChips.push({
      key: "collection",
      label: collectionLabelFor(selectedCollection),
      clear: () => { setSelectedCollection(null); updateUrlFilters({ collection: null }); }
    });
  }

  const handleAddToCart = (prod: CatalogProduct, displayName: string) => {
    const size = selectedSizes[prod.id] || (prod.sizes && prod.sizes[0]) || "100ml";

    if (typeof window !== "undefined") {
      let cart: CartItem[] = [];
      try {
        cart = JSON.parse(localStorage.getItem("gharib_cart_v2") || "[]");
      } catch {
        cart = [];
      }

      const existingIdx = cart.findIndex(
        (item: CartItem) => item.product?.id === prod.id && item.selectedSize === size
      );

      if (existingIdx > -1) {
        cart[existingIdx].quantity += 1;
      } else {
        cart.push({ product: prod, quantity: 1, selectedSize: size });
      }

      localStorage.setItem("gharib_cart_v2", JSON.stringify(cart));
    }

    triggerToast(`${displayName} — ${size} added to your selection`);
  };

  const isTabActive = (tab: { gender: string | null; collection: string | null }) =>
    selectedGender === tab.gender && selectedCollection === tab.collection;

  return (
    <div className="maison min-h-screen bg-white text-black flex flex-col justify-between font-body relative overflow-x-hidden">
      {/* Confirmation notice */}
      <AnimatePresence>
        {addedToast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-6 right-5 z-[130] bg-black text-white px-6 py-4 text-[12px] font-normal uppercase tracking-[0.1em]"
          >
            {addedToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Header */}
      <AppHeader activePage="shop" />

      <main className="flex-grow bg-white">
        <div className="maison-container">

          {/* 1 ─ Sub-nav category tabs */}
          <nav className="pt-10 md:pt-14">
            <ul className="flex items-center justify-start md:justify-center gap-8 md:gap-10 overflow-x-auto no-scrollbar">
              {categoryTabs.map((tab) => {
                const active = isTabActive(tab);
                return (
                  <li key={tab.key} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGender(tab.gender);
                        setSelectedCollection(tab.collection);
                        updateUrlFilters({ gender: tab.gender, collection: tab.collection });
                      }}
                      className={`pb-1.5 text-[15px] leading-none transition-colors duration-300 cursor-pointer whitespace-nowrap ${
                        active
                          ? "text-black border-b border-black"
                          : "text-[#646464] hover:text-black border-b border-transparent"
                      }`}
                      style={{ fontWeight: 350 }}
                      aria-current={active ? "page" : undefined}
                    >
                      {tab.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* 2 ─ Eyebrow + collection title */}
          <header className="text-center pt-14 md:pt-20 pb-10 md:pb-14">
            <span className="maison-eyebrow block mb-5">{eyebrowLabel}</span>
            <h1 className="maison-page-title">{collectionTitle}</h1>
          </header>

          {/* 3 ─ Filter / utility bar */}
          <div className="border-t border-b border-[rgba(0,0,0,0.12)]">
            <div className="h-14 grid grid-cols-3 items-center">
              {/* left — all filters */}
              <div className="justify-self-start">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(true)}
                  className="text-[14px] text-black border-b border-black pb-0.5 transition-opacity duration-300 hover:opacity-55 cursor-pointer"
                  style={{ fontWeight: 350 }}
                >
                  All filters
                </button>
              </div>

              {/* center — count (withheld until the catalogue has answered) */}
              <div className="justify-self-center text-[14px] text-black whitespace-nowrap" style={{ fontWeight: 350 }}>
                {isLoadingCatalog
                  ? ""
                  : `${sortedProducts.length} ${sortedProducts.length === 1 ? "product" : "products"}`}
              </div>

              {/* right — sort */}
              <div className="justify-self-end relative">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSortBy(val);
                    updateUrlFilters({ sort: val });
                  }}
                  aria-label="Sort products by"
                  className="appearance-none bg-transparent border-0 border-b border-[rgba(0,0,0,0.12)] text-[14px] text-black pr-6 pb-0.5 outline-none cursor-pointer focus:border-black transition-colors duration-300"
                  style={{ fontWeight: 350, borderRadius: 0 }}
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-black" strokeWidth={1.25} />
              </div>
            </div>
          </div>

          {/* Active filters — plain text, hairline bottom */}
          {activeFilterChips.length > 0 && (
            <div className="border-b border-[rgba(0,0,0,0.12)] py-4 flex flex-wrap items-center gap-x-7 gap-y-3">
              {activeFilterChips.map(chip => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  className="maison-card-label flex items-center gap-2 transition-opacity duration-300 hover:opacity-55 cursor-pointer"
                >
                  {chip.label}
                  <span aria-hidden="true" className="text-[13px] leading-none">&times;</span>
                  <span className="sr-only">Remove filter</span>
                </button>
              ))}
              <button
                type="button"
                onClick={resetAllFilters}
                className="maison-card-label ml-auto border-b border-black pb-0.5 hover:opacity-55 transition-opacity duration-300 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}

          {/* 4 ─ Product grid */}
          {isLoadingCatalog ? (
            /* Quiet placeholder — flat #F5F5F5 blocks at the card ratio. No
               shimmer, no spinner, no motion. */
            <div className="pt-14 md:pt-16" role="status" aria-live="polite">
              <span className="sr-only">Loading the collection</span>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16" aria-hidden="true">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="w-full aspect-square bg-[#F5F5F5]" />
                ))}
              </div>
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="py-28 md:py-40 text-center flex flex-col items-center">
              <h2 className="font-display text-[20px] md:text-[24px] uppercase tracking-[0.1em] text-black">
                No fragrances found
              </h2>
              <p className="maison-body mt-6 max-w-[46ch]">
                We could not find a scent matching this selection. Adjust your filters, or explore the full
                collection.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="maison-btn-outline mt-10"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16 pt-14 md:pt-16">
                {visibleProducts.map((prod) => {
                  const isFav = favorites.includes(prod.id);
                  const displayName = prod.name ? prod.name.replace(/_/g, " ") : "";
                  const label = prod.isFeaturedLarge
                    ? "Iconic"
                    : prod.isNew
                      ? "New"
                      : prod.isBestSeller
                        ? "Best seller"
                        : null;
                  const sizes = prod.sizes && prod.sizes.length > 0 ? prod.sizes : ["100ml"];
                  const activeSize = selectedSizes[prod.id] || sizes[0];

                  return (
                    <article key={prod.id} className="group flex flex-col bg-transparent">
                      {/* Media */}
                      <div className="relative">
                        {label && (
                          <span className="maison-card-label absolute top-0 left-0 z-10">
                            {label}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setFavorites(prev => isFav ? prev.filter(id => id !== prod.id) : [...prev, prod.id]);
                            triggerToast(isFav ? `${displayName} removed from favourites` : `${displayName} saved to favourites`);
                          }}
                          className="absolute top-0 right-0 z-10 text-black transition-opacity duration-300 hover:opacity-55 cursor-pointer"
                          title={isFav ? "Remove from favourites" : "Add to favourites"}
                          aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
                          aria-pressed={isFav}
                        >
                          <Heart className={`w-4 h-4 ${isFav ? "fill-black" : ""}`} strokeWidth={1.25} />
                        </button>

                        <Link href={`/product/${prod.id}`} className="maison-card-media block">
                          <Image
                            src={prod.image}
                            alt={displayName}
                            fill
                            sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 45vw"
                            className="object-contain"
                          />
                        </Link>
                      </div>

                      {/* Copy */}
                      <div className="pt-7 text-center">
                        <span className="maison-eyebrow block mb-3">
                          {prod.brand}
                        </span>
                        <Link href={`/product/${prod.id}`} className="block">
                          <h3 className="maison-card-title transition-opacity duration-300 hover:opacity-55">
                            {displayName}
                          </h3>
                        </Link>
                        {prod.olfactory && (
                          <span className="maison-card-notes block mt-3">{prod.olfactory}</span>
                        )}
                      </div>

                      {/* Price + size */}
                      <div className="mt-auto pt-6">
                        <div className="flex items-center justify-between gap-2 border-b border-[rgba(0,0,0,0.12)] pb-3">
                          <span className="maison-price">
                            AED {parseFloat(prod.price).toFixed(2)}
                          </span>

                          {sizes.length > 1 ? (
                            <div className="relative shrink-0">
                              <select
                                value={activeSize}
                                onChange={(e) =>
                                  setSelectedSizes(prev => ({ ...prev, [prod.id]: e.target.value }))
                                }
                                aria-label={`Select size for ${displayName}`}
                                className="appearance-none bg-transparent border-0 text-[14px] text-black pr-5 outline-none cursor-pointer"
                                style={{ fontWeight: 350, borderRadius: 0 }}
                              >
                                {sizes.map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-black" strokeWidth={1.25} />
                            </div>
                          ) : (
                            <span className="text-[14px] text-black shrink-0" style={{ fontWeight: 350 }}>
                              {sizes[0]}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddToCart(prod, displayName)}
                          className="maison-btn-outline w-full mt-5"
                          style={{ paddingLeft: 0, paddingRight: 0, height: 48 }}
                        >
                          Add to cart
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* 5 ─ Load more */}
              {hasMore && (
                <div className="pt-16 md:pt-20 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    className="maison-btn-outline"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}

          {/* bottom air */}
          <div className="pb-20 md:pb-28" />
        </div>
      </main>

      {/* Filter drawer */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              key="filter-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 z-[140] bg-black/35"
            />
            <motion.aside
              key="filter-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 left-0 bottom-0 z-[150] w-full max-w-[400px] bg-white flex flex-col"
              aria-label="Product filters"
            >
              {/* Drawer head */}
              <div className="flex items-center justify-between px-6 md:px-8 h-16 border-b border-[rgba(0,0,0,0.12)]">
                <span className="font-display text-[20px] uppercase tracking-[0.07em] text-black">
                  All filters
                </span>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  aria-label="Close filters"
                  className="text-[22px] leading-none text-black transition-opacity duration-300 hover:opacity-55 cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto px-6 md:px-8 py-8 flex flex-col gap-10">
                {/* Search */}
                <div>
                  <label htmlFor="shop-search" className="maison-label">Search</label>
                  <input
                    id="shop-search"
                    type="text"
                    placeholder="Scent, maison or note"
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      updateUrlFilters({ search: val || null });
                    }}
                    className="maison-input"
                  />
                </div>

                {/* Olfactive family */}
                <div>
                  <span className="maison-label">Olfactive family</span>
                  <ul className="flex flex-col">
                    {OLFACTORY_FAMILIES.map((olf) => {
                      const active = selectedOlfactory === olf.id;
                      return (
                        <li key={olf.id}>
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = active ? null : olf.id;
                              setSelectedOlfactory(nextVal);
                              updateUrlFilters({ olfactory: nextVal });
                            }}
                            className="w-full flex items-center gap-3 py-3 text-left border-b border-[rgba(0,0,0,0.12)] cursor-pointer"
                          >
                            <span
                              className={`w-4 h-4 shrink-0 border border-black flex items-center justify-center text-[10px] leading-none text-white ${active ? "bg-black" : "bg-white"}`}
                              aria-hidden="true"
                            >
                              {active ? "✓" : ""}
                            </span>
                            <span className="text-[14px] text-black" style={{ fontWeight: 300 }}>
                              {olf.label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Maison / brand */}
                <div>
                  <label htmlFor="shop-brand" className="maison-label">Maison</label>
                  <div className="relative">
                    <select
                      id="shop-brand"
                      value={selectedBrand || ""}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        setSelectedBrand(val);
                        updateUrlFilters({ brand: val });
                      }}
                      className="maison-select"
                      style={{ paddingRight: 40 }}
                    >
                      <option value="">All maisons ({brandOptions.length})</option>
                      {brandOptions.map(b => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black" strokeWidth={1.25} />
                  </div>
                </div>

                {/* Collection */}
                <div>
                  <label htmlFor="shop-collection" className="maison-label">Collection</label>
                  <div className="relative">
                    <select
                      id="shop-collection"
                      value={selectedCollection || ""}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        setSelectedCollection(val);
                        updateUrlFilters({ collection: val });
                      }}
                      className="maison-select"
                      style={{ paddingRight: 40 }}
                    >
                      <option value="">All collections</option>
                      {collectionOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black" strokeWidth={1.25} />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <span className="maison-label">Wear</span>
                  <ul className="flex flex-col">
                    {["women", "men", "unisex"].map((gen) => {
                      const active = selectedGender === gen;
                      return (
                        <li key={gen}>
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = active ? null : gen;
                              setSelectedGender(nextVal);
                              updateUrlFilters({ gender: nextVal });
                            }}
                            className="w-full flex items-center gap-3 py-3 text-left border-b border-[rgba(0,0,0,0.12)] cursor-pointer"
                          >
                            <span
                              className={`w-4 h-4 shrink-0 border border-black flex items-center justify-center text-[10px] leading-none text-white ${active ? "bg-black" : "bg-white"}`}
                              aria-hidden="true"
                            >
                              {active ? "✓" : ""}
                            </span>
                            <span className="text-[14px] text-black" style={{ fontWeight: 300 }}>
                              {GENDER_LABELS[gen]}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* Drawer foot */}
              <div className="px-6 md:px-8 py-6 border-t border-[rgba(0,0,0,0.12)] flex items-center gap-6">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  disabled={!isAnyFilterActive}
                  className={`maison-card-label border-b border-black pb-0.5 transition-opacity duration-300 cursor-pointer ${isAnyFilterActive ? "hover:opacity-55" : "opacity-35 cursor-not-allowed"}`}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="maison-btn flex-1"
                  style={{ height: 48, paddingLeft: 0, paddingRight: 0 }}
                >
                  View {sortedProducts.length} {sortedProducts.length === 1 ? "product" : "products"}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main App Footer */}
      <Footer />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="maison min-h-screen bg-white flex items-center justify-center">
        <span className="font-display text-[16px] uppercase tracking-[0.1em] text-[#646464]">
          Loading the collection
        </span>
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}
