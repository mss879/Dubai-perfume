"use client";

import { useCurrency } from "../lib/currency";

/**
 * Trailing `.00` is noise on the retail price — it is a round number in almost
 * every case, and the charged price beneath it is the one that needs its fils.
 */
function trimWholeFils(formatted: string): string {
  return formatted.replace(/\.00$/, "");
}

/**
 * The one way prices render on the storefront. Takes the AED amount from the
 * catalogue and displays it in the shopper's selected currency, in the house
 * format (`AED 745` / `USD 202.86`).
 *
 * Pass `compareAtAed` — products.compare_at_price, the brand's own retail price
 * — to show it struck through beneath what the house actually charges. It is
 * ignored unless it is genuinely higher, so a product with no saving, a null
 * column, or a mispriced row simply renders the plain price.
 *
 * Layout: the charged price stays on line 1, on the baseline it shares with the
 * size selector and the hairline; the struck price sits on line 2. A 375px card
 * gives the price cell roughly 90px and `AED 139.49` alone measures ~87px, so
 * an inline second figure does not fit at any size — the line break is
 * structural, not stylistic. Stacking also keeps the charged price on a
 * constant baseline across a grid where every product carries a saving.
 *
 * No label. The strikethrough is the whole message, so it has to be legible on
 * its own: the figure is near-black and the rule takes currentColor, never a
 * lighter tint. An earlier attempt set the rule lighter than its own text, at
 * 1.98:1 against white — under the 3:1 WCAG 1.4.11 floor for non-text contrast
 * — and disappeared entirely. The currency code stays on the struck figure:
 * without a word to license it, a lone number needs to read as a price.
 *
 * Markup: the visual cluster is aria-hidden and a single sr-only sentence
 * carries the meaning, since a strikethrough is not announced. `<s>`, not
 * `<del>` — `<del>` marks a document edit, `<s>` marks something no longer
 * accurate. aria-label is not used: it is name-prohibited on a generic span and
 * JAWS ignores it on static content.
 */
export default function Price({
  amountAed,
  compareAtAed,
  className,
}: {
  amountAed: number;
  compareAtAed?: number | null;
  className?: string;
}) {
  const { format } = useCurrency();

  const was =
    typeof compareAtAed === "number" && Number.isFinite(compareAtAed) && compareAtAed > amountAed
      ? compareAtAed
      : null;

  if (was === null) {
    return <span className={className}>{format(amountAed)}</span>;
  }

  return (
    <span className={className}>
      <span className="maison-price-now">{format(amountAed)}</span>
      <s className="maison-price-rrp" aria-hidden="true">
        {trimWholeFils(format(was))}
      </s>
      <span className="sr-only">Retail price {format(was)}.</span>
    </span>
  );
}
