import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";
import { isBot, readJsonBody } from "../../lib/request-guard";
import { sendEmail } from "../../lib/email/send";
import { welcomeCodeEmail } from "../../lib/email/growth-templates";
import { liveFeature } from "../../lib/features-server";
import { unsubscribeUrl } from "../../lib/marketing-links";

/**
 * The welcome offer's sign-up (Admin → Welcome offer): joins the list and, for
 * an address that has never ordered, issues a personal first-order code
 * (claim_welcome_offer, migration 70), shown on screen and emailed.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody<{ email?: unknown; company?: unknown }>(request, 2 * 1024);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: parsed.status });
  if (isBot(parsed.body.company)) return NextResponse.json({ ok: true, code: null });
  const email = String(parsed.body.email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 422 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ ok: false, error: "Sign-up is unavailable just now." }, { status: 503 });

  const supabase = createServerSupabase();
  const key = clientKey(request);
  if (!(await checkRateLimit(supabase, `welcome:ip:${key}`, 5, 3600))) {
    return NextResponse.json({ ok: false, error: "Please wait a little before trying again." }, { status: 429 });
  }

  const { data, error } = await supabase.rpc("claim_welcome_offer", { p_email: email });
  const result = (data ?? {}) as { ok?: boolean; code?: string | null; ends_at?: string | null; repeat?: boolean; reason?: string };
  if (error || !result.ok) {
    if (result.reason === "invalid_email") return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 422 });
    return NextResponse.json({ ok: false, error: "Sign-up is unavailable just now." }, { status: 503 });
  }

  // A new code is also emailed, so it isn't lost when the card closes.
  if (result.code && !result.repeat) {
    const feature = await liveFeature("welcome_offer");
    const s = feature.settings;
    const rewardLine =
      s.reward === "gift"
        ? "A complimentary perfume joins your first order."
        : s.reward === "amount"
          ? `AED ${Number(s.amount) || 0} off your first order.`
          : `${Number(s.percent) || 0}% off your first order.`;
    const min = Number(s.min_order) || 0;
    await sendEmail(
      {
        to: email,
        ...welcomeCodeEmail({
          code: result.code,
          rewardLine: min > 0 ? `${rewardLine.replace(/\.$/, "")}, on orders of AED ${min} or more.` : rewardLine,
          endsAt: result.ends_at ?? null,
          finePrint: String(s.fine_print || ""),
          unsubscribeUrl: unsubscribeUrl(email),
        }),
      },
      { quiet: true, idempotencyKey: `welcome-${result.code}` }
    ).catch(() => null);
  }
  return NextResponse.json({ ok: true, code: result.code ?? null }, { headers: { "Cache-Control": "no-store" } });
}
