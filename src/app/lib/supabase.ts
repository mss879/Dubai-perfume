import { createClient } from "@supabase/supabase-js";

// Check if credentials exist in the environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const isRealSupabaseConfigured = supabaseUrl && supabaseAnonKey;

// Real Client initialization
export const supabase = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

// Mock Database Storage seeded with migrations mock data
const SEED_PRODUCTS = [
  { id: 101, brand: "GHARIB PRIVÉ", name: "Gold Memoir", price: 203.00, sizes: ["50ml", "100ml"], image_url: "/gold-memoir.png", description: "Elevate your everyday moments with our luxurious fragrances that transform routine into a sensory journey of pleasure and luxury.", tagline: "Aurum Noble Edition", olfactory_group: "Woody & Oud", is_new: true, is_bestseller: false, is_featured_large: false },
  { id: 102, brand: "GHARIB PRIVÉ", name: "Enchanted Blooms", price: 119.00, sizes: ["30ml", "50ml"], image_url: "/enchanted-blooms.png", description: "A floral-centric perfume inspired by a magical garden with a delicate bouquet of blooming jasmine, fresh peony, and soft vanilla highlights.", tagline: "Aura Floral Collection", olfactory_group: "Floral & Sweet", is_new: false, is_bestseller: true, is_featured_large: false },
  { id: 103, brand: "GHARIB PRIVÉ", name: "Mystic Oud", price: 169.00, sizes: ["50ml", "100ml"], image_url: "/mystic-oud.png", description: "An oriental fragrance that combines the richness of exotic spices, warm agarwood, and rare dark cardamom for a mysterious, timeless appeal.", tagline: "Royal Spice Reserve", olfactory_group: "Woody & Oud", is_new: false, is_bestseller: true, is_featured_large: false },
  { id: 104, brand: "GHARIB PRIVÉ", name: "Ocean Breeze", price: 145.00, sizes: ["50ml", "100ml"], image_url: "/ocean-breeze.png", description: "A fresh marine experience blending salty sea minerals, crushed mint leaves, amberwood, and bright Italian bergamot for clean coastal refinement.", tagline: "Aquamarine Coast Line", olfactory_group: "Fresh & Aquatic", is_new: true, is_bestseller: false, is_featured_large: false },
  { id: 1, brand: "INITIO PARFUMS PRIVES", name: "Oud for greatness", price: 331.00, sizes: ["50ml", "90ml"], image_url: "/catalog_initio_oud.png", description: "A highly concentrated woody fragrance with saffron, lavender, and nutmeg, dry down to heavy dark agarwood oud.", tagline: "Sacred Geometry", olfactory_group: "Woody & Oud", is_new: true, is_bestseller: false, is_featured_large: false },
  { id: 2, brand: "JULIETTE HAS A GUN", name: "Juliette", price: 98.00, sizes: ["30ml", "50ml"], image_url: "/catalog_juliette_gun.png", description: "A beautiful floral-sensual blend that balances elegant red berries, white blossoms, and sweet woods.", tagline: "Femme Fatale Signature", olfactory_group: "Floral & Sweet", is_new: false, is_bestseller: true, is_featured_large: false },
  { id: 3, brand: "RABANNE", name: "Phantom", price: 120.00, sizes: ["50ml", "100ml"], image_url: "/catalog_rabanne_phantom.png", description: "A fresh, futuristic composition featuring notes of lavender, creamy patchouli, vanilla, and sparkling vetiver.", tagline: "Metallic Modern Scent", olfactory_group: "Fresh & Aquatic", is_new: true, is_bestseller: false, is_featured_large: false },
  { id: 4, brand: "HFC", name: "Devil's intrigue", price: 370.00, sizes: ["75ml"], image_url: "/catalog_hfc_devils.png", description: "Deep, dramatic amber oriental profile combining warm vanilla, fine sandalwood, and exotic floral touches.", tagline: "Hypnotic Indulgence", olfactory_group: "Amber & Oriental", is_new: false, is_bestseller: true, is_featured_large: false },
  { id: 5, brand: "TOM FORD", name: "Lost Cherry eau de parfum", price: 326.00, sizes: ["30ml", "50ml", "100ml"], image_url: "/catalog_tom_ford_cherry.png", description: "A full-bodied journey into the once-forbidden; a contrasting scent that reveals a tempting dichotomy of playful, candy-like gleam on the outside and luscious flesh on the inside.", tagline: "Gourmand Masterpiece", olfactory_group: "Floral & Sweet", is_new: false, is_bestseller: true, is_featured_large: false },
  { id: 6, brand: "MOSCHINO", name: "Toy Boy", price: 43.12, sizes: ["30ml", "50ml", "100ml"], image_url: "/catalog_moschino_teddy.png", description: "A unique, masculine fragrance blending dark woods, pink pepper, rose notes, and resinous amber highlights.", tagline: "Playful Sophistication", olfactory_group: "Woody & Oud", is_new: true, is_bestseller: false, is_featured_large: false },
  { id: 7, brand: "FILIPPO SORCINELLI", name: "Epicentro", price: 326.00, sizes: ["50ml", "100ml"], image_url: "/catalog_sorcinelli_epicentro.png", description: "Epicentro is an artistic perfume that represents a deep volcanic impact. Topped with a heavy raw silver metal crumpled sculpture that serves as both the cap and a piece of tactile art.", tagline: "Artistic Volcanic Shudder", olfactory_group: "Fresh & Aquatic", is_new: false, is_bestseller: true, is_featured_large: true },
  { id: 8, brand: "FILIPPO SORCINELLI", name: "Eio_non_ho_mani_che_mi_accarezzino_il_volto", price: 235.00, sizes: ["100ml"], image_url: "/catalog_sorcinelli_leather.png", description: "An avante-garde olfactory masterpiece encased in a bottle wrapped dramatically in draped, textured organic matte black leather folds.", tagline: "Gothic Draped Incense", olfactory_group: "Amber & Oriental", is_new: true, is_bestseller: false, is_featured_large: true },
  { id: 9, brand: "MARC-ANTOINE BARROIS", name: "Ganymede Extrait", price: 319.00, sizes: ["30ml", "50ml"], image_url: "/catalog_marc_barrois.png", description: "Deeply woody and metallic masterpiece with leather, saffron, mandarin, and heavy warm immortelle.", tagline: "Cosmic Leather Harmony", olfactory_group: "Woody & Oud", is_new: true, is_bestseller: false, is_featured_large: false }
];

