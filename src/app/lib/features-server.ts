import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingFunction } from "./rpc-errors";
import { createServerSupabase, isSupabaseConfigured } from "./supabase-server";
import { allFeaturesOff, shapeStoreFeatures, type FeatureKey, type FeatureState, type StoreFeatures } from "./features";

/**
 * The feature switches as the server reads them (get_store_features,
 * migration 70). Before that migration, and whenever the read fails, every
 * feature counts as OFF: the shop then behaves exactly as it did before the
 * switches existed. Money is never decided here; the database re-checks every
 * switch it depends on (place_order, checkout_quote).
 */

/** A fresh read, for the admin. `missing` when migration 70 hasn't run. */
export async function readStoreFeaturesFresh(
  supabase: SupabaseClient
): Promise<{ features: StoreFeatures; missing: boolean; failed: boolean }> {
  const { data, error } = await supabase.rpc("get_store_features");
  if (error) {
    return { features: allFeaturesOff(), missing: isMissingFunction(error), failed: !isMissingFunction(error) };
  }
  return { features: shapeStoreFeatures(data) ?? allFeaturesOff(), missing: false, failed: false };
}

// The shop asks on every page view; a few seconds of memory per server instance
// keeps that to one small read, and an owner's switch still lands within moments.
const TTL_MS = 10_000;
let cached: { at: number; value: StoreFeatures } | null = null;

export async function liveStoreFeatures(): Promise<StoreFeatures> {
  if (!isSupabaseConfigured) return allFeaturesOff();
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  try {
    const { features } = await readStoreFeaturesFresh(createServerSupabase());
    cached = { at: now, value: features };
    return features;
  } catch {
    return allFeaturesOff();
  }
}

export async function liveFeature(key: FeatureKey): Promise<FeatureState> {
  return (await liveStoreFeatures())[key];
}

/** After the owner saves, this instance forgets its copy at once. */
export function forgetStoreFeatures(): void {
  cached = null;
}
