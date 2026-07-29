"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SlidersHorizontal, Sparkles, Filter, X, ChevronDown,
  Check, ShoppingBag, ArrowUpDown, Tag, RefreshCw, Heart, ArrowRight
} from "lucide-react";
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

const FALLBACK_PRODUCTS: CatalogProduct[] = [
  {
    id: 1,
    brand: "INITIO PARFUMS PRIVES",
    name: "Oud for greatness",
    price: "1215",
    sizes: ["50ml", "90ml"],
    image: "/catalog_initio_oud.png",
    isNew: true,
    olfactory: "Woody & Oud",
    gender: "unisex",
    description: "A highly concentrated woody fragrance with saffron, lavender, and nutmeg, dry down to heavy dark agarwood oud."
  },
  {
    id: 2,
    brand: "JULIETTE HAS A GUN",
    name: "Juliette",
    price: "360",
    sizes: ["30ml", "50ml"],
    image: "/catalog_juliette_gun.png",
    isBestSeller: true,
    olfactory: "Floral & Sweet",
    gender: "women",
    description: "A beautiful floral-sensual blend that balances elegant red berries, white blossoms, and sweet woods."
  },
  {
    id: 3,
    brand: "RABANNE",
    name: "Phantom",
    price: "440",
    sizes: ["50ml", "100ml"],
    image: "/catalog_rabanne_phantom.png",
    isNew: true,
    olfactory: "Fresh & Aquatic",
    gender: "men",
    description: "A fresh, futuristic composition featuring notes of lavender, creamy patchouli, vanilla, and sparkling vetiver."
  },
  {
    id: 4,
    brand: "HFC",
    name: "Devil's intrigue",
    price: "1358",
    sizes: ["75ml"],
    image: "/catalog_hfc_devils.png",
    isBestSeller: true,
    olfactory: "Amber & Oriental",
    gender: "women",
    description: "Deep, dramatic amber oriental profile combining warm vanilla, fine sandalwood, and exotic floral touches."
  },
  {
    id: 5,
    brand: "TOM FORD",
    name: "Lost Cherry eau de parfum",
    price: "1196",
    sizes: ["30ml", "50ml", "100ml"],
    image: "/catalog_tom_ford_cherry.png",
    isBestSeller: true,
    olfactory: "Floral & Sweet",
    gender: "women",
    description: "A full-bodied journey into the once-forbidden; a contrasting scent that reveals a tempting dichotomy of playful, candy-like gleam."
  },
  {
    id: 6,
    brand: "MOSCHINO",
    name: "Toy Boy",
    price: "158",
    sizes: ["30ml", "50ml", "100ml"],
    image: "/catalog_moschino_teddy.png",
    isNew: true,
    olfactory: "Woody & Oud",
    gender: "men",
    description: "A unique, masculine fragrance blending dark woods, pink pepper, rose notes, and resinous amber highlights."
  },
  {
    id: 7,
    brand: "FILIPPO SORCINELLI",
    name: "Epicentro",
    price: "1196",
    sizes: ["50ml", "100ml"],
    image: "/catalog_sorcinelli_epicentro.png",
    isBestSeller: true,
    isFeaturedLarge: true,
    olfactory: "Fresh & Aquatic",
    gender: "unisex",
    description: "Epicentro is an artistic perfume that represents a deep volcanic impact. Topped with a heavy raw silver metal crumpled sculpture."
  },
  {
    id: 8,
    brand: "FILIPPO SORCINELLI",
    name: "Eio_non_ho_mani_che_mi_accarezzino_il_volto",
    price: "862",
    sizes: ["100ml"],
    image: "/catalog_sorcinelli_leather.png",
    isNew: true,
    isFeaturedLarge: true,
    olfactory: "Amber & Oriental",
    gender: "unisex",
    description: "An avante-garde olfactory masterpiece encased in a bottle wrapped dramatically in draped, textured organic matte black leather folds."
  },
  {
    id: 9,
    brand: "MARC-ANTOINE BARROIS",
    name: "Ganymede Extrait",
    price: "1170",
    sizes: ["30ml", "50ml"],
    image: "/catalog_marc_barrois.png",
    isNew: true,
    olfactory: "Woody & Oud",
    gender: "unisex",
    description: "Deeply woody and metallic masterpiece with leather, saffron, mandarin, and heavy warm immortelle."
  }
];