const SEED_COLLECTIONS = [
  { id: "new", title: "New Arrivals", description: "Freshly decanted summer releases", cover_image: "/campaign-gold.png" },
  { id: "bestsellers", title: "Bestsellers", description: "Our most coveted scent signatures", cover_image: "/campaign-purple.png" },
  { id: "favorites", title: "Exclusive Offers", description: "Hand-selected custom vaults", cover_image: "/campaign-red-black.png" },
  { id: "trending", title: "Trending", description: "Most wanted scent creations", cover_image: "/campaign-silver.png" }
];

const SEED_INVENTORY = [
  { product_id: 101, size: "50ml", stock_level: 45, low_stock_threshold: 10 },
  { product_id: 101, size: "100ml", stock_level: 25, low_stock_threshold: 5 },
  { product_id: 102, size: "30ml", stock_level: 80, low_stock_threshold: 15 },
  { product_id: 102, size: "50ml", stock_level: 65, low_stock_threshold: 10 },
  { product_id: 103, size: "50ml", stock_level: 12, low_stock_threshold: 5 },
  { product_id: 103, size: "100ml", stock_level: 8, low_stock_threshold: 3 },
  { product_id: 104, size: "50ml", stock_level: 35, low_stock_threshold: 8 },
  { product_id: 104, size: "100ml", stock_level: 19, low_stock_threshold: 5 },
  { product_id: 1, size: "50ml", stock_level: 14, low_stock_threshold: 5 },
  { product_id: 1, size: "90ml", stock_level: 9, low_stock_threshold: 3 },
  { product_id: 2, size: "30ml", stock_level: 24, low_stock_threshold: 5 },
  { product_id: 2, size: "50ml", stock_level: 18, low_stock_threshold: 5 },
  { product_id: 3, size: "50ml", stock_level: 40, low_stock_threshold: 10 },
  { product_id: 3, size: "100ml", stock_level: 30, low_stock_threshold: 8 },
  { product_id: 4, size: "75ml", stock_level: 6, low_stock_threshold: 2 },
  { product_id: 5, size: "30ml", stock_level: 15, low_stock_threshold: 3 },
  { product_id: 5, size: "50ml", stock_level: 22, low_stock_threshold: 5 },
  { product_id: 5, size: "100ml", stock_level: 11, low_stock_threshold: 3 },
  { product_id: 6, size: "30ml", stock_level: 55, low_stock_threshold: 10 },
  { product_id: 6, size: "50ml", stock_level: 48, low_stock_threshold: 8 },
  { product_id: 6, size: "100ml", stock_level: 32, low_stock_threshold: 5 }
];

