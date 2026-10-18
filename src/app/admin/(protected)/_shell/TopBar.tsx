import Form from "next/form";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import type { AdminLockState } from "../../../lib/site-lock-admin";
import { cn } from "../../_ui/cn";
import { AccountMenu } from "./AccountMenu";

/** Search, whether the shop is open, a way to the shop, and the account. */
export function TopBar({ email, lock }: { email: string; lock: AdminLockState | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur print:hidden">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Link
          href="/admin"
          className="flex shrink-0 items-baseline gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <span className="text-[19px] font-semibold text-neutral-900" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Gharib
          </span>
          <span className="text-[14px] font-medium text-neutral-400">Admin</span>
        </Link>

        <Form action="/admin/orders" role="search" className="ml-2 hidden max-w-md flex-1 md:block lg:ml-10">
          <label htmlFor="admin-order-search" className="sr-only">
            Search orders
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              id="admin-order-search"
              name="q"
              type="search"
              autoComplete="off"
              placeholder="Search orders: number, name, phone or email"
              className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>
        </Form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {lock ? <StoreStatusPill locked={lock.effectiveLocked} /> : null}
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 sm:inline-flex"
          >
            View shop
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          <AccountMenu email={email} />
        </div>
      </div>
    </header>
  );
}

/** Whether customers can see the shop right now; tap to change it in Settings. */
function StoreStatusPill({ locked }: { locked: boolean }) {
  return (
    <Link
      href="/admin/settings#store-status"
      title={locked ? "Customers see the 'Launching soon' page" : "Customers can browse and order"}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset",
        locked ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-emerald-50 text-emerald-900 ring-emerald-200"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", locked ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
      {locked ? "Shop locked" : "Shop live"}
    </Link>
  );
}
