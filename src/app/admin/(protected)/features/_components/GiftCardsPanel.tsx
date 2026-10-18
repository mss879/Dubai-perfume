"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Badge, type Tone } from "../../../_ui/Badge";
import { Button } from "../../../_ui/Button";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { ConfirmDialog, Dialog } from "../../../_ui/Dialog";
import { EmptyState } from "../../../_ui/EmptyState";
import { Field, Input, Textarea } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import type { GiftCardRow } from "../../../_lib/feature-data";
import JobButton from "./JobButton";

const aed = (n: number) => `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(new Date(iso)) : "";

const KIND_LABELS: Record<string, string> = { purchased: "Bought", reward: "Referral reward", issued: "From you" };

function stateOf(card: GiftCardRow, now: number): { label: string; tone: Tone } {
  if (card.status === "pending") return { label: "Waiting for payment", tone: "amber" };
  if (card.status === "void") return { label: "Cancelled", tone: "neutral" };
  if (card.expiresAt && new Date(card.expiresAt).getTime() < now) return { label: "Expired", tone: "neutral" };
  if (card.balance <= 0) return { label: "Used up", tone: "neutral" };
  return { label: "Active", tone: "emerald" };
}

/** Gift cards and credit: what's out there, what's left on them, and the owner's own cards. */
export default function GiftCardsPanel({
  cards,
  outstanding,
  sold,
  soldValue,
  failed,
  now,
}: {
  /** The server's clock when the page was made, so both sides agree on "expired". */
  now: number;
  cards: GiftCardRow[];
  outstanding: number;
  sold: number;
  soldValue: number;
  failed: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [issuing, setIssuing] = useState(false);
  const [confirm, setConfirm] = useState<{ code: string; action: "void" | "resend" } | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async () => {
    if (!confirm) return;
    setBusy(true);
    const result = await adminFetch(`/api/admin/gift-cards/${encodeURIComponent(confirm.code)}`, "PATCH", { action: confirm.action }, "That didn't work.");
    setBusy(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(confirm.action === "void" ? "Gift card cancelled. It can no longer be spent." : "The gift card email goes out again within 15 minutes.");
    setConfirm(null);
    startTransition(() => router.refresh());
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Gift cards and credit"
          description="Cards bought in the shop, referral rewards and cards you issue. A card is spent like money at checkout, and given back if that order is cancelled."
          actions={
            <>
              <JobButton job="gift_cards" label="Send due emails now" />
              <Button onClick={() => setIssuing(true)} icon={<Plus className="h-4 w-4" aria-hidden />}>
                Issue a gift card
              </Button>
            </>
          }
        />
        <CardBody className="grid gap-4 border-b border-neutral-100 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 px-4 py-3">
            <p className="text-[13px] text-neutral-500">Still to be spent</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-neutral-900">{aed(outstanding)}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 px-4 py-3">
            <p className="text-[13px] text-neutral-500">Cards sold</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-neutral-900">{sold}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 px-4 py-3">
            <p className="text-[13px] text-neutral-500">Sold for</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-neutral-900">{aed(soldValue)}</p>
          </div>
        </CardBody>
        {failed ? (
          <CardBody>
            <p className="text-[14px] text-red-700">The gift cards couldn&rsquo;t be read just now.</p>
          </CardBody>
        ) : cards.length === 0 ? (
          <EmptyState title="No gift cards yet" description="Cards bought on /gift-cards, referral rewards and cards you issue appear here." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {cards.map((card) => {
              const state = stateOf(card, now);
              const canAct = card.status === "active";
              return (
                <li key={card.code} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[14px] text-neutral-900">{card.code}</span>
                      <Badge tone={state.tone}>{state.label}</Badge>
                      <span className="text-[12px] text-neutral-500">{KIND_LABELS[card.kind] ?? card.kind}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-neutral-600">
                      {aed(card.balance)} left of {aed(card.initialValue)}
                      {card.recipientEmail ? ` · for ${card.recipientName ? `${card.recipientName}, ` : ""}${card.recipientEmail}` : ""}
                    </p>
                    <p className="text-[12px] text-neutral-500">
                      {card.sentAt
                        ? `Emailed ${day(card.sentAt)}`
                        : card.sendOn
                          ? `To be emailed on ${day(card.sendOn)}`
                          : card.status === "active" && card.recipientEmail
                            ? "Email due"
                            : ""}
                      {card.expiresAt ? ` · valid until ${day(card.expiresAt)}` : ""}
                      {card.orderId ? (
                        <>
                          {" · "}
                          <Link href={`/admin/orders/${encodeURIComponent(card.orderId)}`} className="underline-offset-2 hover:underline">
                            order {card.orderId}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {canAct ? (
                    <div className="flex shrink-0 gap-2">
                      {card.recipientEmail ? (
                        <Button size="sm" variant="secondary" onClick={() => setConfirm({ code: card.code, action: "resend" })}>
                          Resend email
                        </Button>
                      ) : null}
                      <Button size="sm" variant="plain" onClick={() => setConfirm({ code: card.code, action: "void" })}>
                        Cancel card
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <IssueDialog
        open={issuing}
        onClose={() => setIssuing(false)}
        onIssued={(code) => {
          setIssuing(false);
          toast(`Gift card ${code} issued.`);
          startTransition(() => router.refresh());
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === "void" ? "Cancel this gift card?" : "Send the gift card email again?"}
        description={
          confirm?.action === "void"
            ? "Whatever is left on it can no longer be spent. Orders already paid with it are not affected. This can't be undone."
            : "The recipient gets the email with the code again, within 15 minutes."
        }
        confirmLabel={confirm?.action === "void" ? "Cancel the card" : "Send again"}
        confirmVariant={confirm?.action === "void" ? "critical" : "primary"}
        busy={busy}
        onConfirm={act}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function IssueDialog({ open, onClose, onIssued }: { open: boolean; onClose: () => void; onIssued: (code: string) => void }) {
  const [amount, setAmount] = useState("100");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [months, setMonths] = useState("12");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1 || value > 20000) {
      setError("Enter an amount from AED 1 to AED 20,000.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await adminFetch<{ code: string }>(
      "/api/admin/gift-cards",
      "POST",
      { amount: value, recipient_name: name, recipient_email: email, message, valid_months: Number(months) || 12, note },
      "The gift card could not be issued."
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAmount("100");
    setName("");
    setEmail("");
    setMessage("");
    setNote("");
    onIssued(result.data.code);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      wide
      title="Issue a gift card"
      description="For a gesture, a replacement or a prize. With an email, the store sends the card; without one, you hand over the code yourself."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} busy={busy}>
            Issue the card
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (AED)" required>
          {({ id }) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="Valid for (months)">
          {({ id }) => <Input id={id} inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />}
        </Field>
        <Field label="Recipient's name">
          {({ id }) => <Input id={id} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Recipient's email" hint="Optional">
          {({ id }) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Message on the card" className="sm:col-span-2">
          {({ id }) => <Textarea id={id} rows={2} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />}
        </Field>
        <Field label="Note for you" hint="Only you see this, e.g. why it was issued." className="sm:col-span-2">
          {({ id }) => <Input id={id} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
