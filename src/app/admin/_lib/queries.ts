import "server-only";
import { cache } from "react";
import { createSessionSupabase } from "../../lib/supabase-server";
import { readAdminLockState, type AdminLockState } from "../../lib/site-lock-admin";
import { readCounts, type AdminCounts } from "./counts";

/**
 * Server-side reads for the admin, always through the signed-in admin's own
 * session so the database's admin policies decide what comes back. Each is
 * cached per request: the layout and the page share one round-trip.
 */

export const loadCounts = cache(async (): Promise<AdminCounts> => {
  const supabase = await createSessionSupabase();
  return readCounts(supabase);
});

export const loadLockState = cache(async (): Promise<AdminLockState | null> => {
  const supabase = await createSessionSupabase();
  return readAdminLockState(supabase);
});
