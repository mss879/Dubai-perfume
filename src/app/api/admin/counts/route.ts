import { NextResponse } from "next/server";
import { getAdminIdentity } from "../../../lib/auth";
import { createSessionSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";
import { readCounts } from "../../../admin/_lib/counts";

/**
 * The admin badges' refresh: counts only (no names, no addresses), for the
 * signed-in admin. Polled once a minute while the admin tab is visible.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Store database is not configured." }, { status: 503 });
  }
  if (!(await getAdminIdentity())) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  const counts = await readCounts(await createSessionSupabase());
  return NextResponse.json(counts, { headers: { "Cache-Control": "no-store" } });
}
