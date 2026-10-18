import "server-only";
import { isPaymobConfigured } from "./payments/paymob/config";
import { rpc } from "./payments/paymob/rpc";

/**
 * How the shop should DESCRIBE payment (footer marks, bag note, legal pages,
 * reminder emails, the agent's "how to pay" line): the owner's switch in
 * Settings → Payments, as checkout itself reads it.
 *
 * Read-only. It changes nothing about how checkout takes payment
 * (lib/payments/mode.ts resolveCheckoutMode stays the authority there); it
 * only stops the shop advertising card payment while the store is on cash on
 * delivery, or the other way round.
 *
 *   switch 'online' and Paymob set up  -> "online"
 *   anything else (incl. a failed read) -> "cod", as checkout does
 */

const TTL_MS = 15_000;
let cached: { at: number; value: "online" | "cod" } | null = null;

export async function liveStorefrontPaymentMode(): Promise<"online" | "cod"> {
  if (!isPaymobConfigured()) return "cod";
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const mode = await rpc.getPaymentMode();
  const value = mode.ok && mode.data === "online" ? "online" : "cod";
  cached = { at: now, value };
  return value;
}
