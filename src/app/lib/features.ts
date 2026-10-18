/**
 * The store's feature switches (migration 70): every feature the owner can
 * turn on or off, what it is called in the admin, and its settings.
 *
 * One definition per setting (its label, kind, default and limits) drives the
 * admin's form, the check on save and the shop's reading of the stored value,
 * so the three never disagree. The database clamps the money-bearing numbers
 * to the same limits (feature_num in migration 70).
 *
 * Client-safe: no secrets, nothing server-only.
 */

export const FEATURE_KEYS = [
  "one_page_checkout",
  "trust_strip",
  "wallet_badges",
  "pay_later",
  "gift_options",
  "send_to_someone",
  "delivery_estimate",
  "demand_signals",
  "shop_filters",
  "inspired_by",
  "recently_viewed",
  "loyalty",
  "referrals",
  "gift_cards",
  "welcome_offer",
  "cart_reminders",
  "reorder_reminders",
  "back_in_stock",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

/* ── Settings fields ───────────────────────────────────────────────────── */

export const TRUST_ICONS = ["shield", "lock", "return", "truck", "gift", "sparkle", "chat"] as const;
export type TrustIcon = (typeof TRUST_ICONS)[number];
export type TrustItem = { icon: TrustIcon; title: string; text: string };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

type Base = { key: string; label: string; hint?: string };
export type FieldSpec =
  | (Base & { kind: "switch"; default: boolean })
  | (Base & { kind: "number"; default: number; min: number; max: number; integer?: boolean; suffix?: string; prefix?: string })
  | (Base & { kind: "text"; default: string; max: number; placeholder?: string })
  | (Base & { kind: "textarea"; default: string; max: number; rows?: number; placeholder?: string })
  | (Base & { kind: "select"; default: string; options: { value: string; label: string }[] })
  | (Base & { kind: "numberList"; default: number[]; min: number; max: number; maxItems: number; suffix?: string })
  | (Base & { kind: "textList"; default: string[]; max: number; maxItems: number; placeholder?: string })
  | (Base & { kind: "dateList"; default: string[]; maxItems: number })
  | (Base & { kind: "weekdays"; default: number[] })
  | (Base & { kind: "trustItems"; default: TrustItem[] })
  | (Base & { kind: "product"; default: number | null; sizeKey: string });

export type FieldGroup = { title: string; description?: string; fields: FieldSpec[] };

export type FeatureGroup = "checkout" | "shop" | "rewards" | "emails";

export type FeatureDefinition = {
  key: FeatureKey;
  /** The admin page: /admin/features/<slug>. */
  slug: string;
  /** What the admin calls it: menu, page title, the switches page. */
  name: string;
  group: FeatureGroup;
  /** One sentence: what it does for the shop. */
  summary: string;
  /** Where shoppers meet it. */
  where: string;
  /** Things that must be true for it to work (shown on its page). */
  needs?: string[];
  groups: FieldGroup[];
};

export const FEATURE_GROUP_LABELS: Record<FeatureGroup, { title: string; description: string }> = {
  checkout: { title: "Checkout", description: "What shoppers see and choose while they pay." },
  shop: { title: "Product pages & shop", description: "Helping shoppers find, compare and decide." },
  rewards: { title: "Rewards & gifting", description: "Reasons to come back, and to bring friends." },
  emails: { title: "Automatic emails", description: "Sent by the store on its own, on a schedule." },
};

const sw = (key: string, label: string, def: boolean, hint?: string): FieldSpec => ({ kind: "switch", key, label, default: def, hint });

export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  one_page_checkout: {
    key: "one_page_checkout",
    slug: "one-page-checkout",
    name: "One-page checkout",
    group: "checkout",
    summary: "Checkout opens straight on the delivery form, with the bag beside it, instead of a separate bag step first.",
    where: "Checkout",
    groups: [
      {
        title: "Layout",
        fields: [
          sw("show_bag_editor", "Let shoppers change quantities in the order summary", true, "So nobody has to go back to the bag to change a quantity."),
        ],
      },
    ],
  },
  trust_strip: {
    key: "trust_strip",
    slug: "trust-badges",
    name: "Trust badges",
    group: "checkout",
    summary: "Short reassurance lines (authentic, secure payment, returns, delivery) at the moment of paying.",
    where: "Checkout, beside the pay button; optionally on product pages",
    groups: [
      {
        title: "The badges",
        description: "Up to four. Keep each promise to something the shop actually does.",
        fields: [
          {
            kind: "trustItems",
            key: "items",
            label: "Badges",
            default: [
              { icon: "shield", title: "100% authentic", text: "Sourced from the houses themselves" },
              { icon: "lock", title: "Secure payment", text: "Card, Apple Pay and Google Pay through Paymob" },
              { icon: "return", title: "Returns within 14 days", text: "On unopened bottles" },
              { icon: "truck", title: "UAE delivery", text: "2–5 business days" },
            ],
          },
        ],
      },
      {
        title: "Where they appear",
        fields: [sw("show_on_checkout", "At checkout", true), sw("show_on_product", "On product pages", false)],
      },
    ],
  },
  wallet_badges: {
    key: "wallet_badges",
    slug: "wallet-badges",
    name: "Apple Pay & Google Pay badges",
    group: "checkout",
    summary: "Shows the ways to pay (Apple Pay, Google Pay, cards) up front, so phone shoppers know before checkout. How payment works doesn't change.",
    where: "Product pages, the bag and checkout (only while online payment is on)",
    needs: ["Online payment switched on in Settings → Payments", "Only show a wallet Paymob has enabled on your account"],
    groups: [
      {
        title: "Which marks",
        fields: [sw("apple_pay", "Apple Pay", true), sw("google_pay", "Google Pay", true), sw("cards", "Visa and Mastercard", true)],
      },
      {
        title: "Where they appear",
        fields: [sw("show_on_product", "On product pages", true), sw("show_in_bag", "In the bag", true), sw("show_on_checkout", "At checkout", true)],
      },
    ],
  },
  pay_later: {
    key: "pay_later",
    slug: "pay-later",
    name: "Pay later (Tabby / Tamara)",
    group: "checkout",
    summary: "Shows \"or 4 payments of AED X\" so shoppers know they can split the cost. The payment itself is taken by Paymob.",
    where: "Product pages and checkout (only while online payment is on)",
    needs: [
      "Ask Paymob to enable Tabby or Tamara on your account",
      "Add the integration ID Paymob gives you to PAYMOB_INTEGRATION_IDS in Netlify (comma-separated), then redeploy",
      "Only then switch this on, so the line never promises something checkout can't do",
    ],
    groups: [
      {
        title: "The offer",
        fields: [
          {
            kind: "select",
            key: "provider",
            label: "Provider",
            default: "tabby",
            options: [
              { value: "tabby", label: "Tabby" },
              { value: "tamara", label: "Tamara" },
              { value: "both", label: "Tabby or Tamara" },
            ],
          },
          { kind: "number", key: "instalments", label: "Number of payments", default: 4, min: 2, max: 12, integer: true },
          { kind: "number", key: "min_amount", label: "Show from", default: 100, min: 0, max: 100000, prefix: "AED", hint: "Below this, the line isn't shown (providers have minimums)." },
          { kind: "number", key: "max_amount", label: "Show up to", default: 5000, min: 1, max: 100000, prefix: "AED" },
        ],
      },
      {
        title: "Where it appears",
        fields: [sw("show_on_product", "On product pages", true), sw("show_on_checkout", "At checkout", true)],
      },
    ],
  },
  gift_options: {
    key: "gift_options",
    slug: "gift-options",
    name: "Gift wrap & message",
    group: "checkout",
    summary: "A \"this is a gift\" section at checkout: gift wrap (paid or free), a gift message, and a packing slip without prices.",
    where: "Checkout; the order page and packing slip in the admin",
    groups: [
      {
        title: "Gift wrap",
        fields: [
          sw("wrap_enabled", "Offer gift wrap", true),
          { kind: "number", key: "wrap_price", label: "Gift wrap price", default: 15, min: 0, max: 500, prefix: "AED", hint: "0 makes it complimentary. A gift box offer that already wraps the order never charges it." },
          { kind: "text", key: "wrap_note", label: "How it's described", default: "Wrapped in our signature box, tied with a ribbon.", max: 120 },
        ],
      },
      {
        title: "Message and slip",
        fields: [
          sw("message_enabled", "Allow a gift message", true),
          { kind: "number", key: "message_max", label: "Longest message", default: 250, min: 20, max: 500, integer: true, suffix: "characters" },
          sw("hide_prices_enabled", "Offer a packing slip without prices", true),
        ],
      },
    ],
  },
  send_to_someone: {
    key: "send_to_someone",
    slug: "send-to-someone",
    name: "Send to someone else",
    group: "checkout",
    summary: "Lets the shopper send the order to another person: their name, phone and address, and a preferred delivery date.",
    where: "Checkout; the order page in the admin",
    groups: [
      {
        title: "Delivery date",
        fields: [
          sw("date_enabled", "Let shoppers choose a delivery date", true, "A preferred date: your team arranges it with the courier."),
          { kind: "number", key: "min_days", label: "Earliest date", default: 1, min: 0, max: 14, integer: true, suffix: "days from today" },
          { kind: "number", key: "max_days", label: "Latest date", default: 30, min: 1, max: 90, integer: true, suffix: "days from today" },
        ],
      },
    ],
  },
  delivery_estimate: {
    key: "delivery_estimate",
    slug: "delivery-estimate",
    name: "Delivery estimate",
    group: "shop",
    summary: "\"Order within 3 h 20 min for delivery by Tuesday\": a concrete date on product pages and at checkout.",
    where: "Product pages and checkout (UAE addresses)",
    groups: [
      {
        title: "Your dispatch day",
        description: "Orders placed before the cut-off leave that working day.",
        fields: [
          { kind: "number", key: "cutoff_hour", label: "Cut-off hour (Dubai time, 24-hour)", default: 14, min: 0, max: 23, integer: true, suffix: ":00" },
          { kind: "weekdays", key: "closed_days", label: "Days you don't dispatch or deliver", default: [] },
          { kind: "dateList", key: "holidays", label: "Holidays (no dispatch or delivery)", default: [], maxItems: 30 },
        ],
      },
      {
        title: "How long delivery takes",
        fields: [
          { kind: "number", key: "days_min", label: "Fastest", default: 2, min: 0, max: 14, integer: true, suffix: "working days" },
          { kind: "number", key: "days_max", label: "Slowest", default: 5, min: 0, max: 21, integer: true, suffix: "working days", hint: "The same as the fastest shows one date; otherwise a range." },
        ],
      },
      {
        title: "Where it appears",
        fields: [sw("show_on_product", "On product pages", true), sw("show_on_checkout", "At checkout", true)],
      },
    ],
  },
  demand_signals: {
    key: "demand_signals",
    slug: "popularity-badges",
    name: "Popularity badges",
    group: "shop",
    summary: "\"12 bought this week\" and \"Bestseller in Woody & Oud\", counted from real orders (paid or cash on delivery, not cancelled).",
    where: "Product pages, and a label on the shop grid",
    groups: [
      {
        title: "\"Bought this week\"",
        fields: [
          sw("show_count", "Show how many orders", true),
          { kind: "number", key: "window_days", label: "Counted over", default: 7, min: 1, max: 60, integer: true, suffix: "days" },
          { kind: "number", key: "min_orders", label: "Only show from", default: 3, min: 1, max: 100, integer: true, suffix: "orders", hint: "Below this the line stays hidden, so a quiet week never shows \"1 bought\"." },
        ],
      },
      {
        title: "\"Bestseller in …\"",
        fields: [
          sw("show_family", "Show bestseller in its scent family", true),
          { kind: "number", key: "family_top", label: "Top", default: 3, min: 1, max: 10, integer: true, suffix: "in each family" },
          { kind: "number", key: "family_window_days", label: "Counted over", default: 30, min: 7, max: 180, integer: true, suffix: "days" },
        ],
      },
    ],
  },
  shop_filters: {
    key: "shop_filters",
    slug: "shop-filters",
    name: "Shop filters",
    group: "shop",
    summary: "Extra filters on the shop: notes, occasion, season, strength and how long it lasts. Fill them in per perfume below.",
    where: "The shop's \"All filters\" panel",
    groups: [
      {
        title: "Filters shown",
        description: "A filter only appears once at least one perfume has a value for it.",
        fields: [
          sw("notes", "Notes (oud, rose, vanilla…)", true),
          sw("occasion", "Occasion", true),
          sw("season", "Season", true),
          sw("strength", "Strength", true),
          sw("longevity", "How long it lasts", true),
        ],
      },
      {
        title: "Note chips",
        fields: [
          {
            kind: "textList",
            key: "note_chips",
            label: "Notes offered as quick choices",
            default: ["Oud", "Rose", "Vanilla", "Amber", "Musk", "Saffron", "Sandalwood", "Citrus"],
            max: 24,
            maxItems: 16,
            hint: "Matched against each perfume's top, heart and base notes.",
          },
        ],
      },
    ],
  },
  inspired_by: {
    key: "inspired_by",
    slug: "inspired-by",
    name: "Inspired-by matches",
    group: "shop",
    summary: "\"If you love [a famous scent]\": a line on the product page, a page of matches, and search by the famous name.",
    where: "Product pages, /inspired-by and search",
    needs: [
      "Describe a scent profile only: never say \"copy\", \"replica\", \"dupe\" or \"same as\"",
      "Keep the disclaimer: the other house's name is its trademark",
    ],
    groups: [
      {
        title: "Wording",
        fields: [
          { kind: "text", key: "lead", label: "Line on the product page", default: "If you love", max: 40, hint: "Shown as: If you love Creed Aventus" },
          { kind: "text", key: "page_title", label: "Page title", default: "If you love…", max: 60 },
          {
            kind: "textarea",
            key: "disclaimer",
            label: "Disclaimer",
            default: "Gharib is not affiliated with the houses named. Their names are trademarks of their owners and are used only to describe a scent profile.",
            max: 300,
            rows: 3,
          },
        ],
      },
      {
        title: "Where it appears",
        fields: [sw("show_on_product", "On product pages", true), sw("show_page", "The /inspired-by page", true), sw("search", "Searchable in the shop", true)],
      },
    ],
  },
  recently_viewed: {
    key: "recently_viewed",
    slug: "recently-viewed",
    name: "Recently viewed",
    group: "shop",
    summary: "A row of the perfumes the shopper looked at, and a quiet \"welcome back\" note for returning visitors. Kept in their browser only.",
    where: "Product pages, the shop and the empty bag",
    groups: [
      {
        title: "Recently viewed",
        fields: [
          { kind: "number", key: "count", label: "How many to show", default: 8, min: 2, max: 12, integer: true },
          sw("show_on_product", "On product pages", true),
          sw("show_on_shop", "On the shop", true),
        ],
      },
      {
        title: "\"Welcome back\"",
        fields: [
          sw("welcome_back", "Show a note to returning visitors", true),
          { kind: "number", key: "welcome_back_hours", label: "After being away", default: 12, min: 1, max: 720, integer: true, suffix: "hours" },
          { kind: "text", key: "welcome_back_text", label: "The note", default: "Welcome back. Still thinking about {name}?", max: 100, hint: "{name} is the perfume they looked at last." },
        ],
      },
    ],
  },
  loyalty: {
    key: "loyalty",
    slug: "loyalty",
    name: "Loyalty points",
    group: "rewards",
    summary: "Points on every order, spent at checkout, plus a birthday gift. Needs a customer account: points go to the account with the order's email.",
    where: "Account → Rewards, checkout, product pages",
    needs: ["Points are added when an order is marked delivered, and taken back if it is cancelled"],
    groups: [
      {
        title: "Earning",
        fields: [
          { kind: "text", key: "program_name", label: "Programme name", default: "Gharib Rewards", max: 60 },
          { kind: "number", key: "earn_points", label: "Points earned", default: 1, min: 0, max: 1000, integer: true, suffix: "points" },
          { kind: "number", key: "earn_per_aed", label: "For every", default: 1, min: 1, max: 1000, prefix: "AED", hint: "Spent on perfume, after offers and codes (delivery and gift wrap don't earn)." },
          { kind: "number", key: "available_after_days", label: "Usable after delivery", default: 0, min: 0, max: 60, integer: true, suffix: "days", hint: "0: usable as soon as the order is delivered. 14 covers the returns window." },
        ],
      },
      {
        title: "Spending",
        fields: [
          { kind: "number", key: "redeem_points", label: "Points", default: 100, min: 1, max: 100000, integer: true, suffix: "points" },
          { kind: "number", key: "redeem_value_aed", label: "Are worth", default: 5, min: 1, max: 10000, prefix: "AED" },
          { kind: "number", key: "min_redeem", label: "Spendable from", default: 100, min: 0, max: 100000, integer: true, suffix: "points" },
          { kind: "number", key: "max_share_pct", label: "Points can pay up to", default: 50, min: 1, max: 100, integer: true, suffix: "% of the perfume" },
          { kind: "number", key: "expiry_months", label: "Points expire after", default: 12, min: 0, max: 60, integer: true, suffix: "months without an order", hint: "0: they never expire." },
        ],
      },
      {
        title: "Birthday gift",
        fields: [
          { kind: "number", key: "birthday_points", label: "Birthday points", default: 0, min: 0, max: 100000, integer: true, suffix: "points", hint: "0: no birthday gift. Shoppers add their birthday in their account, once." },
          sw("show_on_product", "Show \"earn N points\" on product pages", true),
        ],
      },
    ],
  },
  referrals: {
    key: "referrals",
    slug: "referrals",
    name: "Referral scheme",
    group: "rewards",
    summary: "\"Give AED 50, get AED 50\": every account gets a personal code and link. The friend saves on their first order; you reward the referrer once it's delivered.",
    where: "Account → Rewards; the code works in the checkout's code box",
    needs: ["The referrer's reward is a store credit (a gift card code) emailed to them"],
    groups: [
      {
        title: "The friend",
        fields: [
          { kind: "number", key: "friend_reward", label: "Friend saves", default: 50, min: 5, max: 1000, prefix: "AED" },
          { kind: "number", key: "friend_min_order", label: "On a first order of at least", default: 200, min: 0, max: 10000, prefix: "AED" },
        ],
      },
      {
        title: "The referrer",
        fields: [
          { kind: "number", key: "referrer_reward", label: "Referrer gets", default: 50, min: 5, max: 1000, prefix: "AED", suffix: "credit" },
          { kind: "number", key: "reward_valid_months", label: "Credit valid for", default: 6, min: 1, max: 36, integer: true, suffix: "months" },
          { kind: "number", key: "max_rewards", label: "Most rewards per person", default: 20, min: 1, max: 500, integer: true },
        ],
      },
    ],
  },
  gift_cards: {
    key: "gift_cards",
    slug: "gift-cards",
    name: "Gift cards",
    group: "rewards",
    summary: "Digital gift cards bought online and emailed to the recipient (now or on a chosen day). Spent at checkout like credit.",
    where: "/gift-cards, the checkout's \"Gift card or credit\" box",
    needs: ["Online payment switched on in Settings → Payments (gift cards are always paid online)"],
    groups: [
      {
        title: "Amounts",
        fields: [
          { kind: "numberList", key: "amounts", label: "Amounts offered", default: [100, 200, 300, 500], min: 10, max: 20000, maxItems: 8, suffix: "AED" },
          sw("allow_custom", "Allow another amount", true),
          { kind: "number", key: "min_amount", label: "Smallest custom amount", default: 50, min: 10, max: 5000, prefix: "AED" },
          { kind: "number", key: "max_amount", label: "Largest custom amount", default: 2000, min: 50, max: 20000, prefix: "AED" },
        ],
      },
      {
        title: "Rules",
        fields: [
          { kind: "number", key: "valid_months", label: "Valid for", default: 12, min: 1, max: 60, integer: true, suffix: "months" },
          sw("allow_scheduled", "Let buyers pick a delivery date", true, "Up to 90 days ahead, for birthdays and occasions."),
        ],
      },
      {
        title: "The page",
        fields: [
          { kind: "text", key: "headline", label: "Headline", default: "The Gharib gift card", max: 80 },
          { kind: "textarea", key: "intro", label: "Introduction", default: "A fragrance is a personal thing. Let them choose theirs: the card arrives by email with your message, and is spent on anything in the boutique.", max: 400, rows: 3 },
        ],
      },
    ],
  },
  welcome_offer: {
    key: "welcome_offer",
    slug: "welcome-offer",
    name: "Welcome offer",
    group: "rewards",
    summary: "A tasteful \"join the list\" card at the end of a visit (never on arrival). New subscribers get a personal code for their first order.",
    where: "Every page except checkout, once per visitor",
    groups: [
      {
        title: "The reward",
        fields: [
          {
            kind: "select",
            key: "reward",
            label: "Reward",
            default: "percent",
            options: [
              { value: "percent", label: "A percentage off" },
              { value: "amount", label: "An amount off" },
              { value: "gift", label: "A free perfume (a discovery vial)" },
            ],
          },
          { kind: "number", key: "percent", label: "Percentage off", default: 10, min: 1, max: 50, integer: true, suffix: "%" },
          { kind: "number", key: "amount", label: "Amount off", default: 25, min: 1, max: 500, prefix: "AED" },
          { kind: "product", key: "gift_product_id", label: "Free perfume", default: null, sizeKey: "gift_size", hint: "Added free to the first order. Must be in stock." },
          { kind: "number", key: "min_order", label: "On a first order of at least", default: 0, min: 0, max: 5000, prefix: "AED" },
          { kind: "number", key: "code_days", label: "Code valid for", default: 14, min: 1, max: 90, integer: true, suffix: "days" },
        ],
      },
      {
        title: "The card",
        fields: [
          { kind: "text", key: "heading", label: "Heading", default: "A welcome from the maison", max: 80 },
          { kind: "textarea", key: "body", label: "Text", default: "Join our list for new arrivals and private offers, and receive a welcome for your first order.", max: 300, rows: 3 },
          { kind: "text", key: "button", label: "Button", default: "Send my welcome", max: 40 },
          { kind: "text", key: "success", label: "After joining", default: "Your welcome code is below, and on its way to your inbox.", max: 140 },
          { kind: "text", key: "fine_print", label: "Small print", default: "For a first order. One per person.", max: 140 },
        ],
      },
      {
        title: "When it appears",
        fields: [
          { kind: "number", key: "delay_seconds", label: "Not before", default: 45, min: 10, max: 600, integer: true, suffix: "seconds on the site" },
          { kind: "number", key: "min_pages", label: "And at least", default: 2, min: 1, max: 10, integer: true, suffix: "pages viewed" },
          sw("exit_intent", "On a computer, when the pointer heads for the tab bar", true),
          { kind: "number", key: "hide_days", label: "After closing it, hide for", default: 14, min: 1, max: 365, integer: true, suffix: "days" },
        ],
      },
    ],
  },
  cart_reminders: {
    key: "cart_reminders",
    slug: "cart-reminders",
    name: "Cart reminder emails",
    group: "emails",
    summary: "Sends the three reminders to shoppers who left a full bag at checkout (after 1 h, 24 h and 72 h). The last one can carry a single-use code and a set suggestion.",
    where: "Email; see Customers → Abandoned carts",
    needs: ["CART_RECOVERY_SECRET set in Netlify and in the database (migration 45's note)", "Email set up (Resend)"],
    groups: [
      {
        title: "The last reminder",
        fields: [
          sw("code_enabled", "Include a single-use code", true, "Made for that shopper only, and for that cart."),
          { kind: "number", key: "code_percent", label: "Code saves", default: 10, min: 1, max: 50, integer: true, suffix: "%" },
          { kind: "number", key: "code_hours", label: "Code valid for", default: 48, min: 1, max: 336, integer: true, suffix: "hours" },
          { kind: "number", key: "code_min_order", label: "On orders of at least", default: 0, min: 0, max: 5000, prefix: "AED" },
          sw("bundle_suggestion", "Suggest a set with what they left", true, "When one of your sets includes a perfume from the cart."),
        ],
      },
    ],
  },
  reorder_reminders: {
    key: "reorder_reminders",
    slug: "reorder-reminders",
    name: "Reorder reminders",
    group: "emails",
    summary: "An email some weeks after delivery: \"Running low? Reorder in one tap\". Sent once per order, never if they've ordered since, and never to anyone who unsubscribed.",
    where: "Email; the link refills the bag",
    needs: ["CART_RECOVERY_SECRET set in Netlify and in the database", "Email set up (Resend)"],
    groups: [
      {
        title: "Timing",
        fields: [{ kind: "number", key: "days_after", label: "Send", default: 75, min: 14, max: 365, integer: true, suffix: "days after delivery" }],
      },
      {
        title: "The email",
        fields: [
          { kind: "text", key: "subject", label: "Subject", default: "Running low on {name}?", max: 100, hint: "{name} is the perfume from their order." },
          { kind: "text", key: "heading", label: "Heading", default: "Time for a new bottle?", max: 80 },
          { kind: "textarea", key: "body", label: "Text", default: "It has been a little while since your {name} arrived. When you're ready for the next bottle, one tap refills your bag.", max: 500, rows: 3 },
          { kind: "text", key: "code", label: "A code to include (optional)", default: "", max: 40, hint: "One of your discount codes, e.g. REFILL10. Leave empty for none." },
        ],
      },
    ],
  },
  back_in_stock: {
    key: "back_in_stock",
    slug: "back-in-stock",
    name: "Back-in-stock alerts",
    group: "emails",
    summary: "A \"Notify me\" button on sold-out sizes. When the size is back in stock, everyone who asked gets one email.",
    where: "Product pages; email",
    needs: ["CART_RECOVERY_SECRET set in Netlify and in the database", "Email set up (Resend)"],
    groups: [
      {
        title: "On the product page",
        fields: [
          { kind: "text", key: "form_note", label: "Under the form", default: "We'll write once, when it's back. Nothing else.", max: 120 },
        ],
      },
      {
        title: "The email",
        fields: [
          { kind: "text", key: "subject", label: "Subject", default: "{name} is back", max: 100, hint: "{name} is the perfume." },
          { kind: "textarea", key: "body", label: "Text", default: "You asked us to tell you when {name} ({size}) was back. It is, for now: bottles go quickly.", max: 400, rows: 3 },
        ],
      },
    ],
  },
};

