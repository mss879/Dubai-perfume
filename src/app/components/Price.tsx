"use client";

import { useCurrency } from "../lib/currency";

/**
 * The one way prices render on the storefront. Takes the AED amount from the
 * catalogue and displays it in the shopper's selected currency, in the house
 * format (`AED 745` / `USD 202.86`).
 */
export default function Price({
  amountAed,
  className,
}: {
  amountAed: number;
  className?: string;
}) {
  const { format } = useCurrency();
  return <span className={className}>{format(amountAed)}</span>;
}
