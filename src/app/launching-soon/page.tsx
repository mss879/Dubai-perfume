import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSiteLock } from "../lib/site-lock";
import { SITE_NAME } from "../lib/site";
import LaunchingSoonClient from "./LaunchingSoonClient";

/**
 * The holding page shown while the maison is closed (migration 52).
 *
 * Reached by rewrite from src/proxy.ts, so the visitor's own URL is still in
 * the address bar. It re-reads the lock rather than trusting the rewrite: a
 * visitor who lands here directly after the site has opened should be sent to
 * the storefront, not shown a countdown that has already run out.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Launching soon",
  // The holding page must never become what the domain is known for.
  robots: { index: false, follow: false },
};

export default async function LaunchingSoonPage() {
  const lock = await readSiteLock();

  if (!lock.locked) {
    redirect("/");
  }

  return (
    <LaunchingSoonClient
      siteName={SITE_NAME}
      headline={lock.headline}
      message={lock.message}
      launchAt={lock.launchAt}
      serverNow={lock.serverNow}
      hasPin={lock.hasPin}
    />
  );
}
