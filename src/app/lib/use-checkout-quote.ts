"use client";

import { useEffect, useState } from "react";
import type { CartLine } from "./cart";
import type { CheckoutQuote } from "./offers";
import { normaliseBagQuote } from "./use-bag-quote";

export type CheckoutOptions = { gift_wrap: boolean; use_points: boolean; gift_card: string | null };

/**
 * The checkout priced by the database (checkout_quote, migration 70): the bag,
 * gift wrap, points and a gift card. Re-asked a moment after anything changes;
 * null until the first answer, or when the database can't answer.
 */
export function useCheckoutQuote(
  lines: CartLine[],
  code: string | null,
  options: CheckoutOptions
): { quote: CheckoutQuote | null; pending: boolean } {
  const items = lines.map((l) => ({ product_id: l.product.id, size: l.selectedSize, quantity: l.quantity }));
  const key = JSON.stringify([items, code ?? "", options.gift_wrap, options.use_points, options.gift_card ?? ""]);
  const [state, setState] = useState<{ key: string; quote: CheckoutQuote | null }>({ key: "", quote: null });

  useEffect(() => {
    if (items.length === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            code: code ?? undefined,
            options: { gift_wrap: options.gift_wrap, use_points: options.use_points, gift_card: options.gift_card ?? undefined },
          }),
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => null)) as { ok?: boolean; quote?: CheckoutQuote } | null;
        setState({ key, quote: json?.ok && json.quote ? normalise(json.quote) : null });
      } catch {
        if (!controller.signal.aborted) setState({ key, quote: null });
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // `key` carries the bag, the code and the options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (items.length === 0) return { quote: null, pending: false };
  return { quote: state.key === key ? state.quote : null, pending: state.key !== key };
}

function normalise(q: CheckoutQuote): CheckoutQuote {
  const n = (v: unknown) => Number(v) || 0;
  const base = normaliseBagQuote(q);
  return {
    ...base,
    gift_wrap_fee: n(q.gift_wrap_fee),
    gift_wrap_included: q.gift_wrap_included === true,
    points: q.points
      ? {
          available: n(q.points.available),
          usable: n(q.points.usable),
          usable_value: n(q.points.usable_value),
          used: n(q.points.used),
          value: n(q.points.value),
          min_redeem: n(q.points.min_redeem),
        }
      : null,
    gift_card: q.gift_card
      ? {
          status: q.gift_card.status,
          amount: n(q.gift_card.amount),
          balance: q.gift_card.balance == null ? null : n(q.gift_card.balance),
          balance_after: q.gift_card.balance_after == null ? null : n(q.gift_card.balance_after),
        }
      : null,
    total_before_credits: q.total_before_credits == null ? base.total : n(q.total_before_credits),
  };
}
