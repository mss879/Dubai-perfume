import { z } from "zod";
import { endOfDubaiDay } from "./discount-schema";

/**
 * Offers (migration 69): one schema for the admin form and the save route.
 * The database prices them (offer_quote); this only checks what the owner
 * typed makes a working offer. A template picks the kind and the wording.
 */

export const OFFER_TEMPLATES = {
  buy_more: {
    kind: "tiered",
    label: "Buy more, save more",
    blurb: "Two or more perfumes get a percentage off, with free delivery if you like.",
    example: "Any 2 Lattafa: 10% off + free delivery. 3 or more: 15% off.",
  },
  backup: {
    kind: "tiered",
    label: "Two of the same",
    blurb: "A second bottle of the same perfume, for less. For daily wearers.",
    example: "Signature + backup: two of the same perfume, 15% off.",
  },
  layering: {
    kind: "bundle",
    label: "Layering duo",
    blurb: "Two perfumes made to be worn together, at a set price.",
    example: "Oud + Musk layering duo: AED 199 (save AED 31).",
  },
  his_hers: {
    kind: "bundle",
    label: "His & Hers set",
    blurb: "One for him, one for her. Strong for gifting.",
    example: "His & Hers: 15% off the pair.",
  },
  house: {
    kind: "bundle",
    label: "House set",
    blurb: "A brand's best, together. Easy for people who know the house.",
    example: "The Lattafa bestsellers trio: AED 299.",
  },
  occasion: {
    kind: "bundle",
    label: "Occasion gift box",
    blurb: "A limited-time gift set, gift-wrapped, with a countdown.",
    example: "Eid gift box: 3 perfumes, gift-wrapped, until 30 March.",
  },
  addon: {
    kind: "addon",
    label: "Checkout add-on",
    blurb: "One tick box at checkout: add a perfume at a special price.",
    example: "Add Yara for AED 59 (usually AED 69) to any order over AED 100.",
  },
  gift: {
    kind: "gift",
    label: "Free gift over a spend",
    blurb: "A free perfume once the bag reaches an amount, with a progress nudge.",
    example: "Spend AED 400, get a free travel favourite.",
  },
} as const;

export type OfferTemplate = keyof typeof OFFER_TEMPLATES;
export type OfferKind = "tiered" | "bundle" | "addon" | "gift";
export const TEMPLATE_KEYS = Object.keys(OFFER_TEMPLATES) as OfferTemplate[];

const money = (label: string) =>
  z
    .number({ error: `Enter ${label}.` })
    .min(0, { error: "Can't be negative." })
    .max(100000)
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, { error: "Use at most two decimal places." });

const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date." })]);

export const offerSchema = z
  .object({
    template: z.enum(TEMPLATE_KEYS as [OfferTemplate, ...OfferTemplate[]]),
    title: z.string().trim().min(1, { error: "Give the offer a name shoppers will see." }).max(80, { error: "Keep it under 80 characters." }),
    description: z.string().trim().max(300, { error: "Keep it under 300 characters." }),
    is_active: z.boolean(),
    starts_on: date,
    ends_on: date,
    priority: z.number().int().min(0).max(100),
    scope: z.enum(["all", "brands", "collections", "products"]),
    scope_brands: z.array(z.string().trim().min(1).max(100)).max(20),
    scope_collection_ids: z.array(z.string().min(1).max(100)).max(50),
    scope_product_ids: z.array(z.number().int().positive()).max(300),
    tiers: z
      .array(
        z.object({
          min_qty: z.number().int().min(2, { error: "A tier starts at 2 perfumes or more." }).max(20),
          percent: z.number().min(0).max(90, { error: "At most 90% off." }),
          free_delivery: z.boolean(),
        })
      )
      .max(5),
    bundle_lines: z
      .array(
        z.object({
          product_id: z.number().int().positive(),
          size: z.string().max(50),
          qty: z.number().int().min(1).max(5),
        })
      )
      .max(6),
    price_mode: z.enum(["price", "percent"]),
    bundle_price: money("the set price").nullable(),
    bundle_percent: z.number().min(0).max(90).nullable(),
    free_delivery: z.boolean(),
    gift_wrap: z.boolean(),
    product_id: z.number().int().positive().nullable(),
    product_size: z.string().max(50),
    addon_price: money("the add-on price").nullable(),
    min_subtotal: money("an amount"),
  })
  .superRefine((d, ctx) => {
    const kind = OFFER_TEMPLATES[d.template].kind as OfferKind;
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    if (d.starts_on && d.ends_on && d.ends_on < d.starts_on) issue("ends_on", "The end date is before the start date.");
    if (d.template === "occasion" && !d.ends_on) issue("ends_on", "An occasion box needs an end date for its countdown.");

    if (kind === "tiered" || (kind === "addon" && d.scope !== "all")) {
      if (d.scope === "brands" && d.scope_brands.length === 0) issue("scope_brands", "Choose at least one brand.");
      if (d.scope === "collections" && d.scope_collection_ids.length === 0) issue("scope_collection_ids", "Choose at least one collection.");
      if (d.scope === "products" && d.scope_product_ids.length === 0) issue("scope_product_ids", "Choose at least one perfume.");
    }

    if (kind === "tiered") {
      if (d.tiers.length === 0) issue("tiers", "Add at least one step.");
      const counts = d.tiers.map((t) => t.min_qty);
      if (new Set(counts).size !== counts.length) issue("tiers", "Each step needs a different number of perfumes.");
      if (d.tiers.some((t) => t.percent === 0 && !t.free_delivery)) issue("tiers", "Each step needs a saving or free delivery.");
      if (d.template === "backup" && d.tiers.some((t) => t.min_qty < 2)) issue("tiers", "Two of the same starts at 2.");
    }

    if (kind === "bundle") {
      const units = d.bundle_lines.reduce((sum, l) => sum + l.qty, 0);
      if (d.bundle_lines.length === 0) issue("bundle_lines", "Add the perfumes in the set.");
      else if (units < 2) issue("bundle_lines", "A set needs at least two bottles.");
      const ids = d.bundle_lines.map((l) => `${l.product_id}|${l.size}`);
      if (new Set(ids).size !== ids.length) issue("bundle_lines", "A perfume is in the set twice. Raise its quantity instead.");
      if (d.price_mode === "price" && !(d.bundle_price && d.bundle_price > 0)) issue("bundle_price", "Enter the set price.");
      if (d.price_mode === "percent" && !(d.bundle_percent && d.bundle_percent > 0)) issue("bundle_percent", "Enter the percentage off.");
    }

    if (kind === "addon") {
      if (!d.product_id) issue("product_id", "Choose the perfume to offer.");
      if (d.addon_price === null) issue("addon_price", "Enter the add-on price.");
    }

    if (kind === "gift") {
      if (!d.product_id) issue("product_id", "Choose the gift.");
      if (!(d.min_subtotal > 0)) issue("min_subtotal", "Enter the spend that earns the gift.");
    }
  });

