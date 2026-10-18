import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { isMissingFunction } from "../../lib/rpc-errors";
import { getAdminIdentity } from "../../lib/auth";
import { isSameOrigin } from "../../lib/request-guard";
import { SITE_URL } from "../../lib/site";
import { isEmailConfigured, sendEmail } from "../../lib/email/send";
import { abandonedCartRecoveryEmail } from "../../lib/email/templates";
import { liveStorefrontPaymentMode } from "../../lib/storefront-payment-mode";
import { readStoreFeaturesFresh } from "../../lib/features-server";
import { allFeaturesOff, type StoreFeatures } from "../../lib/features";
import { loadOfferCards } from "../../lib/offers-server";
import {
  RECOVERY_BATCH_LIMIT,
  RECOVERY_MAX_AGE_HOURS,
  RECOVERY_SEND_CONCURRENCY,
  RECOVERY_STAGES,
  minGapMinutes,
  normalizeRecoveryItems,
  type ClaimedCart,
  type NormalizedRecoveryItem,
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
  // costs an attacker a string compare and nothing else. The admin's button is
  // a same-site request only, so another site cannot make an admin's browser
  // send a batch of customer emails.
  const bySecret = secretMatches(bearerToken(request));
  const authorised =
    bySecret || (isSameOrigin(request, SITE_URL) && Boolean(await getAdminIdentity()));
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

  // Test overrides, honoured only with the secret (the admin's button always
  // runs the normal schedule). Both only ever narrow or hurry the queue —
  // neither can reach a cart the schedule excludes.
  const url = new URL(request.url);
  const onlyStage = bySecret ? Number(url.searchParams.get("stage")) || null : null;
  const minAgeOverride =
    bySecret && url.searchParams.has("minAgeMinutes")
      ? Math.max(0, Number(url.searchParams.get("minAgeMinutes")) || 0)
      : null;

  const supabase = createServerSupabase();

  // Migration 70: the schedule sends only while "Cart reminder emails" is on;
  // the admin's button always works. The switch also decides the last
  // reminder's code and set suggestion.
  const { features } = await readStoreFeaturesFresh(supabase).catch(() => ({ features: allFeaturesOff() }));
  if (bySecret && url.searchParams.get("scheduled") === "1" && !features.cart_reminders.enabled) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: "Cart reminder emails are switched off." });
  }

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
    const outcome = await sendStage(supabase, stage.stage, carts, features);

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
  carts: ClaimedCart[],
  features: StoreFeatures
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < carts.length; i += RECOVERY_SEND_CONCURRENCY) {
    const batch = carts.slice(i, i + RECOVERY_SEND_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (cart) => {
        try {
          return await sendOne(supabase, stage, cart, features);
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
async function sendOne(
  supabase: ReturnType<typeof createServerSupabase>,
  stage: number,
  cart: ClaimedCart,
  features: StoreFeatures
): Promise<boolean> {
  const items = await fromCatalogue(supabase, normalizeRecoveryItems(cart.cart_items));
  if (items.length === 0) {
    // Nothing left to remind them about. Not a failure — releasing it would
    // only put an unmailable cart back at the front of the queue forever.
    console.warn(`[cart-recovery] cart ${cart.id} has no usable lines — skipped.`);
    return true;
  }

  // Priced from the catalogue rather than total_price: that column includes
  // the delivery fee the checkout was quoting, and this email shows a subtotal.
  const subtotalAed = items.reduce((sum, l) => sum + l.unitPriceAed * l.quantity, 0);

  const lastStage = stage === RECOVERY_STAGES[RECOVERY_STAGES.length - 1].stage;
  const extras = lastStage && features.cart_reminders.enabled ? await lastReminderExtras(supabase, cart, items, features) : {};

  const message = abandonedCartRecoveryEmail({
    stage,
    firstName: plainFirstName(cart.first_name),
    items,
    subtotalAed,
    token: cart.token,
    // Says "pay on delivery" or "secure payment" as the store is set right now.
    paymentMode: await liveStorefrontPaymentMode(),
    ...extras,
  });

  const result = await sendEmail({ to: cart.email, ...message });
  if (!result.ok) {
    console.error(`[cart-recovery] cart ${cart.id} stage ${stage} not sent: ${result.reason}`);
    return false;
  }
  return true;
}

/**
 * Migration 70: the last reminder's single-use code (made for this cart and
 * this shopper only) and a set that includes something they left. Either may
 * be missing; neither stops the reminder.
 */
async function lastReminderExtras(
  supabase: ReturnType<typeof createServerSupabase>,
  cart: ClaimedCart,
  items: NormalizedRecoveryItem[],
  features: StoreFeatures
): Promise<{ code?: { code: string; percent: number; endsAt: string | null; minOrder: number }; bundle?: { title: string; priceAed: number; baseAed: number; names: string[]; url: string } }> {
  const out: Awaited<ReturnType<typeof lastReminderExtras>> = {};
  const s = features.cart_reminders.settings;
  if (s.code_enabled) {
    const { data } = await supabase.rpc("issue_recovery_code", { p_secret: secret, p_cart_id: cart.id });
    const issued = data as { code?: string | null; percent?: number; ends_at?: string | null; min_order?: number } | null;
    if (issued?.code) {
      out.code = { code: issued.code, percent: Number(issued.percent) || 0, endsAt: issued.ends_at ?? null, minOrder: Number(issued.min_order) || 0 };
    }
  }
  if (s.bundle_suggestion) {
    for (const item of items.slice(0, 3)) {
      const cards = await loadOfferCards(item.productId);
      const set = cards.find((c) => c.kind === "bundle" && c.bundle && c.bundle.lines.length > 1);
      if (set?.bundle) {
        out.bundle = {
          title: set.title,
          priceAed: set.bundle.price,
          baseAed: set.bundle.base,
          names: set.bundle.lines.map((l) => l.name),
          url: `${SITE_URL}/product/${item.productId}`,
        };
        break;
      }
    }
  }
  return out;
}

/**
 * The saved lines' names, brands and prices come from whoever filled in the
 * checkout form, and anyone can save a cart for any address. So the email
 * never shows them: each line is rebuilt from the catalogue by product id, the
 * way the restore page already does. Lines whose perfume is gone or hidden are
 * dropped.
 */
async function fromCatalogue(
  supabase: ReturnType<typeof createServerSupabase>,
  saved: NormalizedRecoveryItem[]
): Promise<NormalizedRecoveryItem[]> {
  const ids = [...new Set(saved.map((s) => s.productId))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("products").select("id, brand, name, price, sizes").in("id", ids);
  if (error) throw new Error("catalogue unavailable");
  const byId = new Map(
    ((data ?? []) as { id: number; brand: string | null; name: string; price: number | string; sizes: string[] | null }[]).map(
      (p) => [p.id, p]
    )
  );
  return saved.flatMap((s) => {
    const product = byId.get(s.productId);
    if (!product) return [];
    const sizes = Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [];
    return [
      {
        ...s,
        brand: String(product.brand ?? "").trim(),
        name: String(product.name ?? "").trim(),
        size: sizes.length === 0 || sizes.includes(s.size) ? s.size : sizes[0],
        unitPriceAed: Number(product.price) || 0,
      },
    ];
  });
}

/** A greeting name only when it looks like one; otherwise the email says "Hello". */
function plainFirstName(value: string | null): string | null {
  const name = (value ?? "").trim();
  return name.length <= 40 && /^[\p{L}][\p{L}\p{M} .'-]*$/u.test(name) ? name : null;
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
