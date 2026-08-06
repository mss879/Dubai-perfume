import type { NextConfig } from "next";

/**
 * The Supabase project host, for next/image.
 *
 * This was previously the wildcard `*.supabase.co`, which authorised ANY
 * Supabase project — anyone could push arbitrary images through the image
 * optimiser at our expense. Pin it to this project. Derived from the same env
 * var the app already requires, so it cannot drift from the real bucket.
 */
function supabaseImageHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      // Malformed value — fall through rather than breaking the build.
    }
  }
  return "oinvkhwaljobqhrocqky.supabase.co";
}

/**
 * Security headers.
 *
 * Netlify already supplies Strict-Transport-Security and X-Content-Type-Options
 * at the edge, but nothing was setting frame protection — so /admin could be
 * loaded in a hidden frame and a signed-in admin clickjacked into acting on
 * orders. That is the gap these close.
 *
 * The CSP is deliberately conservative rather than maximal. Next.js injects
 * inline bootstrap scripts and this app emits inline JSON-LD, so 'unsafe-inline'
 * on script-src is required until a nonce-based CSP is wired through the
 * document — a stricter policy that breaks the storefront would be worse than
 * none. The directives that actually stop the attacks found in the audit
 * (framing, plugin embedding, base-tag hijacking, form exfiltration) are strict.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Next.js runtime + inline JSON-LD. Tighten to a nonce when convenient.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind and the inline critical styles this app ships.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  // Supabase REST/auth over https and realtime over wss; the FX rates endpoint.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://open.er-api.com",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  // Belt and braces with frame-ancestors above: older browsers honour only this.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // camera=(self) so the concierge's "photograph a bottle" input can reach the
    // camera on a phone. Defensive rather than proven: it is not established
    // that Chromium gates <input capture> on this header, and the file-picker
    // path works regardless — so if the camera does not open, this is not the
    // reason. Everything else stays denied outright.
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

const nextConfig: NextConfig = {
  experimental: {
    /**
     * proxy.ts matches every route, and when a proxy is in play Next buffers the
     * whole request body in memory before the route handler sees a byte of it —
     * 10MB by default. The concierge's own cap (512KB, enforced by streaming in
     * request-guard.ts) therefore protects nothing on its own: the memory is
     * already spent by the time it runs. This is the limit that actually binds.
     * Sized just above the concierge's cap, which is the largest body the store
     * accepts anywhere.
     */
    proxyClientMaxBodySize: "640kb",
  },
  compress: true,
  // Stop advertising the framework and its version to attackers.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHost(),
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/sign-in",
        destination: "/signin",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
