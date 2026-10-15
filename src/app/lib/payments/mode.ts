import "server-only";
import { readPaymobConfig, isPaymobConfigured } from "./paymob/config";
import { rpc } from "./paymob/rpc";

/**
 * Which way the store takes payment right now.
 *
 * The owner's switch lives in the database (payment_settings.mode, migration
 * 63) so that place_order can enforce it even when called directly. Online
 * also needs the Paymob variables and the payment secret to be in order:
 *
 *   database 'cod'                                -> cod (cash on delivery)
 *   database 'online' + Paymob ready              -> online
 *   database 'online' + Paymob misconfigured      -> unavailable (no orders)
 *   migration 63 not applied yet                  -> cod (as before)
 */
export type CheckoutMode = "cod" | "online" | "unavailable";

export async function resolveCheckoutMode(): Promise<CheckoutMode> {
  const mode = await rpc.getPaymentMode();
  if (!mode.ok || mode.data !== "online") return "cod";

  const config = readPaymobConfig();
  if (!config.ok) return "unavailable";
  const ready = await rpc.ready(config.config.rpcSecret);
  return ready.ok && ready.data.ok ? "online" : "unavailable";
}

/**
 * Storefront copy (footer marks, cart note, legal pages): whether this
 * deployment is set up for card payment. Read when the page is built, which
 * is fine — changing the variables needs a redeploy anyway.
 */
export function storefrontPaymentMode(): "online" | "cod" {
  return isPaymobConfigured() ? "online" : "cod";
}
