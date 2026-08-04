"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientSafeSupabase } from "./supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Cookie-backed browser client so the server (proxy, server components, route
 * handlers) can see the auth session. Falls back to the localStorage mock when
 * Supabase env vars are absent (dev sandbox only — the mock refuses to run in
 * production builds).
 */
export function getBrowserSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return clientSafeSupabase;
  }
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}
