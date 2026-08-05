import { NextRequest, NextResponse } from "next/server";
import { createSessionSupabase, isSupabaseConfigured } from "../../lib/supabase-server";

/**
 * Where a confirmation link lands.
 *
 * The browser client is PKCE (the @supabase/ssr default), so Supabase sends the
 * shopper back with `?code=...` and the session only exists once that code is
 * exchanged. Nothing was doing that: the link landed on the site root, the code
 * was dropped, and a shopper who had just confirmed their address still had to
 * work out for themselves that they now needed to sign in.
 *
 * The PKCE verifier is written to a cookie by @supabase/ssr, so the exchange
 * belongs here — a route handler can both read that cookie and write the
 * rotated session cookies back. It cannot happen in a server component, where
 * cookies are read-only.
 */

export const dynamic = "force-dynamic";

/**
 * Only a same-origin app path may be used as the post-confirmation
 * destination. `//evil.com` is a valid *relative* URL to the browser, so
 * checking for a leading "/" alone is not enough to keep this off an open
 * redirect.
 */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/customer/dashboard";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");

  // Supabase reports an expired or already-used link on the query string.
  const linkError = searchParams.get("error_description") || searchParams.get("error");

  const toSignin = (notice: string) =>
    NextResponse.redirect(
      new URL(`/signin?notice=${encodeURIComponent(notice)}&redirect=${encodeURIComponent(next)}`, origin)
    );

  if (linkError) {
    return toSignin("That confirmation link has expired or has already been used. Please sign in, or request a new link.");
  }

  if (!code || !isSupabaseConfigured) {
    return toSignin("Please sign in to continue.");
  }

  const supabase = await createSessionSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // The commonest cause is opening the link on a different device from the
    // one that signed up, so the PKCE verifier cookie is not present. The
    // address is confirmed either way — only the automatic sign-in is lost.
    console.error("Auth callback exchange failed:", error.message);
    return toSignin("Your email address is confirmed. Please sign in to continue.");
  }

  return NextResponse.redirect(new URL(next, origin));
}
