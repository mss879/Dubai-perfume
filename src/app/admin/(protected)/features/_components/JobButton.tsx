"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Button } from "../../../_ui/Button";
import { useToast } from "../../../_ui/Toast";

export type JobName = "gift_cards" | "back_in_stock" | "reorder";

/** Runs one of the store's scheduled email jobs now, instead of waiting for the next run. */
export default function JobButton({ job, label }: { job: JobName; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const run = async () => {
    setBusy(true);
    const result = await adminFetch<{ sent: number; failed: number; note?: string }>("/api/admin/jobs", "POST", { job }, "That didn't run.");
    setBusy(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    const { sent, failed, note } = result.data;
    toast(note ?? (sent === 0 && failed === 0 ? "Nothing was due." : `${sent} sent${failed ? `, ${failed} not sent (they'll be tried again)` : ""}.`), failed ? "info" : "success");
    startTransition(() => router.refresh());
  };

  return (
    <Button variant="secondary" onClick={run} busy={busy}>
      {label}
    </Button>
  );
}
