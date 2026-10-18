"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../_ui/Button";
import { Field, Input } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import { postOrderStatus } from "./order-api";

/**
 * Correct or add the courier details after dispatch. Goes through the order
 * route (not a direct write), so the change lands in the order's timeline and,
 * if asked, the customer is emailed the new details.
 */
export default function TrackingEditor({
  orderId,
  status,
  trackingNumber,
  trackingUrl,
}: {
  orderId: string;
  status: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [number, setNumber] = useState(trackingNumber ?? "");
  const [url, setUrl] = useState(trackingUrl ?? "");
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onTheWay = status === "out_for_delivery" || status === "shipped";
  const changed = number.trim() !== (trackingNumber ?? "") || url.trim() !== (trackingUrl ?? "");

  const save = async () => {
    setError(null);
    setBusy(true);
    // Both fields are always sent: an emptied field is removed from the order.
    const result = await postOrderStatus({
      orderId,
      expectedStatus: status,
      trackingNumber: number.trim(),
      trackingUrl: url.trim(),
      notifyCustomer: onTheWay && notify,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(
      result.email === "sent"
        ? "Tracking saved. The customer was emailed the new details."
        : onTheWay && notify
          ? "Tracking saved, but the email didn't go out."
          : "Tracking saved."
    );
    setNotify(false);
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Tracking number">
        {({ id }) => (
          <Input id={id} autoComplete="off" maxLength={100} value={number} onChange={(e) => setNumber(e.target.value)} />
        )}
      </Field>
      <Field label="Tracking link" hint="Starting with https://">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            type="url"
            inputMode="url"
            maxLength={500}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
          />
        )}
      </Field>
      {onTheWay ? (
        <label className="flex items-start gap-2 text-[14px] text-neutral-700">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-neutral-900"
          />
          Email the customer the new details
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[14px] text-red-800">
          {error}
        </p>
      ) : null}
      <div>
        <Button variant="secondary" onClick={save} busy={busy || refreshing} disabled={!changed}>
          Save tracking
        </Button>
      </div>
    </div>
  );
}
