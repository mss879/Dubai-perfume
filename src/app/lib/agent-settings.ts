import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingFunction } from "./rpc-errors";

/**
 * The owner's switches for the shop's chat assistant (Admin → Agent,
 * migration 65). Until that migration runs, and whenever the read fails,
 * everything counts as on: exactly how the assistant behaved before the
 * switches existed, so a database hiccup never silently hides it.
 */

export type AgentSettings = {
  enabled: boolean;
  /** null: the house greeting. */
  greeting: string | null;
  photosEnabled: boolean;
  offersEnabled: boolean;
  orderHelpEnabled: boolean;
  nudgesEnabled: boolean;
  updatedAt: string | null;
  /** False before migration 65 (the switches can't be saved yet). */
  stored: boolean;
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabled: true,
  greeting: null,
  photosEnabled: true,
  offersEnabled: true,
  orderHelpEnabled: true,
  nudgesEnabled: true,
  updatedAt: null,
  stored: false,
};

type Row = {
  enabled: boolean | null;
  greeting: string | null;
  photos_enabled: boolean | null;
  offers_enabled: boolean | null;
  order_help_enabled: boolean | null;
  nudges_enabled: boolean | null;
  updated_at: string | null;
};

export function shapeAgentSettings(data: unknown): AgentSettings | null {
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined | null;
  if (!row || typeof row !== "object") return null;
  return {
    enabled: row.enabled !== false,
    greeting: typeof row.greeting === "string" && row.greeting.trim() ? row.greeting : null,
    photosEnabled: row.photos_enabled !== false,
    offersEnabled: row.offers_enabled !== false,
    orderHelpEnabled: row.order_help_enabled !== false,
    nudgesEnabled: row.nudges_enabled !== false,
    updatedAt: row.updated_at ?? null,
    stored: true,
  };
}

/** A fresh read, for the admin page. `missing` when migration 65 hasn't run. */
export async function readAgentSettingsFresh(
  supabase: SupabaseClient
): Promise<{ settings: AgentSettings; missing: boolean; failed: boolean }> {
  const { data, error } = await supabase.rpc("get_agent_settings");
  if (error) {
    return { settings: DEFAULT_AGENT_SETTINGS, missing: isMissingFunction(error), failed: !isMissingFunction(error) };
  }
  return { settings: shapeAgentSettings(data) ?? DEFAULT_AGENT_SETTINGS, missing: false, failed: false };
}

// The shop asks on every page view and every chat turn; a few seconds of
// memory per server instance keeps that to one small read, and an owner's
// switch still takes effect within moments.
const TTL_MS = 10_000;
let cached: { at: number; value: AgentSettings } | null = null;

export async function readAgentSettings(supabase: SupabaseClient): Promise<AgentSettings> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const { settings } = await readAgentSettingsFresh(supabase);
  cached = { at: now, value: settings };
  return settings;
}

/** After the owner saves, this instance forgets its copy at once. */
export function forgetAgentSettings(): void {
  cached = null;
}
