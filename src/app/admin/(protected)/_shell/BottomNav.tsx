"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, LogOut, Menu, X } from "lucide-react";
import { cn } from "../../_ui/cn";
import { AdminNav, badgeFor } from "./AdminNav";
import { useCounts } from "./CountsProvider";
import { NAV_ICONS } from "./icons";
import { PINNED, isActive } from "./nav-model";
import { useSignOut } from "./useSignOut";

/**
 * The phone's navigation: Today, Orders and Products always one tap away at
 * the bottom of the screen, everything else behind "More".
 */
export function BottomNav({ email }: { email: string }) {
  const pathname = usePathname();
  const counts = useCounts();
  const [moreOpen, setMoreOpen] = useState(false);
  const onPinned = PINNED.some((item) => isActive(pathname, item));

  return (
    <>
      <nav
        aria-label="Admin shortcuts"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
      >
        <ul className="grid grid-cols-4">
          {PINNED.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = isActive(pathname, item);
            const badge = badgeFor(item, counts);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-medium",
                    active ? "text-neutral-900" : "text-neutral-500"
                  )}
                >
                  <span className="relative">
                    <Icon className="h-6 w-6" aria-hidden />
                    {badge.count > 0 ? (
                      <span
                        aria-label={badge.label}
                        className={cn(
                          "absolute -right-3 -top-1.5 min-w-[1.25rem] rounded-full px-1 text-center text-[11px] font-bold leading-5 text-white",
                          badge.tone === "red" ? "bg-red-600" : "bg-amber-500"
                        )}
                      >
                        {badge.count > 99 ? "99+" : badge.count}
                      </span>
                    ) : null}
                  </span>
                  {item.label}
                  {active ? <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-neutral-900" aria-hidden /> : null}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[12px] font-medium",
                !onPinned ? "text-neutral-900" : "text-neutral-500"
              )}
            >
              <span className="relative">
                <Menu className="h-6 w-6" aria-hidden />
                {counts.messages > 0 ? (
                  <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" aria-label="Unanswered messages" />
                ) : null}
              </span>
              More
              {!onPinned ? <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-neutral-900" aria-hidden /> : null}
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} email={email} />
    </>
  );
}

function MoreSheet({ open, onClose, email }: { open: boolean; onClose: () => void; email: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const signOut = useSignOut();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="More"
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="mb-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-2xl border-0 bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-neutral-900/40 lg:hidden"
    >
      {open ? (
        <div className="flex flex-col pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <p className="text-[16px] font-semibold">More</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-2 rounded-lg p-2 text-neutral-500 hover:text-neutral-900"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-3 py-4">
            {/* Tapping a link closes the sheet as the page changes. */}
            <AdminNav includePinned={false} onNavigate={onClose} />
            <div className="mt-4 flex flex-col gap-1 border-t border-neutral-200 pt-4">
              <a
                href="/"
                target="_blank"
                rel="noopener"
                className="flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-neutral-600 hover:bg-neutral-50"
              >
                <ExternalLink className="h-[18px] w-[18px] text-neutral-400" aria-hidden />
                View shop
              </a>
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex h-11 items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium text-neutral-600 hover:bg-neutral-50"
              >
                <LogOut className="h-[18px] w-[18px] text-neutral-400" aria-hidden />
                Sign out
                <span className="ml-auto truncate text-[13px] font-normal text-neutral-400">{email}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
