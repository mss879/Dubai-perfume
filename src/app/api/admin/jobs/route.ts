import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../lib/admin-route";
import { readStoreFeaturesFresh } from "../../../lib/features-server";
import { runGiftCardJob, runReorderJob, runStockAlertJob } from "../../../lib/growth-jobs";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { MIGRATION_70 } from "../../../admin/_lib/feature-data";

/** "Send now" on a feature's page: runs that one job immediately. */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const parsed = await readAdminJson(request, 512);
  if (!parsed.ok) return parsed.response;
  const job = (parsed.body as { job?: unknown } | null)?.job;

  const { features, missing } = await readStoreFeaturesFresh(await createSessionSupabase());
  if (missing) return reply(503, { error: MIGRATION_70 });

  const report =
    job === "gift_cards"
      ? await runGiftCardJob()
      : job === "back_in_stock"
        ? await runStockAlertJob(features)
        : job === "reorder"
          ? await runReorderJob(features)
          : null;
  if (!report) return reply(422, { error: "Unknown job." });
  return reply(200, { ok: true, ...report });
}
