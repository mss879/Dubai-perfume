import {
  AXES,
  EMPTY_AXES,
  wheelAffinity,
  wheelIndexOf,
  wheelLabel,
  type Axis,
  type AxisScores,
  type ScentProfile,
} from "./scent-wheel";

/**
 * The fragrance finder — the questions, and the matching.
 *
 * Runs in the BROWSER, against profiles the server derived (see
 * scent-lexicon.ts). That is why nothing here imports the note lexicon: the
 * shopper gets an answer the instant they tap, and the 260-note table stays on
 * the server where it belongs.
 *
 * ── What the questions are actually asking ───────────────────────────────────
 *
 * Five questions, each one measuring something a perfumer would recognise
 * rather than something that merely sounds like a personality quiz:
 *
 *   1. recipient  — the gender register the composition is built on
 *   2. character  — position on the fragrance wheel. The heaviest question.
 *   3. occasion   — what sillage is socially right, and which register suits
 *   4. climate    — how the composition will behave in Gulf heat
 *   5. avoid      — a negative filter, which is the single most effective
 *                   question in any recommender and the one most often left out
 *
 * There used to be a sixth — "how should it announce you?", a direct sillage
 * question. It was removed: the catalogue is Gulf-strength throughout (nothing
 * in stock reads below ~6/10 sillage), so its quietest answer was a promise the
 * stock could never keep. Sillage is still scored, negotiated from occasion and
 * climate, which is the part of the question the catalogue can actually honour.
 *
 * ── On the climate question ──────────────────────────────────────────────────
 *
 * This store sells in the UAE, where a fragrance decision is a thermal one. In
 * Gulf heat projection RISES while longevity FALLS: volatile citrus and aquatic
 * accords burn off in a couple of hours, while heavy amber, musk, sandalwood
 * and oud bases hold and bloom with body warmth. Humidity separately intensifies
 * sweet and spicy materials, which is why sweetness is penalised for summer
 * rather than rewarded. So summer wants a fresh TOP over a base with enough
 * weight to survive — not simply "the lightest thing we sell", which would be
 * gone before the shopper reached the car.
 */

export type QuestionId =
  | "recipient"
  | "character"
  | "occasion"
  | "climate"
  | "avoid";

/**
 * How one answer bends the search.
 *
 * Declarative rather than a callback so the whole model can be read in one
 * sitting, diffed, and argued with.
 */
type Lens = {
  /** Wheel sub-styles this answer is asking for, by relative pull. */
  wheelTargets?: { key: string; weight: number }[];
  /** Reward a product for scoring HIGH on an axis, scaled by the value given. */
  axisBonus?: Partial<Record<Axis, number>>;
  /** Punish a product for scoring high on an axis. */
  axisPenalty?: Partial<Record<Axis, number>>;
  /**
   * Materials this answer refuses outright, matched against the note names.
   *
   * The axis is a blunt instrument for some refusals. "No heavy oud" does not
   * mean "no woods" — cedar and patchouli are woody and perfectly welcome —
   * it means no agarwood. An axis penalty cannot make that distinction; a note
   * veto can, and it is what the shopper actually said.
   */
  noteVeto?: string[];
  /** The sillage being asked for, 0–10. Scored by distance. */
  intensity?: number;
  /** Reward compositions that survive heat. */
  enduranceBonus?: number;
  /** Gender register: how a men's / women's / shared composition is treated. */
  gender?: { men: number; women: number; unisex: number };
};

export type QuizOption = {
  value: string;
  label: string;
  /** The line under the label — what this means in plain words. */
  hint: string;
  lens: Lens;
};

