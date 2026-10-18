import { formatFromAed } from "../../lib/currency-shared";

/**
 * Admin formatting. Dates are always rendered in Dubai time and on the server:
 * Netlify runs in UTC, so formatting in the browser would both disagree with
 * the store's own day and cause hydration mismatches.
 */

const DUBAI = "Asia/Dubai";
/** Dubai keeps UTC+4 all year (no daylight saving). */
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** AED 1,234.50 — the store's own money format. */
export function aed(amount: number | string | null | undefined): string {
  const n = typeof amount === "number" ? amount : Number(amount ?? 0);
  return formatFromAed(Number.isFinite(n) ? n : 0);
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** "16 Oct 2026, 14:05" in Dubai time. */
export function dubaiDateTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? DATE_TIME.format(d) : "—";
}

/** "16 Oct 2026" in Dubai time. */
export function dubaiDate(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? DATE_ONLY.format(d) : "—";
}

/** "just now", "12 min ago", "3 h ago", "2 days ago" — relative to `now`. */
export function ago(iso: string | null | undefined, now: number): string {
  const d = toDate(iso);
  if (!d) return "—";
  const minutes = Math.max(0, Math.floor((now - d.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** Midnight at the start of today in Dubai, as an ISO timestamp. */
export function dubaiMidnightIso(now: number): string {
  const local = new Date(now + DUBAI_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - DUBAI_OFFSET_MS).toISOString();
}

/**
 * The server's clock, read once per render by pages that show "3 h ago".
 * A function call (rather than Date.now() in a component body) keeps reading
 * the time out of the render logic itself.
 */
export function serverNow(): number {
  return Date.now();
}

/** "3 items" / "1 item". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
