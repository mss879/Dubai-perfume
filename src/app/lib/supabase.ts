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
  { id: 101, brand: "GHARIB", name: "Gold Memoir", price: 745.00, sizes: ["50ml", "100ml"], image_url: "/gold-memoir.png", description: "Elevate your everyday moments with our luxurious fragrances that transform routine into a sensory journey of pleasure and luxury.", tagline: "Aurum Noble Edition", olfactory_group: "Woody & Oud", is_new: true, is_bestseller: false, is_featured_large: false, tags: ["memoir", "noble", "wood", "oud"], top_notes: ["Saffron", "Cinnamon", "Bergamot"], heart_notes: ["Rose", "Jasmine", "Clove"], base_notes: ["Amber", "Agarwood (Oud)", "Sandalwood", "Vanilla"] },
  { id: 102, brand: "GHARIB", name: "Enchanted Blooms", price: 437.00, sizes: ["30ml", "50ml"], image_url: "/enchanted-blooms.png", description: "A floral-centric perfume inspired by a magical garden with a delicate bouquet of blooming jasmine, fresh peony, and soft vanilla highlights.", tagline: "Aura Floral Collection", olfactory_group: "Floral & Sweet", is_new: false, is_bestseller: true, is_featured_large: false, tags: ["floral", "sweet", "jasmine", "blooms"], top_notes: ["Pear", "Red Berries", "Jasmine"], heart_notes: ["Peony", "Freesia", "Orange Blossom"], base_notes: ["Vanilla", "White Musk", "Patchouli"] },
  { id: 103, brand: "GHARIB", name: "Mystic Oud", price: 620.00, sizes: ["50ml", "100ml"], image_url: "/mystic-oud.png", description: "An oriental fragrance that combines the richness of exotic spices, warm agarwood, and rare dark cardamom for a mysterious, timeless appeal.", tagline: "Royal Spice Reserve", olfactory_group: "Woody & Oud", is_new: false, is_bestseller: true, is_featured_large: false, tags: ["oriental", "oud", "spice", "mystic"], top_notes: ["Saffron", "Nutmeg", "Cardamom"], heart_notes: ["Oud", "Incense", "Myrrh"], base_notes: ["Leather", "Amber", "Patchouli", "Cedarwood"] },
  { id: 104, brand: "GHARIB", name: "Ocean Breeze", price: 532.00, sizes: ["50ml", "100ml"], image_url: "/ocean-breeze.png", description: "A fresh marine experience blending salty sea minerals, crushed mint leaves, amberwood, and bright Italian bergamot for clean coastal refinement.", tagline: "Aquamarine Coast Line", olfactory_group: "Fresh & Aquatic", is_new: true, is_bestseller: false, is_featured_large: false, tags: ["fresh", "aquatic", "marine", "ocean"], top_notes: ["Italian Bergamot", "Mint Leaves", "Lemon"], heart_notes: ["Sea Salt", "Lavender", "Geranium"], base_notes: ["Amberwood", "Vetiver", "White Musk"] },
  { id: 1, brand: "INITIO PARFUMS", name: "Oud for greatness", price: 1215.00, sizes: ["50ml", "90ml"], image_url: "/catalog_initio_oud.png", description: "A highly concentrated woody fragrance with saffron, lavender, and nutmeg, dry down to heavy dark agarwood oud.", tagline: "Sacred Geometry", olfactory_group: "Woody & Oud", is_new: true, is_bestseller: false, is_featured_large: false, tags: ["wood", "oud", "greatness", "saffron"], top_notes: ["Saffron", "Nutmeg", "Lavender"], heart_notes: ["Oud (Agarwood)"], base_notes: ["Patchouli", "Musk"] },
  { id: 2, brand: "JULIETTE HAS A GUN", name: "Juliette", price: 360.00, sizes: ["30ml", "50ml"], image_url: "/catalog_juliette_gun.png", description: "A beautiful floral-sensual blend that balances elegant red berries, white blossoms, and sweet woods.", tagline: "Femme Fatale Signature", olfactory_group: "Floral & Sweet", is_new: false, is_bestseller: true, is_featured_large: false, tags: ["floral", "sweet", "juliette", "rose"], top_notes: ["Red Berries", "Jasmine Sambac"], heart_notes: ["Centifolia Rose", "White Blossoms"], base_notes: ["Sweet Woods", "Amber", "Musk"] },
  { id: 3, brand: "RABANNE", name: "Phantom", price: 440.00, sizes: ["50ml", "100ml"], image_url: "/catalog_rabanne_phantom.png", description: "A fresh, futuristic composition featuring notes of lavender, creamy patchouli, vanilla, and sparkling vetiver.", tagline: "Metallic Modern Scent", olfactory_group: "Fresh & Aquatic", is_new: true, is_bestseller: false, is_featured_large: false, tags: ["fresh", "aquatic", "phantom", "modern"], top_notes: ["Lavender", "Lemon Peel"], heart_notes: ["Patchouli", "Creamy Apple", "Smoke"], base_notes: ["Vanilla", "Vetiver"] },
  { id: 4, brand: "HFC", name: "Devil's intrigue", price: 1358.00, sizes: ["75ml"], image_url: "/catalog_hfc_devils.png", description: "Deep, dramatic amber oriental profile combining warm vanilla, fine sandalwood, and exotic floral touches.", tagline: "Hypnotic Indulgence", olfactory_group: "Amber & Oriental", is_new: false, is_bestseller: true, is_featured_large: false, tags: ["amber", "oriental", "devil", "sandalwood"], top_notes: ["White Tea", "Osmanthus"], heart_notes: ["Orange Blossom", "Sandalwood"], base_notes: ["Cashmere Wood", "Vanilla", "Dry Amber"] },
  { id: 5, brand: "TOM FORD", name: "Lost Cherry eau de parfum", price: 1196.00, sizes: ["30ml", "50ml", "100ml"], image_url: "/catalog_tom_ford_cherry.png", description: "A full-bodied journey into the once-forbidden; a contrasting scent that reveals a tempting dichotomy of playful, candy-like gleam on the outside and luscious flesh on the inside.", tagline: "Gourmand Masterpiece", olfactory_group: "Floral & Sweet", is_new: false, is_bestseller: true, is_featured_large: false, tags: ["floral", "sweet", "cherry", "gourmand"], top_notes: ["Black Cherry", "Bitter Almond", "Cherry Liqueur"], heart_notes: ["Griotte Syrup", "Turkish Rose", "Jasmine Sambac"], base_notes: ["Tonka Bean", "Roasted Cocoa", "Sandalwood", "Vetiver", "Cedarwood"] },
  { id: 6, brand: "MOSCHINO", name: "Toy Boy", price: 158.00, sizes: ["30ml", "50ml", "100ml"], image_url: "/catalog_moschino_teddy.png", description: "A unique, masculine fragrance blending dark woods, pink pepper, rose notes, and resinous amber highlights.", tagline: "Playful Sophistication", olfactory_group: "Woody & Oud", is_new: true, is_bestseller: false, is_featured_large: false, tags: ["wood", "oud", "toy", "rose"], top_notes: ["Pink Pepper", "Pear", "Indonesian Nutmeg"], heart_notes: ["Rose", "Flax Flowers", "Magnolia"], base_notes: ["Haitian Vetiver", "Sandalwood", "Cashmeran", "Amber"] },
  { id: 7, brand: "FILIPPO SORCINELLI", name: "Epicentro", price: 1196.00, sizes: ["50ml", "100ml"], image_url: "/catalog_sorcinelli_epicentro.png", description: "Epicentro is an artistic perfume that represents a deep volcanic impact. Topped with a heavy raw silver metal crumpled sculpture that serves as both the cap and a piece of tactile art.", tagline: "Artistic Volcanic Shudder", olfactory_group: "Fresh & Aquatic", is_new: false, is_bestseller: true, is_featured_large: true, tags: ["fresh", "aquatic", "epicentro", "volcanic"], top_notes: ["Volcanic Silt", "Italian Bergamot"], heart_notes: ["Deep Sea Minerals", "Warm Earth", "Rust"], base_notes: ["Driftwood", "Dry Cedarwood"] },
  { id: 8, brand: "FILIPPO SORCINELLI", name: "Eio_non_ho_mani_che_mi_accarezzino_il_volto", price: 862.00, sizes: ["100ml"], image_url: "/catalog_sorcinelli_leather.png", description: "An avante-garde olfactory masterpiece encased in a bottle wrapped dramatically in draped, textured organic matte black leather folds.", tagline: "Gothic Draped Incense", olfactory_group: "Amber & Oriental", is_new: true, is_bestseller: false, is_featured_large: true, tags: ["amber", "oriental", "gothic", "incense"], top_notes: ["Clerics Cassock", "Incense Smoke"], heart_notes: ["Organic Dark Leather", "Petrichor"], base_notes: ["Gothic Resin", "Myrrh", "Warm Amber"] },
  { id: 9, brand: "MARC-ANTOINE BARROIS", name: "Ganymede Extrait", price: 1170.00, sizes: ["30ml", "50ml"], image_url: "/catalog_marc_barrois.png", description: "Deeply woody and metallic masterpiece with leather, saffron, mandarin, and heavy warm immortelle.", tagline: "Cosmic Leather Harmony", olfactory_group: "Woody & Oud", is_new: true, is_bestseller: false, is_featured_large: false, tags: ["wood", "oud", "ganymede", "leather"], top_notes: ["Mandarin Orange", "Saffron"], heart_notes: ["Violet Leaves", "Immortelle Flower"], base_notes: ["Suede Leather", "Akigalawood"] }
];

