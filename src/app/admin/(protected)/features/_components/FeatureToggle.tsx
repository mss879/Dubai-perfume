"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "../../../_lib/admin-fetch";
import { useToast } from "../../../_ui/Toast";
import { cn } from "../../../_ui/cn";
import type { FeatureKey } from "../../../../lib/features";

/** The on/off switch on the Features page: saves at once, with the feature's current settings. */
export default function FeatureToggle({
  featureKey,
  name,
  enabled,
  disabled = false,
}: {
  featureKey: FeatureKey;
  name: string;
  enabled: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const flip = async () => {
    const next = !on;
    setBusy(true);
    setOn(next);
    const result = await adminFetch(`/api/admin/features/${featureKey}`, "PATCH", { enabled: next }, "The switch could not be saved.");
    setBusy(false);
    if (!result.ok) {
      setOn(!next);
      toast(result.error, "error");
      return;
    }
    toast(next ? `${name} is on. The shop shows it within a minute.` : `${name} is off.`);
    startTransition(() => router.refresh());
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${name}: ${on ? "on" : "off"}`}
      disabled={disabled || busy}
      onClick={flip}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50",
        on ? "bg-neutral-900" : "bg-neutral-300"
      )}
    >
      <span aria-hidden className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}
