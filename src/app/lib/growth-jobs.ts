import "server-only";
import { createServerSupabase, isSupabaseConfigured } from "./supabase-server";
import { isEmailConfigured, sendEmail } from "./email/send";
import { backInStockEmail, birthdayEmail, giftCardEmail, giftCardReceiptEmail, reorderEmail } from "./email/growth-templates";
import { fillTemplate, type StoreFeatures } from "./features";
import { jobSecret, reorderUrl, unsubscribeUrl } from "./marketing-links";
import { SITE_URL } from "./site";

/**
 * The store's scheduled emails (migration 70): gift cards to their
 * recipients, back-in-stock alerts, reorder reminders and birthday points.
 *
 * Each job claims what is due and stamps it in one database call, then mails
 * it; anything the mail service refuses is handed back for the next run. The
 * database checks the jobs' secret (CART_RECOVERY_SECRET, migration 45), so
 * none of this can be run with the public key alone.
 *
 * Nothing here prints customer data: the log line is counts only.
 */

export type JobReport = { sent: number; failed: number; note?: string };
type Supabase = ReturnType<typeof createServerSupabase>;
type Row = Record<string, unknown>;

const CONCURRENCY = 3;
const BATCH = 20;

function ready(): { ok: true; supabase: Supabase; secret: string } | { ok: false; note: string } {
  if (!isSupabaseConfigured) return { ok: false, note: "The store database is not configured." };
  if (!isEmailConfigured) return { ok: false, note: "Email isn't set up (RESEND_API_KEY / RESEND_FROM_EMAIL), so nothing can be sent." };
  const secret = jobSecret();
  if (secret.length < 20) return { ok: false, note: "CART_RECOVERY_SECRET isn't set on the server, so the store can't send these emails." };
  return { ok: true, supabase: createServerSupabase(), secret };
}

function refused(error: { message?: string } | null): string | null {
  if (!error) return null;
  if (/unauthorized/i.test(error.message ?? "")) return "The jobs' secret doesn't match the one stored in the database (app_config 'cart_recovery').";
  if (/Could not find the function|does not exist/i.test(error.message ?? "")) return "These emails need database migration 70.";
  return "The database couldn't be asked just now.";
}

/** Sends a batch a few at a time; `send` returns false when the mail didn't go. */
async function inBatches<T>(items: T[], send: (item: T) => Promise<boolean>, release: (item: T) => Promise<void>): Promise<JobReport> {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((item) => send(item).catch(() => false)));
    for (let j = 0; j < results.length; j += 1) {
      if (results[j]) sent += 1;
      else {
        failed += 1;
        await release(batch[j]).catch(() => undefined);
      }
    }
  }
  return { sent, failed };
}

const add = (a: JobReport, b: JobReport): JobReport => ({ sent: a.sent + b.sent, failed: a.failed + b.failed, note: a.note ?? b.note });

/* ── Gift cards ─────────────────────────────────────────────────────────── */

