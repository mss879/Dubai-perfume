"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Button } from "../../../_ui/Button";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { Field, Textarea } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";

/** A private note about the customer: preferences, allergies, how they like to be contacted. */
export default function CustomerNote({ customerId, initial }: { customerId: string; initial: string }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const changed = note.trim() !== saved.trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await adminFetch("/api/admin/customers/" + customerId, "PATCH", { note: note.trim() }, "The note could not be saved.");
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(note.trim());
    toast("Note saved.");
    startTransition(() => router.refresh());
  };

  return (
    <Card>
      <CardHeader title="Note" description="Never displayed in the shop. Keep it to things you'd be comfortable with the customer reading." />
      <CardBody className="flex flex-col gap-3">
        <Field label="Note" error={error}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              rows={5}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Preferences, allergies, how they like to be contacted…"
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} busy={saving} disabled={!changed}>
            Save note
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
