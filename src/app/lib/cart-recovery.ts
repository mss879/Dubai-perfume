/**
 * The abandoned-cart recovery sequence — schedule and shared shapes.
 *
 * Plain module (no "use client", no "server-only") so the job route, the email
 * templates and the restore page can all import the same definitions. Nothing
 * secret lives here.
 *
 * The stages are what the store sends and when. Changing a delay changes the
 * schedule immediately — the database holds only "how many reminders has this
 * cart had", never the timing, so nothing has to be migrated to retune it.
 */

export type RecoveryStage = {
  /** 1-based, and the value stored in abandoned_carts.recovery_stage. */
  stage: number;
  /** How long after the shopper last touched the cart this reminder is due. */
  afterMinutes: number;
  /** A label for the job's log line and the admin's summary. */
  label: string;
};

/**
 * Three reminders: soon, next day, last call.
 *
 * The first is the one that recovers most — an hour later the shopper often
 * still means to buy and was simply interrupted. The third is the last thing
 * the store ever sends about that cart; after it, the cart goes quiet whether
 * or not it converts.
 */
export const RECOVERY_STAGES: RecoveryStage[] = [
  { stage: 1, afterMinutes: 60, label: "1 hour" },
  { stage: 2, afterMinutes: 24 * 60, label: "24 hours" },
  { stage: 3, afterMinutes: 72 * 60, label: "72 hours" },
];

/**
 * How old a cart may be and still be worth a reminder. Past this it is not an
 * abandoned cart, it is an old one, and mailing about it reads as a database
 * leak rather than a service.
 */
export const RECOVERY_MAX_AGE_HOURS = 14 * 24;

/**
 * Carts handled per stage per run — so at most three times this many emails go
 * out in one invocation.
 *
 * Sized for the request timeout, not for the mailbox: a serverless function has
 * seconds, and each send is a round trip to Resend. A run that fills its batch
 * says so in the log and in the response, and the next hourly run takes the
 * rest — nothing is dropped, only deferred.
 */
export const RECOVERY_BATCH_LIMIT = 20;

/**
 * Sends in flight at once. Resend's lower tiers throttle at a couple of
 * requests a second, and a 429 here costs a shopper their reminder.
 */
export const RECOVERY_SEND_CONCURRENCY = 3;

/**
 * The shortest gap allowed between two reminders to the same cart.
 *
 * Without it, a job that has not run for two days would find a cart due stage 1
 * AND immediately due stage 2, and send both within a minute of each other.
 */
export function minGapMinutes(stage: number): number {
  const index = RECOVERY_STAGES.findIndex((s) => s.stage === stage);
  if (index <= 0) return 0;
  return RECOVERY_STAGES[index].afterMinutes - RECOVERY_STAGES[index - 1].afterMinutes;
}

/** One line of a saved cart, as checkout's autosave writes it. */
export type RecoveryCartItem = {
  product_id?: number | string | null;
  brand?: string | null;
  name?: string | null;
  size?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
};

/** A cart claimed for a reminder, as claim_abandoned_carts_for_recovery returns it. */
export type ClaimedCart = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  token: string;
  cart_items: RecoveryCartItem[];
  total_price: number | string;
  currency: string | null;
  abandoned_at: string | null;
};

/** Normalises one saved line into the shape the email and the restore page use. */
export function normalizeRecoveryItem(raw: RecoveryCartItem) {
  const quantity = Math.max(1, Math.min(20, Number(raw?.quantity) || 1));
  return {
    productId: Number(raw?.product_id) || 0,
    brand: String(raw?.brand ?? "").trim(),
    name: String(raw?.name ?? "").trim(),
    size: String(raw?.size ?? "").trim(),
    quantity,
    unitPriceAed: Number(raw?.unit_price) || 0,
  };
}

export type NormalizedRecoveryItem = ReturnType<typeof normalizeRecoveryItem>;

/** Saved lines, cleaned up and with the unusable ones dropped. */
export function normalizeRecoveryItems(raw: unknown): NormalizedRecoveryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 50)
    .map((item) => normalizeRecoveryItem(item as RecoveryCartItem))
    .filter((item) => item.productId > 0 && item.name !== "");
}

/** The link a reminder points at. */
export function recoveryUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/recover?token=${encodeURIComponent(token)}`;
}

/** The unsubscribe link every reminder carries. */
export function recoveryStopUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/recover/stop?token=${encodeURIComponent(token)}`;
}