const SEED_COLLECTIONS = [
  { id: "new", title: "New Arrivals", description: "Freshly decanted summer releases", cover_image: "/campaign-gold.png", type: "manual", rules: [] },
  { id: "bestsellers", title: "Bestsellers", description: "Our most coveted scent signatures", cover_image: "/campaign-purple.png", type: "manual", rules: [] },
  { id: "favorites", title: "Exclusive Offers", description: "Hand-selected custom vaults", cover_image: "/campaign-red-black.png", type: "manual", rules: [] },
  { id: "trending", title: "Trending", description: "Most wanted scent creations", cover_image: "/campaign-silver.png", type: "manual", rules: [] },
  { id: "smart-ouds", title: "Automated Oud Vault", description: "Smart collection automatically populated with all fragrances containing the oud tag.", cover_image: "/campaign-gold.png", type: "automated", rules: [{ field: "tag", relation: "equals", value: "oud" }] }
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
  { id: "ORD-9921", email: "alex.mercer@gmail.com", total_price: 1215.00, status: "delivered", shipping_address: { name: "Alex Mercer", street: "Sheikh Zayed Rd, Apt 1402", city: "Dubai", country: "UAE", postal_code: "00000" }, tracking_number: "DXB-EXP-11002", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "ORD-9922", email: "sarah.connor@yahoo.com", total_price: 796.00, status: "shipped", shipping_address: { name: "Sarah Connor", street: "100 Ocean Drive", city: "Miami", country: "USA", postal_code: "33139" }, tracking_number: "DHL-9844102", created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: "ORD-9923", email: "james.bond@mi6.gov.uk", total_price: 1358.00, status: "processing", shipping_address: { name: "James Bond", street: "85 Albert Embankment", city: "London", country: "UK", postal_code: "SE1 7TP" }, tracking_number: null, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: "ORD-9924", email: "layla.hasan@dubai.ae", total_price: 1941.00, status: "pending", shipping_address: { name: "Layla Hasan", street: "Jumeirah Beach Road, Villa 45", city: "Dubai", country: "UAE", postal_code: "00000" }, tracking_number: null, created_at: new Date().toISOString() }
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
  { id: 3, name: "Elite Member Newsletter #12", channel: "Klaviyo Email", status: "completed", budget: 300.00, attributed_sales: 4890.00, impressions: 12000, clicks: 1500 }
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

const SEED_INQUIRIES = [
  { id: "inq-1", name: "Alexander Mercer", email: "alex.mercer@gmail.com", subject: "General Inquiries", message: "I would like to schedule a private fragrance blending session at your Alserkal Avenue flagship boutique next Friday evening.", created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: "inq-2", name: "Elena Rostova", email: "elena.rostova@yahoo.com", subject: "General Inquiries", message: "Does your House plan to release a summer collection featuring rose or soft jasmine notes soon? I absolutely adore your Enchanted Blooms scent.", created_at: new Date(Date.now() - 86400000).toISOString() }
];

const SEED_PRODUCT_COLLECTIONS = [
  { product_id: 101, collection_id: "new" },
  { product_id: 104, collection_id: "new" },
  { product_id: 1, collection_id: "new" },
  { product_id: 3, collection_id: "new" },
  { product_id: 6, collection_id: "new" },
  { product_id: 8, collection_id: "new" },
  { product_id: 9, collection_id: "new" },
  { product_id: 102, collection_id: "bestsellers" },
  { product_id: 103, collection_id: "bestsellers" },
  { product_id: 2, collection_id: "bestsellers" },
  { product_id: 4, collection_id: "bestsellers" },
  { product_id: 5, collection_id: "bestsellers" },
  { product_id: 7, collection_id: "bestsellers" },
  { product_id: 2, collection_id: "favorites" },
  { product_id: 4, collection_id: "favorites" },
  { product_id: 5, collection_id: "favorites" },
  { product_id: 9, collection_id: "favorites" },
  { product_id: 101, collection_id: "trending" },
  { product_id: 1, collection_id: "trending" },
  { product_id: 4, collection_id: "trending" },
  { product_id: 7, collection_id: "trending" },
  { product_id: 101, collection_id: "smart-ouds" },
  { product_id: 103, collection_id: "smart-ouds" },
  { product_id: 1, collection_id: "smart-ouds" },
  { product_id: 6, collection_id: "smart-ouds" },
  { product_id: 9, collection_id: "smart-ouds" }
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


// Sync functions to mimic database triggers for automated collections
const syncMockAutomatedCollections = (product: any) => {
  const collections = getLocalStorage("mock_collections", SEED_COLLECTIONS);
  let mappings = getLocalStorage("mock_product_collections", SEED_PRODUCT_COLLECTIONS);
  
  // 1. Remove this product's links to automated collections
  const automatedCollectionIds = collections.filter((c: any) => (c.type || "manual") === "automated").map((c: any) => c.id);
  mappings = mappings.filter((m: any) => !(m.product_id === product.id && automatedCollectionIds.includes(m.collection_id)));
  
  // 2. For each automated collection, evaluate tags
  collections.filter((c: any) => (c.type || "manual") === "automated").forEach((col: any) => {
    let matches = false;
    if (Array.isArray(col.rules)) {
      col.rules.forEach((rule: any) => {
        if (rule.field === "tag" && rule.relation === "equals") {
          if (Array.isArray(product.tags) && product.tags.includes(rule.value)) {
            matches = true;
          }
        }
      });
    }
    
    if (matches) {
      if (!mappings.some((m: any) => m.product_id === product.id && m.collection_id === col.id)) {
        mappings.push({ product_id: product.id, collection_id: col.id });
      }
    }
  });
  
  setLocalStorage("mock_product_collections", mappings);
};

const syncMockProductsForCollection = (collection: any) => {
  if ((collection.type || "manual") !== "automated") return;
  const products = getLocalStorage("mock_products", SEED_PRODUCTS);
  let mappings = getLocalStorage("mock_product_collections", SEED_PRODUCT_COLLECTIONS);
  
  // Clear existing mappings for this collection
  mappings = mappings.filter((m: any) => m.collection_id !== collection.id);
  
  products.forEach((prod: any) => {
    let matches = false;
    if (Array.isArray(collection.rules)) {
      collection.rules.forEach((rule: any) => {
        if (rule.field === "tag" && rule.relation === "equals") {
          if (Array.isArray(prod.tags) && prod.tags.includes(rule.value)) {
            matches = true;
          }
        }
      });
    }
    if (matches) {
      mappings.push({ product_id: prod.id, collection_id: collection.id });
    }
  });
  
  setLocalStorage("mock_product_collections", mappings);
};

// Client-side Local Storage Database Orchestrator
class MockSupabaseClient {
  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, file: any) => ({ data: { path }, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: "" } })
    })
  };

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
        note: "Auto-registered Member."
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
        case "product_collections": return getLocalStorage("mock_product_collections", SEED_PRODUCT_COLLECTIONS);
        case "inventory": return getLocalStorage("mock_inventory", SEED_INVENTORY);
        case "orders": return getLocalStorage("mock_orders", SEED_ORDERS);
        case "customers": return getLocalStorage("mock_customers", SEED_CUSTOMERS);
        case "marketing_campaigns": return getLocalStorage("mock_marketing", SEED_MARKETING);
        case "discounts": return getLocalStorage("mock_discounts", SEED_DISCOUNTS);
        case "order_tracking": return getLocalStorage("mock_tracking", SEED_TRACKING);
        case "wishlists": return getLocalStorage("mock_wishlists", []);
        case "abandoned_carts": return getLocalStorage("mock_abandoned_carts", []);
        case "contact_inquiries": return getLocalStorage("mock_contact_inquiries", SEED_INQUIRIES);
        default: return [];
      }
    };

    const setTableData = (data: any) => {
      switch (table) {
        case "products": setLocalStorage("mock_products", data); break;
        case "collections": setLocalStorage("mock_collections", data); break;
        case "product_collections": setLocalStorage("mock_product_collections", data); break;
        case "inventory": setLocalStorage("mock_inventory", data); break;
        case "orders": setLocalStorage("mock_orders", data); break;
        case "customers": setLocalStorage("mock_customers", data); break;
        case "marketing_campaigns": setLocalStorage("mock_marketing", data); break;
        case "discounts": setLocalStorage("mock_discounts", data); break;
        case "order_tracking": setLocalStorage("mock_tracking", data); break;
        case "wishlists": setLocalStorage("mock_wishlists", data); break;
        case "abandoned_carts": setLocalStorage("mock_abandoned_carts", data); break;
        case "contact_inquiries": setLocalStorage("mock_contact_inquiries", data); break;
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
        
        if (table === "products") {
          insertRows.forEach(syncMockAutomatedCollections);
        }
        if (table === "collections") {
          insertRows.forEach(syncMockProductsForCollection);
        }
        
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
        
        if (table === "products") {
          upsertRows.forEach(syncMockAutomatedCollections);
        }
        if (table === "collections") {
          upsertRows.forEach(syncMockProductsForCollection);
        }
        
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
        const deleteBuilder = {
          eq: (field: string, value: any) => {
            const updated = data.filter((row: any) => row[field] !== value);
            setTableData(updated);
            data = updated;
            return deleteBuilder;
          },
          match: (criteria: any) => {
            const updated = data.filter((row: any) => {
              return !Object.keys(criteria).every(key => row[key] == criteria[key]);
            });
            setTableData(updated);
            data = updated;
            return deleteBuilder;
          },
          then: (onfulfilled: any) => {
            return Promise.resolve(onfulfilled({ data, error: null }));
          }
        };
        return deleteBuilder;
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
