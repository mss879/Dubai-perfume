import {
  AXES,
  EMPTY_AXES,
  WHEEL_SIZE,
  wheelIndexOf,
  type Axis,
  type AxisScores,
  type ScentProfile,
} from "./scent-wheel";

/**
 * What the notes mean — the finder's whole olfactory vocabulary.
 *
 * Imported by the SERVER only (the /discover page derives a profile per product
 * at request time and ships the browser 138 small vectors instead of this
 * table). Keep it that way: it is by far the largest thing in the feature, and
 * the browser has no use for it.
 *
 * Every entry is a reading of one material on the six axes, plus two physical
 * properties that decide how a composition behaves rather than what it smells
 * of:
 *
 *   weight  0–1  How far down the pyramid the material sits — how slowly it
 *                evaporates. Citrus is ~0.05, oud and labdanum ~1.0. This is
 *                what separates a cologne that is gone by lunch from a parfum
 *                that is still there the next morning.
 *
 *   power   0–1  How hard it pushes into the air. Not the same as weight:
 *                aldehydes and mint are volatile AND loud, while a soft musk is
 *                heavy and quiet.
 *
 * ── Where the readings come from ─────────────────────────────────────────────
 *
 * The axes follow standard perfumery classification (Michael Edwards' wheel and
 * its sub-families). `weight` follows the conventional top/heart/base ordering
 * of materials by volatility. The heat behaviour that `endurance` is built from
 * is specific to where this store actually sells: in Gulf heat, projection
 * rises but longevity falls — volatile citrus and aquatic accords burn off in a
 * couple of hours, while heavy amber, musk, sandalwood and oud bases hold and
 * develop with body warmth. Humidity intensifies sweet and spicy materials,
 * which is why sweetness is treated as a liability in the summer question
 * rather than a virtue.
 */

type NoteReading = Partial<AxisScores> & { weight: number; power: number };

/**
 * Keyed by a lower-case fragment matched against the note name. Order matters:
 * the FIRST entry whose key appears in the note wins, so specific keys must
 * precede the general ones they contain ("green apple" before "apple",
 * "orange blossom" before "orange", "rose milk" before "rose").
 */
