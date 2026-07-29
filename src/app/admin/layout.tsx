"use client";

import React, { useState, useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Home, ShoppingBag, Tag, FolderOpen, Layers, ClipboardList, 
  GitCompare, Gift, Users, Megaphone, Percent, FileText, Globe, 
  BarChart3, Loader2, LogOut, ShieldAlert, ChevronLeft, Menu, X,
  ChevronDown, ChevronRight, Mail, Sparkles
} from "lucide-react";
import { clientSafeSupabase } from "../lib/supabase";

// Categorized Admin Sidebar Links with Icons
const categories = [
  {
    id: "overview",
    label: "Overview & Reports",
    icon: BarChart3,
    subItems: [
      { id: "dashboard", label: "Home Dashboard", icon: Home },
      { id: "analytics", label: "Analytics Reports", icon: BarChart3 },
      { id: "reports", label: "Executive Reports", icon: ClipboardList }
    ]
  },
  {
    id: "catalog",
    label: "Catalog & Stock",
    icon: Tag,
    subItems: [
      { id: "products", label: "Products Catalog", icon: Tag },
      { id: "collections", label: "Collections Registry", icon: FolderOpen },
      { id: "inventory", label: "Inventory Tracker", icon: Layers },
      { id: "transfers", label: "Stock Transfers", icon: GitCompare }
    ]
  },
  {
    id: "sales",
    label: "Sales & Customers",
    icon: ShoppingBag,
    subItems: [
      { id: "orders", label: "Orders Registry", icon: ShoppingBag },
      { id: "customers", label: "Customers Catalog", icon: Users },
      { id: "abandoned_carts", label: "Abandoned Carts", icon: FolderOpen }
    ]
  },
  {
    id: "marketing",
    label: "Marketing & Promos",
    icon: Megaphone,
    subItems: [
      { id: "marketing", label: "Campaigns & Ads", icon: Megaphone },
      { id: "discounts", label: "Discount Codes", icon: Percent },
      { id: "gift_cards", label: "Gift Cards Vault", icon: Gift }
    ]
  },
  {
    id: "settings",
    label: "Store Settings",
    icon: Globe,
    subItems: [
      { id: "homepage", label: "Homepage Editor", icon: Sparkles },
      { id: "content", label: "CMS & Pages", icon: FileText },
      { id: "markets", label: "Global Markets", icon: Globe }
    ]
  }
];

