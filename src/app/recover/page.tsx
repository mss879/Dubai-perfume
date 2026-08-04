import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import RecoverClient, { type RecoverableLine } from "./RecoverClient";
import { createServerSupabase, isSupabaseConfigured } from "../lib/supabase-server";
import { isMissingFunction } from "../lib/rpc-errors";
import { normalizeRecoveryItems } from "../lib/cart-recovery";

/**
 * Where the "return to your selection" link in a recovery email lands.
 *
 * A server component that resolves the token and hands the island a finished
 * list of lines — the browser never sees the token turn into an address, and
 * the lines are re-read from the live catalogue rather than trusted from the
 * saved cart, so a price or a photograph that changed since is current.
 */

export const metadata: Metadata = {
  title: "Your saved selection",
  // Not a page for search engines: every URL here is one shopper's token.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Outcome =
  | { kind: "restored"; lines: RecoverableLine[]; firstName: string }
  | { kind: "already-ordered" }
  | { kind: "gone" }
  | { kind: "unavailable" };

type RecoveryCartResult = {
  found?: boolean;
  converted?: boolean;
  email?: string;
  first_name?: string | null;
  cart_items?: unknown;
};

type ProductRow = {
  id: number;
  brand: string | null;
  name: string;
  price: number | string;
  image_url: string | null;
  sizes: string[] | null;
};

async function resolve(token: string): Promise<Outcome> {
  if (!UUID.test(token)) return { kind: "gone" };
  if (!isSupabaseConfigured) return { kind: "unavailable" };

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.rpc("get_recovery_cart", { p_token: token });

    if (error) {
      if (isMissingFunction(error)) {
        console.error("get_recovery_cart is missing — apply migration 45.");
      } else {
        console.error("Recovery cart lookup failed:", error.message);
      }
      return { kind: "unavailable" };
    }

    const result = (data ?? {}) as RecoveryCartResult;
    if (!result.found) return { kind: "gone" };
    if (result.converted) return { kind: "already-ordered" };

    const saved = normalizeRecoveryItems(result.cart_items);
    if (saved.length === 0) return { kind: "gone" };

    // The saved lines carry a price and no photograph. Both come from the
    // catalogue instead, so the shopper is never restored a stale price.
    const ids = [...new Set(saved.map((s) => s.productId))];
    const { data: products } = await supabase
      .from("products")
      .select("id, brand, name, price, image_url, sizes")
      .in("id", ids);

    const byId = new Map(((products ?? []) as ProductRow[]).map((p) => [p.id, p]));

    const lines: RecoverableLine[] = saved
      .map((s) => {
        const product = byId.get(s.productId);
        if (!product) return null;
        // A size that has since been discontinued falls back to the first the
        // product still offers, rather than restoring an unbuyable line.
        const sizes = Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [];
        const size = sizes.includes(s.size) ? s.size : sizes[0] || s.size;
        return {
          productId: product.id,
          brand: String(product.brand ?? ""),
          name: product.name,
          priceAed: Number(product.price) || 0,
          imageUrl: product.image_url || "",
          size,
          quantity: s.quantity,
        };
      })
      .filter((l): l is RecoverableLine => l !== null);

    if (lines.length === 0) return { kind: "gone" };

    return { kind: "restored", lines, firstName: String(result.first_name ?? "").trim() };
  } catch (err) {
    console.error("Recovery page error:", err);
    return { kind: "unavailable" };
  }
}

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const outcome = await resolve((token ?? "").trim());

  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />
      <CartDrawer />

      <main className="flex-grow">
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">Your selection</p>

          {outcome.kind === "restored" && (
            <>
              <h1 className="maison-page-title mt-5">
                {outcome.firstName ? `Welcome back, ${outcome.firstName}` : "Welcome back"}
              </h1>
              <p className="maison-body mt-6 mx-auto max-w-[52ch]">
                Your selection has been returned to your bag, exactly as you left it. Payment is
                collected on delivery — nothing is charged before your parcel arrives.
              </p>
            </>
          )}

          {outcome.kind === "already-ordered" && (
            <>
              <h1 className="maison-page-title mt-5">This selection is already on its way</h1>
              <p className="maison-body mt-6 mx-auto max-w-[52ch]">
                You have already placed this order — nothing further is needed. You can follow the
                parcel with your order reference and the email address you ordered with.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/track" className="maison-btn w-full sm:w-auto">
                  Track your order
                </Link>
                <Link href="/shop" className="maison-btn-outline w-full sm:w-auto">
                  Continue shopping
                </Link>
              </div>
            </>
          )}

          {outcome.kind === "gone" && (
            <>
              <h1 className="maison-page-title mt-5">This selection is no longer saved</h1>
              <p className="maison-body mt-6 mx-auto max-w-[52ch]">
                Saved selections are held for a short while and then released. The house is open,
                though — the full catalogue is a tap away.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/shop" className="maison-btn w-full sm:w-auto">
                  Discover the catalogue
                </Link>
                <Link href="/collections" className="maison-btn-outline w-full sm:w-auto">
                  Browse the houses
                </Link>
              </div>
            </>
          )}

          {outcome.kind === "unavailable" && (
            <>
              <h1 className="maison-page-title mt-5">We cannot reach your selection</h1>
              <p className="maison-body mt-6 mx-auto max-w-[52ch]">
                Something on our side is not answering just now. Please try the link again in a few
                minutes, or write to us and a client advisor will rebuild your selection by hand.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/contact" className="maison-btn-outline w-full sm:w-auto">
                  Contact us
                </Link>
              </div>
            </>
          )}
        </section>

        {outcome.kind === "restored" && <RecoverClient lines={outcome.lines} />}
      </main>

      <Footer />
    </div>
  );
}