export type OfferInput = z.infer<typeof offerSchema>;

/** The table row for an offer: only the columns its kind uses are filled. */
export function offerRow(input: OfferInput) {
  const kind = OFFER_TEMPLATES[input.template].kind as OfferKind;
  const scoped = kind === "tiered" || kind === "addon";
  const scope = scoped ? input.scope : "all";
  return {
    kind,
    template: input.template,
    title: input.title,
    description: input.description || null,
    is_active: input.is_active,
    starts_at: input.starts_on ? new Date(`${input.starts_on}T00:00:00+04:00`).toISOString() : null,
    ends_at: input.ends_on ? endOfDubaiDay(input.ends_on) : null,
    priority: input.priority,
    scope,
    scope_brands: scope === "brands" ? [...new Set(input.scope_brands.map((b) => b.toUpperCase()))] : [],
    scope_collection_ids: scope === "collections" ? [...new Set(input.scope_collection_ids)] : [],
    scope_product_ids: scope === "products" ? [...new Set(input.scope_product_ids)] : [],
    count_by: input.template === "backup" ? "same_product" : "items",
    tiers: kind === "tiered" ? [...input.tiers].sort((a, b) => a.min_qty - b.min_qty) : [],
    bundle_lines: kind === "bundle" ? input.bundle_lines : [],
    bundle_price: kind === "bundle" && input.price_mode === "price" ? input.bundle_price : null,
    bundle_percent: kind === "bundle" && input.price_mode === "percent" ? input.bundle_percent : null,
    free_delivery: kind === "bundle" ? input.free_delivery : false,
    gift_wrap: kind === "bundle" ? input.gift_wrap : false,
    product_id: kind === "addon" || kind === "gift" ? input.product_id : null,
    product_size: kind === "addon" || kind === "gift" ? input.product_size || null : null,
    addon_price: kind === "addon" ? input.addon_price : null,
    min_subtotal: kind === "addon" || kind === "gift" ? input.min_subtotal : 0,
    updated_at: new Date().toISOString(),
  };
}

/** The form's starting values for a template. */
export function offerDefaults(template: OfferTemplate): OfferInput {
  const base: OfferInput = {
    template,
    title: "",
    description: "",
    is_active: true,
    starts_on: "",
    ends_on: "",
    priority: 0,
    scope: "all",
    scope_brands: [],
    scope_collection_ids: [],
    scope_product_ids: [],
    tiers: [],
    bundle_lines: [],
    price_mode: "percent",
    bundle_price: null,
    bundle_percent: 15,
    free_delivery: false,
    gift_wrap: false,
    product_id: null,
    product_size: "",
    addon_price: null,
    min_subtotal: 0,
  };
  switch (template) {
    case "buy_more":
      return {
        ...base,
        title: "Buy more, save more",
        tiers: [
          { min_qty: 2, percent: 10, free_delivery: true },
          { min_qty: 3, percent: 15, free_delivery: false },
        ],
      };
    case "backup":
      return { ...base, title: "Signature + backup", tiers: [{ min_qty: 2, percent: 15, free_delivery: false }] };
    case "layering":
      return { ...base, title: "Layering duo" };
    case "his_hers":
      return { ...base, title: "His & Hers set" };
    case "house":
      return { ...base, title: "House trio", bundle_percent: 12 };
    case "occasion":
      return { ...base, title: "Gift box", gift_wrap: true, free_delivery: true };
    case "addon":
      return { ...base, title: "Add a favourite", min_subtotal: 100 };
    case "gift":
      return { ...base, title: "A gift with your order", min_subtotal: 400 };
  }
}

/** Shopper-facing one-liner for the admin list ("2+: 10% off + free delivery · 3+: 15% off"). */
export function tierSummary(tiers: { min_qty: number; percent: number; free_delivery?: boolean }[], sameProduct = false): string {
  return [...tiers]
    .sort((a, b) => a.min_qty - b.min_qty)
    .map((t) => {
      const parts = [t.percent > 0 ? `${t.percent}% off` : null, t.free_delivery ? "free delivery" : null].filter(Boolean);
      return `${t.min_qty}${sameProduct ? " of the same" : "+"}: ${parts.join(" + ")}`;
    })
    .join(" · ");
}
