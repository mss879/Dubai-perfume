"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLockState } from "../../../lib/site-lock-admin";
import { dubaiDateTime } from "../../_lib/format";
import { Button } from "../../_ui/Button";
import { Field, Input, Switch, Textarea } from "../../_ui/Field";
import { useToast } from "../../_ui/Toast";

/**
 * Whether customers can see the shop. Moved here from the floating panel that
 * sat over every admin page.
 *
 * Nothing here is trusted: /api/admin/site-lock re-verifies the admin, and
 * set_site_lock() (migration 52) verifies it again in the database. The PIN is
 * sent once, hashed there, and never comes back; only whether one exists does.
 * Edits are staged and saved together, so a stray tap changes nothing live.
 */

function countdownLabel(launchAt: string | null, serverNow: string): string | null {
  if (!launchAt) return null;
  const target = new Date(launchAt).getTime();
  const from = new Date(serverNow).getTime();
  if (!Number.isFinite(target) || !Number.isFinite(from)) return null;
  const seconds = Math.floor((target - from) / 1000);
  if (seconds <= 0) return "countdown finished";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h to go`;
  if (hours > 0) return `${hours} h ${minutes} min to go`;
  return `${minutes} min to go`;
}

export default function SiteLockSettings({ initial }: { initial: AdminLockState | null }) {
  const router = useRouter();
  const toast = useToast();

  const [state, setState] = useState<AdminLockState | null>(initial);
  const [locked, setLocked] = useState(initial?.locked ?? false);
  const [pin, setPin] = useState("");
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [launchAt, setLaunchAt] = useState("");
  const [autoUnlock, setAutoUnlock] = useState(initial?.autoUnlock ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state) {
    return (
      <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
        The shop lock isn&rsquo;t available. Database migration 52 may not have been applied.
      </p>
    );
  }

  const adopt = (next: AdminLockState) => {
    setState(next);
    setLocked(next.locked);
    setHeadline(next.headline);
    setMessage(next.message);
    setAutoUnlock(next.autoUnlock);
    setPin("");
    setLaunchAt("");
  };

  const save = async (options?: { clearLaunch?: boolean }) => {
    if (saving) return;
    setError(null);

    let launchInHours: number | undefined;
    if (!options?.clearLaunch && launchAt) {
      const hours = (new Date(launchAt).getTime() - Date.now()) / 3_600_000;
      if (!Number.isFinite(hours) || hours <= 0) {
        setError("Pick a launch time in the future.");
        return;
      }
      launchInHours = Math.round(hours * 100) / 100;
    }
    if (locked && !state.hasPin && !pin) {
      setError("Set a preview PIN before locking the shop, so you can still see it.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/site-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locked,
          pin: pin || undefined,
          headline,
          message,
          launchInHours,
          clearLaunch: options?.clearLaunch === true,
          autoUnlock,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { state?: AdminLockState; error?: string };
      if (!response.ok || !payload.state) {
        setError(payload.error || "Could not update the shop lock.");
        return;
      }
      adopt(payload.state);
      toast(payload.state.effectiveLocked ? "The shop is locked. Visitors see the holding page." : "The shop is live.");
      // Updates the status pill in the top bar.
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const remaining = countdownLabel(state.launchAt, state.serverNow);
  const changed =
    locked !== state.locked ||
    pin !== "" ||
    headline !== state.headline ||
    message !== state.message ||
    launchAt !== "" ||
    autoUnlock !== state.autoUnlock;

  return (
    <div className="flex flex-col gap-6">
      <div
        className={
          state.effectiveLocked
            ? "rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900"
            : "rounded-lg bg-emerald-50 px-4 py-3 text-[14px] text-emerald-900"
        }
      >
        <strong className="font-semibold">{state.effectiveLocked ? "The shop is locked." : "The shop is live."}</strong>{" "}
        {state.effectiveLocked
          ? "Customers see the “Launching soon” page; people with the preview PIN see the shop."
          : "Customers can browse and order."}
      </div>

      <Switch
        checked={locked}
        onChange={setLocked}
        label="Lock the shop"
        description="Shows the “Launching soon” page to everyone without the preview PIN. Saved when you press Save."
      />

      <Field
        label={state.hasPin ? "Change preview PIN" : "Preview PIN"}
        hint={
          state.hasPin
            ? "A PIN is set. Leave blank to keep it. Changing it signs everyone else out of the preview."
            : "4 to 12 digits. Needed to lock the shop: anyone with it can view the shop while it is locked."
        }
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder={state.hasPin ? "Keep current PIN" : "e.g. 2468"}
            className="max-w-xs"
          />
        )}
      </Field>

      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-5">
        <p className="text-[14px] font-medium text-neutral-900">Launch countdown</p>
        {state.launchAt ? (
          <div className="flex flex-wrap items-center gap-3 text-[14px] text-neutral-700">
            <span>
              Launches {dubaiDateTime(state.launchAt)} (Dubai)
              {remaining ? <span className="text-neutral-500"> · {remaining}</span> : null}
            </span>
            <Button variant="plain" size="sm" disabled={saving} onClick={() => void save({ clearLaunch: true })}>
              Remove countdown
            </Button>
          </div>
        ) : (
          <p className="text-[14px] text-neutral-500">No countdown is shown.</p>
        )}
        <Field label="Set a launch date and time" hint="Your local time. The holding page counts down to it.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="datetime-local"
              value={launchAt}
              onChange={(e) => setLaunchAt(e.target.value)}
              className="max-w-xs"
            />
          )}
        </Field>
        <Switch
          checked={autoUnlock}
          onChange={setAutoUnlock}
          label="Open the shop automatically at launch"
          description="When the countdown ends, the lock lifts by itself."
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-neutral-100 pt-5">
        <p className="text-[14px] font-medium text-neutral-900">Holding page text</p>
        <Field label="Headline">
          {({ id }) => <Input id={id} value={headline} maxLength={80} onChange={(e) => setHeadline(e.target.value)} />}
        </Field>
        <Field label="Message">
          {({ id }) => (
            <Textarea id={id} value={message} maxLength={240} rows={3} onChange={(e) => setMessage(e.target.value)} />
          )}
        </Field>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-[14px] text-red-800">
          {error}
        </p>
      ) : null}

      <div>
        <Button onClick={() => void save()} busy={saving} disabled={!changed}>
          Save store status
        </Button>
      </div>
    </div>
  );
}
