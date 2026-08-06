import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recommend, type QuizAnswers } from "../quiz";
import { toTitleCase } from "../catalogue";
import { checkRateLimit } from "../rate-limit";
import { bagWithOffer, fetchLiveOffers, priceCode } from "./offers";
import type { ConciergeSnapshot } from "./catalogue";
import type { ConciergeAction, ConciergeStockRow, StageQuestion } from "./types";

/**
 * The concierge's tools, and the collector they write into.
 *
 * The collector is the trust boundary. Presentation tools (show_products,
 * present_question, add_to_cart, suggest_replies) do not "return" anything to
 * the shopper — they record intent here, and the route resolves that intent
 * against the database snapshot AFTER the model is done. The model chooses
 * ids; the server decides names, prices, and images. A hallucinated id simply
 * resolves to nothing.
 *
 * Read tools (search, details, stock, recommend) run against the same
 * snapshot, so what the model is told and what the shopper is shown can never
 * disagree. Only check_stock touches the network — availability must be live.
 */

export type ConciergeCollector = {
  /** Ids staged for the product exhibit. Last show_products call wins. */
  stagedIds: number[];
  /** A staged scent-builder question. Mutually exclusive with the other two. */
  stagedQuestion: StageQuestion | null;
  /** A staged order-lookup form. Mutually exclusive with the other two. */
  stagedOrderLookup: { prefillOrderRef: string | null } | null;
  /** Live stock rows fetched this turn, so staged cards can carry them. */
  stockById: Map<number, ConciergeStockRow[]>;
  /** Quick-reply chips. */
  suggestions: string[];
  /** Cart effects for the widget to execute. */
  actions: ConciergeAction[];
  /** A code the customer accepted this turn, parked for the checkout field. */
  offerCode: string | null;
  /** Offer lookups spent this turn, so one turn cannot become a scan. */
  offerCalls: number;
  /** What the agent read out of a photograph, on an image turn. */
  photoReading: string | null;
};

export function createCollector(): ConciergeCollector {
  return {
    stagedIds: [],
    stagedQuestion: null,
    stagedOrderLookup: null,
    stockById: new Map(),
    suggestions: [],
    actions: [],
    offerCode: null,
    offerCalls: 0,
    photoReading: null,
  };
}

/**
 * How many tool steps a turn may take, by kind.
 *
 * Lives here rather than in the route because the outcome classifier has to
 * compare against the SAME number to tell a truncated turn from a finished one
 * — `stepCountIs(n)` stops on `steps.length === n`, so the count alone cannot
 * distinguish "ran out of room" from "happened to finish on the last step".
 * Two copies of this number would drift and quietly mislabel the metric.
 */
export const STEP_BUDGET = { text: 10, photo: 12, retry: 4 } as const;

/** One turn may check offers a few times over; it may not become a scan. */
const MAX_OFFER_CALLS = 3;

const BRANDS = ["Rasasi", "Lattafa", "Armaf", "French Avenue", "Afnan", "Al Haramain"] as const;
const GROUPS = ["Fresh & Aquatic", "Floral & Sweet", "Woody & Oud", "Amber & Oriental"] as const;

/** The one-line summary a search result carries. */
function summarise(snapshot: ConciergeSnapshot, id: number) {
  const p = snapshot.byId.get(id);
  if (!p) return null;
  const m = snapshot.meta.get(id);
  const notes = [p.topNotes[0], p.heartNotes[0], p.baseNotes[0]].filter(Boolean).join(", ");
  return {
    id: p.id,
    brand: toTitleCase(p.brand),
    name: p.name.replace(/_/g, " "),
    priceAed: p.price,
    family: m?.olfactoryGroup || "",
    register: p.gender,
    leadNotes: notes,
    tagline: p.tagline || undefined,
    bestseller: p.isBestseller || undefined,
  };
}