const LEXICON: [string, NoteReading][] = [
  /* ── Citrus ─────────────────────────────────────────────────────────────
     The brightest, most volatile materials there are. Enormous opening lift,
     almost no staying power — hence weight at the very bottom of the scale. */
  ["blood orange", { fresh: 9, sweet: 1, weight: 0.08, power: 0.55 }],
  ["orange blossom", { floral: 8, fresh: 2, sweet: 2, weight: 0.5, power: 0.6 }],
  ["african orange flower", { floral: 8, fresh: 2, weight: 0.5, power: 0.55 }],
  ["sweet orange", { fresh: 8, sweet: 2, weight: 0.08, power: 0.5 }],
  ["green tangerine", { fresh: 9, weight: 0.07, power: 0.5 }],
  ["tangerine", { fresh: 8, sweet: 1, weight: 0.08, power: 0.45 }],
  ["mandarin", { fresh: 8, sweet: 1, weight: 0.09, power: 0.45 }],
  ["italian lemon", { fresh: 9, weight: 0.05, power: 0.55 }],
  ["sicilian bergamot", { fresh: 9, weight: 0.1, power: 0.5 }],
  ["bergamot", { fresh: 8, floral: 1, weight: 0.1, power: 0.45 }],
  ["grapefruit", { fresh: 9, weight: 0.08, power: 0.55 }],
  ["lemon", { fresh: 9, weight: 0.05, power: 0.55 }],
  ["lime", { fresh: 9, weight: 0.05, power: 0.55 }],
  ["petitgrain", { fresh: 7, weight: 0.15, power: 0.4 }],
  ["neroli", { floral: 6, fresh: 4, weight: 0.3, power: 0.5 }],
  ["citrus", { fresh: 8, weight: 0.08, power: 0.5 }],
  ["orange", { fresh: 7, sweet: 2, weight: 0.1, power: 0.45 }],

  /* ── Aquatic, mineral, airy ─────────────────────────────────────────────
     Transparent by design. They read as cool and clean and they do not last;
     in Gulf humidity they are the first thing to go. */
  ["sea salt", { fresh: 8, weight: 0.25, power: 0.35 }],
  ["sea water", { fresh: 9, weight: 0.2, power: 0.4 }],
  ["sea notes", { fresh: 9, weight: 0.2, power: 0.4 }],
  ["salty notes", { fresh: 8, weight: 0.25, power: 0.35 }],
  ["marine notes", { fresh: 9, weight: 0.2, power: 0.4 }],
  ["aquatic notes", { fresh: 9, weight: 0.2, power: 0.4 }],
  ["watery notes", { fresh: 9, weight: 0.18, power: 0.35 }],
  ["water notes", { fresh: 9, weight: 0.18, power: 0.35 }],
  ["water lily", { floral: 6, fresh: 4, weight: 0.3, power: 0.35 }],
  ["coconut water", { fresh: 6, sweet: 3, weight: 0.25, power: 0.35 }],
  ["mineral notes", { fresh: 7, weight: 0.35, power: 0.3 }],
  ["salt", { fresh: 7, weight: 0.3, power: 0.35 }],
  ["sand", { fresh: 4, woody: 3, weight: 0.5, power: 0.25 }],
  ["foam", { fresh: 7, weight: 0.2, power: 0.3 }],
  ["lotus", { floral: 6, fresh: 4, weight: 0.3, power: 0.35 }],
  ["aloe vera", { fresh: 7, weight: 0.3, power: 0.25 }],
  ["aldehydes", { fresh: 7, floral: 2, weight: 0.15, power: 0.8 }],

  /* ── Green, herbal, aromatic ────────────────────────────────────────────
     The aromatic wedge of the wheel — lavender, sage, mint. Cool, dry and
     comfortable in heat without being sweet. */
  ["violet leaves", { fresh: 6, floral: 3, weight: 0.3, power: 0.35 }],
  ["violet leaf", { fresh: 6, floral: 3, weight: 0.3, power: 0.35 }],
  ["fig leaf", { fresh: 6, woody: 2, weight: 0.3, power: 0.35 }],
  ["green apple", { fresh: 7, sweet: 3, weight: 0.12, power: 0.45 }],
  ["granny smith apple", { fresh: 7, sweet: 3, weight: 0.12, power: 0.45 }],
  ["green notes", { fresh: 8, weight: 0.15, power: 0.4 }],
  ["green tea", { fresh: 7, weight: 0.2, power: 0.3 }],
  ["galbanum", { fresh: 8, weight: 0.2, power: 0.55 }],
  ["wild lavender", { fresh: 5, floral: 4, spice: 1, weight: 0.3, power: 0.5 }],
  ["lavandin", { fresh: 5, floral: 4, weight: 0.3, power: 0.5 }],
  ["lavender", { fresh: 5, floral: 4, spice: 1, weight: 0.3, power: 0.5 }],
  ["peppermint", { fresh: 9, weight: 0.08, power: 0.65 }],
  ["mint leaves", { fresh: 9, weight: 0.08, power: 0.6 }],
  ["mint", { fresh: 9, weight: 0.08, power: 0.6 }],
  ["clary sage", { fresh: 6, spice: 2, weight: 0.25, power: 0.4 }],
  ["sage", { fresh: 6, spice: 2, weight: 0.25, power: 0.4 }],
  ["rosemary", { fresh: 7, spice: 2, weight: 0.2, power: 0.5 }],
  ["basil", { fresh: 7, spice: 2, weight: 0.15, power: 0.5 }],
  ["thyme", { fresh: 6, spice: 3, weight: 0.2, power: 0.45 }],
  ["myrtle", { fresh: 6, woody: 2, weight: 0.25, power: 0.35 }],
  ["artemisia", { fresh: 6, spice: 2, weight: 0.2, power: 0.45 }],
  ["mugwort", { fresh: 5, spice: 3, weight: 0.25, power: 0.5 }],
  ["cannabis", { fresh: 4, spice: 3, woody: 2, weight: 0.35, power: 0.55 }],
  ["juniper berries", { fresh: 6, spice: 3, weight: 0.2, power: 0.45 }],
  ["juniper berry", { fresh: 6, spice: 3, weight: 0.2, power: 0.45 }],
  ["juniper", { fresh: 6, spice: 3, weight: 0.2, power: 0.45 }],
  ["cypress", { fresh: 4, woody: 5, weight: 0.4, power: 0.4 }],
  ["mate", { fresh: 6, weight: 0.25, power: 0.3 }],
  ["aromatic notes", { fresh: 6, spice: 2, weight: 0.25, power: 0.4 }],

  /* ── Fruit ──────────────────────────────────────────────────────────────
     Sweetness without sugar in the top, sugar as it descends. Tropical fruit
     is the signature of the modern Gulf crowd-pleaser. */
  ["pitahaya", { fresh: 5, sweet: 5, weight: 0.15, power: 0.4 }],
  ["passion fruit", { fresh: 4, sweet: 6, weight: 0.15, power: 0.45 }],
  ["passionfruit", { fresh: 4, sweet: 6, weight: 0.15, power: 0.45 }],
  ["tropical fruits", { fresh: 4, sweet: 6, weight: 0.15, power: 0.45 }],
  ["pineapple", { fresh: 5, sweet: 6, weight: 0.15, power: 0.55 }],
  ["watermelon", { fresh: 7, sweet: 4, weight: 0.12, power: 0.35 }],
  ["melon", { fresh: 6, sweet: 4, weight: 0.12, power: 0.35 }],
  ["guava", { fresh: 4, sweet: 6, weight: 0.15, power: 0.4 }],
  ["mango", { fresh: 3, sweet: 7, weight: 0.18, power: 0.45 }],
  ["banana", { sweet: 7, weight: 0.2, power: 0.4 }],
  ["coconut milk", { sweet: 6, weight: 0.4, power: 0.35 }],
  ["coconut", { sweet: 6, fresh: 1, weight: 0.4, power: 0.4 }],
  ["litchi", { fresh: 4, sweet: 5, floral: 2, weight: 0.15, power: 0.4 }],
  ["lychee", { fresh: 4, sweet: 5, floral: 2, weight: 0.15, power: 0.4 }],
  ["strawberry fizz candy", { sweet: 8, weight: 0.2, power: 0.5 }],
  ["strawberry jam", { sweet: 8, weight: 0.3, power: 0.45 }],
  ["strawberry", { sweet: 6, fresh: 1, weight: 0.18, power: 0.4 }],
  ["cherry jam", { sweet: 8, weight: 0.3, power: 0.45 }],
  ["raspberry", { sweet: 6, fresh: 1, weight: 0.18, power: 0.45 }],
  ["blackberry", { sweet: 6, weight: 0.2, power: 0.4 }],
  ["black currant", { fresh: 4, sweet: 5, weight: 0.15, power: 0.55 }],
  ["blackcurrant", { fresh: 4, sweet: 5, weight: 0.15, power: 0.55 }],
  ["red currant", { fresh: 4, sweet: 5, weight: 0.15, power: 0.5 }],
  ["cassis", { fresh: 4, sweet: 5, weight: 0.15, power: 0.55 }],
  ["red berries", { sweet: 6, fresh: 2, weight: 0.18, power: 0.4 }],
  ["red fruits", { sweet: 6, fresh: 2, weight: 0.18, power: 0.4 }],
  ["candied fruits", { sweet: 8, weight: 0.3, power: 0.45 }],
  ["yellow fruits", { sweet: 5, fresh: 3, weight: 0.18, power: 0.4 }],
  ["fruity notes", { sweet: 5, fresh: 3, weight: 0.18, power: 0.4 }],
  ["fruits", { sweet: 5, fresh: 3, weight: 0.18, power: 0.4 }],
  ["grapes", { sweet: 6, fresh: 2, weight: 0.2, power: 0.35 }],
  ["mirabelle", { sweet: 6, fresh: 2, weight: 0.2, power: 0.35 }],
  ["plum liquor", { sweet: 7, amber: 2, weight: 0.35, power: 0.45 }],
  ["plum", { sweet: 6, fresh: 1, weight: 0.25, power: 0.4 }],
  ["apricot", { sweet: 6, floral: 1, weight: 0.25, power: 0.4 }],
  ["peach", { sweet: 6, floral: 2, weight: 0.25, power: 0.4 }],
  ["pear", { fresh: 4, sweet: 5, weight: 0.15, power: 0.4 }],
  ["apple", { fresh: 5, sweet: 4, weight: 0.12, power: 0.45 }],
  ["pomegranate", { fresh: 4, sweet: 5, weight: 0.18, power: 0.4 }],
  ["rhubarb", { fresh: 6, sweet: 3, weight: 0.15, power: 0.45 }],
  ["fig", { sweet: 5, woody: 2, weight: 0.3, power: 0.35 }],
  ["dates", { sweet: 7, amber: 2, weight: 0.45, power: 0.4 }],
  ["davana", { sweet: 5, floral: 3, spice: 1, weight: 0.3, power: 0.5 }],

  /* ── Flowers ────────────────────────────────────────────────────────────
     The white flowers (tuberose, jasmine, gardenia) are the loud ones; iris
     and violet are the quiet, powdery ones. */
  ["bulgarian rose", { floral: 9, weight: 0.45, power: 0.6 }],
  ["turkish rose", { floral: 9, weight: 0.45, power: 0.6 }],
  ["white rose", { floral: 8, weight: 0.45, power: 0.5 }],
  ["rose milk", { floral: 6, sweet: 4, weight: 0.45, power: 0.4 }],
  ["rosyfolia", { floral: 8, fresh: 1, weight: 0.4, power: 0.45 }],
  ["rose", { floral: 9, weight: 0.45, power: 0.55 }],
  ["cistus", { amber: 6, floral: 2, woody: 2, weight: 0.85, power: 0.5 }],
  ["egyptian jasmine", { floral: 9, sweet: 1, weight: 0.5, power: 0.7 }],
  ["moroccan jasmine", { floral: 9, sweet: 1, weight: 0.5, power: 0.7 }],
  ["jasmine sambac", { floral: 9, sweet: 1, weight: 0.5, power: 0.7 }],
  ["jasmine", { floral: 9, sweet: 1, weight: 0.5, power: 0.7 }],
  ["tuberose", { floral: 10, sweet: 2, weight: 0.55, power: 0.85 }],
  ["gardenia", { floral: 9, sweet: 2, weight: 0.5, power: 0.65 }],
  ["frangipani", { floral: 8, sweet: 3, weight: 0.5, power: 0.6 }],
  ["ylang-ylang", { floral: 8, sweet: 3, weight: 0.5, power: 0.65 }],
  ["ylang ylang", { floral: 8, sweet: 3, weight: 0.5, power: 0.65 }],
  ["honeysuckle", { floral: 8, sweet: 3, weight: 0.4, power: 0.5 }],
  ["white blossom", { floral: 8, weight: 0.45, power: 0.5 }],
  ["white flowers", { floral: 8, weight: 0.45, power: 0.55 }],
  ["floral notes", { floral: 7, weight: 0.4, power: 0.45 }],
  ["orris root", { floral: 7, woody: 2, weight: 0.7, power: 0.35 }],
  ["orris", { floral: 7, woody: 2, weight: 0.7, power: 0.35 }],
  ["iris", { floral: 7, woody: 2, weight: 0.7, power: 0.35 }],
  ["violet", { floral: 7, sweet: 2, weight: 0.4, power: 0.35 }],
  ["heliotrope", { floral: 6, sweet: 4, weight: 0.5, power: 0.4 }],
  ["lily-of-the-valley", { floral: 8, fresh: 2, weight: 0.35, power: 0.45 }],
  ["lily of the valley", { floral: 8, fresh: 2, weight: 0.35, power: 0.45 }],
  ["white lily", { floral: 8, weight: 0.4, power: 0.5 }],
  ["lily", { floral: 8, weight: 0.4, power: 0.5 }],
  ["peony", { floral: 8, fresh: 2, weight: 0.35, power: 0.45 }],
  ["freesia", { floral: 7, fresh: 3, weight: 0.3, power: 0.4 }],
  ["geranium", { floral: 6, fresh: 3, weight: 0.35, power: 0.5 }],
  ["orchid", { floral: 7, sweet: 2, weight: 0.45, power: 0.45 }],
  ["narcissus", { floral: 8, weight: 0.45, power: 0.5 }],
  ["marigold", { floral: 6, spice: 2, weight: 0.35, power: 0.45 }],
  ["carrot", { floral: 3, spice: 2, sweet: 2, weight: 0.4, power: 0.3 }],
  ["mahonial", { floral: 7, fresh: 3, weight: 0.4, power: 0.45 }],

  /* ── Gourmand ───────────────────────────────────────────────────────────
     The edible register. Vanilla appears in 71 of the 138 products here, so it
     is the single most load-bearing material in the catalogue. In humidity
     these intensify — wonderful in winter, cloying at 45°C. */
  ["madagascar vanilla", { sweet: 9, amber: 3, weight: 0.9, power: 0.6 }],
  ["bourbon vanilla", { sweet: 9, amber: 3, weight: 0.9, power: 0.6 }],
  ["vanille bourbon", { sweet: 9, amber: 3, weight: 0.9, power: 0.6 }],
  ["vanille", { sweet: 9, amber: 3, weight: 0.9, power: 0.6 }],
  ["vanilla", { sweet: 9, amber: 3, weight: 0.9, power: 0.6 }],
  ["tonka bean", { sweet: 7, amber: 4, spice: 1, weight: 0.9, power: 0.55 }],
  ["tonka", { sweet: 7, amber: 4, spice: 1, weight: 0.9, power: 0.55 }],
  ["praline", { sweet: 9, weight: 0.75, power: 0.6 }],
  ["creme brulee", { sweet: 9, weight: 0.75, power: 0.55 }],
  ["dulce de leche", { sweet: 9, weight: 0.75, power: 0.55 }],
  ["caramel", { sweet: 9, weight: 0.7, power: 0.55 }],
  ["toffee", { sweet: 9, weight: 0.7, power: 0.55 }],
  ["maple", { sweet: 8, weight: 0.7, power: 0.45 }],
  ["dark chocolate", { sweet: 7, amber: 2, weight: 0.8, power: 0.55 }],
  ["chocolate", { sweet: 8, amber: 2, weight: 0.8, power: 0.55 }],
  ["cacao butter", { sweet: 7, weight: 0.8, power: 0.4 }],
  ["cacao", { sweet: 7, amber: 2, weight: 0.8, power: 0.5 }],
  ["cocoapulse", { sweet: 7, amber: 2, weight: 0.8, power: 0.5 }],
  ["cocoa", { sweet: 7, amber: 2, weight: 0.8, power: 0.5 }],
  ["coffee", { sweet: 4, amber: 3, spice: 2, weight: 0.75, power: 0.7 }],
  ["cotton candy", { sweet: 10, weight: 0.6, power: 0.6 }],
  ["marshmallow", { sweet: 9, weight: 0.65, power: 0.5 }],
  ["meringue", { sweet: 9, weight: 0.6, power: 0.45 }],
  ["whipped cream", { sweet: 8, weight: 0.6, power: 0.4 }],
  ["ice cream", { sweet: 8, weight: 0.6, power: 0.4 }],
  ["milk", { sweet: 6, weight: 0.6, power: 0.35 }],
  ["lactones", { sweet: 6, weight: 0.65, power: 0.35 }],
  ["sugar cane", { sweet: 8, fresh: 1, weight: 0.5, power: 0.45 }],
  ["sugar", { sweet: 8, weight: 0.5, power: 0.45 }],
  ["sweet notes", { sweet: 8, weight: 0.5, power: 0.45 }],
  ["gourmand accord", { sweet: 9, weight: 0.7, power: 0.55 }],
  ["knafeh", { sweet: 9, spice: 1, weight: 0.75, power: 0.55 }],
  ["biscuit", { sweet: 7, weight: 0.65, power: 0.4 }],
  ["pistachio spread cream", { sweet: 8, weight: 0.7, power: 0.45 }],
  ["pistachio", { sweet: 6, weight: 0.6, power: 0.4 }],
  ["hazelnut", { sweet: 6, weight: 0.65, power: 0.4 }],
  ["bitter almond", { sweet: 6, spice: 2, weight: 0.6, power: 0.5 }],
  ["almond", { sweet: 6, weight: 0.6, power: 0.45 }],
  ["nutty notes", { sweet: 5, woody: 2, weight: 0.6, power: 0.4 }],
  ["honey", { sweet: 8, amber: 3, weight: 0.7, power: 0.55 }],
  ["cognac", { sweet: 5, amber: 3, spice: 2, weight: 0.5, power: 0.6 }],
  ["whiskey", { sweet: 4, amber: 3, woody: 2, weight: 0.5, power: 0.6 }],
  ["rum accord", { sweet: 6, amber: 3, spice: 1, weight: 0.5, power: 0.6 }],
  ["rum", { sweet: 6, amber: 3, spice: 1, weight: 0.5, power: 0.6 }],
  ["vodka", { fresh: 5, weight: 0.2, power: 0.45 }],

  /* ── Spice ──────────────────────────────────────────────────────────────
     Saffron and cardamom are the Gulf signature — the materials that make a
     composition read as Arabian rather than European. */
  ["pink pepper", { spice: 7, fresh: 2, weight: 0.2, power: 0.55 }],
  ["black pepper", { spice: 8, weight: 0.25, power: 0.6 }],
  ["pimento", { spice: 8, weight: 0.3, power: 0.6 }],
  ["pepper", { spice: 7, weight: 0.25, power: 0.55 }],
  ["saffron", { spice: 9, amber: 3, weight: 0.6, power: 0.7 }],
  ["cardamom", { spice: 8, fresh: 2, weight: 0.35, power: 0.6 }],
  ["cinnamon leaf", { spice: 7, sweet: 2, weight: 0.45, power: 0.6 }],
  ["cinnamon", { spice: 8, sweet: 3, amber: 2, weight: 0.5, power: 0.65 }],
  ["nutmeg", { spice: 7, sweet: 1, weight: 0.4, power: 0.55 }],
  ["cloves", { spice: 9, amber: 2, weight: 0.5, power: 0.7 }],
  ["ginger", { spice: 7, fresh: 3, weight: 0.25, power: 0.55 }],
  ["turmeric", { spice: 7, weight: 0.4, power: 0.5 }],
  ["coriander", { spice: 6, fresh: 3, weight: 0.25, power: 0.5 }],
  ["caraway", { spice: 7, weight: 0.3, power: 0.5 }],
  ["cumin", { spice: 8, weight: 0.4, power: 0.6 }],
  ["star anise", { spice: 7, sweet: 2, weight: 0.3, power: 0.55 }],
  ["anise", { spice: 7, sweet: 2, weight: 0.3, power: 0.55 }],
  ["spicy notes", { spice: 7, weight: 0.4, power: 0.55 }],
  ["spices", { spice: 7, weight: 0.4, power: 0.55 }],

  /* ── Amber, resin, incense ──────────────────────────────────────────────
     The warm heart of Arabian perfumery, and the reason these compositions
     survive the heat: heavy, low-volatility materials that bloom with body
     warmth rather than burning off. */
  ["crystal amber", { amber: 8, woody: 2, weight: 0.85, power: 0.6 }],
  ["dry amber", { amber: 8, woody: 3, weight: 0.85, power: 0.6 }],
  ["amberwood", { amber: 7, woody: 5, weight: 0.9, power: 0.65 }],
  ["ambergris", { amber: 8, weight: 0.95, power: 0.55 }],
  ["ambroxan", { amber: 7, woody: 3, weight: 0.95, power: 0.8 }],
  ["ambrofix", { amber: 7, woody: 3, weight: 0.95, power: 0.8 }],
  ["orcanox", { amber: 7, woody: 3, weight: 0.95, power: 0.75 }],
  ["amber", { amber: 9, sweet: 2, weight: 0.9, power: 0.6 }],
  ["labdanum", { amber: 9, woody: 2, weight: 0.95, power: 0.6 }],
  ["benzoin", { amber: 8, sweet: 4, weight: 0.9, power: 0.5 }],
  ["styrax", { amber: 8, woody: 2, weight: 0.9, power: 0.55 }],
  ["olibanum", { amber: 7, spice: 3, woody: 2, weight: 0.8, power: 0.6 }],
  ["frankincense", { amber: 7, spice: 3, woody: 2, weight: 0.8, power: 0.6 }],
  ["incense", { amber: 7, woody: 3, spice: 2, weight: 0.8, power: 0.65 }],
  ["myrrh", { amber: 8, spice: 2, weight: 0.9, power: 0.55 }],
  ["elemi", { amber: 5, fresh: 3, spice: 2, weight: 0.6, power: 0.5 }],
  ["fir resin", { amber: 4, woody: 5, fresh: 2, weight: 0.7, power: 0.45 }],
  ["gurjan balsam", { amber: 6, woody: 4, weight: 0.85, power: 0.5 }],
  ["mystikal", { amber: 6, woody: 3, spice: 2, weight: 0.85, power: 0.6 }],

  /* ── Woods, oud, leather, moss ──────────────────────────────────────────
     Oud is the heaviest material in perfumery and the longest-lasting; leather
     and tobacco sit just behind it. These are the entrance-makers. */
  ["cambodian oud", { woody: 10, amber: 3, spice: 1, weight: 1, power: 0.85 }],
  ["agarwood (oud)", { woody: 10, amber: 3, weight: 1, power: 0.85 }],
  ["oud mood accord", { woody: 9, amber: 3, weight: 0.95, power: 0.8 }],
  ["agarwood", { woody: 10, amber: 3, weight: 1, power: 0.85 }],
  ["oud", { woody: 10, amber: 3, weight: 1, power: 0.85 }],
  ["cypriol", { woody: 8, spice: 2, weight: 0.9, power: 0.65 }],
  ["akigalawood", { woody: 8, spice: 3, weight: 0.9, power: 0.7 }],
  ["healingwood", { woody: 8, amber: 2, weight: 0.9, power: 0.6 }],
  ["cashmere wood", { woody: 6, amber: 2, weight: 0.9, power: 0.5 }],
  ["cashmeran", { woody: 6, amber: 3, sweet: 2, weight: 0.9, power: 0.6 }],
  ["sandalwood", { woody: 8, amber: 2, sweet: 1, weight: 0.9, power: 0.5 }],
  ["blonde woods", { woody: 6, amber: 2, weight: 0.8, power: 0.45 }],
  ["white wood", { woody: 6, fresh: 2, weight: 0.8, power: 0.45 }],
  ["guaiac wood", { woody: 8, amber: 2, spice: 1, weight: 0.85, power: 0.6 }],
  ["cedarwood", { woody: 8, fresh: 1, weight: 0.8, power: 0.55 }],
  ["cedar", { woody: 8, fresh: 1, weight: 0.8, power: 0.55 }],
  ["driftwood", { woody: 7, fresh: 3, weight: 0.8, power: 0.5 }],
  ["dry woods", { woody: 8, weight: 0.85, power: 0.55 }],
  ["dry wood", { woody: 8, weight: 0.85, power: 0.55 }],
  ["woodsy notes", { woody: 7, weight: 0.8, power: 0.5 }],
  ["woody notes", { woody: 7, weight: 0.8, power: 0.5 }],
  ["vetyver", { woody: 8, fresh: 3, weight: 0.85, power: 0.55 }],
  ["vetiver", { woody: 8, fresh: 3, weight: 0.85, power: 0.55 }],
  ["patchouli", { woody: 8, amber: 3, spice: 1, weight: 0.9, power: 0.7 }],
  ["oakmoss", { woody: 6, fresh: 3, weight: 0.85, power: 0.55 }],
  ["oak moss", { woody: 6, fresh: 3, weight: 0.85, power: 0.55 }],
  ["oak", { woody: 7, amber: 2, weight: 0.85, power: 0.5 }],
  ["moss", { woody: 6, fresh: 3, weight: 0.8, power: 0.45 }],
  ["birch", { woody: 7, spice: 2, weight: 0.8, power: 0.6 }],
  ["cade oil", { woody: 7, spice: 3, weight: 0.85, power: 0.7 }],
  ["smoke", { woody: 6, spice: 3, amber: 2, weight: 0.8, power: 0.7 }],
  ["suede", { woody: 5, amber: 3, weight: 0.85, power: 0.5 }],
  ["leather", { woody: 6, amber: 4, spice: 2, weight: 0.9, power: 0.7 }],
  ["tobacco", { amber: 5, sweet: 3, woody: 3, spice: 2, weight: 0.9, power: 0.7 }],

  /* ── Musk ───────────────────────────────────────────────────────────────
     Present in 65 of 138. Heavy and long-lasting, but quiet — the classic
     illustration of why weight and power have to be tracked separately. */
  ["white musk", { sweet: 2, floral: 1, weight: 0.9, power: 0.35 }],
  ["musk", { sweet: 2, amber: 1, weight: 0.9, power: 0.4 }],
];

