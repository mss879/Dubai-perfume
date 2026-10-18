"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { getBrowserSupabase } from "../../../lib/supabase-browser";
import { paymentStatusLabel } from "../../../lib/payments/status";
import { Badge } from "../../_ui/Badge";
import { Button } from "../../_ui/Button";
import { Dialog } from "../../_ui/Dialog";
import { Field, Input } from "../../_ui/Field";
import { useToast } from "../../_ui/Toast";

/**
 * The payment side of one online order.
 *
 * Reads the sealed payment tables through the admin's own session (RLS: admins
 * read, nobody writes) and refunds or voids through /api/admin/payments/refund.
 * A fresh idempotency key is minted each time the dialog opens, so however
 * often "confirm" is pressed it is one refund.
 */

type Loaded = {
  payment: PaymentRow | null;
  transactions: TransactionRow[];
  attempts: AttemptRow[];
  refunds: RefundRow[];
};

type PaymentRow = {
  state: string;
  attention: string[] | null;
  paid_transaction_id: number | null;
  refunded_fils: number;
  amount_fils: number;
  due_at: string;
  paid_at: string | null;
};

type TransactionRow = {
  id: number;
  kind: string;
  success: boolean;
  pending: boolean;
  amount_fils: number;
  refunded_fils: number;
  is_voided: boolean;
  is_refunded: boolean;
  source_type: string | null;
  source_sub_type: string | null;
  pan_last4: string | null;
  integration_known: boolean;
  received_at: string;
};

type AttemptRow = { attempt_no: number; status: string; key_mode: string | null; created_at: string };
type RefundRow = { kind: string; amount_fils: number; status: string; created_at: string; error_code: string | null };

const ATTENTION: Record<string, string> = {
  duplicate_payment: "Paid twice: refund the extra payment below.",
  paid_after_close: "Paid after the order was released (its stock was returned). Refund it, or reinstate the order by hand.",
  amount_mismatch: "A payment for a different amount or currency arrived. The order was not marked paid: refund it.",
  unknown_integration: "Paid through an integration not listed in PAYMOB_INTEGRATION_IDS. Not marked paid.",
  authorized_not_captured: "Card authorised but never captured. Capture or void it in Paymob's dashboard.",
};

