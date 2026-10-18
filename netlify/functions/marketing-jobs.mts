/**
 * Netlify Scheduled Function — the store's own emails, every fifteen minutes.
 *
 * Knocks on two of the store's routes, which do the work and decide what is
 * switched on (Admin → Feature switches):
 *   /api/jobs/marketing          gift cards, back in stock, reorder reminders, birthdays
 *   /api/cart-recovery?scheduled cart reminders, only while "Cart reminder emails" is on
 *
 * Needs CART_RECOVERY_SECRET (and NEXT_PUBLIC_SITE_URL) in the site's
 * environment, matching app_config 'cart_recovery' in the database (migration
 * 45). Without them it does nothing. Dependency-free on purpose, like
 * payments-reconcile.mts. From any other scheduler:
 *   curl -X POST https://<domain>/api/jobs/marketing -H "Authorization: Bearer $CART_RECOVERY_SECRET"
 */

export default async function marketingJobs(): Promise<Response> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "").replace(/\/+$/, "");
  const secret = (process.env.CART_RECOVERY_SECRET || "").trim();
  if (!base.startsWith("https://") || secret.length < 20) return new Response(null, { status: 204 });

  const call = (path: string) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);

  // One after the other: both send email, and the mail service limits the pace.
  await call("/api/jobs/marketing");
  await call("/api/cart-recovery?scheduled=1");
  return new Response(null, { status: 204 });
}

export const config = { schedule: "*/15 * * * *" };
