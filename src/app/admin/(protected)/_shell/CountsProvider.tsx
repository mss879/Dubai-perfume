"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AdminCounts } from "../../_lib/counts";
import { useToast } from "../../_ui/Toast";

/**
 * Keeps the badges current without a page reload: the server's reading comes
 * in with each render, and a light poll (counts only) runs once a minute while
 * the admin tab is visible, and again whenever it regains focus. The newer of
 * the two readings wins. A new order to accept announces itself and refreshes
 * Today and Orders so it appears in the list.
 */

const CountsContext = createContext<AdminCounts | null>(null);

const POLL_MS = 60_000;

export function CountsProvider({ initial, children }: { initial: AdminCounts; children: ReactNode }) {
  const [polled, setPolled] = useState<AdminCounts | null>(null);
  const counts = polled && polled.at > initial.at ? polled : initial;

  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  // The poll reads these between renders; refs keep it from re-subscribing.
  const latest = useRef(counts);
  const currentPath = useRef(pathname);
  useEffect(() => {
    latest.current = counts;
    currentPath.current = pathname;
  });

  useEffect(() => {
    let stopped = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch("/api/admin/counts", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as AdminCounts;
        if (stopped || typeof next?.at !== "number") return;

        const before = latest.current;
        setPolled(next);

        if (next.accept > before.accept) {
          const added = next.accept - before.accept;
          toast(added === 1 ? "A new order is waiting to be accepted." : `${added} new orders are waiting to be accepted.`, "info");
          const path = currentPath.current;
          if (path === "/admin" || path.startsWith("/admin/orders")) router.refresh();
        }
      } catch {
        // Offline for a moment: the next tick tries again.
      } finally {
        inFlight = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };

    const timer = window.setInterval(() => void tick(), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router, toast]);

  return <CountsContext.Provider value={counts}>{children}</CountsContext.Provider>;
}

export function useCounts(): AdminCounts {
  const counts = useContext(CountsContext);
  if (!counts) throw new Error("useCounts must be used inside <CountsProvider>.");
  return counts;
}
