import "server-only";
import { createServerSupabase, isSupabaseConfigured } from "../supabase-server";
import { fetchQuizCatalogue } from "../quiz-catalogue";
import { toArray, toTitleCase } from "../catalogue";
import type { ScoredProduct } from "../quiz";
import type { ConciergeCard, ConciergeStockRow } from "./types";

/**
 * The concierge's view of the catalogue.
 *
 * Built on the finder's catalogue (fetchQuizCatalogue) so the concierge and
 * /discover read every composition identically — same scent vectors, same
 * gender reading, same "no notes, not listed" rule. One extra query fetches
 * the columns the finder does not carry (description, olfactory_group, is_new)
 * because the agent's product dossier needs them.
 *
 * Cached in-module for 60 seconds: the catalogue changes at admin speed, not
 * chat speed, and two queries per message would be pure waste. Stock is NOT
 * cached here — check_stock hits the database live on every call, because
 * "how many are left" is the one answer that must never be a minute old.
 */

export type ConciergeSnapshot = {
  scored: ScoredProduct[];
  byId: Map<number, ScoredProduct>;
  meta: Map<number, { description: string; olfactoryGroup: string; isNew: boolean }>;
  digest: string;
};

/* select("*") on purpose — the migration-31 editorial columns must never be
   named in a column list. Only the fields below are read. */
type MetaRow = {
  id: number;
  description?: string | null;
  olfactory_group?: string | null;
  is_new?: boolean | null;
};

const SNAPSHOT_TTL_MS = 60_000;

let cached: { at: number; snapshot: ConciergeSnapshot } | null = null;
let pending: Promise<ConciergeSnapshot | null> | null = null;

/**
 * One line per product. This rides inside the system prompt so the model
 * knows the entire assortment without a retrieval round-trip — the tools then
 * correct and deepen rather than discover. Notes are deliberately absent
 * (get_product_details carries them); a line must stay short enough that 138
 * of them cost ~3K tokens, not 30K.
 */
function buildDigest(scored: ScoredProduct[], meta: ConciergeSnapshot["meta"]): string {
  const lines = scored.map((p) => {
    const m = meta.get(p.id);
    const flags = [p.isBestseller ? "bestseller" : "", m?.isNew ? "new" : ""]
      .filter(Boolean)
      .join(",");
    return [
      `#${p.id}`,
      toTitleCase(p.brand),
      p.name.replace(/_/g, " "),
      `AED ${Math.round(p.price)}`,
      m?.olfactoryGroup || "",
      p.gender,
      flags,
    ].join("|");
  });
  return lines.join("\n");
}

export async function getConciergeCatalogue(): Promise<ConciergeSnapshot | null> {
  if (!isSupabaseConfigured) return null;

  const now = Date.now();
  if (cached && now - cached.at < SNAPSHOT_TTL_MS) return cached.snapshot;
  // Concurrent requests share one rebuild rather than racing four of them.
  if (pending) return pending;

  pending = (async () => {
    try {
      const supabase = createServerSupabase();
      const [scored, metaResult] = await Promise.all([
        fetchQuizCatalogue(),
        supabase.from("products").select("*"),
      ]);
      if (scored.length === 0) return cached?.snapshot ?? null;

      const meta = new Map<number, { description: string; olfactoryGroup: string; isNew: boolean }>();
      if (!metaResult.error && Array.isArray(metaResult.data)) {
        for (const row of metaResult.data as MetaRow[]) {
          meta.set(row.id, {
            description: row.description || "",
            olfactoryGroup: row.olfactory_group || "",
            isNew: Boolean(row.is_new),
          });
        }
      }

      const snapshot: ConciergeSnapshot = {
        scored,
        byId: new Map(scored.map((p) => [p.id, p])),
        meta,
        digest: buildDigest(scored, meta),
      };
      cached = { at: Date.now(), snapshot };
      return snapshot;
    } catch (err) {
      console.error("Concierge catalogue load failed:", err);
      return cached?.snapshot ?? null;
    } finally {
      pending = null;
    }
  })();

  return pending;
}

/**
 * Turns validated product ids into card payloads. Everything on a card comes
 * from the snapshot; ids the snapshot does not know are dropped silently —
 * an invented product must die here, not reach a shopper's screen.
 */
export function resolveCards(
  ids: number[],
  snapshot: ConciergeSnapshot,
  stockById: Map<number, ConciergeStockRow[]>
): ConciergeCard[] {
  const seen = new Set<number>();
  const cards: ConciergeCard[] = [];
  for (const id of ids) {
    if (seen.has(id) || cards.length >= 3) continue;
    const p = snapshot.byId.get(id);
    if (!p) continue;
    seen.add(id);
    cards.push({
      id: p.id,
      brand: toTitleCase(p.brand),
      name: p.name.replace(/_/g, " "),
      priceAed: p.price,
      image: p.image || "/placeholder-bottle.png",
      sizes: toArray(p.sizes),
      topNotes: p.topNotes,
      heartNotes: p.heartNotes,
      baseNotes: p.baseNotes,
      tagline: p.tagline,
      stock: stockById.get(p.id) ?? null,
    });
  }
  return cards;
}
