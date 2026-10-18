import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The admin's view of the site lock (migration 52's admin_site_lock_state),
 * shared by /api/admin/site-lock and the admin pages that render it on the
 * server. Never includes the PIN or the bypass fingerprint.
 */

export type AdminLockState = {
  locked: boolean;
  /** Locked right now (a finished countdown with auto-unlock reads as open). */
  effectiveLocked: boolean;
  headline: string;
  message: string;
  launchAt: string | null;
  autoUnlock: boolean;
  hasPin: boolean;
  updatedAt: string | null;
  serverNow: string;
};

export function shapeLockState(row: Record<string, unknown> | undefined | null): AdminLockState | null {
  if (!row) return null;
  return {
    locked: row.locked === true,
    effectiveLocked: row.effective_locked === true,
    headline: String(row.headline ?? ""),
    message: String(row.message ?? ""),
    launchAt: (row.launch_at as string | null) ?? null,
    autoUnlock: row.auto_unlock !== false,
    hasPin: row.has_pin === true,
    updatedAt: (row.updated_at as string | null) ?? null,
    serverNow: (row.server_now as string | null) ?? new Date().toISOString(),
  };
}

/** The lock state through the admin's session, or null if it can't be read. */
export async function readAdminLockState(supabase: SupabaseClient): Promise<AdminLockState | null> {
  const { data, error } = await supabase.rpc("admin_site_lock_state");
  if (error) return null;
  return shapeLockState(Array.isArray(data) ? data[0] : data);
}
