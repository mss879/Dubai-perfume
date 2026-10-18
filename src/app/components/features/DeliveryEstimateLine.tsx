"use client";

import { useFeature } from "../StoreFeaturesProvider";
import { deliverySentence, estimateDelivery } from "../../lib/delivery-estimate";
import { useMinuteClock } from "./useMinuteClock";

/**
 * The delivery estimate (Admin → Delivery estimate), worked out in the
 * browser from the owner's cut-off and days, to the minute. Nothing renders
 * on the server, so the countdown never mismatches.
 */
export default function DeliveryEstimateLine({
  place,
  className = "",
  fallback = null,
}: {
  place: "product" | "checkout";
  className?: string;
  /** What to show when the estimate is off. */
  fallback?: React.ReactNode;
}) {
  const settings = useFeature("delivery_estimate");
  const now = useMinuteClock();
  if (!settings || (place === "product" && settings.show_on_product === false) || (place === "checkout" && settings.show_on_checkout === false)) {
    return <>{fallback}</>;
  }
  if (now === null) return <>{fallback}</>;
  const estimate = estimateDelivery(now, {
    cutoff_hour: Number(settings.cutoff_hour) || 0,
    closed_days: Array.isArray(settings.closed_days) ? (settings.closed_days as number[]) : [],
    holidays: Array.isArray(settings.holidays) ? (settings.holidays as string[]) : [],
    days_min: Number(settings.days_min) || 0,
    days_max: Number(settings.days_max) || 0,
  });
  return <p className={className}>{deliverySentence(estimate)}</p>;
}
