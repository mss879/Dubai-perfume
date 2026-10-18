import type { ReactNode } from "react";
import type { AdminLockState } from "../../../lib/site-lock-admin";
import { AdminNav } from "./AdminNav";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

/**
 * The admin's frame: top bar, a sidebar on laptops, a bottom bar on phones.
 * Light and readable throughout (15px body text, nothing under 12px).
 */
export function AdminFrame({
  email,
  lock,
  children,
}: {
  email: string;
  lock: AdminLockState | null;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-dvh w-full bg-neutral-50 text-[15px] leading-normal text-neutral-900"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg"
      >
        Skip to content
      </a>
      <TopBar email={email} lock={lock} />
      <div className="flex w-full">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white px-3 py-5 lg:block print:hidden">
          <AdminNav />
        </aside>
        <main
          id="admin-main"
          className="min-w-0 flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8 print:p-0"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <BottomNav email={email} />
    </div>
  );
}
