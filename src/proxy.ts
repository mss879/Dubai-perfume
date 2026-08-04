import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Optimistic gate for /admin. Per the Next.js guidance on authentication, this
 * only reads the session from the cookie — it performs no database check, so it
 * stays cheap on prefetched navigations. The authoritative `customers.is_admin`
 * check runs in src/app/lib/auth.ts (called by both the protected layout and
 * the protected page), and RLS enforces it again on every query.
 *
 * It also refreshes the Supabase auth cookie, which server components cannot do
 * themselves — without this an expired token would bounce a signed-in admin.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

export const config = {
  // "/admin" is listed explicitly alongside the wildcard so the index route is
  // covered regardless of how zero-segment matches are interpreted.
  matcher: ["/admin", "/admin/:path*"],
};
