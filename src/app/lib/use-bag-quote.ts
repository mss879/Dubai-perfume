"use client";

import { useEffect, useState } from "react";
import type { CartLine } from "./cart";
import type { BagQuote } from "./offers";

/**
 * The bag priced by the database, kept in step with the bag: offers, the free
 * gift, the code, delivery and the total. Re-asked a moment after the bag
 * changes; null until the first answer, or when the database can't answer
 * (the caller then shows its own simple totals).
 */
export function useBagQuote(lines: CartLine[], code: string | null = null): { quote: BagQuote | null; pending: boolean } {
  const items = lines.map((l) => ({ product_id: l.product.id, size: l.selectedSize, quantity: l.quantity }));
  const key = JSON.stringify([items, code ?? ""]);
  const [state, setState] = useState<{ key: string; quote: BagQuote | null }>({ key: "", quote: null });

  useEffect(() => {
    if (items.length === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/bag/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, code: code ?? undefined }),
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => null)) as { ok?: boolean; quote?: BagQuote } | null;
        setState({ key, quote: json?.ok && json.quote ? normaliseBagQuote(json.quote) : null });
      } catch {
        if (!controller.signal.aborted) setState({ key, quote: null });
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // `key` carries the bag and the code; `items` is rebuilt from it every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (items.length === 0) return { quote: null, pending: false };
  return { quote: state.key === key ? state.quote : null, pending: state.key !== key };
}

/** Numbers arrive as JSON numbers or numeric strings; make them numbers. */
export function normaliseBagQuote<Q extends BagQuote>(q: Q): Q {
  const n = (v: unknown) => Number(v) || 0;
  return {
    ...q,
    subtotal: n(q.subtotal),
    offer_saving: n(q.offer_saving),
    offer_delivery: n(q.offer_delivery),
    code_goods: n(q.code_goods),
    code_delivery: n(q.code_delivery),
    shipping_fee: n(q.shipping_fee),
    total: n(q.total),
    to_free_delivery: n(q.to_free_delivery),
    applied: (q.applied ?? []).map((a) => ({ ...a, saving: n(a.saving) })),
    addons: (q.addons ?? []).map((a) => ({ ...a, price: n(a.price), addon_price: n(a.addon_price) })),
    free_delivery_picks: (q.free_delivery_picks ?? []).map((p) => ({ ...p, price: n(p.price) })),
    gift: q.gift ? { ...q.gift, value: n(q.gift.value), threshold: n(q.gift.threshold) } : null,
    nudges: (q.nudges ?? []).map((x) => (x.kind === "gift" ? { ...x, missing_aed: n(x.missing_aed) } : { ...x, percent: n(x.percent) })),
    code: q.code ? { ...q.code, gift: q.code.gift ? { ...q.code.gift, value: n(q.code.gift.value) } : null } : null,
  };
}