export async function runGiftCardJob(): Promise<JobReport> {
  const env = ready();
  if (!env.ok) return { sent: 0, failed: 0, note: env.note };
  const { supabase, secret } = env;

  const due = await supabase.rpc("claim_gift_card_deliveries", { p_secret: secret, p_limit: BATCH });
  const problem = refused(due.error);
  if (problem) return { sent: 0, failed: 0, note: problem };
  const cards = (Array.isArray(due.data) ? due.data : []) as Row[];

  const delivered = await inBatches(
    cards,
    async (card) => {
      const message = giftCardEmail({
        kind: card.kind === "reward" ? "reward" : card.kind === "issued" ? "issued" : "purchased",
        recipientName: (card.recipient_name as string | null) ?? null,
        senderName: (card.sender_name as string | null) ?? null,
        amountAed: Number(card.initial_value) || 0,
        code: String(card.code),
        message: (card.message as string | null) ?? null,
        expiresAt: (card.expires_at as string | null) ?? null,
      });
      const result = await sendEmail({ to: String(card.recipient_email), ...message }, { quiet: true, idempotencyKey: `gift-card-${card.code}-${card.order_id ?? "x"}` });
      if (!result.ok) return false;
      await supabase.rpc("gift_card_delivered", { p_secret: secret, p_code: card.code });
      return true;
    },
    async (card) => {
      await supabase.rpc("release_gift_card_delivery", { p_secret: secret, p_code: card.code });
    }
  );

  // The buyer's note, once their payment has arrived.
  const receipts = await supabase.rpc("claim_gift_card_receipts", { p_secret: secret, p_limit: BATCH });
  const notes = (Array.isArray(receipts.data) ? receipts.data : []) as Row[];
  const receipted = await inBatches(
    notes,
    async (r) => {
      const message = giftCardReceiptEmail({
        buyerName: null,
        recipientName: (r.recipient_name as string | null) ?? null,
        recipientEmail: String(r.recipient_email ?? ""),
        amountAed: Number(r.amount) || 0,
        sendOn: (r.send_on as string | null) ?? null,
        orderId: String(r.order_id ?? ""),
      });
      const result = await sendEmail({ to: String(r.buyer_email), ...message }, { quiet: true, idempotencyKey: `gift-card-receipt-${r.order_id}` });
      return result.ok;
    },
    // A receipt that didn't go is not retried (the card itself still is).
    async () => undefined
  );
  return add(delivered, receipted);
}

/* ── Back in stock ──────────────────────────────────────────────────────── */

export async function runStockAlertJob(features: StoreFeatures): Promise<JobReport> {
  if (!features.back_in_stock.enabled) return { sent: 0, failed: 0, note: "Back-in-stock alerts are switched off." };
  const env = ready();
  if (!env.ok) return { sent: 0, failed: 0, note: env.note };
  const { supabase, secret } = env;
  const s = features.back_in_stock.settings;

  const due = await supabase.rpc("claim_stock_alerts", { p_secret: secret, p_limit: BATCH });
  const problem = refused(due.error);
  if (problem) return { sent: 0, failed: 0, note: problem };
  const alerts = (Array.isArray(due.data) ? due.data : []) as Row[];

  return inBatches(
    alerts,
    async (a) => {
      const name = String(a.name ?? "");
      const values = { name, size: String(a.size ?? "") };
      const message = backInStockEmail({
        subject: fillTemplate(String(s.subject), values),
        body: fillTemplate(String(s.body), values),
        brand: String(a.brand ?? ""),
        name,
        size: String(a.size ?? ""),
        priceAed: Number(a.price) || 0,
        imageUrl: (a.image_url as string | null) ?? null,
        productUrl: `${SITE_URL}/product/${a.product_id}`,
      });
      const result = await sendEmail({ to: String(a.email), ...message }, { quiet: true, idempotencyKey: `stock-alert-${a.id}` });
      return result.ok;
    },
    async (a) => {
      await supabase.rpc("release_stock_alert", { p_secret: secret, p_id: a.id });
    }
  );
}

/* ── Reorder reminders ──────────────────────────────────────────────────── */

