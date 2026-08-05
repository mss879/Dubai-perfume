import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  LAUNCHING_SOON_PATH,
  SITE_LOCK_COOKIE,
  readSiteLock,
  verifyBypass,
} from "./app/lib/site-lock";

/**
 * Two jobs, kept apart because they apply to opposite halves of the site.
 *
 * 1. /admin — an optimistic gate. Per the Next.js guidance on authentication,
 *    it only reads the session from the cookie and performs no database check,
 *    so it stays cheap on prefetched navigations. The authoritative
 *    `customers.is_admin` check runs in src/app/lib/auth.ts (called by both the
 *    protected layout and the protected page), and RLS enforces it again on
 *    every query. It also refreshes the Supabase auth cookie, which server
 *    components cannot do themselves — without this an expired token would
 *    bounce a signed-in admin.
 *
 * 2. Everything else — the site lock (migration 52). When the owner has locked
 *    the site, public requests are rewritten to the "Launching soon" holding
 *    page unless the visitor carries a valid bypass cookie.
 *
 * Cost note: the lock adds no per-request database call. The state is cached in
 * the instance for fifteen seconds (see lib/site-lock.ts) and the bypass cookie
 * is validated by hashing it locally against a published fingerprint. Nothing
 * here calls supabase.auth.getUser() on a public route — an admin previewing
 * the locked site is handed the bypass cookie when they save the lock settings,
 * so the panel is the only place that pays for an identity check.
 */

/** Never gated: the way back in, and the machinery the lock itself needs. */
const ALWAYS_OPEN = [
  "/admin",
  "/api/admin",
  "/api/site-lock",
  // Job endpoints authenticate with their own shared secret and must keep
  // running through a lock.
  "/api/cart-recovery",
  "/api/abandoned-cart",
  LAUNCHING_SOON_PATH,
];

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isUnder(pathname, "/admin")) {
    return adminGate(request, supabaseUrl, supabaseAnonKey);
  }

  if (ALWAYS_OPEN.some((base) => isUnder(pathname, base))) {
    return NextResponse.next();
  }

  return siteLockGate(request);
}

/** The original optimistic /admin gate, unchanged in behaviour. */
async function adminGate(
  request: NextRequest,
  supabaseUrl: string | undefined,
  supabaseAnonKey: string | undefined
) {
  const { pathname } = request.nextUrl;

  // Without Supabase configured there is no session to read; let the server
  // components handle it (they refuse to render admin content).
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refreshes the auth token and writes the rotated cookie onto `response`.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The sign-in page must stay reachable to signed-out operators.
  if (pathname.startsWith("/admin/signin")) {
    return response;
  }

  if (!user) {
    const signin = new URL("/admin/signin", request.url);
    signin.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signin);
  }

  return response;
}

/** The public half: hold the door when the maison has not opened yet. */
async function siteLockGate(request: NextRequest) {
  const lock = await readSiteLock();

  if (!lock.locked) {
    return NextResponse.next();
  }

  if (verifyBypass(request.cookies.get(SITE_LOCK_COOKIE)?.value, lock.unlockFingerprint)) {
    return NextResponse.next();
  }

  // A locked storefront must not take orders either, but handing an HTML
  // holding page to something expecting JSON is its own kind of broken. API
  // callers get an API answer.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "The store is not open yet." },
      { status: 503, headers: { "x-robots-tag": "noindex, nofollow" } }
    );
  }

  // A rewrite rather than a redirect: the visitor's URL is left intact, so a
  // link shared before launch still lands where it was meant to once the site
  // opens, and there is no redirect loop to reason about.
  const holding = request.nextUrl.clone();
  holding.pathname = LAUNCHING_SOON_PATH;
  holding.search = "";

  const response = NextResponse.rewrite(holding);
  // Belt and braces alongside the page's own robots metadata — a crawler that
  // arrives mid-lock must not bank "Launching soon" as the page's content.
  response.headers.set("x-robots-tag", "noindex, nofollow");
  return response;
}

export const config = {
  /*
   * Everything except the assets a holding page still has to serve. Static
   * files, the image optimiser and the metadata routes are excluded, as are
   * bare asset extensions — locking the site must not also break the CSS and
   * fonts the holding page itself is rendered with.
   *
   * "/admin" is covered by the leading catch-all; it is handled first inside
   * proxy() rather than by a separate matcher entry.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|mp4|webm|woff|woff2|ttf|otf|txt|xml)$).*)",
  ],
};
