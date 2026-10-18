import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { readStoreFeaturesFresh } from "../../../lib/features-server";
import { runDueJobs } from "../../../lib/growth-jobs";
import { jobSecret } from "../../../lib/marketing-links";
import { createServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

/**
 * The scheduled run of the store's own emails (gift cards, back in stock,
 * reorder reminders, birthdays). Called every 15 minutes by
 * netlify/functions/marketing-jobs.mts with `Authorization: Bearer
 * <CART_RECOVERY_SECRET>`; the database checks the same secret again.
 * Answers with counts only.
 */

export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const secret = jobSecret();
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  const supplied = match ? match[1].trim() : "";
  if (secret.length < 20 || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Store database is not configured." }, { status: 503 });
  const { features, missing } = await readStoreFeaturesFresh(createServerSupabase());
  if (missing) return NextResponse.json({ ok: true, skipped: "migration 70 has not run" });
  const report = await runDueJobs(features);
  return NextResponse.json({ ok: true, report }, { headers: { "Cache-Control": "no-store" } });
}
