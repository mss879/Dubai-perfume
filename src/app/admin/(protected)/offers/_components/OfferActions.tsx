"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Button, ButtonLink } from "../../../_ui/Button";
import { ConfirmDialog } from "../../../_ui/Dialog";
import { useToast } from "../../../_ui/Toast";

/** Edit, pause / resume, delete. */
export default function OfferActions({ offer }: { offer: { id: number; title: string; isActive: boolean } }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();

  const toggle = async () => {
    setBusy(true);
    const result = await adminFetch(`/api/admin/offers/${offer.id}`, "PATCH", { is_active: !offer.isActive }, "The offer could not be updated.");
    setBusy(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(offer.isActive ? `“${offer.title}” is paused.` : `“${offer.title}” is running again.`);
    startTransition(() => router.refresh());
  };

  const destroy = async () => {
    setDeleting(true);
    const result = await adminFetch(`/api/admin/offers/${offer.id}`, "DELETE", undefined, "The offer could not be deleted.");
    setDeleting(false);
    setConfirmDelete(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`“${offer.title}” deleted.`);
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <ButtonLink href={`/admin/offers/${offer.id}`} size="sm" icon={<Pencil className="h-3.5 w-3.5" aria-hidden />}>
        Edit
      </ButtonLink>
      <Button size="sm" variant="secondary" busy={busy} onClick={toggle}>
        {offer.isActive ? "Pause" : "Resume"}
      </Button>
      <Button
        size="sm"
        variant="plain"
        className="text-red-700 hover:bg-red-50 hover:text-red-800"
        icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
        onClick={() => setConfirmDelete(true)}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${offer.title}”?`}
        description="The shop stops applying it straight away. Orders that already used it keep their saving and their record. To stop it for now instead, pause it."
        confirmLabel="Delete offer"
        confirmVariant="critical"
        busy={deleting}
        onConfirm={destroy}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
