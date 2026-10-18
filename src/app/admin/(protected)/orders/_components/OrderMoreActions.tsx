"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ASSIGNABLE_ORDER_STATUSES, normalizeOrderStatus } from "../../../../lib/orders";
import { orderStatusBadge } from "../../../_lib/badges";
import { Button } from "../../../_ui/Button";
import { ConfirmDialog } from "../../../_ui/Dialog";
import { Field, Select } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import { postOrderStatus } from "./order-api";

/**
 * The less common actions on an order page: cancel it, or put its status
 * right after a mistake. Both go through the same server route as the main
 * button, so the payment rules and the emails behave the same.
 */
export default function OrderMoreActions({
  order,
}: {
  order: { id: string; status: string; paymentMethod: string; paymentStatus: string; paymentState: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<"cancel" | "status" | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState(normalizeOrderStatus(order.status));
  const status = normalizeOrderStatus(order.status);
  // Bottles still in the building go back on the shelf; once the courier has
  // them, the admin says whether they came back.
  const [restock, setRestock] = useState(status !== "out_for_delivery" && status !== "shipped");

  const online = order.paymentMethod === "paymob";
  const awaitingOnline = online && order.paymentState === "awaiting";
  const paidOnline = online && (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded");
  const canCancel = status !== "cancelled" && status !== "delivered" && !awaitingOnline;
  // A cancelled order can't be reopened (its stock was given back), except an
  // online payment that arrived after the order was released.
  const canChangeStatus = status !== "cancelled" || paidOnline;
  // Cancelling has its own button and checks, so it isn't offered here.
  const statusChoices = ASSIGNABLE_ORDER_STATUSES.filter((value) => value !== "cancelled" || status === "cancelled");

  const run = async (nextStatus: string) => {
    setBusy(true);
    setError(null);
    const result = await postOrderStatus({
      orderId: order.id,
      status: nextStatus,
      expectedStatus: order.status,
      ...(nextStatus === "cancelled" ? { restock } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      if (result.status === 409) {
        setDialog(null);
        toast(result.error, "error");
        startTransition(() => router.refresh());
        return;
      }
      setError(result.error);
      return;
    }
    setDialog(null);
    toast(
      nextStatus === "cancelled"
        ? `Order ${order.id} cancelled.`
        : `Order ${order.id} is now “${orderStatusBadge(nextStatus).label}”.${result.email === "sent" ? " The customer was emailed." : ""}`
    );
    startTransition(() => router.refresh());
  };

  return (
    <>
      {canChangeStatus ? (
        <Button
          variant="secondary"
          busy={refreshing}
          onClick={() => {
            setTarget(status);
            setError(null);
            setDialog("status");
          }}
        >
          Change status
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          variant="plain"
          className="text-red-700 hover:bg-red-50 hover:text-red-800"
          onClick={() => {
            setError(null);
            setDialog("cancel");
          }}
        >
          Cancel order
        </Button>
      ) : null}

      <ConfirmDialog
        open={dialog === "cancel"}
        title={`Cancel order ${order.id}?`}
        description={
          <div className="flex flex-col gap-2">
            <p>The order stops here and the customer sees it as cancelled. No email is sent.</p>
            <p>A discount code it used can be used again, and the customer&rsquo;s spend no longer counts it.</p>
            {paidOnline ? (
              <p className="font-medium text-red-700">
                This order was paid online. Refund the payment in full first, in the Payment section of this page.
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Cancel order"
        confirmVariant="critical"
        busy={busy}
        confirmDisabled={paidOnline}
        onConfirm={() => run("cancelled")}
        onCancel={() => setDialog(null)}
      >
        <label className="flex items-start gap-2 text-[14px] text-neutral-800">
          <input
            type="checkbox"
            checked={restock}
            onChange={(e) => setRestock(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-neutral-900"
          />
          Put this order&rsquo;s bottles back in stock
        </label>
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[14px] text-red-800">
            {error}
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "status"}
        title="Change the status"
        description="For putting a mistake right. Moving an order to “Out for delivery” or “Delivered” emails the customer."
        confirmLabel="Save status"
        busy={busy}
        confirmDisabled={target === status}
        onConfirm={() => run(target)}
        onCancel={() => setDialog(null)}
      >
        <div className="flex flex-col gap-3">
          <Field label="Status">
            {({ id }) => (
              <Select id={id} value={target} onChange={(e) => setTarget(normalizeOrderStatus(e.target.value))}>
                {statusChoices.map((value) => (
                  <option key={value} value={value}>
                    {orderStatusBadge(value).label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
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
