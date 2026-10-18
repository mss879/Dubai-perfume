"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Button } from "../../../_ui/Button";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { EmptyState } from "../../../_ui/EmptyState";
import { Field, Input } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import type { LoyaltyMember } from "../../../_lib/feature-data";

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(new Date(iso)) : "—";

/** Members' points, and a way to add or take away points by hand. */
export default function LoyaltyPanel({ members, failed }: { members: LoyaltyMember[]; failed: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outstanding = members.reduce((s, m) => s + m.available, 0);

  const adjust = async () => {
    const value = Number(points);
    if (!email.includes("@")) {
      setError("Enter the customer's account email.");
      return;
    }
    if (!Number.isInteger(value) || value === 0) {
      setError("Enter a whole number of points: 200 to add, -200 to take away.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await adminFetch<{ available: number }>("/api/admin/loyalty", "POST", { email, points: value, note }, "The points could not be changed.");
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(`Done. ${email} now has ${result.data.available} points to spend.`);
    setPoints("");
    setNote("");
    startTransition(() => router.refresh());
  };

  return (
    <>
      <Card>
        <CardHeader title="Add or take away points" description="For a gesture, a correction or a missed order. The customer sees the change, with your note, in their account." />
        <CardBody className="grid gap-4 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end">
          <Field label="Customer's email">
            {({ id }) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Points">
            {({ id }) => <Input id={id} inputMode="numeric" placeholder="e.g. 200" value={points} onChange={(e) => setPoints(e.target.value)} />}
          </Field>
          <Field label="Note (they see it)">
            {({ id }) => <Input id={id} maxLength={200} placeholder="A thank-you from the maison" value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <Button onClick={adjust} busy={busy}>
            Save
          </Button>
          {error ? (
            <p role="alert" className="text-[14px] font-medium text-red-700 sm:col-span-4">
              {error}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Members" description={`${members.length} customers with points · ${outstanding.toLocaleString("en-AE")} points ready to spend.`} />
        {failed ? (
          <CardBody>
            <p className="text-[14px] text-red-700">The members couldn&rsquo;t be read just now.</p>
          </CardBody>
        ) : members.length === 0 ? (
          <EmptyState title="No points yet" description="Points arrive when a signed-in customer's order is marked delivered." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="border-b border-neutral-100 text-[12px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-5">Customer</th>
                  <th className="px-4 py-2 text-right font-medium">Ready</th>
                  <th className="px-4 py-2 text-right font-medium">Pending</th>
                  <th className="px-4 py-2 text-right font-medium">Earned in all</th>
                  <th className="px-4 py-2 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 sm:px-5">
                      <div className="text-neutral-900">{m.name || m.email}</div>
                      {m.name ? <div className="text-[12px] text-neutral-500">{m.email}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-900">{m.available.toLocaleString("en-AE")}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{m.pending.toLocaleString("en-AE")}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{m.lifetime.toLocaleString("en-AE")}</td>
                    <td className="px-4 py-3 text-neutral-500">{day(m.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