export const FEATURE_LIST: FeatureDefinition[] = FEATURE_KEYS.map((k) => FEATURES[k]);

export function featureBySlug(slug: string): FeatureDefinition | null {
  return FEATURE_LIST.find((f) => f.slug === slug) ?? null;
}

export function featureHref(key: FeatureKey): string {
  return `/admin/features/${FEATURES[key].slug}`;
}

/* ── Settings values ───────────────────────────────────────────────────── */

export type SettingsValue = string | number | boolean | null | number[] | string[] | TrustItem[];
export type FeatureSettings = Record<string, SettingsValue>;

function allFields(key: FeatureKey): FieldSpec[] {
  return FEATURES[key].groups.flatMap((g) => g.fields);
}

export function featureDefaults(key: FeatureKey): FeatureSettings {
  const out: FeatureSettings = {};
  for (const f of allFields(key)) {
    out[f.key] = Array.isArray(f.default) ? ([...f.default] as SettingsValue) : f.default;
    if (f.kind === "product") out[f.sizeKey] = "";
  }
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clampNum = (n: number, f: { min: number; max: number; integer?: boolean }) => {
  const v = Math.min(f.max, Math.max(f.min, n));
  return f.integer ? Math.round(v) : Math.round(v * 100) / 100;
};

/** One stored value, or the default when it's missing or the wrong shape. Never throws. */
function readField(f: FieldSpec, raw: unknown): SettingsValue {
  switch (f.kind) {
    case "switch":
      return typeof raw === "boolean" ? raw : f.default;
    case "number":
      return typeof raw === "number" && Number.isFinite(raw) ? clampNum(raw, f) : f.default;
    case "text":
    case "textarea":
      return typeof raw === "string" ? raw.slice(0, f.max) : f.default;
    case "select":
      return typeof raw === "string" && f.options.some((o) => o.value === raw) ? raw : f.default;
    case "numberList":
      return Array.isArray(raw)
        ? raw.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= f.min && n <= f.max).slice(0, f.maxItems)
        : [...f.default];
    case "textList":
      return Array.isArray(raw)
        ? raw.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim().slice(0, f.max)).slice(0, f.maxItems)
        : [...f.default];
    case "dateList":
      return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string" && DATE.test(s)).slice(0, f.maxItems) : [...f.default];
    case "weekdays":
      return Array.isArray(raw) ? [...new Set(raw.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))] : [...f.default];
    case "trustItems":
      return Array.isArray(raw)
        ? raw
            .filter((i): i is TrustItem => Boolean(i) && typeof i === "object" && typeof (i as TrustItem).title === "string")
            .map((i) => ({
              icon: (TRUST_ICONS as readonly string[]).includes(i.icon) ? i.icon : "shield",
              title: String(i.title).slice(0, 40),
              text: typeof i.text === "string" ? i.text.slice(0, 80) : "",
            }))
            .slice(0, 4)
        : f.default.map((i) => ({ ...i }));
    case "product":
      return typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : null;
  }
}

