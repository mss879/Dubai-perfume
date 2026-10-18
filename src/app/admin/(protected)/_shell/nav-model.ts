import type { AdminCounts } from "../../_lib/counts";

/**
 * The admin's map. Daily work is pinned at the top with no sub-menus; the
 * rarely used screens sit in small, always-open groups; Settings at the end.
 */

export type IconKey =
  | "today"
  | "orders"
  | "products"
  | "messages"
  | "customers"
  | "carts"
  | "collections"
  | "discounts"
  | "offers"
  | "features"
  | "giftcards"
  | "loyalty"
  | "referrals"
  | "welcome"
  | "reminders"
  | "reorder"
  | "stock"
  | "filters"
  | "inspired"
  | "reports"
  | "concierge"
  | "settings";

export type BadgeKey = keyof Pick<AdminCounts, "needsAction" | "stockAlerts" | "messages">;

export type NavItem = {
  href: string;
  label: string;
  icon: IconKey;
  badge?: BadgeKey;
  /** Today is only active on /admin itself, not on every admin page. */
  exact?: boolean;
};

export const PINNED: NavItem[] = [
  { href: "/admin", label: "Today", icon: "today", exact: true },
  { href: "/admin/orders", label: "Orders", icon: "orders", badge: "needsAction" },
  { href: "/admin/products", label: "Products", icon: "products", badge: "stockAlerts" },
];

export const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Customers",
    items: [
      { href: "/admin/messages", label: "Messages", icon: "messages", badge: "messages" },
      { href: "/admin/customers", label: "Customers", icon: "customers" },
      { href: "/admin/abandoned-carts", label: "Abandoned carts", icon: "carts" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/collections", label: "Collections", icon: "collections" },
      { href: "/admin/features/shop-filters", label: "Shop filters", icon: "filters" },
      { href: "/admin/features/inspired-by", label: "Inspired-by matches", icon: "inspired" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/offers", label: "Offers & bundles", icon: "offers" },
      { href: "/admin/discounts", label: "Discount codes", icon: "discounts" },
      { href: "/admin/features/welcome-offer", label: "Welcome offer", icon: "welcome" },
      { href: "/admin/features/gift-cards", label: "Gift cards", icon: "giftcards" },
      { href: "/admin/features/loyalty", label: "Loyalty points", icon: "loyalty" },
      { href: "/admin/features/referrals", label: "Referral scheme", icon: "referrals" },
    ],
  },
  {
    label: "Automatic emails",
    items: [
      { href: "/admin/features/cart-reminders", label: "Cart reminder emails", icon: "reminders" },
      { href: "/admin/features/reorder-reminders", label: "Reorder reminders", icon: "reorder" },
      { href: "/admin/features/back-in-stock", label: "Back-in-stock alerts", icon: "stock" },
    ],
  },
  {
    label: "Store features",
    items: [{ href: "/admin/features", label: "Feature switches", icon: "features", exact: true }],
  },
  {
    label: "Reports",
    items: [
      { href: "/admin/reports", label: "Sales reports", icon: "reports" },
      { href: "/admin/agent", label: "Agent", icon: "concierge" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/admin/settings", label: "Settings", icon: "settings" };

/**
 * Where each tab of the old one-page admin lives now, so bookmarks and links
 * in old emails (`/admin?tab=…`, `/admin/more/…`) still land somewhere useful.
 * The old panel's other tabs (a dashboard of made-up figures, gift cards,
 * campaigns, markets, content, analytics, homepage order, stock transfers)
 * saved nothing or had no effect on the shop, and go to Today.
 */
const OLD_TAB_PATHS: Record<string, string> = {
  orders: "/admin/orders",
  products: "/admin/products",
  inventory: "/admin/products?stock=all",
  inquiries: "/admin/messages",
  customers: "/admin/customers",
  abandoned_carts: "/admin/abandoned-carts",
  collections: "/admin/collections",
  discounts: "/admin/discounts",
  reports: "/admin/reports",
  concierge: "/admin/agent",
};

export function pathForOldTab(tab: string): string {
  return Object.prototype.hasOwnProperty.call(OLD_TAB_PATHS, tab) ? OLD_TAB_PATHS[tab] : "/admin";
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
