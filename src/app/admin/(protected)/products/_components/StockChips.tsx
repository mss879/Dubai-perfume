"use client";

import { useState } from "react";
import { cn } from "../../../_ui/cn";
import StockDialog, { type StockTarget } from "./StockDialog";

type Chip = { size: string; level: number | null; threshold: number | null };

/** One chip per size; tapping one opens its stock dialog. */
export default function StockChips({
  productId,
  productName,
  chips,
  editable,
}: {
  productId: number;
  productName: string;
  chips: Chip[];
  editable: boolean;
}) {
  const [target, setTarget] = useState<StockTarget | null>(null);

  return (
    <>
      <ul className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const out = chip.level !== null && chip.level <= 0;
          const low = chip.level !== null && !out && chip.level <= (chip.threshold ?? 5);
          const label = chip.level === null ? "always" : out ? "sold out" : String(chip.level);
          return (
            <li key={chip.size}>
              <button
                type="button"
                disabled={!editable}
                onClick={() => setTarget({ productId, productName, size: chip.size, level: chip.level, threshold: chip.threshold })}
                title={chip.level === null ? "Not tracked: always available" : `${chip.level} in stock`}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default",
                  out
                    ? "bg-red-50 text-red-800 ring-red-200 enabled:hover:bg-red-100"
                    : low
                      ? "bg-amber-50 text-amber-900 ring-amber-200 enabled:hover:bg-amber-100"
                      : chip.level === null
                        ? "bg-white text-neutral-500 ring-neutral-200 enabled:hover:bg-neutral-50"
                        : "bg-emerald-50 text-emerald-900 ring-emerald-200 enabled:hover:bg-emerald-100"
                )}
              >
                <span className="text-neutral-900/70">{chip.size}</span>
                <span className="tabular-nums">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {target ? <StockDialog key={`${target.size}-${target.level}`} target={target} onClose={() => setTarget(null)} /> : null}
    </>
  );
}
