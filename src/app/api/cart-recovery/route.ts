import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { isMissingFunction } from "../../lib/rpc-errors";
import { getAdminIdentity } from "../../lib/auth";
import { isEmailConfigured, sendEmail } from "../../lib/email/send";
import { abandonedCartRecoveryEmail } from "../../lib/email/templates";
import {
  RECOVERY_BATCH_LIMIT,
  RECOVERY_MAX_AGE_HOURS,
  RECOVERY_SEND_CONCURRENCY,
  RECOVERY_STAGES,
  minGapMinutes,
  normalizeRecoveryItems,
  type ClaimedCart,
} from "../../lib/cart-recovery";

/**
 * The abandoned-cart recovery job.
 *
 * Carts have been captured since migration 12 and never read back; this is the
 * send. Run it hourly — it walks the three stages in
 * lib/cart-recovery.ts, claims what is due and mails it.
 *
 * Two ways in, both server-side:
 *   • `Authorization: Bearer <CART_RECOVERY_SECRET>` — for the scheduler.
 *   • A signed-in admin session — the "send now" button in the admin.
 *
 * Either way the secret is what the DATABASE checks: the claim function returns
 * customer PII, so it refuses to run without it. Set it in both places
 * (see the operations note at the foot of migration 45) or nothing sends.
 *
 * Claiming stamps the cart before the mail is attempted, so a crash mid-run
 * skips a reminder rather than repeating one. Anything Resend refuses is handed
 * straight back to the queue.
 */

export const dynamic = "force-dynamic";

const secret = process.env.CART_RECOVERY_SECRET || "";

/** Length-independent comparison, so a wrong secret leaks nothing by timing. */
function secretMatches(supplied: string): boolean {
  if (!secret || supplied.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i += 1) {
    diff |= supplied.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

function bearerToken(request: NextRequest): string {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

type StageReport = {
  stage: number;
  label: string;
  claimed: number;
  sent: number;
  failed: number;
  /** True when the batch filled — more are waiting for the next run. */
  more: boolean;
};

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Store database is not configured." }, { status: 503 });
  }

  // The env comparison happens before any database work, so a wrong secret
  // costs an attacker a string compare and nothing else.
  const authorised = secretMatches(bearerToken(request)) || Boolean(await getAdminIdentity());
  if (!authorised) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  if (!secret) {
    return NextResponse.json(
      {
        error:
          "CART_RECOVERY_SECRET is not set. Generate one, store it in app_config, and set the same value in the environment — see migration 45.",
      },
      { status: 503 }
    );
  }
  if (!isEmailConfigured) {
    return NextResponse.json(
      { error: "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL)." },
      { status: 503 }
    );
  }

  // Test overrides. Both are already behind the secret, and both only ever
  // narrow or hurry the queue — neither can reach a cart the schedule excludes.
  const url = new URL(request.url);
  const onlyStage = Number(url.searchParams.get("stage")) || null;
  const minAgeOverride = url.searchParams.has("minAgeMinutes")
    ? Math.max(0, Number(url.searchParams.get("minAgeMinutes")) || 0)
    : null;

  const supabase = createServerSupabase();
  const stages = RECOVERY_STAGES.filter((s) => !onlyStage || s.stage === onlyStage);
  const report: StageReport[] = [];

  for (const stage of stages) {
    const { data, error } = await supabase.rpc("claim_abandoned_carts_for_recovery", {
      p_secret: secret,
      p_stage: stage.stage,
      p_min_age_minutes: minAgeOverride ?? stage.afterMinutes,
      p_min_gap_minutes: minAgeOverride !== null ? 0 : minGapMinutes(stage.stage),
      p_max_age_hours: RECOVERY_MAX_AGE_HOURS,
      p_limit: RECOVERY_BATCH_LIMIT,
    });

    if (error) {
      if (isMissingFunction(error)) {
        console.error("claim_abandoned_carts_for_recovery is missing — apply migration 45.");
        return NextResponse.json(
          { error: "Cart recovery is not available yet (migration 45 has not been applied)." },
          { status: 503 }
        );
      }
      if (/unauthorized/i.test(error.message || "")) {
        console.error(
          "Cart recovery refused by the database: CART_RECOVERY_SECRET does not match app_config.cart_recovery."
        );
        return NextResponse.json(
          { error: "The recovery secret does not match the one stored in the database." },
          { status: 401 }
        );
      }
      console.error(`Cart recovery claim failed at stage ${stage.stage}:`, error.message);
      return NextResponse.json({ error: "Could not read the recovery queue." }, { status: 500 });
    }

    const carts = (Array.isArray(data) ? data : []) as ClaimedCart[];
    const outcome = await sendStage(supabase, stage.stage, carts);

    report.push({
      stage: stage.stage,
      label: stage.label,
      claimed: carts.length,
      sent: outcome.sent,
      failed: outcome.failed,
      more: carts.length >= RECOVERY_BATCH_LIMIT,
    });

    if (carts.length >= RECOVERY_BATCH_LIMIT) {
      console.warn(
        `[cart-recovery] stage ${stage.stage} filled its batch of ${RECOVERY_BATCH_LIMIT} — more carts are queued for the next run.`
      );
    }
  }

  const sent = report.reduce((n, s) => n + s.sent, 0);
  const failed = report.reduce((n, s) => n + s.failed, 0);
  console.info(`[cart-recovery] sent ${sent}, failed ${failed}`);

  return NextResponse.json({ ok: true, sent, failed, stages: report });
}

/**
 * Mails one stage's claimed carts, a few at a time.
 *
 * A cart whose mail does not go out is released back to the queue: it was
 * stamped as reminded before the attempt, and leaving it stamped would silently
 * cost that shopper the reminder.
 */
async function sendStage(
  supabase: ReturnType<typeof createServerSupabase>,
  stage: number,
  carts: ClaimedCart[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < carts.length; i += RECOVERY_SEND_CONCURRENCY) {
    const batch = carts.slice(i, i + RECOVERY_SEND_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (cart) => {
        try {
          return await sendOne(stage, cart);
        } catch (err) {
          console.error(
            `[cart-recovery] cart ${cart.id} threw:`,
            err instanceof Error ? err.message : err
          );
          return false;
        }
      })
    );

    for (let j = 0; j < results.length; j += 1) {
      if (results[j]) {
        sent += 1;
      } else {
        failed += 1;
        await release(supabase, batch[j].id, stage);
      }
    }
  }

  return { sent, failed };
}

