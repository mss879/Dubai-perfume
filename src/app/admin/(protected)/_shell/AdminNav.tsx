"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CountPill, type Tone } from "../../_ui/Badge";
import { cn } from "../../_ui/cn";
import { useCounts } from "./CountsProvider";
import { NAV_ICONS } from "./icons";
import { GROUPS, PINNED, SETTINGS_ITEM, isActive, type NavItem } from "./nav-model";
import type { AdminCounts } from "../../_lib/counts";

/** A spinner on the link being opened, so a slow page never feels ignored. */
function PendingHint() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-neutral-400" aria-hidden /> : null;
}

export function badgeFor(item: NavItem, counts: AdminCounts): { count: number; tone: Tone; label: string } {
  switch (item.badge) {
    case "needsAction":
      return { count: counts.needsAction, tone: "amber", label: `${counts.needsAction} orders need you` };
    case "stockAlerts":
      return {
        count: counts.stockAlerts,
        tone: counts.outOfStock > 0 ? "red" : "amber",
        label: `${counts.stockAlerts} sizes low or out of stock`,
      };
    case "messages":
      return { count: counts.messages, tone: "neutral", label: `${counts.messages} unanswered messages` };
    default:
      return { count: 0, tone: "neutral", label: "" };
  }
}

export function NavItemLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const counts = useCounts();
  const Icon = NAV_ICONS[item.icon];
  const badge = badgeFor(item, counts);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors lg:h-10 lg:text-[14px]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
        active ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
      )}
    >
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0", active ? "text-neutral-900" : "text-neutral-400 group-hover:text-neutral-600")}
        aria-hidden
      />
      <span className={cn("truncate", active && "font-semibold")}>{item.label}</span>
      <PendingHint />
      <CountPill count={badge.count} tone={badge.tone} label={badge.label} />
    </Link>
  );
}

/** The laptop sidebar (and the body of the phone's "More" sheet). */
export function AdminNav({ onNavigate, includePinned = true }: { onNavigate?: () => void; includePinned?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {includePinned ? (
        <ul className="flex flex-col gap-0.5">
          {PINNED.map((item) => (
            <li key={item.href}>
              <NavItemLink item={item} active={isActive(pathname, item)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      ) : null}

      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1 text-[13px] font-semibold text-neutral-400">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavItemLink item={item} active={isActive(pathname, item)} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      <ul className="flex flex-col gap-0.5 border-t border-neutral-200 pt-4">
        <li>
          <NavItemLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM)} onNavigate={onNavigate} />
        </li>
      </ul>
    </nav>
  );
}
