/**
 * Supabase hands back at most 1,000 rows per request, silently. For the few
 * admin reads that can be longer (a year of orders, every collection link),
 * read in pages until the end or `max`, and say whether `max` cut it short.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 10000,
  size = 1000
): Promise<{ rows: T[]; failed: boolean; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, Math.min(from + size, max) - 1);
    if (error) return { rows, failed: true, truncated: false };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < Math.min(size, max - from)) return { rows, failed: false, truncated: false };
  }
  return { rows, failed: false, truncated: true };
}