/** One reminder. False means it did not go out and the cart should be released. */
async function sendOne(stage: number, cart: ClaimedCart): Promise<boolean> {
  const items = normalizeRecoveryItems(cart.cart_items);
  if (items.length === 0) {
    // Nothing left to remind them about. Not a failure — releasing it would
    // only put an unmailable cart back at the front of the queue forever.
    console.warn(`[cart-recovery] cart ${cart.id} has no usable lines — skipped.`);
    return true;
  }

  // Priced from the saved lines rather than total_price: that column includes
  // the delivery fee the checkout was quoting, and this email shows a subtotal.
  const subtotalAed = items.reduce((sum, l) => sum + l.unitPriceAed * l.quantity, 0);

  const message = abandonedCartRecoveryEmail({
    stage,
    firstName: cart.first_name,
    items,
    subtotalAed,
    token: cart.token,
  });

  const result = await sendEmail({ to: cart.email, ...message });
  if (!result.ok) {
    console.error(`[cart-recovery] cart ${cart.id} stage ${stage} not sent: ${result.reason}`);
    return false;
  }
  return true;
}

async function release(
  supabase: ReturnType<typeof createServerSupabase>,
  id: string,
  stage: number
) {
  const { error } = await supabase.rpc("release_abandoned_cart_recovery", {
    p_secret: secret,
    p_id: id,
    p_stage: stage,
  });
  if (error) {
    // The cart stays stamped, so it loses this one reminder. Loud, because the
    // alternative is a silent hole in the sequence.
    console.error(`[cart-recovery] could not release cart ${id}:`, error.message);
  }
}