export type QuizQuestion = {
  id: QuestionId;
  /** Spoken position, for the stepper. */
  ordinal: string;
  prompt: string;
  /** The quieter line under the prompt. Says why we are asking. */
  aside: string;
  options: QuizOption[];
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "recipient",
    ordinal: "One",
    prompt: "Who is it for?",
    aside: "So we know which register to compose on.",
    options: [
      {
        value: "her",
        label: "For her",
        hint: "A feminine register",
        lens: { gender: { women: 1, unisex: 0.55, men: -0.9 } },
      },
      {
        value: "him",
        label: "For him",
        hint: "A masculine register",
        lens: { gender: { men: 1, unisex: 0.55, women: -0.9 } },
      },
      {
        value: "anyone",
        label: "For anyone",
        hint: "Shared compositions, worn by both",
        lens: { gender: { unisex: 1, men: 0.35, women: 0.35 } },
      },
      {
        value: "gift",
        label: "A gift — I am not sure",
        hint: "We will keep to ground that suits most",
        // Shared compositions of moderate sillage are the safe gift: nothing
        // that presumes a register, nothing that overwhelms a stranger.
        lens: { gender: { unisex: 0.9, men: 0.45, women: 0.45 }, intensity: 6 },
      },
    ],
  },
  {
    id: "character",
    ordinal: "Two",
    prompt: "Which world draws you in?",
    aside: "The one question that decides most of the answer.",
    options: [
      {
        value: "citrus",
        label: "Citrus & sea air",
        hint: "Bergamot, lemon, salt, cool water",
        lens: {
          wheelTargets: [
            { key: "crisp citrus", weight: 1 },
            { key: "marine-fresh", weight: 0.9 },
            { key: "aromatic-fresh", weight: 0.5 },
          ],
          axisBonus: { fresh: 1 },
        },
      },
      {
        value: "aromatic",
        label: "Herbs & clean air",
        hint: "Lavender, sage, mint, green leaves",
        lens: {
          wheelTargets: [
            { key: "aromatic-fresh", weight: 1 },
            { key: "crisp citrus", weight: 0.6 },
            { key: "woody", weight: 0.5 },
          ],
          axisBonus: { fresh: 0.8 },
        },
      },
      {
        value: "floral",
        label: "Flowers",
        hint: "Rose, jasmine, orange blossom, tuberose",
        lens: {
          wheelTargets: [
            { key: "floral", weight: 1 },
            { key: "fruity-floral", weight: 0.8 },
            { key: "floral-gourmand", weight: 0.6 },
          ],
          axisBonus: { floral: 1 },
        },
      },
      {
        value: "sweet",
        label: "Sweet & edible",
        hint: "Vanilla, praline, caramel, ripe fruit",
        lens: {
          wheelTargets: [
            { key: "gourmand", weight: 1 },
            { key: "floral-gourmand", weight: 0.85 },
            { key: "warm amber", weight: 0.5 },
          ],
          axisBonus: { sweet: 1 },
        },
      },
      {
        value: "amber",
        label: "Amber, resin & spice",
        hint: "Saffron, incense, labdanum, cardamom",
        lens: {
          wheelTargets: [
            { key: "resinous amber", weight: 1 },
            { key: "spiced amber", weight: 0.95 },
            { key: "warm amber", weight: 0.7 },
          ],
          axisBonus: { amber: 0.8, spice: 0.6 },
        },
      },
      {
        value: "woody",
        label: "Wood, oud & smoke",
        hint: "Oud, sandalwood, leather, cedar",
        lens: {
          wheelTargets: [
            { key: "oud-led woody", weight: 1 },
            { key: "smoky woody", weight: 0.9 },
            { key: "woody-leather", weight: 0.85 },
            { key: "woody", weight: 0.8 },
          ],
          axisBonus: { woody: 1 },
        },
      },
    ],
  },
  {
    id: "occasion",
    ordinal: "Three",
    prompt: "When will it be worn?",
    aside: "How much room a scent may take is a question of where you are.",
    options: [
      {
        value: "everyday",
        label: "Every day",
        hint: "The office, the school run, the ordinary hours",
        // At conversation distance in a shared room, restraint is the whole
        // brief: clean citrus, soft florals, light woods, quiet musk.
        lens: { intensity: 4.5, axisBonus: { fresh: 0.5 }, axisPenalty: { sweet: 0.25 } },
      },
      {
        value: "evening",
        label: "After dark",
        hint: "Dinner, the long evening, company",
        lens: { intensity: 7, axisBonus: { amber: 0.5, woody: 0.45, spice: 0.3 } },
      },
      {
        value: "occasion",
        label: "Occasions",
        hint: "Weddings, Eid, the night that matters",
        // Oud is what the Gulf actually wears to a wedding, to Eid, to Friday
        // prayers. This is the one answer where more is the right answer.
        lens: {
          intensity: 8.5,
          axisBonus: { amber: 0.5, woody: 0.45, floral: 0.3, spice: 0.3 },
        },
      },
      {
        value: "weekend",
        label: "Weekends & travel",
        hint: "Daylight, the beach road, somewhere else",
        lens: { intensity: 5.5, axisBonus: { fresh: 0.6 } },
      },
    ],
  },
  {
    id: "climate",
    ordinal: "Four",
    prompt: "And in what weather?",
    aside: "Heat changes a fragrance more than any other thing you can control.",
    options: [
      {
        value: "summer",
        label: "The Gulf summer",
        hint: "Outdoors, 40°C and humid",
        // Fresh at the top so it is bearable, weight underneath so it is still
        // there an hour later, and sweetness held back because humidity turns
        // it cloying.
        lens: {
          axisBonus: { fresh: 0.9 },
          axisPenalty: { sweet: 0.5 },
          enduranceBonus: 0.45,
          intensity: 5,
        },
      },
      {
        value: "indoors",
        label: "Mostly indoors",
        hint: "Air-conditioned rooms, the car, the office",
        lens: { axisBonus: { floral: 0.25, amber: 0.25 }, intensity: 5.5 },
      },
      {
        value: "cooler",
        label: "The cooler months",
        hint: "Desert evenings, winter, travel abroad",
        lens: { axisBonus: { amber: 0.6, woody: 0.5, sweet: 0.45, spice: 0.35 } },
      },
      {
        value: "allyear",
        label: "All year round",
        hint: "One bottle that never feels wrong",
        // Rewards compositions that hold without shouting — the ones that work
        // in January and in July.
        lens: { enduranceBonus: 0.3, intensity: 6 },
      },
    ],
  },
  {
    id: "avoid",
    ordinal: "Five",
    prompt: "Anything you would rather avoid?",
    aside: "Knowing what you dislike narrows this faster than anything else.",
    options: [
      {
        value: "none",
        label: "Nothing in particular",
        hint: "Show me what fits",
        lens: {},
      },
      {
        value: "oud",
        label: "Heavy oud & smoke",
        hint: "Too dense, too serious",
        // The axis penalty softens the whole woody corner; the veto removes
        // agarwood and smoke outright. Cedar and vetiver survive both, which
        // is right — a dry cedar is not what anyone means by "heavy oud".
        lens: {
          axisPenalty: { woody: 0.8 },
          noteVeto: ["oud", "agarwood", "smoke", "cade oil", "tobacco", "leather"],
        },
      },
      {
        value: "sweetness",
        label: "Sweetness",
        hint: "No vanilla, no dessert",
        lens: { axisPenalty: { sweet: 1.2 } },
      },
      {
        value: "florals",
        label: "Big florals",
        hint: "Nothing powdery or bouquet-like",
        lens: { axisPenalty: { floral: 1.1 } },
      },
    ],
  },
];

