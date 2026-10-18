/**
 * A path on this site to send someone to after signing in, or null.
 *
 * "Starts with / but not //" is not enough: browsers read "/\evil.com" (and a
 * slash followed by a tab or newline) as "//evil.com", a link to another site.
 * So the value is resolved against a placeholder origin and kept only if it
 * stays on that origin.
 */
export function safeLocalPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().slice(0, 512);
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const base = "https://same-site.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * The fixed messages the sign-in page can show. Links carry the key, never the
 * text, so nobody can put words of their own on the store's sign-in page.
 */
export const SIGNIN_NOTICES = {
  "link-expired": "That confirmation link has expired or has already been used. Please sign in, or request a new link.",
  "please-sign-in": "Please sign in to continue.",
  confirmed: "Your email address is confirmed. Please sign in to continue.",
} as const;

export type SigninNotice = keyof typeof SIGNIN_NOTICES;

export function signinNoticeText(raw: unknown): string | null {
  return typeof raw === "string" && raw in SIGNIN_NOTICES ? SIGNIN_NOTICES[raw as SigninNotice] : null;
}
