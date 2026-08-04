import "server-only";

/**
 * PostgREST reports a missing SECURITY DEFINER function as PGRST202 rather
 * than a database fault. Every trusted write in this release goes through such
 * a function, so telling the two apart turns "500, no idea" into "the
 * migrations have not been applied yet" — the single most likely cause of a
 * fresh deployment misbehaving.
 */
export function isMissingFunction(error: {
  code?: string | null;
  message?: string | null;
} | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  return /Could not find the function|does not exist/i.test(error.message ?? "");
}

export const MIGRATIONS_PENDING_MESSAGE =
  "This feature is not available yet (database migrations 38–42 have not been applied).";
