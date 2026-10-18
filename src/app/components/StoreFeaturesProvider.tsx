"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FeatureKey, FeatureSettings, PublicFeatures } from "../lib/features";

/**
 * The switched-on features and their settings, for the shop's client islands
 * (the root layout reads them once per request). A feature that is off is
 * simply absent, so `useFeature` returns null and the island renders nothing.
 */

const StoreFeaturesContext = createContext<PublicFeatures>({});

export function StoreFeaturesProvider({ value, children }: { value: PublicFeatures; children: ReactNode }) {
  return <StoreFeaturesContext.Provider value={value}>{children}</StoreFeaturesContext.Provider>;
}

export function useFeature(key: FeatureKey): FeatureSettings | null {
  return useContext(StoreFeaturesContext)[key] ?? null;
}

export function useStoreFeatures(): PublicFeatures {
  return useContext(StoreFeaturesContext);
}