const SEED_ORDERS = [
  { id: "ORD-9921", email: "alex.mercer@gmail.com", total_price: 331.00, status: "delivered", shipping_address: { name: "Alex Mercer", street: "Sheikh Zayed Rd, Apt 1402", city: "Dubai", country: "UAE", postal_code: "00000" }, tracking_number: "DXB-EXP-11002", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "ORD-9922", email: "sarah.connor@yahoo.com", total_price: 217.00, status: "shipped", shipping_address: { name: "Sarah Connor", street: "100 Ocean Drive", city: "Miami", country: "USA", postal_code: "33139" }, tracking_number: "DHL-9844102", created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: "ORD-9923", email: "james.bond@mi6.gov.uk", total_price: 370.00, status: "processing", shipping_address: { name: "James Bond", street: "85 Albert Embankment", city: "London", country: "UK", postal_code: "SE1 7TP" }, tracking_number: null, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: "ORD-9924", email: "layla.hasan@dubai.ae", total_price: 529.00, status: "pending", shipping_address: { name: "Layla Hasan", street: "Jumeirah Beach Road, Villa 45", city: "Dubai", country: "UAE", postal_code: "00000" }, tracking_number: null, created_at: new Date().toISOString() }
];

const SEED_CUSTOMERS = [
  { id: "cust-1", first_name: "Alex", last_name: "Mercer", email: "alex.mercer@gmail.com", phone: "+1 305 555 0199", total_spent: 331.00, orders_count: 1, is_admin: false, note: "Prefers rich spicy notes and ouds." },
  { id: "cust-2", first_name: "Sarah", last_name: "Connor", email: "sarah.connor@yahoo.com", phone: "+1 212 555 0144", total_spent: 217.00, orders_count: 1, is_admin: false, note: "Regular floral scent buyer." },
  { id: "cust-3", first_name: "James", last_name: "Bond", email: "james.bond@mi6.gov.uk", phone: "+44 20 7946 0958", total_spent: 370.00, orders_count: 1, is_admin: false, note: "Prefers bespoke royal collections." },
  { id: "cust-4", first_name: "Layla", last_name: "Hasan", email: "layla.hasan@dubai.ae", phone: "+971 50 987 6543", total_spent: 529.00, orders_count: 1, is_admin: false, note: "VIP member in Dubai region." },
  { id: "admin-1", first_name: "Admin", last_name: "Gharib", email: "admin@gharib.com", phone: "+971 4 123 4567", total_spent: 0.00, orders_count: 0, is_admin: true, note: "Executive Head Administrator." }
];

const SEED_MARKETING = [
  { id: 1, name: "EID Luxury Collection Launch", channel: "Instagram/Meta", status: "active", budget: 5000.00, attributed_sales: 18450.00, impressions: 245000, clicks: 8900 },
  { id: 2, name: "Gold Memoir Search Ads", channel: "Google Ads", status: "active", budget: 2500.00, attributed_sales: 7120.00, impressions: 85000, clicks: 4200 },
  { id: 3, name: "Privé Member Newsletter #12", channel: "Klaviyo Email", status: "completed", budget: 300.00, attributed_sales: 4890.00, impressions: 12000, clicks: 1500 }
];

const SEED_DISCOUNTS = [
  { id: 1, code: "GOLDMEMOIR15", title: "Gold Memoir Promo", type: "percentage", value: 15.00, min_requirement: 0.00, usage_limit: 500, usage_count: 142, is_active: true },
  { id: 2, code: "EID2026", title: "Eid Mubarak Scent Gift", type: "fixed_amount", value: 50.00, min_requirement: 300.00, usage_limit: 1000, usage_count: 389, is_active: true },
  { id: 3, code: "WELCOMETOTHECLUB", title: "New Member Welcome Discount", type: "percentage", value: 10.00, min_requirement: 0.00, usage_limit: null, usage_count: 658, is_active: true }
];