/** Stored settings, merged over the defaults. Unknown keys are dropped. */
export function readFeatureSettings(key: FeatureKey, raw: unknown): FeatureSettings {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: FeatureSettings = {};
  for (const f of allFields(key)) {
    out[f.key] = readField(f, source[f.key]);
    if (f.kind === "product") out[f.sizeKey] = typeof source[f.sizeKey] === "string" ? String(source[f.sizeKey]).slice(0, 50) : "";
  }
  return out;
}

/** The admin's save, checked strictly: the first problem, in words, or the clean settings. */
export function validateFeatureSettings(
  key: FeatureKey,
  raw: unknown
): { ok: true; settings: FeatureSettings } | { ok: false; error: string; field?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid settings." };
  const source = raw as Record<string, unknown>;
  for (const f of allFields(key)) {
    const v = source[f.key];
    if (v === undefined) continue;
    const bad = (error: string) => ({ ok: false as const, error: `${f.label}: ${error}`, field: f.key });
    switch (f.kind) {
      case "switch":
        if (typeof v !== "boolean") return bad("choose on or off.");
        break;
      case "number":
        if (typeof v !== "number" || !Number.isFinite(v)) return bad("enter a number.");
        if (v < f.min || v > f.max) return bad(`enter ${f.min} to ${f.max}.`);
        if (f.integer && !Number.isInteger(v)) return bad("enter a whole number.");
        if (!f.integer && Math.round(v * 100) !== v * 100) return bad("use at most two decimals.");
        break;
      case "text":
      case "textarea":
        if (typeof v !== "string") return bad("enter text.");
        if (v.length > f.max) return bad(`keep it under ${f.max} characters.`);
        break;
      case "select":
        if (typeof v !== "string" || !f.options.some((o) => o.value === v)) return bad("choose one of the options.");
        break;
      case "numberList":
        if (!Array.isArray(v) || v.length > f.maxItems || v.some((n) => typeof n !== "number" || n < f.min || n > f.max || !Number.isInteger(n)))
          return bad(`up to ${f.maxItems} whole amounts from ${f.min} to ${f.max}.`);
        break;
      case "textList":
        if (!Array.isArray(v) || v.length > f.maxItems || v.some((s) => typeof s !== "string" || s.length > f.max))
          return bad(`up to ${f.maxItems} entries of ${f.max} characters.`);
        break;
      case "dateList":
        if (!Array.isArray(v) || v.length > f.maxItems || v.some((s) => typeof s !== "string" || !DATE.test(s)))
          return bad("use dates like 2026-12-02.");
        break;
      case "weekdays":
        if (!Array.isArray(v) || v.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) return bad("choose days of the week.");
        break;
      case "trustItems":
        if (!Array.isArray(v) || v.length > 4) return bad("up to four badges.");
        for (const item of v) {
          const i = item as TrustItem;
          if (!i || typeof i.title !== "string" || !i.title.trim()) return bad("every badge needs a title.");
          if (i.title.length > 40 || (typeof i.text === "string" && i.text.length > 80)) return bad("keep titles under 40 and lines under 80 characters.");
          if (!(TRUST_ICONS as readonly string[]).includes(i.icon)) return bad("choose an icon.");
        }
        break;
      case "product":
        if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v <= 0)) return bad("choose a perfume.");
        break;
    }
  }
  const settings = readFeatureSettings(key, source);
  // Cross-field rules.
  const n = (k: string) => Number(settings[k]);
  if (key === "pay_later" && n("min_amount") > n("max_amount")) return { ok: false, error: "Pay later: \"Show from\" must not be above \"Show up to\".", field: "min_amount" };
  if (key === "gift_cards" && n("min_amount") > n("max_amount")) return { ok: false, error: "Gift cards: the smallest custom amount is above the largest.", field: "min_amount" };
  if (key === "gift_cards" && (settings.amounts as number[]).length === 0 && !settings.allow_custom)
    return { ok: false, error: "Gift cards: offer at least one amount, or allow another amount.", field: "amounts" };
  if (key === "send_to_someone" && n("min_days") > n("max_days")) return { ok: false, error: "The earliest delivery date is after the latest.", field: "min_days" };
  if (key === "delivery_estimate" && n("days_min") > n("days_max")) return { ok: false, error: "The fastest delivery is slower than the slowest.", field: "days_min" };
  if (key === "welcome_offer" && settings.reward === "gift" && !settings.gift_product_id)
    return { ok: false, error: "Welcome offer: choose the free perfume, or pick another reward.", field: "gift_product_id" };
  return { ok: true, settings };
}

