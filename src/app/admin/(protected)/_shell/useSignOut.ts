"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "../../../lib/supabase-browser";

export function useSignOut() {
  const router = useRouter();
  return useCallback(async () => {
    await getBrowserSupabase().auth.signOut();
    try {
      // Legacy identity mirrors written by older builds: never let one survive.
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userId");
    } catch {
      // Storage blocked (private mode): nothing to clear.
    }
    router.push("/admin/signin");
    router.refresh();
  }, [router]);
}
