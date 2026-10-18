"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "../../../_ui/Dialog";
import { Button } from "../../../_ui/Button";
import { Field, Input } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import { cn } from "../../../_ui/cn";

type Mode = "add" | "set" | "threshold";

export type StockTarget = {
  productId: number;
  productName: string;
  size: string;
  /** null = this size isn't tracked yet (always available). */
  level: number | null;
  threshold: number | null;
};

/**
 * Stock for one size, saved straight away (outside the product form, so a
 * count can never be overwritten by an older copy of the form).
 */
export default function StockDialog({ target, onClose }: { target: StockTarget | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const tracked = target?.level !== null && target?.level !== undefined;
  const [mode, setMode] = useState<Mode>(tracked ? "add" : "set");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!target) return <Dialog open={false} onClose={onClose} title="" />;

  const number = value.trim() === "" ? NaN : Number(value);
  const valid = Number.isInteger(number) && number >= 0 && number <= 100000 && !(mode === "add" && number === 0);

  const save = async () => {
    if (!valid) {
      setError(mode === "add" ? "Enter how many bottles arrived." : "Enter a whole number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: target.productId,
          size: target.size,
          mode,
          value: number,
          ...(mode === "set" && target.level !== null ? { expected: target.level } : {}),
        }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string; stockLevel?: number } | null;
      if (!response.ok) {
        if (response.status === 409) {
          // The count moved since this dialog opened. Close it and reload, so
          // the next try starts from the real number instead of the old one.
          toast(json?.error || "The count changed in the meantime. Check it and try again.", "error");
          onClose();
          startTransition(() => router.refresh());
          return;
        }
        setError(json?.error || "The stock could not be updated.");
        return;
      }
      toast(
        mode === "threshold"
          ? `Warning level for ${target.size} set to ${number}.`
          : `${target.productName} ${target.size}: ${json?.stockLevel ?? number} in stock.`
      );
      onClose();
      startTransition(() => router.refresh());
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const modes: { key: Mode; label: string; disabled?: boolean }[] = [
    { key: "add", label: "Received" },
    { key: "set", label: tracked ? "Stocktake" : "Start tracking" },
    { key: "threshold", label: "Warning level", disabled: !tracked },
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      dismissable={!busy}
      title={`${target.productName} · ${target.size}`}
      description={
        tracked
          ? `${target.level} in stock. Shows as low at ${target.threshold ?? 5} or fewer.`
          : "Not tracked yet: this size always shows as available. Set a count to start tracking it."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} busy={busy || refreshing} disabled={!valid}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="What changed" className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              disabled={m.disabled}
              onClick={() => {
                setMode(m.key);
                setValue("");
                setError(null);
              }}
              className={cn(
                "h-9 rounded-md text-[13px] font-medium transition-colors disabled:opacity-40",
                mode === m.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Field
          label={mode === "add" ? "Bottles received" : mode === "set" ? "Bottles on the shelf now" : "Warn me at"}
          hint={
            mode === "add"
              ? "Added to the current count. Safe even while orders come in."
              : mode === "set"
                ? "Replaces the count. If an order changes it while you type, nothing is saved and you'll see the new number."
                : "The size shows as low stock at this number or fewer."
          }
          error={error}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="number"
              inputMode="numeric"
              min={mode === "add" ? 1 : 0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
