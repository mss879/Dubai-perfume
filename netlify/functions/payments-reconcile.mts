/**
 * Netlify Scheduled Function — the online-payment check, every ten minutes.
 *
 * It only knocks on the store's own reconcile route (src/app/api/payments/
 * reconcile/route.ts), which does the work: asks Paymob about unpaid orders,
 * releases those whose payment window closed unpaid, and sends any
 * confirmation still owed. Dependency-free on purpose: this file is type-checked
 * with the rest of the app and must not import packages the app does not have.
 *
 * Needs PAYMENTS_CRON_SECRET (and NEXT_PUBLIC_SITE_URL) in the site's
 * environment. Without them it does nothing. Scheduled functions run on
 * published production deploys only. If this host ever changes, call the same
 * route from any scheduler:
 *   curl -X POST https://<domain>/api/payments/reconcile -H "Authorization: Bearer $PAYMENTS_CRON_SECRET"
 */

export default async function paymentsReconcile(): Promise<Response> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "").replace(/\/+$/, "");
  const secret = (process.env.PAYMENTS_CRON_SECRET || "").trim();
  if (!base.startsWith("https://") || secret.length < 32) return new Response(null, { status: 204 });

  try {
    await fetch(`${base}/api/payments/reconcile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    // The next run picks up whatever this one missed.
  }
  return new Response(null, { status: 204 });
}

export const config = { schedule: "*/10 * * * *" };
