import Link from "next/link";
import { cn } from "./cn";

export type LinkTab = {
  key: string;
  label: string;
  href: string;
  count?: number;
  /** Draws attention to the count (e.g. orders waiting). */
  urgent?: boolean;
};

/** Tabs that are plain links, so each view has its own URL (back button, bookmarks). */
export function LinkTabs({ tabs, active, label }: { tabs: LinkTab[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:hidden">
      <ul className="flex min-w-max gap-1 border-b border-neutral-200">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center gap-2 border-b-2 px-3 text-[14px] font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600",
                  isActive
                    ? "border-neutral-900 text-neutral-900"
                    : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900"
                )}
              >
                {tab.label}
                {typeof tab.count === "number" ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[12px] font-semibold leading-5",
                      tab.urgent && tab.count > 0
                        ? "bg-amber-100 text-amber-900"
                        : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