export type QuizAnswers = Partial<Record<QuestionId, string>>;

/** What the browser needs per product. Derived on the server. */
export type ScoredProduct = {
  id: number;
  brand: string;
  name: string;
  price: number;
  image: string;
  sizes: string[];
  gender: "men" | "women" | "unisex";
  tagline: string;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  profile: ScentProfile;
  axisNotes: Partial<Record<Axis, string[]>>;
  isBestseller: boolean;
};

export type QuizMatch = {
  product: ScoredProduct;
  /** 0–100, for display. */
  match: number;
  /** The sentence under the name. */
  reason: string;
  /**
   * How to name this composition's family TO THIS SHOPPER.
   *
   * Usually the wheel label, but not when that would contradict what they said
   * to avoid — see explain(). The card must use this rather than the raw wheel
   * label, or the heading and the sentence beneath it disagree.
   */
  styleLabel: string;
  /** The notes named in the reason — highlighted in the pyramid. */
  highlighted: string[];
};

/* ── How much each question is allowed to decide ─────────────────────────── */

const WEIGHT = {
  wheel: 34,
  gender: 22,
  axisBonus: 16,
  intensity: 13,
  endurance: 6,
  penalty: 38,
} as const;

/** The largest score achievable, used to turn a raw total into a percentage. */
const MAX_SCORE =
  WEIGHT.wheel + WEIGHT.gender + WEIGHT.axisBonus + WEIGHT.intensity + WEIGHT.endurance;

