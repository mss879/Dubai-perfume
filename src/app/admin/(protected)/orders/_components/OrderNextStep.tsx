"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aed } from "../../../_lib/format";
import { ACTION_TARGET, nextStepFor, type NextAction } from "../../../_lib/order-queues";
import { Button, type ButtonSize } from "../../../_ui/Button";
import { ConfirmDialog } from "../../../_ui/Dialog";
import { Field, Input } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import { postOrderStatus, type EmailOutcome } from "./order-api";

export type NextStepOrder = {
  /** Migration 70: a digital gift card order has no next step (the store emails it). */
  giftCard?: boolean;
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  packingCharges: number;
  name: string;
  trackingNumber?: string | null;
};

function doneMessage(action: NextAction, order: NextStepOrder, email: EmailOutcome): { text: string; tone: "success" | "info" } {
  const emailedOk = email === "sent";
  switch (action) {
    case "accept":
      return { text: `Order ${order.id} accepted. Next: pack it.`, tone: "success" };
    case "pack":
      return { text: `Order ${order.id} is packed. Next: dispatch it.`, tone: "success" };
    case "dispatch":
      return emailedOk
        ? { text: `Order ${order.id} dispatched. ${order.name} was emailed the tracking details.`, tone: "success" }
        : { text: `Order ${order.id} dispatched, but the email didn't go out. Send ${order.name} the tracking number yourself.`, tone: "info" };
    case "deliver":
      return emailedOk
        ? { text: `Order ${order.id} delivered. The customer was emailed.`, tone: "success" }
        : { text: `Order ${order.id} marked as delivered. The email didn't go out.`, tone: "info" };
  }
}

/**
 * The one obvious button for an order: Accept, Mark as packed, Dispatch or
 * Mark as delivered, each confirming what it will do (and who gets emailed)
 * before it does it. Nothing shows while an online order is still unpaid.
 */
export default function OrderNextStep({
  order,
  size = "md",
  fullWidth = false,
}: {
  order: NextStepOrder;
  size?: ButtonSize;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [packing, setPacking] = useState("");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = useState("");

  const step = nextStepFor({
    status: order.status,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    gift_card: order.giftCard,
  });
  if (!step) return null;

  const action = step.action;
  // Paid online, or in full by a gift card and points ('credit'): nothing to collect.
  const cod = order.paymentMethod !== "paymob" && order.paymentMethod !== "credit";
  const packingValue = packing.trim() === "" ? null : Number(packing);
  const packingInvalid = packingValue !== null && (!Number.isFinite(packingValue) || packingValue < 0 || packingValue > 10000);
  const collect = order.total + (cod ? order.packingCharges : 0);

  const confirm = async () => {
    setError(null);
    if (action === "dispatch" && !tracking.trim()) {
      setError("Enter the courier's tracking number.");
      return;
    }
    if (action === "pack" && packingInvalid) {
      setError("The packing charge must be between AED 0 and AED 10,000.");
      return;
    }
    setBusy(true);
    const result = await postOrderStatus({
      orderId: order.id,
      status: ACTION_TARGET[action],
      expectedStatus: order.status,
      ...(action === "pack" && cod && packingValue !== null ? { packingCharges: packingValue } : {}),
      ...(action === "dispatch"
        ? { trackingNumber: tracking.trim(), ...(trackingUrl.trim() ? { trackingUrl: trackingUrl.trim() } : {}) }
        : {}),
    });
    setBusy(false);

    if (!result.ok) {
      if (result.status === 409) {
        // Someone (or another tab) moved it on: show them the current state.
        setOpen(false);
        toast(result.error, "error");
        startTransition(() => router.refresh());
        return;
      }
      setError(result.error);
      return;
    }

    setOpen(false);
    const message = doneMessage(action, order, result.email);
    toast(message.text, message.tone);
    startTransition(() => router.refresh());
  };

  const dialog = {
    accept: {
      title: `Accept order ${order.id}?`,
      description: `${order.name}'s order moves to “To pack”. They see it as accepted in their account; no email is sent at this step.`,
      confirmLabel: "Accept order",
    },
    pack: {
      title: `Mark order ${order.id} as packed?`,
      description: "It moves to “To dispatch”, ready for the courier.",
      confirmLabel: "Mark as packed",
    },
    dispatch: {
      title: `Dispatch order ${order.id}`,
      description: `${order.name} is emailed that the order is on its way, with the tracking number.`,
      confirmLabel: "Dispatch",
    },
    deliver: {
      title: `Mark order ${order.id} as delivered?`,
      description: cod
        ? `Confirm the courier collected ${aed(collect)} in cash. ${order.name} is emailed that the order arrived.`
        : `${order.name} is emailed that the order arrived.`,
      confirmLabel: "Mark as delivered",
    },
  }[action];

  return (
    <>
      <Button
        size={size}
        busy={refreshing}
        className={fullWidth ? "w-full" : undefined}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {step.label}
      </Button>
      <ConfirmDialog
        open={open}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirmLabel}
        busy={busy}
        confirmDisabled={action === "dispatch" && !tracking.trim()}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      >
        <div className="flex flex-col gap-4">
          {action === "pack" && cod ? (
            <Field
              label="Packing charge (optional)"
              hint="Added to the cash the courier collects. Leave empty for none."
              error={packingInvalid ? "Enter an amount between 0 and 10,000." : null}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="AED 0.00"
                  value={packing}
                  onChange={(e) => setPacking(e.target.value)}
                />
              )}
            </Field>
          ) : null}
          {action === "dispatch" ? (
            <>
              <Field label="Tracking number" required>
                {({ id }) => (
                  <Input
                    id={id}
                    autoComplete="off"
                    value={tracking}
                    maxLength={100}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="From the courier's label"
                  />
                )}
              </Field>
              <Field label="Tracking link (optional)" hint="The courier's tracking page, starting with https://.">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    type="url"
                    inputMode="url"
                    value={trackingUrl}
                    maxLength={500}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://"
                  />
                )}
              </Field>
            </>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[14px] text-red-800">
              {error}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