const SEED_TRACKING = [
  { id: 1, order_id: "ORD-9922", status: "Order Placed", location: "Dubai Headquarters", description: "We have received your exclusive order selection.", updated_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 2, order_id: "ORD-9922", status: "Fragrance Blending", location: "Dubai Blending Labs", description: "Master scent artists are blending your delicate extrait de parfum.", updated_at: new Date(Date.now() - 86400000 * 1.8).toISOString() },
  { id: 3, order_id: "ORD-9922", status: "Quality Control", location: "Dubai Blending Labs", description: "Scent profile approved by Gharib QC team.", updated_at: new Date(Date.now() - 86400000 * 1.5).toISOString() },
  { id: 4, order_id: "ORD-9922", status: "In Transit", location: "Dubai International Airport", description: "Handed over to DHL Express. Shipment in route to Miami.", updated_at: new Date(Date.now() - 86400000).toISOString() },
  
  { id: 5, order_id: "ORD-9923", status: "Order Placed", location: "Dubai Headquarters", description: "We have received your exclusive order selection.", updated_at: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: 6, order_id: "ORD-9923", status: "Fragrance Blending", location: "Dubai Blending Labs", description: "Master scent artists are blending your delicate extrait de parfum.", updated_at: new Date(Date.now() - 86400000 * 3.8).toISOString() },
  { id: 7, order_id: "ORD-9923", status: "Quality Control", location: "Dubai Blending Labs", description: "Scent profile approved by Gharib QC team.", updated_at: new Date(Date.now() - 86400000 * 3.5).toISOString() }
];

// Seed browser storage if keys are absent
const getLocalStorage = (key: string, defaultValue: any) => {
  if (typeof window === "undefined") return defaultValue;
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  return JSON.parse(stored);
};