/** Every lens the answers select, in question order. */
function lensesFor(answers: QuizAnswers): Lens[] {
  const lenses: Lens[] = [];
  for (const question of QUIZ_QUESTIONS) {
    const chosen = answers[question.id];
    if (!chosen) continue;
    const option = question.options.find((o) => o.value === chosen);
    if (option) lenses.push(option.lens);
  }
  return lenses;
}

/**
 * The shopper's own profile, as the finder reads it.
 *
 * Not used for matching — the lenses do that — but shown back to them on the
 * results screen and stored with the response, because "here is what we heard"
 * is what makes a recommendation feel earned rather than random.
 */
export function readerProfile(answers: QuizAnswers): AxisScores & { intensity: number } {
  const axes: AxisScores = { ...EMPTY_AXES };
  let intensity = 5;

  for (const lens of lensesFor(answers)) {
    for (const axis of AXES) {
      axes[axis] += (lens.axisBonus?.[axis] ?? 0) * 6;
      axes[axis] -= (lens.axisPenalty?.[axis] ?? 0) * 5;
    }
    if (lens.intensity !== undefined) intensity = (intensity + lens.intensity) / 2;
  }

  for (const axis of AXES) {
    axes[axis] = Math.max(0, Math.min(10, axes[axis] + 1.5));
  }
  return { ...axes, intensity };
}

