import type { Metadata } from "next";
import WishlistClient from "./WishlistClient";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function WishlistPage() {
  return <WishlistClient />;
}