/** How much each pyramid tier contributes to the reading of the character. */
const TIER_CHARACTER_WEIGHT = { top: 0.7, heart: 1, base: 1.15 } as const;

/**
 * How much each tier contributes to how the composition BEHAVES.
 *
 * Base notes dominate: they are what is still there after an hour, and in heat
 * the top has usually gone before anyone but the wearer has smelled it.
 */
const TIER_BEHAVIOUR_WEIGHT = { top: 0.35, heart: 0.85, base: 1.6 } as const;

const readingCache = new Map<string, NoteReading | null>();

/** The reading for one note name, or null if the lexicon does not know it. */
function readNote(note: string): NoteReading | null {
  const key = note.toLowerCase().trim();
  if (!key) return null;
  const cached = readingCache.get(key);
  if (cached !== undefined) return cached;

  let found: NoteReading | null = null;
  for (const [fragment, reading] of LEXICON) {
    if (key.includes(fragment)) {
      found = reading;
      break;
    }
  }
  readingCache.set(key, found);
  return found;
}

const clamp10 = (n: number) => Math.max(0, Math.min(10, n));

export type NotePyramid = {
  top: string[];
  heart: string[];
  base: string[];
};

/** Which notes carry each axis, strongest first — at most three per axis. */
export type AxisNotes = Partial<Record<Axis, string[]>>;

