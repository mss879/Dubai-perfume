"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Button } from "../../../_ui/Button";
import { ConfirmDialog } from "../../../_ui/Dialog";
import { useToast } from "../../../_ui/Toast";

export type DiscountSummary = {
  id: number;
  code: string;
  isActive: boolean;
  conciergeOnly: boolean;
  hasLimit: boolean;
};

/** Pause / resume, concierge / public, delete. */
export default function DiscountActions({ discount }: { discount: DiscountSummary }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<null | "active" | "concierge">(null);
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const change = async (field: "is_active" | "concierge_only", value: boolean, done: string) => {
    setBusy(field === "is_active" ? "active" : "concierge");
    const result = await adminFetch(`/api/admin/discounts/${discount.id}`, "PATCH", { [field]: value }, `${discount.code} could not be updated.`);
    setBusy(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(done);
    startTransition(() => router.refresh());
  };

  const destroy = async () => {
    setDeleting(true);
    const result = await adminFetch(`/api/admin/discounts/${discount.id}`, "DELETE", undefined, `${discount.code} could not be deleted.`);
    setDeleting(false);
    setConfirmDelete(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`${discount.code} deleted.`);
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        busy={busy === "active"}
        onClick={() => change("is_active", !discount.isActive, discount.isActive ? `${discount.code} is paused.` : `${discount.code} works again.`)}
      >
        {discount.isActive ? "Pause" : "Resume"}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        busy={busy === "concierge"}
        disabled={!discount.conciergeOnly && !discount.hasLimit}
        title={!discount.conciergeOnly && !discount.hasLimit ? "Only a code with a usage limit can be given to the Agent." : undefined}
        onClick={() =>
          change(
            "concierge_only",
            !discount.conciergeOnly,
            discount.conciergeOnly ? `${discount.code} is a public code again.` : `Only the Agent offers ${discount.code} now.`
          )
        }
      >
        {discount.conciergeOnly ? "Make public" : "Give to Agent"}
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
        title={`Delete ${discount.code}?`}
        description="Customers can no longer use it. Orders that already used it keep their discount. To stop it for now instead, pause it."
        confirmLabel="Delete code"
        confirmVariant="critical"
        busy={deleting}
        onConfirm={destroy}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
