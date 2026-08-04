"use client";

import { useCurrency } from "../lib/currency";
import {
  FREE_SHIPPING_THRESHOLD_AED,
  amountToFreeShipping,
} from "../lib/shipping";

/**
 * How close the bag is to complimentary delivery.
 *
 * With the threshold at AED 300 and most bottles at AED 199, nearly every
 * single-bottle bag sits just under the line — so this is the one place a
 * shopper is most likely to add a second. It states the gap in money, because
 * "AED 101 away" is actionable and "you are 66% of the way" is not.
 *
 * Everything comes from lib/shipping, which mirrors place_order() in the
 * database — the bar can never promise a threshold checkout does not honour.
 *
 * The figures run through the shopper's display currency like every other
 * price on the site; the threshold itself is stored and charged in AED.
 */

const HAIRLINE = "rgba(0,0,0,0.12)";

export default function FreeDeliveryProgress({
  subtotalAed,
  className = "",
}: {
  subtotalAed: number;
  className?: string;
}) {
  const { format } = useCurrency();

  // An empty bag gets nothing: "add AED 300 for free delivery" on a bag with
  // nothing in it is noise, not a nudge.
  if (subtotalAed <= 0) return null;

  const remaining = amountToFreeShipping(subtotalAed);
  const qualified = remaining <= 0;
  const progress = Math.max(
    0,
    Math.min(100, (subtotalAed / FREE_SHIPPING_THRESHOLD_AED) * 100)
  );

  return (
    <div className={className}>
      <p className="text-[12px] font-light leading-[1.7] text-[#646464]">
        {qualified ? (
          <span className="text-black">
            Your delivery is complimentary.
          </span>
        ) : (
          <>
            Add{" "}
            <span className="text-black">{format(remaining)}</span> more for complimentary
            delivery.
          </>
        )}
      </p>

      {/* Presentational only — the sentence above already carries the meaning,
          so the track is hidden from assistive technology rather than
          duplicated into it. */}
      <div
        aria-hidden="true"
        className="mt-3 h-px w-full overflow-hidden"
        style={{ background: HAIRLINE }}
      >
        <div
          className="h-full bg-black transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