const setLocalStorage = (key: string, value: any) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// Client-side Local Storage Database Orchestrator
class MockSupabaseClient {
  auth = {
    signUp: async ({ email, password, options }: any) => {
      const customers = getLocalStorage("mock_customers", SEED_CUSTOMERS);
      if (customers.some((c: any) => c.email === email)) {
        return { data: null, error: { message: "User already exists." } };
      }
      const newCustomer = {
        id: `cust-${Math.random().toString(36).substr(2, 9)}`,
        first_name: options?.data?.first_name || "",
        last_name: options?.data?.last_name || "",
        email,
        phone: options?.data?.phone || "",
        total_spent: 0.00,
        orders_count: 0,
        is_admin: options?.data?.is_admin || false,
        note: "Auto-registered Privé Member."
      };
      customers.push(newCustomer);
      setLocalStorage("mock_customers", customers);
      if (typeof window !== "undefined") {
        localStorage.setItem("userEmail", email);
        localStorage.setItem("userRole", newCustomer.is_admin ? "admin" : "customer");
        localStorage.setItem("userId", newCustomer.id);
      }
      return { data: { user: { id: newCustomer.id, email } }, error: null };
    },
    signInWithPassword: async ({ email, password }: any) => {
      const customers = getLocalStorage("mock_customers", SEED_CUSTOMERS);
      const user = customers.find((c: any) => c.email === email);
      if (!user) {
        return { data: null, error: { message: "Invalid email or password." } };
      }
      // Simple custom validation: passwords ending in '123' or 'admin' or just allow for mocks
      if (email.includes("admin") && password !== "admin123") {
        return { data: null, error: { message: "Unauthorized admin password." } };
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("userEmail", email);
        localStorage.setItem("userRole", user.is_admin ? "admin" : "customer");
        localStorage.setItem("userId", user.id);
      }
      return { data: { user: { id: user.id, email, user_metadata: { is_admin: user.is_admin } } }, error: null };
    },
    signOut: async () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userRole");
        localStorage.removeItem("userId");
      }
      return { error: null };
    },
    getUser: async () => {
      if (typeof window === "undefined") return { data: { user: null } };
      const email = localStorage.getItem("userEmail");
      const id = localStorage.getItem("userId");
      const role = localStorage.getItem("userRole");
      if (!email) return { data: { user: null } };
      return {
        data: {
          user: {
            id,
            email,
            user_metadata: { is_admin: role === "admin" }
          }
        }
      };
    },
    updateUser: async ({ password }: any) => {
      // In mock mode, password update succeeds immediately
      return { data: { user: {} }, error: null };
    }
  };

  from(table: string) {
    const getTableData = () => {
      switch (table) {
        case "products": return getLocalStorage("mock_products", SEED_PRODUCTS);
        case "collections": return getLocalStorage("mock_collections", SEED_COLLECTIONS);
        case "inventory": return getLocalStorage("mock_inventory", SEED_INVENTORY);
        case "orders": return getLocalStorage("mock_orders", SEED_ORDERS);
        case "customers": return getLocalStorage("mock_customers", SEED_CUSTOMERS);
        case "marketing_campaigns": return getLocalStorage("mock_marketing", SEED_MARKETING);
        case "discounts": return getLocalStorage("mock_discounts", SEED_DISCOUNTS);
        case "order_tracking": return getLocalStorage("mock_tracking", SEED_TRACKING);
        case "wishlists": return getLocalStorage("mock_wishlists", []);
        case "abandoned_carts": return getLocalStorage("mock_abandoned_carts", []);
        default: return [];
      }
    };

    const setTableData = (data: any) => {
      switch (table) {
        case "products": setLocalStorage("mock_products", data); break;
        case "collections": setLocalStorage("mock_collections", data); break;
        case "inventory": setLocalStorage("mock_inventory", data); break;
        case "orders": setLocalStorage("mock_orders", data); break;
        case "customers": setLocalStorage("mock_customers", data); break;
        case "marketing_campaigns": setLocalStorage("mock_marketing", data); break;
        case "discounts": setLocalStorage("mock_discounts", data); break;
        case "order_tracking": setLocalStorage("mock_tracking", data); break;
        case "wishlists": setLocalStorage("mock_wishlists", data); break;
        case "abandoned_carts": setLocalStorage("mock_abandoned_carts", data); break;
      }
    };

    let data = getTableData();

    const queryBuilder = {
      select: (fields?: string) => {
        return queryBuilder;
      },
      insert: (rows: any) => {
        const insertRows = Array.isArray(rows) ? rows : [rows];
        const updated = [...data, ...insertRows];
        setTableData(updated);
        data = updated;
        return queryBuilder;
      },
      upsert: (rows: any) => {
        const upsertRows = Array.isArray(rows) ? rows : [rows];
        let updated = [...data];
        upsertRows.forEach((row: any) => {
          const idx = updated.findIndex((r: any) => r.id === row.id);
          if (idx > -1) {
            updated[idx] = { ...updated[idx], ...row };
          } else {
            updated.push(row);
          }
        });
        setTableData(updated);
        data = updated;
        return queryBuilder;
      },
      update: (values: any) => {
        return {
          eq: (field: string, value: any) => {
            const updated = data.map((row: any) => {
              if (row[field] === value) {
                return { ...row, ...values };
              }
              return row;
            });
            setTableData(updated);
            data = updated;
            return queryBuilder;
          }
        };
      },
      delete: () => {
        return {
          eq: (field: string, value: any) => {
            const updated = data.filter((row: any) => row[field] !== value);
            setTableData(updated);
            data = updated;
            return queryBuilder;
          }
        };
      },
      eq: (field: string, value: any) => {
        data = data.filter((row: any) => row[field] == value);
        return queryBuilder;
      },
      match: (criteria: any) => {
        data = data.filter((row: any) => {
          return Object.keys(criteria).every(key => row[key] == criteria[key]);
        });
        return queryBuilder;
      },
      // Promise resolve methods to allow `await supabase.from(...)` syntax
      then: (onfulfilled: any) => {
        return Promise.resolve(onfulfilled({ data, error: null }));
      }
    };

    return queryBuilder;
  }
}

// Global exported client interface, checking configuration or fallbacks
export const clientSafeSupabase = isRealSupabaseConfigured
  ? supabase
  : new MockSupabaseClient();
