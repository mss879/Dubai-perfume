"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  CurrencyCode,
  FALLBACK_RATES,
  formatFromAed,
  getRateFromAed,
  isSupportedCurrency,
} from "./currency-shared";

/**
 * Single display-currency system (client side). Replaces the five divergent
 * formatCurrency implementations, which used three different rate sources and
 * two different layouts for the same product. Constants and pure formatters
 * live in currency-shared.ts so server code can import them too.
 */

export const CURRENCY_STORAGE_KEY = "gharib_active_currency";
const CURRENCY_EVENT = "gharib:currency";
const RATES_CACHE_KEY = "gharib_fx_rates_v2";

export {
  SUPPORTED_CURRENCIES,
  FALLBACK_RATES,
  formatFromAed,
  getRateFromAed,
  isSupportedCurrency,
} from "./currency-shared";
export type { CurrencyCode } from "./currency-shared";

export function readStoredCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "AED";
  const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY) || "AED";
  return isSupportedCurrency(stored) ? stored : "AED";
}

export function setStoredCurrency(code: CurrencyCode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  window.dispatchEvent(new CustomEvent(CURRENCY_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(CURRENCY_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CURRENCY_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerCurrency(): CurrencyCode {
  return "AED";
}

let ratesPromise: Promise<Partial<Record<CurrencyCode, number>>> | null = null;

async function loadRates(): Promise<Partial<Record<CurrencyCode, number>>> {
  if (typeof window === "undefined") return FALLBACK_RATES;
  try {
    const cached = window.sessionStorage.getItem(RATES_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  if (!ratesPromise) {
    ratesPromise = fetch("/api/rates")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const rates = json?.rates && typeof json.rates === "object" ? json.rates : FALLBACK_RATES;
        try {
          window.sessionStorage.setItem(RATES_CACHE_KEY, JSON.stringify(rates));
        } catch {}
        return rates;
      })
      .catch(() => FALLBACK_RATES);
  }
  return ratesPromise;
}

/**
 * Reactive currency hook: the selected currency (persisted, cross-page,
 * cross-tab) plus a `format(amountAed)` bound to live rates.
 */
export function useCurrency() {
  const currency = useSyncExternalStore(subscribe, readStoredCurrency, getServerCurrency);
  const [rates, setRates] = useState<Partial<Record<CurrencyCode, number>>>(FALLBACK_RATES);

  useEffect(() => {
    let cancelled = false;
    loadRates().then((loaded) => {
      if (!cancelled) setRates(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const format = useCallback(
    (amountAed: number) => formatFromAed(amountAed, currency, rates),
    [currency, rates]
  );

  const rate = getRateFromAed(currency, rates);

  return { currency, setCurrency: setStoredCurrency, format, rate, rates };
}
