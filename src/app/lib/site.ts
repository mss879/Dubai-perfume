export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://gharibperfumes.com";

export const SITE_NAME = "Gharib";
export const SITE_TITLE = "Gharib | Exquisite Luxury Fragrances";
export const SITE_DESCRIPTION =
  "Maison Gharib — a Dubai house of fragrance. Discover rare oud, amber and floral compositions from the region's most coveted maisons.";

/**
 * Published contact details. Single source so the legal pages, the contact
 * page and any future transactional email all quote the same address.
 */
export const SITE_EMAIL = "info@gharib.com";
export const SITE_PHONE_DISPLAY = "+971 4 380 8888";
export const SITE_PHONE_HREF = "tel:+97143808888";

/**
 * UAE trade licence number, shown on the Terms page.
 *
 * This is a legal identifier that can only come from the business's own
 * licence — it is deliberately NOT invented here. Set NEXT_PUBLIC_TRADE_LICENCE
 * and the Terms page will state it; until then the page simply omits the claim
 * rather than printing a placeholder.
 */
export const TRADE_LICENCE = process.env.NEXT_PUBLIC_TRADE_LICENCE || "";

/**
 * WhatsApp and social handles.
 *
 * Same principle as the trade licence: these are the maison's own accounts and
 * are not invented here. Each renders only when its variable is set, so an
 * unset handle shows nothing rather than a link to a profile that isn't yours.
 *
 * WhatsApp wants digits only, including country code and no "+" — e.g.
 * 971501234567 for a Dubai mobile.
 */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
export const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL || "";
export const TIKTOK_URL = process.env.NEXT_PUBLIC_TIKTOK_URL || "";
export const FACEBOOK_URL = process.env.NEXT_PUBLIC_FACEBOOK_URL || "";

/** A wa.me link, optionally pre-filled. Empty when no number is configured. */
export function whatsappLink(message?: string): string {
  if (!WHATSAPP_NUMBER) return "";
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// `isSupabaseConfigured` lives in lib/supabase-server.ts — a second copy here
// meant two things could disagree about whether the store has a database.
