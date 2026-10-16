import "server-only";

/**
 * Paymob configuration, read from the environment on every call.
 *
 * Nothing here is ever logged or returned to a browser: status reports carry
 * variable NAMES only. A missing or malformed value disables online payment
 * rather than limping on — in particular the public key is shape-checked so a
 * secret key pasted into the wrong variable can never end up in the checkout
 * URL the shopper's browser is sent to.
 *
 * The hosts are constants, not configuration: a mistyped (or tampered) env var
 * must not be able to point the server's authenticated calls somewhere else.
 */

/** Paymob's UAE region. Test and live share it; the keys decide the mode. */
export const PAYMOB_API_BASE = "https://uae.paymob.com";
/** Unified Checkout, Paymob's hosted payment page, for the UAE. */
export const PAYMOB_CHECKOUT_BASE = "https://uae.checkout.paymob.com";

export type PaymobKeyMode = "test" | "live";

export type PaymobConfig = {
  secretKey: string;
  publicKey: string;
  /**
   * Optional. Enables Paymob's transaction inquiry: the recovery path for a
   * missed callback and the read-back of refunds. Without it the store runs on
   * Paymob's signed callbacks alone ("notifications only").
   */
  apiKey: string | null;
  /** Current first; the previous one is accepted during a rotation. */
  hmacSecrets: string[];
  integrationIds: number[];
  /**
   * Optional pin on the `owner` field of signed transactions: Paymob's USER id
   * for the account (the same number as a transaction's `user_id` and
   * `created_by`). NOT the merchant id (MID) the dashboard shows; that is
   * `profile_id`, which the signature does not cover.
   */
  ownerId: number | null;
  rpcSecret: string;
  mode: PaymobKeyMode;
};

export type PaymobConfigStatus = {
  configured: boolean;
  mode: PaymobKeyMode | null;
  /** Variable names that are unset. */
  missing: string[];
  /** Variable names that are set but unusable. */
  invalid: string[];
};

const REQUIRED = [
  "PAYMOB_SECRET_KEY",
  "PAYMOB_PUBLIC_KEY",
  "PAYMOB_HMAC_SECRET",
  "PAYMOB_INTEGRATION_IDS",
  "PAYMENTS_RPC_SECRET",
] as const;

// Paymob keys look like `sk_test_…` / `pk_live_…`, optionally with a region
// prefix (`are_sk_test_…`). The test/live marker is what matters here.
const SECRET_KEY = /^(?:[a-z]{2,5}_)?sk_(test|live)_[A-Za-z0-9_-]{8,200}$/;
const PUBLIC_KEY = /^(?:[a-z]{2,5}_)?pk_(test|live)_[A-Za-z0-9_-]{8,200}$/;

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function parseIds(raw: string): number[] | null {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 20) return null;
  const ids = parts.map((p) => (/^[1-9][0-9]{0,15}$/.test(p) ? Number(p) : NaN));
  return ids.every((n) => Number.isSafeInteger(n) && n > 0) ? Array.from(new Set(ids)) : null;
}

type ReadResult =
  | { ok: true; config: PaymobConfig; status: PaymobConfigStatus }
  | { ok: false; status: PaymobConfigStatus };

export function readPaymobConfig(): ReadResult {
  const missing = REQUIRED.filter((name) => !env(name));
  const invalid: string[] = [];

  const secretKey = env("PAYMOB_SECRET_KEY");
  const publicKey = env("PAYMOB_PUBLIC_KEY");
  const apiKey = env("PAYMOB_API_KEY");
  const hmac = env("PAYMOB_HMAC_SECRET");
  const hmacPrevious = env("PAYMOB_HMAC_SECRET_PREVIOUS");
  const rpcSecret = env("PAYMENTS_RPC_SECRET");
  const ownerRaw = env("PAYMOB_OWNER_ID");

  const secretMatch = secretKey ? SECRET_KEY.exec(secretKey) : null;
  const publicMatch = publicKey ? PUBLIC_KEY.exec(publicKey) : null;
  if (secretKey && !secretMatch) invalid.push("PAYMOB_SECRET_KEY");
  if (publicKey && !publicMatch) invalid.push("PAYMOB_PUBLIC_KEY");
  if (secretMatch && publicMatch && secretMatch[1] !== publicMatch[1]) {
    // A test public key with a live secret key (or the reverse) can never work.
    invalid.push("PAYMOB_PUBLIC_KEY");
  }
  if (apiKey && apiKey.length < 20) invalid.push("PAYMOB_API_KEY");
  if (hmac && hmac.length < 16) invalid.push("PAYMOB_HMAC_SECRET");
  if (hmacPrevious && hmacPrevious.length < 16) invalid.push("PAYMOB_HMAC_SECRET_PREVIOUS");
  if (rpcSecret && rpcSecret.length < 32) invalid.push("PAYMENTS_RPC_SECRET");

  const ids = env("PAYMOB_INTEGRATION_IDS") ? parseIds(env("PAYMOB_INTEGRATION_IDS")) : null;
  if (env("PAYMOB_INTEGRATION_IDS") && !ids) invalid.push("PAYMOB_INTEGRATION_IDS");

  let ownerId: number | null = null;
  if (ownerRaw) {
    ownerId = /^[1-9][0-9]{0,15}$/.test(ownerRaw) ? Number(ownerRaw) : null;
    if (ownerId === null) invalid.push("PAYMOB_OWNER_ID");
  }

  const mode = (secretMatch?.[1] as PaymobKeyMode | undefined) ?? null;
  const status: PaymobConfigStatus = {
    configured: missing.length === 0 && invalid.length === 0,
    mode,
    missing: [...missing],
    invalid: Array.from(new Set(invalid)),
  };
  if (!status.configured || !ids || !mode) {
    return { ok: false, status: { ...status, configured: false } };
  }

  return {
    ok: true,
    status,
    config: {
      secretKey,
      publicKey,
      apiKey: apiKey || null,
      hmacSecrets: hmacPrevious ? [hmac, hmacPrevious] : [hmac],
      integrationIds: ids,
      ownerId,
      rpcSecret,
      mode,
    },
  };
}

export function isPaymobConfigured(): boolean {
  return readPaymobConfig().ok;
}
