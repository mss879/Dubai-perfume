import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionSupabase, isSupabaseConfigured } from "./supabase-server";

export type AdminIdentity = {
  id: string;
  email: string;
};

/**
 * Authoritative admin check. The ONLY thing that grants admin is the
 * `customers.is_admin` column, read server-side with the viewer's own session
 * (so RLS applies). Email substrings, `user_metadata`, and localStorage roles
 * are deliberately ignored — all three were client-forgeable.
 *
 * Wrapped in `cache()` so the layout and the page share one round-trip per
 * request while both still performing the check (a layout alone is not
 * re-rendered on every navigation, so it cannot be the only gate).
 */
export const getAdminIdentity = cache(async (): Promise<AdminIdentity | null> => {
  if (!isSupabaseConfigured) return null;

  const supabase = await createSessionSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("customers")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.is_admin) return null;

  return { id: user.id, email: user.email ?? "" };
});

/**
 * Gate for admin server components. Redirects to the admin sign-in when the
 * viewer is not a verified admin, so no admin markup is ever sent.
 */
export async function requireAdmin(redirectTo = "/admin"): Promise<AdminIdentity> {
  const admin = await getAdminIdentity();
  if (!admin) {
    redirect(`/admin/signin?redirect=${encodeURIComponent(redirectTo)}`);
  }
  return admin;
}