const aed = (fils: number) =>
  `AED ${(fils / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DUE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type RefundDialog = { transactionId: number; kind: "refund" | "void"; remainingFils: number; key: string };

async function fetchPayment(orderId: string): Promise<Loaded> {
  const db = getBrowserSupabase();
  const [p, t, a, r] = await Promise.all([
    db
      .from("order_payments")
      .select("state, attention, paid_transaction_id, refunded_fils, amount_fils, due_at, paid_at")
      .eq("order_id", orderId)
      .maybeSingle(),
    db
      .from("payment_transactions")
      .select(
        "id, kind, success, pending, amount_fils, refunded_fils, is_voided, is_refunded, source_type, source_sub_type, pan_last4, integration_known, received_at"
      )
      .eq("order_id", orderId)
      .order("received_at", { ascending: true }),
    db.from("payment_attempts").select("attempt_no, status, key_mode, created_at").eq("order_id", orderId).order("attempt_no"),
    db
      .from("payment_refunds")
      .select("kind, amount_fils, status, created_at, error_code")
      .eq("order_id", orderId)
      .order("created_at"),
  ]);
  return {
    payment: (p.data as PaymentRow | null) ?? null,
    transactions: (t.data as TransactionRow[] | null) ?? [],
    attempts: (a.data as AttemptRow[] | null) ?? [],
    refunds: (r.data as RefundRow[] | null) ?? [],
  };
}

export default function OrderPaymentSection({
  orderId,
  paymentStatus,
  onChanged,
  onToast,
}: {
  orderId: string;
  paymentStatus: string | null;
  /** Defaults to refreshing the page's server data. */
  onChanged?: () => void;
  /** Defaults to the admin's toasts. */
  onToast?: (message: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const notify = useCallback(
    (message: string, tone: "success" | "info" | "error" = "success") => (onToast ? onToast(message) : toast(message, tone)),
    [onToast, toast]
  );

  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<RefundDialog | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const apply = useCallback((loaded: Loaded) => {
    setPayment(loaded.payment);
    setTransactions(loaded.transactions);
    setAttempts(loaded.attempts);
    setRefunds(loaded.refunds);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await fetchPayment(orderId);
      if (!cancelled) apply(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, apply]);

  /** After a refund: called from the click handler, not from an effect. */
  const reload = async () => apply(await fetchPayment(orderId));

  const openDialog = (txn: TransactionRow, kind: "refund" | "void") => {
    const remaining = Math.max(txn.amount_fils - txn.refunded_fils, 0);
    setAmount(kind === "refund" ? (remaining / 100).toFixed(2) : "");
    setReason("");
    setDialog({ transactionId: txn.id, kind, remainingFils: remaining, key: crypto.randomUUID() });
  };

  const submit = async () => {
    if (!dialog) return;
    const amountAed = dialog.kind === "refund" ? Number(amount) : undefined;
    if (dialog.kind === "refund" && (!Number.isFinite(amountAed) || (amountAed ?? 0) <= 0)) {
      notify("Enter the amount to refund.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          transactionId: dialog.transactionId,
          kind: dialog.kind,
          ...(amountAed !== undefined ? { amountAed: Math.round(amountAed * 100) / 100 } : {}),
          reason: reason.trim() || undefined,
          idempotencyKey: dialog.key,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; status?: string; message?: string; error?: string }
        | null;
      if (!res.ok) {
        notify(json?.error || "The refund could not be completed.", "error");
      } else if (json?.status === "succeeded") {
        notify(dialog.kind === "void" ? "Payment voided. The customer has been told." : "Refund issued. The customer has been told.");
        setDialog(null);
      } else if (json?.status === "unknown") {
        notify(json.message || "Paymob did not confirm the outcome yet. Check the Paymob dashboard.", "info");
        setDialog(null);
      } else {
        notify(json?.message ? `Paymob refused: ${json.message}` : "Paymob refused the request.", "error");
      }
    } catch {
      notify("The refund could not be completed. Check the Paymob dashboard before retrying.", "error");
    } finally {
      setSubmitting(false);
      await reload();
      if (onChanged) onChanged();
      else router.refresh();
    }
  };

  if (loading) {
    return <div className="h-20 animate-pulse rounded-lg bg-neutral-100" aria-busy="true" />;
  }

  const paid = transactions.find((t) => t.id === payment?.paid_transaction_id) ?? null;
  const card = paid?.source_sub_type ? `${paid.source_sub_type}${paid.pan_last4 ? ` ending ${paid.pan_last4}` : ""}` : null;
  const attention = payment?.attention ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-neutral-900">{paymentStatusLabel("paymob", paymentStatus)}</p>
          {card ? <p className="mt-0.5 text-[14px] text-neutral-600">{card}</p> : null}
          {payment?.paid_transaction_id ? (
            <p className="mt-0.5 text-[13px] text-neutral-500">Paymob transaction {payment.paid_transaction_id}</p>
          ) : null}
        </div>
        <div className="text-right">
          {payment && payment.refunded_fils > 0 ? <Badge tone="sky">Refunded {aed(payment.refunded_fils)}</Badge> : null}
          {payment?.state === "awaiting" ? (
            <p className="text-[13px] text-neutral-500">
              Releases itself if unpaid by {DUE_FORMAT.format(new Date(payment.due_at))}
            </p>
          ) : null}
        </div>
      </div>

      {attention.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3">
          {attention.map((a) => (
            <p key={a} className="flex items-start gap-2 text-[14px] text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              {ATTENTION[a] ?? a}
            </p>
          ))}
        </div>
      ) : null}

      {transactions.length > 0 ? (
        <div>
          <p className="mb-1 text-[13px] font-medium text-neutral-500">Transactions</p>
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {transactions.map((t) => {
              const refundable =
                t.kind === "payment" && t.success && !t.pending && !t.is_voided && t.refunded_fils < t.amount_fils;
              const state =
                t.kind === "payment"
                  ? t.pending
                    ? "pending"
                    : t.success
                      ? t.is_voided
                        ? "voided"
                        : "approved"
                      : "declined"
                  : t.kind;
              return (
                <li key={t.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[14px] text-neutral-700">
                    {t.kind === "payment" ? "Payment" : t.kind === "refund" ? "Refund" : t.kind} {t.id} · {state}
                    {t.refunded_fils > 0 ? ` · ${aed(t.refunded_fils)} refunded` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold tabular-nums text-neutral-900">{aed(t.amount_fils)}</span>
                    {refundable ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openDialog(t, "refund")}>
                          Refund
                        </Button>
                        {t.refunded_fils === 0 ? (
                          <Button variant="secondary" size="sm" onClick={() => openDialog(t, "void")}>
                            Void
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {attempts.length > 0 || refunds.length > 0 ? (
        <div className="flex flex-col gap-1 text-[13px] text-neutral-500">
          {attempts.length > 0 ? (
            <p>
              {attempts.length} payment attempt{attempts.length === 1 ? "" : "s"}; the last one {attempts[attempts.length - 1].status}
              {attempts.some((a) => a.key_mode === "test") ? " (test mode)" : ""}.
            </p>
          ) : null}
          {refunds.length > 0 ? (
            <p>Refund requests: {refunds.map((r) => `${r.kind} ${aed(r.amount_fils)} ${r.status}`).join(" · ")}</p>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        dismissable={!submitting}
        title={dialog?.kind === "void" ? "Void this payment?" : "Refund this payment"}
        description={
          dialog?.kind === "void"
            ? "Cancels the whole payment before it settles, usually only possible on the same business day. If Paymob refuses, use a refund instead. The customer is emailed."
            : "The money goes back to the customer's card through Paymob, and the customer is emailed."
        }
        footer={
          <>
            <Button variant="secondary" disabled={submitting} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="critical" busy={submitting} onClick={submit}>
              {dialog?.kind === "void"
                ? "Void payment"
                : `Refund ${amount && Number(amount) > 0 ? `AED ${Number(amount).toFixed(2)}` : ""}`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {dialog?.kind === "refund" ? (
            <Field label="Amount (AED)" hint={`Up to ${aed(dialog.remainingFils)}.`}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              )}
            </Field>
          ) : null}
          <Field label="Reason (optional, only you see it)">
            {({ id }) => <Input id={id} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