export type CompositionReading = {
  profile: ScentProfile;
  /**
   * The notes that actually drive each axis. This is what lets the finder say
   * "for the saffron and the oud" instead of "because it is woody" — the
   * difference between a recommendation a shopper believes and one they don't.
   */
  axisNotes: AxisNotes;
};

/**
 * Reads a composition into a profile.
 *
 * `subStyle` is the phrase lifted from the product description ("resinous
 * amber", "oud-led woody", …) and gives the wheel position directly. Where it
 * is missing or unrecognised, the position is inferred from the notes instead,
 * so a product with a blank description still places somewhere sensible.
 */
export function readComposition(pyramid: NotePyramid, subStyle: string): CompositionReading {
  const axes: AxisScores = { ...EMPTY_AXES };
  const contributions: Record<Axis, { note: string; amount: number }[]> = {
    fresh: [],
    floral: [],
    sweet: [],
    amber: [],
    woody: [],
    spice: [],
  };
  let characterWeight = 0;
  let weightedWeight = 0;
  let weightedPower = 0;
  let behaviourWeight = 0;

  const tiers: [keyof NotePyramid, string[]][] = [
    ["top", pyramid.top],
    ["heart", pyramid.heart],
    ["base", pyramid.base],
  ];

  for (const [tier, notes] of tiers) {
    const characterFactor = TIER_CHARACTER_WEIGHT[tier];
    const behaviourFactor = TIER_BEHAVIOUR_WEIGHT[tier];

    for (const note of notes) {
      const reading = readNote(note);
      if (!reading) continue;

      for (const axis of AXES) {
        const value = reading[axis as Axis];
        if (value) {
          const amount = value * characterFactor;
          axes[axis] += amount;
          contributions[axis].push({ note, amount });
        }
      }
      characterWeight += characterFactor;

      weightedWeight += reading.weight * behaviourFactor;
      weightedPower += reading.power * behaviourFactor;
      behaviourWeight += behaviourFactor;
    }
  }

  // Normalise the axes so a composition listing twenty notes is not read as
  // twice as floral as one listing ten. The 2.6 puts a single-minded
  // composition (every note pulling one way) near the top of the 0–10 scale
  // without letting anything saturate.
  const divisor = characterWeight > 0 ? characterWeight : 1;
  for (const axis of AXES) {
    axes[axis] = clamp10((axes[axis] / divisor) * 2.6);
  }

  const avgWeight = behaviourWeight > 0 ? weightedWeight / behaviourWeight : 0.5;
  const avgPower = behaviourWeight > 0 ? weightedPower / behaviourWeight : 0.5;

  // How loudly it carries. Power leads, but a composition of heavy materials
  // keeps announcing itself for hours, so weight counts for a third of it.
  const intensity = clamp10((avgPower * 0.68 + avgWeight * 0.32) * 13.5);

  // How it holds up in Gulf heat. Heavy, low-volatility materials thrive and
  // develop with body warmth; volatile citrus and aquatic accords are gone in
  // two hours. This is about SURVIVAL, not about comfort — a heavy gourmand
  // endures beautifully at 45°C and is still the wrong thing to wear in it.
  const endurance = clamp10(avgWeight * 11);

  const fromStyle = wheelIndexOf(subStyle);
  const wheel = fromStyle !== null ? fromStyle : inferWheel(axes);

  const axisNotes: AxisNotes = {};
  for (const axis of AXES) {
    const ranked = contributions[axis]
      .sort((a, b) => b.amount - a.amount)
      .map((c) => c.note);
    // De-duplicated: "Cedar" and "Cedarwood" both appear in some compositions
    // and naming both back reads like padding.
    const seen = new Set<string>();
    const unique = ranked.filter((n) => {
      const key = n.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length > 0) axisNotes[axis] = unique.slice(0, 3);
  }

  return { profile: { ...axes, wheel, intensity, endurance }, axisNotes };
}

/**
 * Fallback wheel position, read from the axes alone.
 *
 * Only reached when a product has no recognised sub-style in its description.
 * The order of these tests is the priority: the most distinctive character
 * wins, so an oud that also happens to be sweet still places as an oud.
 */
function inferWheel(axes: AxisScores): number {
  const { fresh, floral, sweet, amber, woody, spice } = axes;
  if (woody >= 6 && amber >= 4) return wheelIndexOf("oud-led woody") ?? 6;
  if (woody >= 6) return wheelIndexOf("woody") ?? 9;
  if (amber >= 6 && spice >= 5) return wheelIndexOf("spiced amber") ?? 5;
  if (amber >= 6) return wheelIndexOf("resinous amber") ?? 4;
  if (sweet >= 6 && floral >= 4) return wheelIndexOf("floral-gourmand") ?? 1;
  if (sweet >= 6) return wheelIndexOf("gourmand") ?? 2;
  if (floral >= 5) return wheelIndexOf("floral") ?? 0;
  if (fresh >= 6) return wheelIndexOf("crisp citrus") ?? 11;
  return wheelIndexOf("aromatic-fresh") ?? 10;
}

const SUB_STYLE = /\bis an?\s+(.+?)\s+eau de parfum\b/i;

/**
 * Lifts the sub-style out of a product description.
 *
 * Migration 37 wrote every description to one pattern — "X is a resinous amber
 * eau de parfum from …" — which gives a fourteen-value classification the
 * products table has no column for. Returns "" when the pattern is absent, and
 * profileFor() then falls back to reading the notes.
 */
export function subStyleFromDescription(description: string | null | undefined): string {
  const match = SUB_STYLE.exec(description ?? "");
  return match ? match[1].toLowerCase().trim() : "";
}

/** Notes the lexicon does not know — for spotting gaps as the catalogue grows. */
export function unknownNotes(pyramid: NotePyramid): string[] {
  return [...pyramid.top, ...pyramid.heart, ...pyramid.base].filter((n) => !readNote(n));
}

export { WHEEL_SIZE };