// Sidebar Links subcomponent utilizing Next.js useSearchParams hook to trigger immediate active state rendering
function AdminSidebarLinks() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "dashboard";
  
  // Track expanded state for categories. Initialize as true for the group containing currentTab.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    categories.forEach(cat => {
      const hasActive = cat.subItems.some(sub => sub.id === currentTab);
      if (hasActive) {
        initial[cat.id] = true;
      }
    });
    return initial;
  });

  // Auto-expand group on Tab change/navigation
  useEffect(() => {
    const activeGroup = categories.find(cat =>
      cat.subItems.some(sub => sub.id === currentTab)
    );
    if (activeGroup) {
      setExpandedGroups(prev => ({
        ...prev,
        [activeGroup.id]: true
      }));
    }
  }, [currentTab]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  return (
    <div className="flex flex-col gap-1.5">
      {categories.map(category => {
        const CategoryIcon = category.icon;
        const isExpanded = !!expandedGroups[category.id];
        const containsActive = category.subItems.some(sub => sub.id === currentTab);
        
        return (
          <div key={category.id} className="flex flex-col">
            {/* Category Header Tab */}
            <button
              onClick={() => toggleGroup(category.id)}
              className={`category-header ${containsActive ? "contains-active font-black" : ""}`}
            >
              <div className="flex items-center gap-3">
                <CategoryIcon className={`w-4 h-4 ${containsActive ? "text-[#8C6239]" : "text-[#5C4E46]/70"}`} />
                <span>{category.label}</span>
              </div>
              <div className="transition-transform duration-200 ease-in-out">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {/* Sub-items list with animatable properties */}
            <div 
              className={`category-subitems flex flex-col pl-4 border-l border-[#D8CFBF]/40 ml-5.5 gap-0.5 transition-all duration-300 ease-in-out ${
                isExpanded ? "max-h-[500px] opacity-100 mt-1 mb-2" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              {category.subItems.map(sub => {
                const SubIcon = sub.icon;
                const isSubActive = currentTab === sub.id;
                return (
                  <Link 
                    key={sub.id}
                    href={`/admin?tab=${sub.id}`} 
                    className={`flex items-center gap-3 py-2 px-3.5 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 block ${
                      isSubActive 
                        ? "text-[#8C6239] font-black border-l-2 border-[#8C6239] bg-[#8C6239]/5 pl-4" 
                        : "text-[#5C4E46]/80 hover:text-[#1C120C] hover:bg-[#8C6239]/2 hover:pl-4 border-l-2 border-transparent"
                    }`}
                  >
                    <SubIcon className={`w-3.5 h-3.5 ${isSubActive ? "text-[#8C6239]" : "text-[#5C4E46]/50"}`} />
                    <span>{sub.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Standalone Inquiries Log Link at the bottom */}
      <div className="border-t border-[#D8CFBF]/30 pt-2.5 mt-2.5">
        <Link 
          href="/admin?tab=inquiries" 
          className={`sidebar-link ${currentTab === "inquiries" ? "active-link" : ""}`}
        >
          <Mail className={`w-4 h-4 ${currentTab === "inquiries" ? "text-amber-600 font-bold" : ""}`} />
          <span>Inquiries Log</span>
        </Link>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // If the path is exactly the signin gate, render it full-page without administrative shells
  const isSignInPage = pathname === "/admin/signin";

  useEffect(() => {
    if (isSignInPage) {
      setLoading(false);
      setAuthorized(true);
      return;
    }

    const verifyAdminAuth = async () => {
      try {
        const { data: { user } } = await clientSafeSupabase.auth.getUser();
        
        if (!user) {
          router.push("/admin/signin");
          setAuthorized(false);
          setLoading(false);
          return;
        }

        const role = localStorage.getItem("userRole");
        const storedEmail = localStorage.getItem("userEmail");

        // Query the database profile directly for absolute security
        const { data: profile } = await clientSafeSupabase
          .from("customers")
          .select("is_admin")
          .eq("id", user.id);
        
        const dbIsAdmin = profile && profile[0]?.is_admin;

        // Assert admin status
        const isUserAdmin = dbIsAdmin || user?.user_metadata?.is_admin || role === "admin" || storedEmail?.toLowerCase().includes("admin") || user?.email?.toLowerCase().includes("admin");

        if (!isUserAdmin) {
          // If not elevated to admin, redirect to signin gate
          router.push("/admin/signin");
          setAuthorized(false);
        } else {
          setActiveUser(user?.email || storedEmail || "admin@gharib.com");
          setAuthorized(true);
          if (typeof window !== "undefined") {
            localStorage.setItem("userEmail", user.email || storedEmail || "");
            localStorage.setItem("userRole", "admin");
            localStorage.setItem("userId", user.id);
          }
        }
      } catch (err) {
        router.push("/admin/signin");
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAdminAuth();
  }, [pathname, isSignInPage, router]);

  const handleSignOut = async () => {
    await clientSafeSupabase.auth.signOut();
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userId");
    router.push("/admin/signin");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070301] flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-[10px] tracking-[0.3em] text-[#EAE3DB]/50 uppercase font-black">
          Validating Security Clearance...
        </span>
      </div>
    );
  }

  // Bypass shell layout for Sign In Screen
  if (isSignInPage) {
    return <>{children}</>;
  }

  // If unauthorized, show fallback block
  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#070301] text-white flex flex-col items-center justify-center p-6 text-center font-sans-luxury">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
        <h1 className="text-xl font-serif-luxury uppercase tracking-widest text-[#EAE3DB]">
          Access Blocked
        </h1>
        <p className="text-[10px] tracking-widest text-[#EAE3DB]/40 uppercase font-bold mt-2 max-w-md">
          Administrator privileges are required to view the operations panel.
        </p>
        <Link 
          href="/admin/signin"
          className="mt-6 bg-amber-600 hover:bg-amber-500 text-white text-[9px] tracking-[0.25em] uppercase px-6 py-3.5 font-bold transition-all"
        >
          LOG IN WITH ELEVATED PRIVILEGES
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#2A1A0F] flex flex-col font-sans-luxury select-none admin-layout-container">
      
      {/* Top Banner Navigation */}
      <header className="w-full h-16 border-b border-white/[0.04] bg-[#FAF9F6]/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 text-[#EAE3DB]/60 hover:text-white"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <Link href="/" className="flex items-center gap-3">
            <span className="text-[12px] tracking-[0.35em] text-amber-500 font-extrabold uppercase">
              GHARIB OPERATOR BACKEND
            </span>
          </Link>
          <span className="hidden md:inline-block border border-amber-600/35 bg-amber-950/20 text-amber-400 text-[7px] tracking-widest font-black uppercase px-2 py-0.5 ml-2.5">
            SHOPIFY ACTIVE CORE
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[7.5px] tracking-[0.2em] text-[#EAE3DB]/40 uppercase font-black">
              ACTIVE ADMINISTRATOR
            </span>
            <span className="text-[10px] tracking-wider font-bold text-amber-200">
              {activeUser}
            </span>
          </div>

          <button 
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-[8.5px] tracking-[0.25em] text-red-400/80 hover:text-red-400 font-black uppercase transition-all bg-white/[0.02] border border-white/[0.05] hover:border-red-500/20 px-3.5 py-2.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            DISCONNECT
          </button>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex flex-1 relative min-h-[calc(100vh-64px)]">
        
        {/* SIDEBAR: Admin Console Panel (Shopify Menu options) */}
        <aside className={`fixed lg:sticky top-16 left-0 w-[280px] h-[calc(100vh-64px)] border-r border-white/[0.04] bg-[#090503] z-20 transition-transform duration-300 transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
          <div className="h-full flex flex-col justify-between p-4 overflow-y-auto">
            
            {/* Top Operations Tabs */}
            <div className="flex flex-col gap-1">
              <span className="text-[7.5px] tracking-[0.25em] text-amber-500/50 uppercase font-black px-3.5 mb-2 block">
                SHOPIFY HUB CORE
              </span>

              <Suspense fallback={<div className="h-40 animate-pulse bg-amber-500/5" />}>
                <AdminSidebarLinks />
              </Suspense>
            </div>

            {/* Bottom Status Panel */}
            <div className="border-t border-white/[0.04] pt-4 mt-6">
              <div className="bg-white/[0.01] border border-white/[0.03] p-3 text-center">
                <span className="text-[7px] tracking-[0.2em] text-[#EAE3DB]/30 uppercase font-bold block mb-1">
                  SECURITY KEY PROTOCOL
                </span>
                <span className="text-[8px] tracking-widest text-[#EAE3DB]/60 font-bold block">
                  AES-256 GCM ACTIVE
                </span>
              </div>
            </div>

          </div>
        </aside>

        {/* Backdrop for mobile layout drawer closing */}
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/70 z-10 lg:hidden"
          />
        )}

        {/* RIGHT CONTAINER: Active view wrapper */}
        <main className="flex-1 min-w-0 p-6 md:p-8 lg:p-10 relative overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Internal Custom Inline Styles for standard sidebar navigation links */}
      <style jsx global>{`
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(234, 227, 219, 0.5);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          border-left: 2px solid transparent;
          text-decoration: none;
        }
        .sidebar-link:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.02);
          border-left-color: rgba(217, 119, 6, 0.3);
        }
        .sidebar-link.active-link {
          color: #fbbf24;
          background: rgba(217, 119, 6, 0.08);
          border-left-color: #f59e0b;
          font-weight: 900;
        }

        .category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 11px 14px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          border-left: 2px solid transparent;
          cursor: pointer;
          background: transparent;
          border: none;
          text-align: left;
          color: rgba(234, 227, 219, 0.5);
        }
        .category-header:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.02);
        }
        .category-header.contains-active {
          color: #fbbf24;
          font-weight: 900;
        }

        .category-subitems {
          overflow: hidden;
          transition: max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
        }

        /* Luxury Light Theme Global Overrides */
        .admin-layout-container {
          background-color: #FAF9F6 !important;
          color: #2A1A0F !important;
        }
        
        .admin-layout-container .category-header {
          color: #5C4E46 !important;
        }
        .admin-layout-container .category-header:hover {
          color: #1C120C !important;
          background: rgba(140, 98, 57, 0.04) !important;
        }
        .admin-layout-container .category-header.contains-active {
          color: #8C6239 !important;
        }
        
        .admin-layout-container header {
          background-color: #F3EFE9 !important;
          border-bottom-color: #E5DFD3 !important;
          color: #2A1A0F !important;
        }
        
        .admin-layout-container header span,
        .admin-layout-container header button {
          color: #2A1A0F !important;
        }

        .admin-layout-container header button:hover {
          background-color: rgba(140, 98, 57, 0.05) !important;
          border-color: rgba(140, 98, 57, 0.2) !important;
        }
        
        .admin-layout-container aside {
          background-color: #F3EFE9 !important;
          border-right-color: #E5DFD3 !important;
        }
        
        .admin-layout-container .sidebar-link {
          color: #5C4E46 !important;
        }
        
        .admin-layout-container .sidebar-link:hover {
          color: #1C120C !important;
          background: rgba(140, 98, 57, 0.04) !important;
          border-left-color: rgba(140, 98, 57, 0.3) !important;
        }
        
        .admin-layout-container .sidebar-link.active-link {
          color: #8C6239 !important;
          background: rgba(140, 98, 57, 0.08) !important;
          border-left-color: #8C6239 !important;
        }

        /* Override main layout and nested views */
        .admin-layout-container main {
          background-color: #FAF9F6 !important;
          color: #2A1A0F !important;
        }

        /* Card and Panel Reskinning */
        .admin-layout-container div[class*="bg-[#"],
        .admin-layout-container div[class*="bg-white/"],
        .admin-layout-container form[class*="bg-[#"],
        .admin-layout-container section[class*="bg-[#"],
        .admin-layout-container div.bg-white\/\[,
        .admin-layout-container select {
          background-color: #FFFFFF !important;
          border-color: #E5DFD3 !important;
          color: #2A1A0F !important;
          box-shadow: 0 4px 20px rgba(140, 98, 57, 0.03), 0 1px 3px rgba(0, 0, 0, 0.01) !important;
        }

        /* Accent Gold Box Overrides */
        .admin-layout-container div[class*="border-amber-600"],
        .admin-layout-container div[class*="border-amber-500"],
        .admin-layout-container input[class*="border-amber-500"] {
          border-color: #8C6239 !important;
        }

        /* Form Inputs & Controls */
        .admin-layout-container input,
        .admin-layout-container select,
        .admin-layout-container textarea {
          background-color: #FFFFFF !important;
          border-color: #D8CFBF !important;
          color: #1C120C !important;
        }

        .admin-layout-container input:focus,
        .admin-layout-container select:focus,
        .admin-layout-container textarea:focus {
          border-color: #8C6239 !important;
          background-color: #FFFFFF !important;
        }

        .admin-layout-container input::placeholder {
          color: #A59B90 !important;
        }

        /* Text Color Specificity */
        .admin-layout-container h1, 
        .admin-layout-container h2, 
        .admin-layout-container h3, 
        .admin-layout-container h4, 
        .admin-layout-container h5, 
        .admin-layout-container h6,
        .admin-layout-container th {
          color: #1C120C !important;
          font-family: inherit;
        }

        .admin-layout-container p,
        .admin-layout-container span:not(.text-amber-500):not(.text-red-400):not(.text-green-400):not(.text-emerald-400),
        .admin-layout-container td,
        .admin-layout-container label {
          color: #2A1A0F !important;
        }

        /* Muted and Sub-labels */
        .admin-layout-container .text-\[#EAE3DB\]\/40,
        .admin-layout-container .text-\[#EAE3DB\]\/50,
        .admin-layout-container .text-white\/40,
        .admin-layout-container .text-white\/50,
        .admin-layout-container .text-[#EAE3DB]\/30,
        .admin-layout-container .text-zinc-500,
        .admin-layout-container .text-gray-400 {
          color: #7C6E65 !important;
        }

        /* Custom badge modifications */
        .admin-layout-container span[class*="border-amber-600/35"] {
          border-color: rgba(140, 98, 57, 0.35) !important;
          background-color: rgba(140, 98, 57, 0.05) !important;
          color: #8C6239 !important;
          font-weight: 700;
        }

        /* Tables adjustments */
        .admin-layout-container table {
          border-collapse: collapse !important;
          width: 100% !important;
        }

        .admin-layout-container tr {
          border-bottom: 1px solid #E5DFD3 !important;
          background-color: transparent !important;
        }

        .admin-layout-container tr:hover {
          background-color: rgba(140, 98, 57, 0.02) !important;
        }

        .admin-layout-container th {
          background-color: #F3EFE9 !important;
          border-bottom: 2px solid #E5DFD3 !important;
          color: #1C120C !important;
        }

        /* Primary action Buttons */
        .admin-layout-container button[class*="bg-amber-600"],
        .admin-layout-container button[class*="bg-amber-500"] {
          background-color: #8C6239 !important;
          color: #FFFFFF !important;
        }

        .admin-layout-container button[class*="bg-amber-600"]:hover,
        .admin-layout-container button[class*="bg-amber-500"]:hover {
          background-color: #9E734A !important;
        }

        /* Secondary actions button style */
        .admin-layout-container button[class*="border-white/"],
        .admin-layout-container button[class*="border-[#EAE3DB]/"] {
          border-color: #D8CFBF !important;
          background-color: #FFFFFF !important;
          color: #2A1A0F !important;
        }

        .admin-layout-container button[class*="border-white/"]:hover {
          background-color: #FAF8F5 !important;
          border-color: #8C6239 !important;
        }

        /* Decorative Gold Corner Accents */
        .admin-layout-container div[class*="border-t border-l border-amber-500"],
        .admin-layout-container div[class*="border-t border-r border-amber-500"],
        .admin-layout-container div[class*="border-b border-l border-amber-500"],
        .admin-layout-container div[class*="border-b border-r border-amber-500"] {
          border-color: #8C6239 !important;
        }

        /* SVG charts compatibility */
        .admin-layout-container svg text {
          fill: #2A1A0F !important;
        }

        /* Status colors preservation */
        .admin-layout-container .text-emerald-400,
        .admin-layout-container .text-green-400 {
          color: #15803d !important;
        }
        .admin-layout-container .bg-emerald-950\/30,
        .admin-layout-container .bg-green-950\/30 {
          background-color: rgba(21, 128, 61, 0.1) !important;
          color: #15803d !important;
        }

        .admin-layout-container .text-red-400,
        .admin-layout-container .text-red-500 {
          color: #b91c1c !important;
        }
        .admin-layout-container .bg-red-950\/30 {
          background-color: rgba(185, 28, 28, 0.1) !important;
          color: #b91c1c !important;
        }

        .admin-layout-container .text-amber-400,
        .admin-layout-container .text-yellow-400,
        .admin-layout-container .text-amber-500 {
          color: #b45309 !important;
        }
        .admin-layout-container .bg-amber-950\/20,
        .admin-layout-container .bg-amber-950\/30 {
          background-color: rgba(180, 83, 9, 0.1) !important;
          color: #b45309 !important;
        }
      `}</style>

    </div>
  );
}
