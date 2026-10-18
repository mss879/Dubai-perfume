"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Button } from "../../../_ui/Button";
import { ConfirmDialog } from "../../../_ui/Dialog";
import { useToast } from "../../../_ui/Toast";

/**
 * Runs the hourly reminder job now. Safe to press twice: a cart is stamped the
 * moment it is claimed, so a second run finds nothing left to send.
 */
export default function SendRemindersButton() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [refreshing, startTransition] = useTransition();

  const run = async () => {
    setBusy(true);
    const result = await adminFetch<{ sent?: number; failed?: number }>("/api/cart-recovery", "POST", undefined, "The reminders could not be sent.");
    setBusy(false);
    setConfirming(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    const sent = result.data.sent ?? 0;
    const failed = result.data.failed ?? 0;
    if (sent === 0 && failed === 0) toast("No carts are due a reminder right now.", "info");
    else if (failed > 0) toast(`${sent} reminder${sent === 1 ? "" : "s"} sent, ${failed} failed. The failed ones are retried on the next run.`, "error");
    else toast(`${sent} reminder${sent === 1 ? "" : "s"} sent.`);
    startTransition(() => router.refresh());
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setConfirming(true)}
        busy={busy || refreshing}
        icon={<Send className="h-4 w-4" aria-hidden />}
      >
        Send due reminders
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Email the customers who are due a reminder?"
        description="Every cart that has reached its next reminder is emailed now, instead of waiting for the hourly run. Customers who asked for no reminders are skipped."
        confirmLabel="Send reminders"
        busy={busy}
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
