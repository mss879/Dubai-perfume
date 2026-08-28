/**
 * Currency constants and pure formatters, importable from both server code
 * (route handlers, server components) and the client hooks in currency.ts.
 * AED is the only transactional currency — conversion is presentation-only.
 */

export type CurrencyCode =
  | "AED" | "USD" | "EUR" | "GBP" | "SAR" | "QAR" | "KWD" | "BHD" | "OMR" | "INR";

export const SUPPORTED_CURRENCIES: { code: CurrencyCode; label: string; decimals: number }[] = [
  // AED carries two decimals because the catalogue is priced on .49 / .99 endings
  // (migration 60). Rounding it to whole dirhams would show 139.49 as "AED 139"
  // and quietly misstate what the shopper is charged.
  { code: "AED", label: "UAE Dirham", decimals: 2 },
  { code: "USD", label: "US Dollar", decimals: 2 },
  { code: "EUR", label: "Euro", decimals: 2 },
  { code: "GBP", label: "British Pound", decimals: 2 },
  { code: "SAR", label: "Saudi Riyal", decimals: 0 },
  { code: "QAR", label: "Qatari Riyal", decimals: 0 },
  { code: "KWD", label: "Kuwaiti Dinar", decimals: 2 },
  { code: "BHD", label: "Bahraini Dinar", decimals: 2 },
  { code: "OMR", label: "Omani Rial", decimals: 2 },
  { code: "INR", label: "Indian Rupee", decimals: 0 },
];

/** Static fallback (AED base) used until /api/rates responds or when it fails. */
export const FALLBACK_RATES: Record<CurrencyCode, number> = {
  AED: 1,
  USD: 0.2723,
  EUR: 0.2514,
  GBP: 0.2131,
  SAR: 1.0211,
  QAR: 0.9911,
  KWD: 0.0837,
  BHD: 0.1026,
  OMR: 0.1048,
  INR: 22.85,
};

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}

/**
 * The house format: currency code before the amount — `AED 139.49` /
 * `USD 202.86`. AED and the two-decimal currencies show fils; the remaining
 * dirham-pegged Gulf currencies stay whole, since their conversion is
 * presentation-only and fractions there mean nothing.
 */
export function formatFromAed(
  amountAed: number,
  code: CurrencyCode = "AED",
  rates: Partial<Record<CurrencyCode, number>> = {}
): string {
  const rate = code === "AED" ? 1 : rates[code] ?? FALLBACK_RATES[code] ?? 1;
  const decimals = SUPPORTED_CURRENCIES.find((c) => c.code === code)?.decimals ?? 2;
  const value = amountAed * rate;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${code} ${formatted}`;
}

export function getRateFromAed(
  code: CurrencyCode,
  rates: Partial<Record<CurrencyCode, number>> = {}
): number {
  return code === "AED" ? 1 : rates[code] ?? FALLBACK_RATES[code] ?? 1;
}
