"use client";

import { useSyncExternalStore } from "react";

/** The time to the minute, on the client only (null while rendering on the server, so nothing mismatches). */
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}

export function useMinuteClock(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null
  );
}