export async function runReorderJob(features: StoreFeatures): Promise<JobReport> {
  if (!features.reorder_reminders.enabled) return { sent: 0, failed: 0, note: "Reorder reminders are switched off." };
  const env = ready();
  if (!env.ok) return { sent: 0, failed: 0, note: env.note };
  const { supabase, secret } = env;
  const s = features.reorder_reminders.settings;

  const due = await supabase.rpc("claim_reorder_reminders", { p_secret: secret, p_limit: BATCH });
  const problem = refused(due.error);
  if (problem) return { sent: 0, failed: 0, note: problem };
  const orders = (Array.isArray(due.data) ? due.data : []) as Row[];

  // Names from the catalogue by id, never from what was typed at checkout.
  const ids = [...new Set(orders.flatMap((o) => ((o.lines as Row[]) ?? []).map((l) => Number(l.product_id))))];
  const { data: products } = ids.length ? await supabase.from("products").select("id, brand, name").in("id", ids) : { data: [] };
  const byId = new Map(((products ?? []) as { id: number; brand: string; name: string }[]).map((p) => [p.id, p]));

  return inBatches(
    orders,
    async (o) => {
      const items = ((o.lines as Row[]) ?? [])
        .map((l) => ({ product: byId.get(Number(l.product_id)), size: String(l.size ?? "") }))
        .filter((l) => l.product)
        .map((l) => ({ brand: titleCase(l.product!.brand), name: l.product!.name.replace(/_/g, " "), size: l.size }));
      const link = reorderUrl(String(o.order_id));
      // Nothing still on sale, or no way to sign the link: nothing worth sending.
      if (items.length === 0 || !link) return true;
      const values = { name: items[0].name };
      const message = reorderEmail({
        firstName: firstNameOf(o.name),
        subject: fillTemplate(String(s.subject), values),
        heading: fillTemplate(String(s.heading), values),
        body: fillTemplate(String(s.body), values),
        items,
        code: String(s.code || "").trim() || null,
        reorderUrl: link,
        unsubscribeUrl: unsubscribeUrl(String(o.email)),
      });
      const result = await sendEmail({ to: String(o.email), ...message }, { quiet: true, idempotencyKey: `reorder-${o.order_id}` });
      return result.ok;
    },
    async (o) => {
      await supabase.rpc("release_reorder_reminder", { p_secret: secret, p_order_id: o.order_id });
    }
  );
}

/* ── Birthdays ──────────────────────────────────────────────────────────── */

export async function runBirthdayJob(features: StoreFeatures): Promise<JobReport> {
  const loyalty = features.loyalty;
  if (!loyalty.enabled || Number(loyalty.settings.birthday_points) <= 0) return { sent: 0, failed: 0 };
  const env = ready();
  if (!env.ok) return { sent: 0, failed: 0, note: env.note };
  const { supabase, secret } = env;

  const due = await supabase.rpc("claim_birthday_rewards", { p_secret: secret, p_limit: 50 });
  const problem = refused(due.error);
  if (problem) return { sent: 0, failed: 0, note: problem };
  const people = (Array.isArray(due.data) ? due.data : []) as Row[];
  const s = loyalty.settings;
  const points = Number(s.birthday_points) || 0;
  const blocks = Math.floor(points / (Number(s.redeem_points) || 100));
  const worth = blocks > 0 ? `AED ${(blocks * (Number(s.redeem_value_aed) || 5)).toLocaleString("en-AE")}` : null;

  // The points are given either way; the email is only for those who haven't unsubscribed.
  return inBatches(
    people.filter((p) => p.opted_out !== true),
    async (p) => {
      const message = birthdayEmail({
        firstName: firstNameOf(p.first_name),
        points,
        programName: String(s.program_name || "Gharib Rewards"),
        worth,
        unsubscribeUrl: unsubscribeUrl(String(p.email)),
      });
      const year = new Date().getUTCFullYear();
      const result = await sendEmail({ to: String(p.email), ...message }, { quiet: true, idempotencyKey: `birthday-${p.email}-${year}` });
      return result.ok;
    },
    async () => undefined
  );
}

/** Every switched-on job, one after another. */
export async function runDueJobs(features: StoreFeatures): Promise<Record<string, JobReport>> {
  return {
    gift_cards: await runGiftCardJob(),
    back_in_stock: features.back_in_stock.enabled ? await runStockAlertJob(features) : { sent: 0, failed: 0 },
    reorder: features.reorder_reminders.enabled ? await runReorderJob(features) : { sent: 0, failed: 0 },
    birthdays: await runBirthdayJob(features),
  };
}

function titleCase(s: string) {
  return String(s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A greeting name only when it looks like one. */
function firstNameOf(value: unknown): string | null {
  const first = String(value ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length <= 40 && /^[\p{L}][\p{L}\p{M}.'-]*$/u.test(first) ? first : null;
}
