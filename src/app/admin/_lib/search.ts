/**
 * Search terms for PostgREST's `.or()` filter. Characters that would break
 * out of the filter syntax (commas, brackets, quotes, wildcards) are dropped,
 * and the term is capped, so a search box can only ever search.
 */

export function cleanSearch(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[,()*%\\":'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** `col.ilike."*term*"` for each column, joined for `.or()`; null for an empty term. */
export function ilikeAny(term: string, columns: string[]): string | null {
  if (!term) return null;
  return columns.map((column) => `${column}.ilike."*${term}*"`).join(",");
}

/** Phone numbers are typed every which way (+971 50…, 050…): match on the last nine digits. */
export function phoneDigits(term: string): string | null {
  const digits = term.replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(-9) : null;
}

/** One search parameter, whatever shape Next hands it over in. */
export function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** A 1-based page number from the URL, within reason. */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(param(value));
  return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 1;
}
