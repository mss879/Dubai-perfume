"use client";

import { useSyncExternalStore } from "react";

/**
 * Single source of truth for the shopping bag. The bag lives in localStorage
 * under `gharib_cart_v2` (same key the old hand-rolled writers used, so
 * existing shoppers keep their carts). Every write dispatches a `gharib:cart`
 * CustomEvent so the header badge and drawers update in the SAME tab —
 * `storage` events only fire in other tabs, which is why the badge used to
 * go stale after "Add to cart".
 */

export const CART_STORAGE_KEY = "gharib_cart_v2";
const CART_EVENT = "gharib:cart";

export type CartProduct = {
  id: number;
  brand: string;
  name: string;
  price: number;
  image_url: string;
};

export type CartLine = {
  product: CartProduct;
  selectedSize: string;
  quantity: number;
};

const EMPTY_CART: CartLine[] = [];

/** Tolerates the divergent payload shapes older writers left behind. */
function normalizeLine(raw: unknown): CartLine | null {
  if (!raw || typeof raw !== "object") return null;
  const line = raw as {
    product?: Record<string, unknown>;
    quantity?: unknown;
    selectedSize?: unknown;
    size?: unknown;
  };
  const product = line.product;
  if (!product || product.id == null) return null;
  const quantity = Math.max(1, Math.min(20, Number(line.quantity) || 1));
  return {
    product: {
      id: Number(product.id),
      brand: String(product.brand ?? ""),
      name: String(product.name ?? ""),
      price: Number(product.price) || 0,
      image_url: String(product.image_url ?? product.image ?? ""),
    },
    selectedSize: String(line.selectedSize ?? line.size ?? ""),
    quantity,
  };
}

let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY_CART;

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return EMPTY_CART;
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (raw === cachedRaw) return cachedLines;
  cachedRaw = raw;
  if (!raw) {
    cachedLines = EMPTY_CART;
    return cachedLines;
  }
  try {
    const parsed = JSON.parse(raw);
    cachedLines = Array.isArray(parsed)
      ? (parsed.map(normalizeLine).filter(Boolean) as CartLine[])
      : EMPTY_CART;
  } catch {
    cachedLines = EMPTY_CART;
  }
  return cachedLines;
}

function persist(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  cachedRaw = null;
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

export function writeCart(lines: CartLine[]) {
  persist(lines);
}

export function addToCart(product: CartProduct, selectedSize: string, quantity = 1) {
  const lines = [...readCart()];
  const idx = lines.findIndex(
    (l) => l.product.id === product.id && l.selectedSize === selectedSize
  );
  if (idx > -1) {
    lines[idx] = {
      ...lines[idx],
      quantity: Math.min(20, lines[idx].quantity + quantity),
    };
  } else {
    lines.push({ product, selectedSize, quantity: Math.max(1, Math.min(20, quantity)) });
  }
  persist(lines);
}

export function removeFromCart(productId: number, selectedSize: string) {
  persist(
    readCart().filter(
      (l) => !(l.product.id === productId && l.selectedSize === selectedSize)
    )
  );
}

export function setCartQuantity(productId: number, selectedSize: string, quantity: number) {
  if (quantity < 1) {
    removeFromCart(productId, selectedSize);
    return;
  }
  persist(
    readCart().map((l) =>
      l.product.id === productId && l.selectedSize === selectedSize
        ? { ...l, quantity: Math.min(20, quantity) }
        : l
    )
  );
}

export function clearCart() {
  persist([]);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
}

function subscribe(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerSnapshot(): CartLine[] {
  return EMPTY_CART;
}

/**
 * Reactive cart hook — no provider needed.
 *
 * The mutators are module-level functions, so their identity is already stable
 * across renders; wrapping them in useCallback added nothing.
 */
export function useCart() {
  const lines = useSyncExternalStore(subscribe, readCart, getServerSnapshot);
  return {
    lines,
    count: cartCount(lines),
    subtotal: cartSubtotal(lines),
    add: addToCart,
    remove: removeFromCart,
    setQuantity: setCartQuantity,
    clear: clearCart,
  };
}
