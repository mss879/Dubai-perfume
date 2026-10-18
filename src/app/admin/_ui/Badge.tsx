import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * One colour per meaning, used everywhere:
 * amber = to do / low, violet = packed, sky = on its way, emerald = done,
 * red = problem / out, blue = accepted, neutral = cash on delivery / closed.
 */
export type Tone = "neutral" | "amber" | "violet" | "sky" | "emerald" | "red" | "blue";

const TONES: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
  sky: "bg-sky-50 text-sky-800 ring-sky-200",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-blue-50 text-blue-800 ring-blue-200",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-neutral-400",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset",
        TONES[tone],
        className
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** A small number in the navigation. Hidden at zero. */
export function CountPill({ count, tone = "neutral", label }: { count: number; tone?: Tone; label?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[12px] font-semibold leading-5",
        tone === "red" ? "bg-red-600 text-white" : tone === "amber" ? "bg-amber-500 text-white" : "bg-neutral-900 text-white"
      )}
      aria-label={label}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
