"use client";

import { useCallback, useEffect, useState } from "react";

type Loaded = {
  payment: PaymentRow | null;
  transactions: TransactionRow[];
  attempts: AttemptRow[];
  refunds: RefundRow[];
};
import { AlertCircle, Loader2 } from "lucide-react";
import { getBrowserSupabase } from "../../../lib/supabase-browser";
import { paymentStatusLabel } from "../../../lib/payments/status";

/**
 * The payment side of one online order, inside the admin invoice.
 *
 * Reads the sealed payment tables through the admin's own session (RLS: admins
 * read, nobody writes) and refunds or voids through /api/admin/payments/refund.
 * A fresh idempotency key is minted each time the dialog opens, so however
 * often "confirm" is pressed it is one refund.
 */

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
  duplicate_payment: "Paid twice — refund the extra payment below.",
  paid_after_close: "Paid after the order was released (stock was returned). Refund it, or reinstate the order by hand.",
  amount_mismatch: "A payment for a different amount or currency arrived. The order was not marked paid — refund it.",
  unknown_integration: "Paid through an integration not listed in PAYMOB_INTEGRATION_IDS. Not marked paid.",
  authorized_not_captured: "Card authorised but never captured. Capture or void it in Paymob's dashboard.",
};

const aed = (fils: number) =>
  `${(fils / 100).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

type Dialog = { transactionId: number; kind: "refund" | "void"; remainingFils: number; key: string };

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
  onChanged: () => void;
  onToast: (message: string) => void;
}) {
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<Dialog | null>(null);
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
      onToast("Enter the amount to refund.");
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
        onToast(json?.error || "The refund could not be completed.");
      } else if (json?.status === "succeeded") {
        onToast(dialog.kind === "void" ? "Payment voided." : "Refund issued.");
        setDialog(null);
      } else if (json?.status === "unknown") {
        onToast(json.message || "Paymob did not confirm the outcome yet. Check the Paymob dashboard.");
        setDialog(null);
      } else {
        onToast(json?.message ? `Paymob refused: ${json.message}` : "Paymob refused the request.");
      }
    } catch {
      onToast("The refund could not be completed. Check the Paymob dashboard before retrying.");
    } finally {
      setSubmitting(false);
      await reload();
      onChanged();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#EAE3DB]/40">
        <Loader2 className="w-3 h-3 animate-spin" /> LOADING PAYMENT
      </div>
    );
  }

  const paid = transactions.find((t) => t.id === payment?.paid_transaction_id) ?? null;
  const card = paid?.source_sub_type ? `${paid.source_sub_type}${paid.pan_last4 ? ` •• ${paid.pan_last4}` : ""}` : null;
  const attention = payment?.attention ?? [];

  return (
    <div className="flex flex-col gap-3 bg-white/[0.01] border border-white/[0.04] p-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <span className="text-[7.5px] tracking-widest text-amber-500 font-black uppercase block mb-1">
            PAYMENT — PAYMOB
          </span>
          <span className="text-[#EAE3DB] font-bold block">{paymentStatusLabel("paymob", paymentStatus)}</span>
          {card && <span className="text-[8px] text-[#EAE3DB]/50 block mt-0.5">{card}</span>}
          {payment?.paid_transaction_id && (
            <span className="text-[8px] text-[#EAE3DB]/40 block mt-0.5 normal-case tracking-normal">
              Transaction {payment.paid_transaction_id}
            </span>
          )}
        </div>
        <div className="text-right">
          {payment && payment.refunded_fils > 0 && (
            <span className="text-[8px] text-amber-400 block">REFUNDED {aed(payment.refunded_fils)}</span>
          )}
          {payment?.state === "awaiting" && (
            <span className="text-[8px] text-[#EAE3DB]/40 block normal-case tracking-normal">
              Releases if unpaid after {new Date(payment.due_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {attention.length > 0 && (
        <div className="flex flex-col gap-1.5 border border-amber-700/40 bg-amber-950/20 p-3">
          {attention.map((a) => (
            <div key={a} className="flex items-start gap-2 text-amber-300 normal-case tracking-normal text-[10px] font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{ATTENTION[a] ?? a}</span>
            </div>
          ))}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="flex flex-col">
          <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/30 uppercase block mb-1.5">TRANSACTIONS</span>
          {transactions.map((t) => {
            const refundable =
              t.kind === "payment" && t.success && !t.pending && !t.is_voided && t.refunded_fils < t.amount_fils;
            return (
              <div key={t.id} className="flex justify-between items-center gap-3 py-1.5 border-b border-white/[0.03]">
                <span className="normal-case tracking-normal text-[10px] text-[#EAE3DB]/70">
                  {t.id} · {t.kind}
                  {t.kind === "payment" &&
                    (t.pending ? " · pending" : t.success ? (t.is_voided ? " · voided" : " · approved") : " · declined")}
                  {t.refunded_fils > 0 ? ` · ${aed(t.refunded_fils)} refunded` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-sans text-[#EAE3DB]/80 font-bold">{aed(t.amount_fils)}</span>
                  {refundable && (
                    <>
                      <button
                        type="button"
                        onClick={() => openDialog(t, "refund")}
                        className="text-[7.5px] tracking-[0.2em] font-black uppercase border border-white/[0.08] px-2 py-1 hover:bg-white/[0.05] cursor-pointer"
                      >
                        REFUND
                      </button>
                      {t.refunded_fils === 0 && (
                        <button
                          type="button"
                          onClick={() => openDialog(t, "void")}
                          className="text-[7.5px] tracking-[0.2em] font-black uppercase border border-white/[0.08] px-2 py-1 hover:bg-white/[0.05] cursor-pointer"
                        >
                          VOID
                        </button>
                      )}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {attempts.length > 0 && (
        <span className="text-[8px] text-[#EAE3DB]/40 normal-case tracking-normal">
          {attempts.length} payment attempt{attempts.length === 1 ? "" : "s"} · last {attempts[attempts.length - 1].status}
          {attempts.some((a) => a.key_mode === "test") ? " · TEST MODE" : ""}
        </span>
      )}
      {refunds.length > 0 && (
        <span className="text-[8px] text-[#EAE3DB]/40 normal-case tracking-normal">
          Refund requests:{" "}
          {refunds.map((r) => `${r.kind} ${aed(r.amount_fils)} ${r.status}`).join(" · ")}
        </span>
      )}

      {dialog && (
        <div className="flex flex-col gap-2 border border-amber-600/30 p-3">
          <span className="text-[7.5px] tracking-widest text-amber-500 font-black uppercase">
            {dialog.kind === "void" ? "VOID PAYMENT" : "REFUND PAYMENT"} {dialog.transactionId}
          </span>
          {dialog.kind === "void" ? (
            <p className="normal-case tracking-normal text-[10px] text-[#EAE3DB]/70">
              Cancels the whole payment before it settles — usually only possible on the same business day. If
              Paymob refuses, use a refund instead.
            </p>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/40">
                AMOUNT (AED) — UP TO {aed(dialog.remainingFils)}
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-black border border-white/[0.08] text-white text-[10px] px-3 py-2 outline-none w-full font-sans"
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[7.5px] tracking-widest text-[#EAE3DB]/40">REASON (OPTIONAL, INTERNAL)</span>
            <input
              type="text"
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-black border border-white/[0.08] text-white text-[10px] px-3 py-2 outline-none w-full normal-case tracking-normal"
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="flex-1 bg-amber-600 text-white hover:bg-amber-500 text-[8.5px] tracking-[0.2em] uppercase font-black py-2.5 cursor-pointer disabled:opacity-40"
            >
              {submitting
                ? "PROCESSING"
                : dialog.kind === "void"
                  ? "CONFIRM VOID"
                  : `CONFIRM REFUND ${amount ? `${Number(amount).toFixed(2)} AED` : ""}`}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setDialog(null)}
              className="border border-white/[0.08] text-[8.5px] tracking-[0.2em] uppercase font-black px-4 py-2.5 cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
