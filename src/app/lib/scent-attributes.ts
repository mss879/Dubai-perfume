/**
 * The shop's filter vocabulary (migration 70's product columns). The values
 * are what the database accepts (products_growth_attributes_check); the
 * labels are what shoppers and the owner read.
 */

export const STRENGTHS = [
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "strong", label: "Strong" },
  { value: "intense", label: "Intense" },
] as const;

export const LONGEVITY = [
  { value: "short", label: "A few hours" },
  { value: "moderate", label: "Half a day" },
  { value: "long", label: "All day" },
  { value: "very_long", label: "Into the next day" },
] as const;

export const SEASONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "autumn", label: "Autumn" },
  { value: "winter", label: "Winter" },
] as const;

export const OCCASIONS = [
  { value: "everyday", label: "Every day" },
  { value: "office", label: "Office" },
  { value: "evening", label: "Evening" },
  { value: "date", label: "Date night" },
  { value: "special", label: "Special occasions" },
  { value: "travel", label: "Travel" },
] as const;

export const STRENGTH_VALUES: readonly string[] = STRENGTHS.map((s) => s.value);
export const LONGEVITY_VALUES: readonly string[] = LONGEVITY.map((s) => s.value);
export const SEASON_VALUES: readonly string[] = SEASONS.map((s) => s.value);
export const OCCASION_VALUES: readonly string[] = OCCASIONS.map((s) => s.value);

export function labelFor(list: readonly { value: string; label: string }[], value: string | null | undefined): string | null {
  return list.find((i) => i.value === value)?.label ?? null;
}
