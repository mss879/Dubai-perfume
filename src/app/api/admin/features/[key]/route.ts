import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../../lib/admin-route";
import { FEATURES, isFeatureKey, readFeatureSettings, validateFeatureSettings } from "../../../../lib/features";
import { forgetStoreFeatures } from "../../../../lib/features-server";
import { isMissingFunction } from "../../../../lib/rpc-errors";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { MIGRATION_70 } from "../../../../admin/_lib/feature-data";

/**
 * Switch a feature on or off, and/or save its settings (migration 70).
 * Body: { enabled?: boolean, settings?: {...} }. Settings are checked against
 * the feature's definition (lib/features.ts) and saved whole.
 */

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const key = (await params).key;
  if (!isFeatureKey(key)) return reply(404, { error: "That feature doesn't exist." });

  const parsed = await readAdminJson(request, 20 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as { enabled?: unknown; settings?: unknown } | null;
  if (!body || typeof body !== "object") return reply(422, { error: "Nothing to change." });
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") return reply(422, { error: "Choose on or off." });

  let settings: Record<string, unknown> | null = null;
  if (body.settings !== undefined) {
    const checked = validateFeatureSettings(key, body.settings);
    if (!checked.ok) return reply(422, { error: checked.error, field: checked.field });
    settings = checked.settings;
  }
  if (body.enabled === undefined && settings === null) return reply(422, { error: "Nothing to change." });

  const supabase = await createSessionSupabase();

  // The welcome gift must be a perfume the shop sells, in a size it has.
  if (key === "welcome_offer" && settings && settings.reward === "gift") {
    const { data: product } = await supabase
      .from("products")
      .select("id, sizes")
      .eq("id", Number(settings.gift_product_id))
      .maybeSingle();
    const sizes = Array.isArray(product?.sizes) ? (product.sizes as string[]) : [];
    if (!product) return reply(422, { error: "Welcome offer: that perfume isn't in the catalogue.", field: "gift_product_id" });
    if (settings.gift_size && !sizes.includes(String(settings.gift_size))) {
      return reply(422, { error: "Welcome offer: choose one of that perfume's sizes.", field: "gift_product_id" });
    }
    if (!settings.gift_size) settings.gift_size = sizes[0] ?? "";
  }

  const { data, error } = await supabase.rpc("admin_set_store_feature", {
    p_key: key,
    p_enabled: typeof body.enabled === "boolean" ? body.enabled : null,
    p_settings: settings,
  });
  if (error) {
    if (isMissingFunction(error)) return reply(503, { error: MIGRATION_70 });
    if (error.code === "42501") return reply(403, { error: "Not authorised." });
    if (error.code === "22023") return reply(422, { error: "Those settings couldn't be saved. Check each field." });
    return reply(500, { error: "The settings could not be saved. Try again." });
  }
  forgetStoreFeatures();
  const row = (data ?? {}) as { enabled?: boolean; settings?: unknown; updated_at?: string };
  return reply(200, {
    ok: true,
    name: FEATURES[key].name,
    enabled: row.enabled === true,
    settings: readFeatureSettings(key, row.settings),
    updatedAt: row.updated_at ?? null,
  });
}