/** Scores one product. Returns the raw total and what drove it. */
function score(product: ScoredProduct, lenses: Lens[]): { total: number; drivers: Axis[] } {
  const p = product.profile;

  let wheelPull = 0;
  let wheelWeight = 0;
  let bonusEarned = 0;
  let bonusAvailable = 0;
  let penalty = 0;
  let genderScore: number | null = null;
  const intensityTargets: number[] = [];
  let enduranceBonus = 0;
  const driverStrength: Partial<Record<Axis, number>> = {};

  for (const lens of lenses) {
    if (lens.wheelTargets) {
      for (const target of lens.wheelTargets) {
        const index = wheelIndexOf(target.key);
        if (index === null) continue;
        wheelPull += wheelAffinity(p.wheel, index) * target.weight;
        wheelWeight += target.weight;
      }
    }

    if (lens.gender) {
      genderScore = lens.gender[product.gender];
    }

    if (lens.axisBonus) {
      for (const axis of AXES) {
        const w = lens.axisBonus[axis];
        if (!w) continue;
        bonusAvailable += w;
        const earned = (p[axis] / 10) * w;
        bonusEarned += earned;
        driverStrength[axis] = (driverStrength[axis] ?? 0) + earned;
      }
    }

    if (lens.axisPenalty) {
      for (const axis of AXES) {
        const w = lens.axisPenalty[axis];
        if (!w) continue;
        // Only the upper half of an axis is punished: a trace of vanilla in a
        // woody composition is not "sweet", and treating it as such would strip
        // out half the catalogue for anyone who ticked "no sweetness".
        const excess = Math.max(0, p[axis] - 5) / 5;
        penalty += excess * w;
      }
    }

    if (lens.noteVeto) {
      const notes = [...product.topNotes, ...product.heartNotes, ...product.baseNotes]
        .join(" | ")
        .toLowerCase();
      if (lens.noteVeto.some((veto) => notes.includes(veto))) {
        // Counted alongside the axis penalty and then capped together, so a
        // vetoed material is decisive without being able to drive the total
        // arbitrarily negative.
        penalty += 1;
      }
    }

    if (lens.intensity !== undefined) intensityTargets.push(lens.intensity);
    if (lens.enduranceBonus) enduranceBonus += lens.enduranceBonus;
  }

  let total = 0;

  // 1. Wheel position — the largest single term.
  total += wheelWeight > 0 ? (wheelPull / wheelWeight) * WEIGHT.wheel : WEIGHT.wheel * 0.5;

  // 2. Register. A mismatch is a real penalty, not merely a missing bonus.
  if (genderScore !== null) {
    total += genderScore * WEIGHT.gender;
  } else {
    total += WEIGHT.gender * 0.5;
  }

  // 3. Character bonuses.
  total += bonusAvailable > 0 ? (bonusEarned / bonusAvailable) * WEIGHT.axisBonus : WEIGHT.axisBonus * 0.5;

  // 4. Sillage. Averaging the targets lets occasion and climate negotiate —
  //    "occasions" wants 8.5 and a Gulf summer wants 5, and the honest
  //    answer is somewhere between.
  if (intensityTargets.length > 0) {
    const target = intensityTargets.reduce((a, b) => a + b, 0) / intensityTargets.length;
    const closeness = 1 - Math.min(10, Math.abs(p.intensity - target)) / 10;
    total += closeness * closeness * WEIGHT.intensity;
  } else {
    total += WEIGHT.intensity * 0.5;
  }

  // 5. Survival in heat, only when an answer asked for it.
  if (enduranceBonus > 0) {
    total += Math.min(1, enduranceBonus) * (p.endurance / 10) * WEIGHT.endurance;
  }

  // 6. What they said to keep away from.
  total -= Math.min(1, penalty) * WEIGHT.penalty;

  const drivers = (Object.entries(driverStrength) as [Axis, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([axis]) => axis);

  return { total, drivers };
}

/* ── Saying why ──────────────────────────────────────────────────────────── */

const OCCASION_CLAUSE: Record<string, string> = {
  everyday: "restrained enough for a shared room",
  evening: "at its best after dark",
  occasion: "made to be noticed",
  weekend: "easy in daylight",
};

const CLIMATE_CLAUSE: Record<string, string> = {
  summer: "and it holds in the heat",
  indoors: "and it suits an air-conditioned room",
  cooler: "and it opens up in cooler air",
  allyear: "and it never feels out of season",
};

/** The axis each "avoid" answer is refusing, and the word that would jar. */
const AVOID_AXIS: Record<string, { axis: Axis; word: RegExp }> = {
  sweetness: { axis: "sweet", word: /sweet/i },
  oud: { axis: "woody", word: /oud|smok/i },
  florals: { axis: "floral", word: /floral/i },
};

/** A descriptor built from what the composition actually is, axis-first. */
function axisDescriptor(product: ScoredProduct, avoid?: Axis): string {
  const ranked = (AXES as readonly Axis[])
    .filter((a) => a !== avoid)
    .map((axis) => ({ axis, value: product.profile[axis] }))
    .sort((a, b) => b.value - a.value);

  const words: Record<Axis, string> = {
    fresh: "fresh",
    floral: "floral",
    sweet: "soft",
    amber: "amber",
    woody: "woody",
    spice: "spiced",
  };
  const lead = ranked[0];
  const second = ranked[1];
  if (!lead || lead.value < 2) return "a quiet composition";
  return second && second.value >= lead.value * 0.6
    ? `a ${words[second.axis]} ${words[lead.axis]} composition`
    : `a ${words[lead.axis]} composition`;
}

/** The sentence under the name. Every clause in it has to be true. */
function explain(
  product: ScoredProduct,
  drivers: Axis[],
  answers: QuizAnswers
): { reason: string; styleLabel: string; highlighted: string[] } {
  // The wheel label is the honest name for the family, but the catalogue is
  // thin in some corners — a shopper asking for florals is often best served
  // by the "sweetened florals" next door. Handing someone who ticked "no
  // sweetness" a thing called "sweetened florals" reads as though we were not
  // listening, even when the composition genuinely is not sweet. So where the
  // family name would contradict what they refused, describe it by what it
  // measures as instead. The product is unchanged; only the wording is.
  const avoided = answers.avoid ? AVOID_AXIS[answers.avoid] : undefined;
  const familyLabel = wheelLabel(product.profile.wheel).toLowerCase();
  const style =
    avoided && avoided.word.test(familyLabel)
      ? axisDescriptor(product, avoided.axis)
      : familyLabel;

  // Name the notes that carry what they actually asked for — but never a note
  // from the axis they refused. Telling someone who ticked "no sweetness" that
  // we chose this "for the vanilla" is worse than saying nothing.
  const named: string[] = [];
  for (const axis of drivers) {
    if (avoided && axis === avoided.axis) continue;
    for (const note of product.axisNotes[axis] ?? []) {
      if (!named.includes(note)) named.push(note);
      if (named.length >= 2) break;
    }
    if (named.length >= 2) break;
  }
  if (named.length === 0) {
    for (const axis of AXES) {
      if (avoided && axis === avoided.axis) continue;
      for (const note of product.axisNotes[axis] ?? []) {
        if (!named.includes(note)) named.push(note);
        if (named.length >= 2) break;
      }
      if (named.length >= 2) break;
    }
  }

  const parts: string[] = [];
  parts.push(named.length > 0 ? `${style} built on ${named.join(" and ")}` : style);

  const occasion = answers.occasion ? OCCASION_CLAUSE[answers.occasion] : undefined;
  if (occasion) parts.push(occasion);

  // The climate clause is only honest when the composition can back it up.
  const climate = answers.climate ? CLIMATE_CLAUSE[answers.climate] : undefined;
  const enduresHeat = product.profile.endurance >= 6;
  if (climate && (answers.climate !== "summer" || enduresHeat)) {
    parts.push(climate);
  }

  const sentence = parts.join(", ").replace(/^./, (c) => c.toUpperCase());
  // The card heading gets the same treatment as the sentence, so the two can
  // never disagree about what this composition is. "A fresh floral composition"
  // reads correctly in a sentence and clumsily as a heading, so the article and
  // the noun come off — the heading sits beside the house name as "Fresh floral".
  const styleLabel = style
    .replace(/^an?\s+/i, "")
    .replace(/\s+composition$/i, "")
    .replace(/^./, (c) => c.toUpperCase());
  return { reason: `${sentence}.`, styleLabel, highlighted: named };
}

/* ── Choosing the three ──────────────────────────────────────────────────── */

/**
 * The recommendations.
 *
 * Diversity is enforced deliberately. Three bottles from one line are three
 * versions of the same answer, and a shopper who dislikes the first will
 * dislike the other two — which is exactly the failure a finder exists to
 * prevent. So: at most two per house, and at most one per line (the catalogue
 * has 28 Hawas and 13 Club de Nuit, so without this the Hawas line would answer
 * every masculine question by itself).
 */
export function recommend(
  products: ScoredProduct[],
  answers: QuizAnswers,
  count = 3
): QuizMatch[] {
  const lenses = lensesFor(answers);
  if (products.length === 0) return [];

  const ranked = products
    .map((product) => {
      const { total, drivers } = score(product, lenses);
      return { product, total, drivers };
    })
    .sort((a, b) => b.total - a.total || a.product.id - b.product.id);

  const best = ranked[0].total;
  const chosen: typeof ranked = [];
  const perBrand = new Map<string, number>();
  const usedLines = new Set<string>();

  const take = (brandCap: number, lineCap: number) => {
    for (const entry of ranked) {
      if (chosen.length >= count) return;
      if (chosen.includes(entry)) continue;
      const brand = entry.product.brand.toUpperCase();
      const line = (entry.product.tagline || `${brand}:${entry.product.id}`).toUpperCase();
      if ((perBrand.get(brand) ?? 0) >= brandCap) continue;
      if (lineCap === 1 && usedLines.has(line)) continue;
      perBrand.set(brand, (perBrand.get(brand) ?? 0) + 1);
      usedLines.add(line);
      chosen.push(entry);
    }
  };

  take(2, 1); // the rule
  take(2, 99); // relax the line rule if the catalogue cannot fill three
  take(99, 99); // and the house rule, rather than return two

  return chosen.map((entry) => {
    const { reason, styleLabel, highlighted } = explain(entry.product, entry.drivers, answers);
    return {
      product: entry.product,
      // Shown as a percentage, so it is scaled against the best available match
      // rather than against a theoretical maximum nothing ever reaches. The
      // floor of 62 keeps a good third choice from reading as a poor one.
      match: Math.round(
        Math.max(62, Math.min(99, 62 + ((entry.total / Math.max(best, 1)) ** 3) * 37))
      ),
      reason,
      styleLabel,
      highlighted,
    };
  });
}

export { MAX_SCORE };

/** True once every question has been answered. */
export function isComplete(answers: QuizAnswers): boolean {
  return QUIZ_QUESTIONS.every((q) => Boolean(answers[q.id]));
}

/** The chosen option for a question, for the answer chips. */
export function chosenOption(question: QuizQuestion, answers: QuizAnswers): QuizOption | null {
  const value = answers[question.id];
  return question.options.find((o) => o.value === value) ?? null;
}

/** The shopper's answers in their own words. */
export function describeAnswers(answers: QuizAnswers): string[] {
  return QUIZ_QUESTIONS.map((q) => chosenOption(q, answers)?.label ?? "").filter(Boolean);
}
