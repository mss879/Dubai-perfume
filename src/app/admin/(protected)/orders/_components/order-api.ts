"use client";

/** What happened to the customer's email, as /api/admin/order-status reports it. */
export type EmailOutcome = "sent" | "skipped" | "failed" | "not_needed";

export type StatusResult =
  | { ok: true; email: EmailOutcome }
  | { ok: false; status: number; error: string };

/** The one way the admin changes an order: the server checks payment rules and emails. */
export async function postOrderStatus(body: {
  orderId: string;
  status?: string;
  expectedStatus?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  packingCharges?: number;
  notifyCustomer?: boolean;
  /** Cancelling: put the order's bottles back in stock. */
  restock?: boolean;
}): Promise<StatusResult> {
  try {
    const response = await fetch("/api/admin/order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as { error?: string; email?: EmailOutcome } | null;
    if (!response.ok) {
      return { ok: false, status: response.status, error: json?.error || "The order could not be updated." };
    }
    return { ok: true, email: json?.email ?? "not_needed" };
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach the server. Check your connection and try again." };
  }
}
