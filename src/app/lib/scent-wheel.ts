/**
 * The fragrance wheel, and the axes a composition is read on.
 *
 * Deliberately tiny and dependency-free: BOTH the server (which derives a
 * profile for every product from its notes) and the browser (which scores the
 * shopper's answers against those profiles) import this. The heavy part — the
 * 260-note lexicon — lives in scent-lexicon.ts and never reaches the client.
 *
 * ── Why a wheel rather than four families ────────────────────────────────────
 *
 * The catalogue stores `olfactory_group`, which has exactly four values, and
 * that is too coarse to recommend on: 50 of 138 products are "Floral & Sweet",
 * which lumps a tuberose soliflore in with a praline gourmand.
 *
 * The product descriptions, however, carry a much finer reading — "resinous
 * amber", "oud-led woody", "crisp citrus", "marine-fresh" and so on, fourteen
 * values in all, and they nest perfectly inside the four groups. Those fourteen
 * map onto Michael Edwards' fragrance wheel, whose whole point is that
 * neighbouring families share olfactory character and families opposite each
 * other do not. So they are laid out here in wheel order, and similarity is
 * measured as distance AROUND the circle.
 *
 * That is what lets the finder answer "you said wood and oud, and we have run
 * out of those" with a smoky leather rather than with a fruity floral.
 *
 * Wheel order follows Edwards' 2010 revision (Floral → Soft Floral → Floral
 * Amber → Soft Amber → Amber → Woody Amber → Mossy Woods → Dry Woods →
 * Aromatic → Citrus → Water → Green → Fruity → back to Floral), with "Oriental"
 * read as "Amber" per his 2021 renaming.
 */

/** The six axes a composition is read on. Each runs 0–10. */
export const AXES = ["fresh", "floral", "sweet", "amber", "woody", "spice"] as const;
export type Axis = (typeof AXES)[number];

/** What each axis is called where a shopper can see it. */
export const AXIS_LABELS: Record<Axis, string> = {
  fresh: "Fresh",
  floral: "Floral",
  sweet: "Sweet",
  amber: "Amber",
  woody: "Woody",
  spice: "Spice",
};

export type AxisScores = Record<Axis, number>;

/**
 * A composition, read.
 *
 * `wheel` is an index into WHEEL_ORDER. `intensity` is how loudly it carries
 * (0 = skin scent, 10 = fills a room). `endurance` is how well it survives Gulf
 * heat, which is NOT the same as intensity — see scent-lexicon.ts.
 */
export type ScentProfile = AxisScores & {
  wheel: number;
  intensity: number;
  endurance: number;
};

export type WheelFamily = {
  /** The sub-style as it appears in the product descriptions. */
  key: string;
  /** How the finder says it to a shopper. */
  label: string;
};

/**
 * The fourteen positions, in wheel order. Index IS the position, and the array
 * wraps — position 13 is adjacent to position 0.
 */
export const WHEEL_ORDER: WheelFamily[] = [
  { key: "floral", label: "Florals" },
  { key: "floral-gourmand", label: "Sweetened florals" },
  { key: "gourmand", label: "Gourmands" },
  { key: "warm amber", label: "Soft amber" },
  { key: "resinous amber", label: "Resinous amber" },
  { key: "spiced amber", label: "Spiced amber" },
  { key: "oud-led woody", label: "Oud woods" },
  { key: "smoky woody", label: "Smoky woods" },
  { key: "woody-leather", label: "Leathered woods" },
  { key: "woody", label: "Dry woods" },
  { key: "aromatic-fresh", label: "Aromatic freshness" },
  { key: "crisp citrus", label: "Citrus" },
  { key: "marine-fresh", label: "Sea air" },
  { key: "fruity-floral", label: "Fruity florals" },
];

export const WHEEL_SIZE = WHEEL_ORDER.length;

const WHEEL_INDEX = new Map(WHEEL_ORDER.map((f, i) => [f.key, i]));

/** The wheel position of a sub-style key, or null if it is not one of ours. */
export function wheelIndexOf(key: string): number | null {
  return WHEEL_INDEX.get(key.toLowerCase().trim()) ?? null;
}

/** The label for a wheel position. */
export function wheelLabel(index: number): string {
  return WHEEL_ORDER[((index % WHEEL_SIZE) + WHEEL_SIZE) % WHEEL_SIZE].label;
}

/**
 * Steps around the circle between two positions — never more than half the
 * wheel, because going the short way round is the whole idea.
 */
export function wheelDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % WHEEL_SIZE;
  return Math.min(raw, WHEEL_SIZE - raw);
}

/**
 * 1 at the same position, falling to 0 at the opposite side of the wheel.
 *
 * Squared so that immediate neighbours still score highly (a shopper who asked
 * for citrus is well served by sea air) while a quarter-turn away drops off
 * sharply (they are not served by a gourmand).
 */
export function wheelAffinity(position: number, target: number): number {
  const maxDistance = WHEEL_SIZE / 2;
  const closeness = 1 - wheelDistance(position, target) / maxDistance;
  return closeness * closeness;
}

export const EMPTY_AXES: AxisScores = {
  fresh: 0,
  floral: 0,
  sweet: 0,
  amber: 0,
  woody: 0,
  spice: 0,
};