/* ── What the shop reads ───────────────────────────────────────────────── */

export type FeatureState = { enabled: boolean; settings: FeatureSettings; updatedAt: string | null };
export type StoreFeatures = Record<FeatureKey, FeatureState>;

/** Everything off with default settings: the shop before migration 70, or when the read fails. */
export function allFeaturesOff(): StoreFeatures {
  const out = {} as StoreFeatures;
  for (const key of FEATURE_KEYS) out[key] = { enabled: false, settings: featureDefaults(key), updatedAt: null };
  return out;
}

export function shapeStoreFeatures(data: unknown): StoreFeatures | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const rows = data as Record<string, { enabled?: unknown; settings?: unknown; updated_at?: unknown }>;
  const out = allFeaturesOff();
  for (const key of FEATURE_KEYS) {
    const row = rows[key];
    if (!row) continue;
    out[key] = {
      enabled: row.enabled === true,
      settings: readFeatureSettings(key, row.settings),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    };
  }
  return out;
}

/** Only the switched-on features, for the browser. */
export type PublicFeatures = Partial<Record<FeatureKey, FeatureSettings>>;

export function publicFeatures(features: StoreFeatures): PublicFeatures {
  const out: PublicFeatures = {};
  for (const key of FEATURE_KEYS) if (features[key].enabled) out[key] = features[key].settings;
  return out;
}

/** "{name}" and friends, filled in. Unknown placeholders are left as written. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? values[name] : whole));
}
