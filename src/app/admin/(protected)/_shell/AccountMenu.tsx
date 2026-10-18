"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useSignOut } from "./useSignOut";

/** The signed-in admin, with Sign out. On phones Sign out also lives under More. */
export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const signOut = useSignOut();
  const wrapper = useRef<HTMLDivElement>(null);
  const initial = (email.trim()[0] ?? "A").toUpperCase();

  // Close when clicking anywhere else or pressing Esc.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${email}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-[14px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {initial}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-[13px] text-neutral-500">{email}</p>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await signOut();
            }}
            className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 text-neutral-500" aria-hidden />
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
