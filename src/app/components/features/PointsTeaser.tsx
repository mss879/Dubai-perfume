"use client";

import { useFeature } from "../StoreFeaturesProvider";

/** "Earn 230 Gharib Rewards points" on a product page (Admin → Loyalty points). */
export default function PointsTeaser({ priceAed, className = "" }: { priceAed: number; className?: string }) {
  const settings = useFeature("loyalty");
  if (!settings || settings.show_on_product === false) return null;
  const every = Number(settings.earn_per_aed) || 1;
  const points = Math.floor(priceAed / every) * (Number(settings.earn_points) || 0);
  if (points <= 0) return null;
  return (
    <p className={`text-[13px] font-light text-[#646464] ${className}`}>
      Earn <span className="text-black">{points.toLocaleString("en-AE")} points</span> with {String(settings.program_name || "Gharib Rewards")}.
    </p>
  );
}