export function buildTools(input: {
  snapshot: ConciergeSnapshot;
  supabase: SupabaseClient;
  collector: ConciergeCollector;
  /** Gates the exclusive slice of the offers list, in the database. */
  sessionId: string;
  /** The rate-limit bucket for offer lookups. */
  clientKey: string;
  /** The bag total, advisory, so an offer can be priced against it. */
  cartSubtotalAed: number | null;
  /** True when this turn carries a photograph. */
  hasImage: boolean;
}) {
  const { snapshot, supabase, collector } = input;

  return {
    search_products: tool({
      description:
        "Filter the maison's catalogue. All filters are optional and combine. Returns compact summaries; use get_product_details for the full dossier.",
      inputSchema: z.object({
        query: z.string().max(80).optional().describe("Free text matched against name, house, tagline and notes"),
        family: z.enum(GROUPS).optional(),
        register: z.enum(["men", "women", "unisex"]).optional(),
        brand: z.enum(BRANDS).optional(),
        minPriceAed: z.number().min(0).optional(),
        maxPriceAed: z.number().min(0).optional(),
        notes: z.array(z.string().max(30)).max(5).optional().describe("Notes that must appear in the pyramid, e.g. [\"oud\", \"vanilla\"]"),
        sort: z.enum(["price_asc", "price_desc", "bestsellers"]).optional(),
        limit: z.number().int().min(1).max(8).optional(),
      }),
      execute: async (args) => {
        const q = args.query?.toLowerCase().trim();
        const wanted = (args.notes ?? []).map((n) => n.toLowerCase().trim()).filter(Boolean);
        let results = snapshot.scored.filter((p) => {
          const m = snapshot.meta.get(p.id);
          if (args.family && (m?.olfactoryGroup || "") !== args.family) return false;
          if (args.register && p.gender !== args.register) return false;
          if (args.brand && p.brand.toUpperCase() !== args.brand.toUpperCase()) return false;
          if (args.minPriceAed !== undefined && p.price < args.minPriceAed) return false;
          if (args.maxPriceAed !== undefined && p.price > args.maxPriceAed) return false;
          const pyramid = [...p.topNotes, ...p.heartNotes, ...p.baseNotes].join(" | ").toLowerCase();
          if (wanted.length > 0 && !wanted.every((n) => pyramid.includes(n))) return false;
          if (q) {
            const haystack = `${p.brand} ${p.name.replace(/_/g, " ")} ${p.tagline} ${pyramid}`.toLowerCase();
            if (!haystack.includes(q)) return false;
          }
          return true;
        });
        if (args.sort === "price_asc") results = [...results].sort((a, b) => a.price - b.price);
        else if (args.sort === "price_desc") results = [...results].sort((a, b) => b.price - a.price);
        else results = [...results].sort((a, b) => Number(b.isBestseller) - Number(a.isBestseller));
        const limit = args.limit ?? 6;
        return {
          totalMatches: results.length,
          results: results.slice(0, limit).map((p) => summarise(snapshot, p.id)),
        };
      },
    }),

    get_product_details: tool({
      description: "The full public dossier for one product: description, complete note pyramid, sizes, price, page link.",
      inputSchema: z.object({ productId: z.number().int() }),
      execute: async ({ productId }) => {
        const p = snapshot.byId.get(productId);
        if (!p) return { error: "unknown_product" };
        const m = snapshot.meta.get(productId);
        return {
          id: p.id,
          brand: toTitleCase(p.brand),
          name: p.name.replace(/_/g, " "),
          priceAed: p.price,
          sizes: p.sizes,
          register: p.gender,
          family: m?.olfactoryGroup || "",
          tagline: p.tagline || undefined,
          topNotes: p.topNotes,
          heartNotes: p.heartNotes,
          baseNotes: p.baseNotes,
          description: (m?.description || "").slice(0, 600) || undefined,
          url: `/product/${p.id}`,
        };
      },
    }),

    check_stock: tool({
      description:
        "Live availability per size for up to six products. Call before asserting availability. low=true means the store itself considers that size low stock.",
      inputSchema: z.object({ productIds: z.array(z.number().int()).min(1).max(6) }),
      execute: async ({ productIds }) => {
        const ids = productIds.filter((id) => snapshot.byId.has(id));
        if (ids.length === 0) return { stock: [] };
        try {
          const { data, error } = await supabase.rpc("get_product_availability", {
            p_product_ids: ids,
          });
          if (error || !Array.isArray(data)) {
            // Pre-migration-53 (or a fault): the concierge must still answer.
            return {
              stock: "unknown",
              note: "Availability could not be checked; tell the customer it is confirmed at checkout.",
            };
          }
          const rows = data as { product_id: number; size: string; stock_level: number; low_stock: boolean }[];
          for (const id of ids) {
            const forProduct = rows
              .filter((r) => r.product_id === id)
              .map((r) => ({ size: r.size, level: r.stock_level, low: r.low_stock }));
            if (forProduct.length > 0) collector.stockById.set(id, forProduct);
          }
          return {
            stock: rows.map((r) => ({
              productId: r.product_id,
              size: r.size,
              level: r.stock_level,
              low: r.low_stock,
            })),
          };
        } catch {
          return {
            stock: "unknown",
            note: "Availability could not be checked; tell the customer it is confirmed at checkout.",
          };
        }
      },
    }),

    recommend_for_profile: tool({
      description:
        "The maison's own matching engine — the same one behind the /discover finder. Give it what you know of the customer; it returns up to three compositions with a match score and an honest reason. Trust its picks.",
      inputSchema: z.object({
        recipient: z.enum(["her", "him", "anyone", "gift"]).optional().describe("Who it is for; gift = safe shared ground"),
        occasion: z.enum(["everyday", "evening", "occasion", "weekend"]).optional().describe("everyday=office and daylight; evening=after dark; occasion=weddings and Eid; weekend=travel and daylight ease"),
        climate: z.enum(["summer", "indoors", "cooler", "allyear"]).optional().describe("summer=outdoors in Gulf heat; indoors=AC life; cooler=winter and desert evenings; allyear=one bottle for all of it"),
        character: z.enum(["citrus", "aromatic", "floral", "sweet", "amber", "woody"]).optional().describe("The world that draws them: citrus and sea air; herbs and clean air; flowers; sweet and edible; amber, resin and spice; wood, oud and smoke"),
        avoid: z.enum(["none", "oud", "sweetness", "florals"]).optional().describe("What they refuse — the single most useful thing to know"),
        count: z.number().int().min(1).max(3).optional(),
      }),
      execute: async (args) => {
        const answers: QuizAnswers = {};
        if (args.recipient) answers.recipient = args.recipient;
        if (args.occasion) answers.occasion = args.occasion;
        if (args.climate) answers.climate = args.climate;
        if (args.character) answers.character = args.character;
        if (args.avoid) answers.avoid = args.avoid;
        const matches = recommend(snapshot.scored, answers, args.count ?? 3);
        return {
          matches: matches.map((m) => ({
            id: m.product.id,
            brand: toTitleCase(m.product.brand),
            name: m.product.name.replace(/_/g, " "),
            priceAed: m.product.price,
            match: m.match,
            style: m.styleLabel,
            reason: m.reason,
          })),
        };
      },
    }),

    show_products: tool({
      description:
        "Stage up to three products in the display window beside the conversation. Call this whenever you name specific products. The most recent call is what the customer sees.",
      inputSchema: z.object({ productIds: z.array(z.number().int()).min(1).max(3) }),
      execute: async ({ productIds }) => {
        const valid = productIds.filter((id) => snapshot.byId.has(id)).slice(0, 3);
        if (valid.length === 0) return { shown: [], note: "No such products in the catalogue." };
        // The stage holds one thing at a time — claiming it clears the rest.
        collector.stagedIds = valid;
        collector.stagedQuestion = null;
        collector.stagedOrderLookup = null;
        return { shown: valid };
      },
    }),

    present_question: tool({
      description:
        "Stage one scent-builder question as tappable option tiles in the display window. One question at a time; the customer's tap arrives as their next message (the option label).",
      inputSchema: z.object({
        id: z.string().max(32).describe("A short slug for this question, e.g. \"occasion\""),
        prompt: z.string().max(120),
        options: z
          .array(
            z.object({
              value: z.string().max(40),
              label: z.string().max(40),
              hint: z.string().max(80).optional(),
            })
          )
          .min(2)
          .max(6),
        allowMultiple: z.boolean().optional(),
      }),
      execute: async (args) => {
        collector.stagedQuestion = {
          id: args.id.trim() || "question",
          prompt: args.prompt.trim(),
          options: args.options.map((o) => ({
            value: o.value.trim(),
            label: o.label.trim(),
            hint: o.hint?.trim() || undefined,
          })),
          allowMultiple: args.allowMultiple || undefined,
        };
        // The stage holds one thing at a time — claiming it clears the rest.
        collector.stagedIds = [];
        collector.stagedOrderLookup = null;
        return { ok: true };
      },
    }),

    present_order_lookup: tool({
      description:
        "Put the secure order-lookup form on the display, for any question about where an existing order is. Do NOT ask for the order number or the email yourself — the form takes them privately and you will never see them. Say one warm sentence inviting them to fill it in.",
      inputSchema: z.object({
        orderRef: z
          .string()
          .max(64)
          .optional()
          .describe("Only if the customer already typed their order reference; otherwise omit"),
      }),
      execute: async ({ orderRef }) => {
        collector.stagedOrderLookup = { prefillOrderRef: orderRef?.trim() || null };
        // The stage holds one thing at a time — claiming it clears the rest.
        collector.stagedIds = [];
        collector.stagedQuestion = null;
        return { ok: true, note: "The form is up. You cannot see what they type into it." };
      },
    }),

    add_to_cart: tool({
      description:
        "Add a product to the customer's shopping bag. ONLY when they clearly asked to add or buy, or accepted your direct offer. Confirm in words afterwards.",
      inputSchema: z.object({
        productId: z.number().int(),
        size: z.string().max(30).optional().describe("Must be one of the product's sizes; omitted = its first size"),
        quantity: z.number().int().min(1).max(5).optional(),
      }),
      execute: async ({ productId, size, quantity }) => {
        if (collector.actions.length >= 3) {
          return { ok: false, error: "Too many additions in one reply." };
        }
        const p = snapshot.byId.get(productId);
        if (!p) return { ok: false, error: "unknown_product" };
        const chosenSize = size && p.sizes.includes(size) ? size : p.sizes[0];
        if (!chosenSize) return { ok: false, error: "no_size_available" };
        collector.actions.push({
          type: "add_to_cart",
          product: {
            id: p.id,
            brand: toTitleCase(p.brand),
            name: p.name.replace(/_/g, " "),
            priceAed: p.price,
            image: p.image || "/placeholder-bottle.png",
          },
          size: chosenSize,
          quantity: quantity ?? 1,
        });
        return { ok: true, added: p.name.replace(/_/g, " "), size: chosenSize, quantity: quantity ?? 1, priceAed: p.price };
      },
    }),

    list_offers: tool({
      description:
        "The offers running right now. Call it when the customer asks about discounts, offers, deals or codes — never answer from memory. Codes marked exclusive are the maison's own for this conversation and you may offer them; every other code is public, and you may name it but must not compute what it saves unless the customer asks about that code by name.",
      inputSchema: z.object({}),
      execute: async () => {
        if (collector.offerCalls >= MAX_OFFER_CALLS) {
          return { offers: [], note: "Already checked the offers this turn." };
        }
        collector.offerCalls += 1;
        const allowed = await checkRateLimit(
          supabase,
          `concierge:offers:${input.clientKey}`,
          12,
          600
        );
        if (!allowed) return { offers: [], note: "Offers cannot be checked just now." };

        const offers = await fetchLiveOffers(supabase, input.sessionId);
        const subtotal = input.cartSubtotalAed;

        return {
          offers: offers.map((o) => {
            // A public code is named, never priced. The asymmetry is the whole
            // point: the model cannot volunteer arithmetic it was not given.
            if (!o.exclusive) {
              return {
                code: o.code,
                headline: o.title,
                minimumAed: o.minimumAed || undefined,
                endsOn: o.endsOn || undefined,
                exclusive: false as const,
              };
            }
            const priced =
              subtotal != null && subtotal > 0
                ? bagWithOffer(
                    subtotal,
                    o.kind === "percentage" ? (subtotal * o.value) / 100 : Math.min(o.value, subtotal)
                  )
                : null;
            return {
              code: o.code,
              headline: o.title,
              saves: o.kind === "percentage" ? `${o.value}%` : `AED ${o.value}`,
              minimumAed: o.minimumAed || undefined,
              endsOn: o.endsOn || undefined,
              exclusive: true as const,
              appliesNow: subtotal != null ? subtotal >= o.minimumAed : undefined,
              bag: priced
                ? {
                    subtotalAed: priced.subtotalAed,
                    discountAed: Math.round(priced.discountAed * 100) / 100,
                    deliveryAed: priced.deliveryAed,
                    totalAed: Math.round(priced.totalAed * 100) / 100,
                    toFreeDeliveryAed: priced.toFreeDeliveryAed || undefined,
                  }
                : undefined,
            };
          }),
          bagSubtotalAed: subtotal ?? undefined,
          note:
            "Delivery is decided on the basket BEFORE any discount, so a code never costs someone free delivery.",
        };
      },
    }),

    check_offer: tool({
      description:
        "Price one code the customer named, against their basket. Use it when they ask 'does CODE work?' or 'what would that save me?'. Set saveForCheckout when they accept it, and say so — it will be waiting in the discount field at checkout for them to apply.",
      inputSchema: z.object({
        code: z.string().min(1).max(100),
        saveForCheckout: z
          .boolean()
          .optional()
          .describe("Only when the customer has clearly accepted the code"),
      }),
      execute: async ({ code, saveForCheckout }) => {
        if (collector.offerCalls >= MAX_OFFER_CALLS) {
          return { ok: false, note: "Already checked the offers this turn." };
        }
        collector.offerCalls += 1;
        const allowed = await checkRateLimit(
          supabase,
          `concierge:offers:${input.clientKey}`,
          12,
          600
        );
        if (!allowed) return { ok: false, note: "Offers cannot be checked just now." };

        const subtotal = input.cartSubtotalAed ?? 0;
        const priced = await priceCode(supabase, code.trim(), subtotal);
        if (!priced.valid) {
          return {
            ok: false,
            reason: priced.reason,
            minimumAed: priced.minimumAed ?? undefined,
            note:
              priced.reason === "minimum_not_met"
                ? "The code is real but their basket is below its minimum — tell them what it would take."
                : "Say only that it is not valid; do not speculate about why.",
          };
        }
        if (saveForCheckout) collector.offerCode = priced.code;
        const bag = bagWithOffer(subtotal, priced.discountAed);
        return {
          ok: true,
          code: priced.code,
          discountAed: priced.discountAed,
          bag: subtotal > 0
            ? {
                subtotalAed: bag.subtotalAed,
                deliveryAed: bag.deliveryAed,
                totalAed: Math.round(bag.totalAed * 100) / 100,
                toFreeDeliveryAed: bag.toFreeDeliveryAed || undefined,
              }
            : undefined,
          saved: Boolean(saveForCheckout),
        };
      },
    }),

    record_photo_reading: tool({
      description:
        "Record what the bottle in the customer's photograph appears to be, as a short name. Call it once on any turn carrying a photograph, before you reply. It is how the conversation remembers the bottle after the picture itself is gone.",
      inputSchema: z.object({
        reading: z
          .string()
          .min(1)
          .max(120)
          .describe('The house and name as best you can read them, e.g. "Baccarat Rouge 540" — or "unclear" if you genuinely cannot tell'),
      }),
      execute: async ({ reading }) => {
        // Always present in the tool set so its key set never varies between
        // turns; it simply declines when there is nothing to read. The model
        // only learns it exists from the PHOTO PROTOCOL prompt section, which
        // is itself conditional.
        if (!input.hasImage) return { ok: false, note: "There is no photograph on this turn." };
        collector.photoReading = reading.trim().replace(/[\n\r[\]]/g, " ").slice(0, 120);
        return { ok: true };
      },
    }),

    suggest_replies: tool({
      description:
        "Two to four short quick-reply chips the customer can tap next. Call this at the end of every reply.",
      inputSchema: z.object({
        suggestions: z.array(z.string().min(1).max(48)).min(1).max(4),
      }),
      execute: async ({ suggestions }) => {
        collector.suggestions = suggestions.map((s) => s.trim()).filter(Boolean).slice(0, 4);
        return { ok: true };
      },
    }),
  };
}