const OLFACTORY_FAMILIES = [
  { id: "Woody & Oud", label: "Woody & Oud", icon: "🪵" },
  { id: "Amber & Oriental", label: "Amber & Oriental", icon: "✨" },
  { id: "Floral & Sweet", label: "Floral & Sweet", icon: "🌸" },
  { id: "Fresh & Aquatic", label: "Fresh & Aquatic", icon: "🌊" }
];

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
  const [products, setProducts] = useState<CatalogProduct[]>(FALLBACK_PRODUCTS);
  const [collections, setCollections] = useState<any[]>([]);
  const [productCollections, setProductCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Filters
  const [selectedOlfactory, setSelectedOlfactory] = useState<string | null>(urlOlfactory);
  const [selectedGender, setSelectedGender] = useState<string | null>(urlGender);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(urlBrand);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(urlCollection);
  const [searchQuery, setSearchQuery] = useState<string>(urlSearch);
  const [sortBy, setSortBy] = useState<string>(urlSort);

  // UI state
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Sync state when URL searchParams change
  useEffect(() => {
    setSelectedOlfactory(searchParams.get("olfactory"));
    setSelectedGender(searchParams.get("gender"));
    setSelectedBrand(searchParams.get("brand"));
    setSelectedCollection(searchParams.get("collection"));
    setSearchQuery(searchParams.get("search") || "");
    setSortBy(searchParams.get("sort") || "featured");
  }, [searchParams]);

  // Fetch products live from Supabase
  useEffect(() => {
    const loadShopData = async () => {
      try {
        setLoading(true);
        const { data: dbProducts } = await clientSafeSupabase.from("products").select("*");
        const { data: dbCollections } = await clientSafeSupabase.from("collections").select("*");
        const { data: dbMappings } = await clientSafeSupabase.from("product_collections").select("*");

        if (dbProducts && dbProducts.length > 0) {
          const mapped: CatalogProduct[] = dbProducts.map((p: any) => {
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
              description: p.description,
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
        setLoading(false);
      }
    };
    loadShopData();
  }, []);

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
          .filter((pc: any) => pc.collection_id === selectedCollection)
          .map((pc: any) => pc.product_id);
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

  // Unique list of brands for filter
  const allBrands = Array.from(new Set(products.map(p => p.brand))).sort();

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

  return (
    <div className="min-h-screen bg-[#FAF5EF] text-[#1C120C] flex flex-col justify-between font-sans-luxury relative overflow-x-hidden pt-20">
      {/* Toast Notification */}
      <AnimatePresence>
        {addedToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-6 z-[120] bg-[#1C120C] text-[#F4E7D4] border border-amber-500/30 px-5 py-3 shadow-2xl text-xs font-bold uppercase tracking-widest flex items-center gap-3"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{addedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Header */}
      <AppHeader activePage="shop" />

      {/* Main Catalog Suite */}
      <main className="max-w-[1440px] mx-auto w-full px-4 md:px-8 lg:px-12 py-12 flex-grow">

        {/* Search Bar & Filter Controls Bar */}
        <div className="bg-white border border-[#EAE3DB] p-4 md:p-6 shadow-sm mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">

          {/* Live Search Bar */}
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8276]" />
            <input
              type="text"
              placeholder="Search by scent name, brand, or notes..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                updateUrlFilters({ search: val || null });
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-[#FAF6F0] border border-[#EAE3DB] text-xs text-[#1C120C] focus:outline-none focus:border-amber-700 transition-colors uppercase font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  updateUrlFilters({ search: null });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black font-bold text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Gender Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {["all", "men", "women", "unisex"].map((gen) => {
              const isActive = (gen === "all" && !selectedGender) || selectedGender === gen;
              return (
                <button
                  key={gen}
                  onClick={() => {
                    const newGen = gen === "all" ? null : gen;
                    setSelectedGender(newGen);
                    updateUrlFilters({ gender: newGen });
                  }}
                  className={`px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest transition-all whitespace-nowrap cursor-pointer border ${isActive
                      ? "bg-[#1C120C] text-[#F4E7D4] border-[#1C120C]"
                      : "bg-[#FAF6F0] text-neutral-600 border-[#EAE3DB] hover:text-black hover:border-black/30"
                    }`}
                >
                  {gen === "all" ? "All Genders" : gen}
                </button>
              );
            })}
          </div>

          {/* Sort Selector Dropdown */}
          <div className="flex items-center gap-3 self-end lg:self-auto">
            <span className="text-[10px] font-bold tracking-widest text-[#8C8276] uppercase hidden sm:inline">SORT BY:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  const val = e.target.value;
                  setSortBy(val);
                  updateUrlFilters({ sort: val });
                }}
                aria-label="Sort products by"
                className="appearance-none bg-[#FAF6F0] border border-[#EAE3DB] text-xs font-semibold text-[#1C120C] uppercase tracking-wider py-2.5 pl-4 pr-9 cursor-pointer focus:outline-none focus:border-amber-700"
              >
                <option value="featured">Featured Curations</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Alphabetical (A-Z)</option>
                <option value="newest">New Releases First</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
            </div>
          </div>

        </div>

        {/* Olfactory Family Pills Strip */}
        <div className="mb-8">
          <span className="text-[9px] font-black tracking-[0.25em] text-[#8C8276] uppercase block mb-3">
            EXPLORE BY OLFACTORY FAMILY
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {OLFACTORY_FAMILIES.map((olf) => {
              const isActive = selectedOlfactory === olf.id;
              return (
                <button
                  key={olf.id}
                  onClick={() => {
                    const nextVal = isActive ? null : olf.id;
                    setSelectedOlfactory(nextVal);
                    updateUrlFilters({ olfactory: nextVal });
                  }}
                  className={`p-3.5 border flex items-center justify-between transition-all duration-300 cursor-pointer ${isActive
                      ? "bg-[#1C120C] text-[#F4E7D4] border-[#1C120C] shadow-md scale-[1.02]"
                      : "bg-white text-[#1C120C] border-[#EAE3DB] hover:border-amber-800/40 hover:bg-[#FAF6F0]"
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{olf.icon}</span>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">{olf.label}</span>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filter Badges & Reset Bar */}
        {isAnyFilterActive && (
          <div className="bg-[#FAF5EF] border border-[#EAE3DB] p-4 mb-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black tracking-widest text-[#8C8276] uppercase mr-1">ACTIVE FILTERS:</span>

              {selectedOlfactory && (
                <span className="bg-[#1C120C] text-[#F4E7D4] text-[10px] tracking-widest font-bold uppercase px-3 py-1.5 flex items-center gap-2">
                  Olfactory: {selectedOlfactory}
                  <button onClick={() => { setSelectedOlfactory(null); updateUrlFilters({ olfactory: null }); }} className="hover:text-red-400 font-bold">✕</button>
                </span>
              )}

              {selectedGender && (
                <span className="bg-[#1C120C] text-[#F4E7D4] text-[10px] tracking-widest font-bold uppercase px-3 py-1.5 flex items-center gap-2">
                  Gender: {selectedGender}
                  <button onClick={() => { setSelectedGender(null); updateUrlFilters({ gender: null }); }} className="hover:text-red-400 font-bold">✕</button>
                </span>
              )}

              {selectedBrand && (
                <span className="bg-[#1C120C] text-[#F4E7D4] text-[10px] tracking-widest font-bold uppercase px-3 py-1.5 flex items-center gap-2">
                  Brand: {selectedBrand}
                  <button onClick={() => { setSelectedBrand(null); updateUrlFilters({ brand: null }); }} className="hover:text-red-400 font-bold">✕</button>
                </span>
              )}

              {selectedCollection && (
                <span className="bg-[#1C120C] text-[#F4E7D4] text-[10px] tracking-widest font-bold uppercase px-3 py-1.5 flex items-center gap-2">
                  Collection: {selectedCollection}
                  <button onClick={() => { setSelectedCollection(null); updateUrlFilters({ collection: null }); }} className="hover:text-red-400 font-bold">✕</button>
                </span>
              )}

              {searchQuery && (
                <span className="bg-[#1C120C] text-[#F4E7D4] text-[10px] tracking-widest font-bold uppercase px-3 py-1.5 flex items-center gap-2">
                  Search: &ldquo;{searchQuery}&rdquo;
                  <button onClick={() => { setSearchQuery(""); updateUrlFilters({ search: null }); }} className="hover:text-red-400 font-bold">✕</button>
                </span>
              )}
            </div>

            <button
              onClick={resetAllFilters}
              className="text-[10px] font-extrabold uppercase tracking-widest text-[#8C6D46] hover:text-black border-b border-[#8C6D46] cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Brand Bar Filter Dropdown */}
        <div className="mb-8 flex items-center justify-between border-b border-[#EAE3DB] pb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-[#8C6D46]" />
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#1C120C]">
              SHOWING {sortedProducts.length} FRAGRANCES
            </span>
          </div>

          {/* Brand Quick Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#8C8276] uppercase hidden sm:inline">FILTER BRAND:</span>
            <select
              value={selectedBrand || ""}
              onChange={(e) => {
                const val = e.target.value || null;
                setSelectedBrand(val);
                updateUrlFilters({ brand: val });
              }}
              aria-label="Filter products by brand"
              className="bg-white border border-[#EAE3DB] text-xs text-[#1C120C] uppercase tracking-wider py-1.5 px-3 focus:outline-none focus:border-amber-800 cursor-pointer font-medium"
            >
              <option value="">All Luxury Houses ({allBrands.length})</option>
              {allBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Grid */}
        {sortedProducts.length === 0 ? (
          <div className="w-full text-center py-24 bg-white border border-[#EAE3DB] flex flex-col items-center justify-center p-8">
            <span className="text-5xl text-amber-800/20 mb-4 block">✧</span>
            <h3 className="text-xl font-serif-luxury uppercase tracking-widest text-[#1C120C] mb-2">No Fragrances Found</h3>
            <p className="text-xs text-[#8C8276] tracking-widest max-w-md uppercase mb-6 font-light">
              We could not find any scents matching your active filters. Try clearing some filters or searching for a different perfume.
            </p>
            <button
              onClick={resetAllFilters}
              className="bg-[#1C120C] text-[#F4E7D4] px-6 py-3 text-[10px] font-extrabold tracking-[0.2em] uppercase hover:bg-[#8C6D46] hover:text-white transition-all duration-300"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {sortedProducts.map((prod) => {
              const isFav = favorites.includes(prod.id);
              const displayName = prod.name ? prod.name.replace(/_/g, " ") : "";

              return (
                <div
                  key={prod.id}
                  className="group bg-white border border-[#EAE3DB] p-5 flex flex-col justify-between text-center hover:border-amber-800/40 hover:shadow-[0_10px_30px_rgba(28,18,12,0.06)] transition-all duration-300 relative"
                >
                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
                    {prod.isNew && (
                      <span className="bg-[#1C120C] text-[#F4E7D4] text-[8px] font-extrabold tracking-widest px-2 py-0.5 uppercase">
                        NEW
                      </span>
                    )}
                    {prod.isBestSeller && (
                      <span className="bg-amber-800 text-white text-[8px] font-extrabold tracking-widest px-2 py-0.5 uppercase">
                        BEST SELLER
                      </span>
                    )}
                  </div>

                  {/* Favorite Toggle Button */}
                  <button
                    onClick={() => {
                      setFavorites(prev => isFav ? prev.filter(id => id !== prod.id) : [...prev, prod.id]);
                      triggerToast(isFav ? `Removed ${displayName} from favorites` : `Saved ${displayName} to favorites`);
                    }}
                    className="absolute top-4 right-4 z-10 p-1.5 rounded-full text-neutral-400 hover:text-amber-800 transition-colors"
                    title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? "fill-amber-800 text-amber-800" : ""}`} />
                  </button>

                  {/* Product Image */}
                  <Link href={`/product/${prod.id}`} className="block relative w-full aspect-[4/5] my-4 overflow-hidden">
                    <Image
                      src={prod.image}
                      alt={displayName}
                      fill
                      className="object-contain p-2 group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  </Link>

                  {/* Product Info */}
                  <div className="flex flex-col items-center flex-grow justify-between w-full pt-2">
                    <div className="w-full">
                      <span className="text-[9px] font-black tracking-[0.25em] text-[#8C6D46] uppercase block mb-1">
                        {prod.brand}
                      </span>
                      <Link href={`/product/${prod.id}`} className="block">
                        <h3 className="font-serif-luxury text-sm font-medium text-[#1C120C] uppercase tracking-wide leading-snug line-clamp-2 hover:text-[#8C6D46] transition-colors">
                          {displayName}
                        </h3>
                      </Link>
                      <span className="text-[10px] text-neutral-500 tracking-widest uppercase block mt-1">
                        {prod.olfactory}
                      </span>
                    </div>

                    <div className="w-full mt-4 flex flex-col items-center gap-3 border-t border-[#FAF5EF] pt-3">
                      <span className="font-serif-luxury text-base font-semibold text-[#1C120C] tracking-widest">
                        AED {parseFloat(prod.price).toFixed(2)}
                      </span>

                      <button
                        onClick={() => {
                          triggerToast(`Added ${displayName} to Basket`);
                        }}
                        className="w-full py-2.5 px-4 bg-[#1C120C] text-[#F4E7D4] hover:bg-[#8C6D46] hover:text-white text-[9px] font-extrabold tracking-[0.2em] uppercase transition-all duration-300 cursor-pointer active:scale-95"
                      >
                        Add to Basket
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Main App Footer */}
      <Footer />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF5EF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <span className="text-xs font-serif-luxury uppercase tracking-widest text-[#1C120C]">Loading Luxury Scent Vault...</span>
        </div>
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}
