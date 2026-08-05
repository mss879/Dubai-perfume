"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Unlock, X, Timer, KeyRound, Loader2 } from "lucide-react";

/**
 * The "lock website" control, docked at the bottom right of the admin layout so
 * it is reachable from every tab rather than buried in one.
 *
 * Nothing here is trusted: the panel talks to /api/admin/site-lock, which
 * re-verifies the admin server-side, and set_site_lock() (migration 52)
 * verifies it a third time inside the database. The PIN is sent once, hashed
 * there, and never comes back — the panel only ever learns whether one exists.
 *
 * Edits are staged locally and committed by a single Apply, so nothing is
 * written to the live site by a stray click on the switch.
 */

type LockState = {
  locked: boolean;
  effectiveLocked: boolean;
  headline: string;
  message: string;
  launchAt: string | null;
  autoUnlock: boolean;
  hasPin: boolean;
  updatedAt: string | null;
  serverNow: string;
};

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
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export default function SiteLockPanel() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LockState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Staged edits.
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [hours, setHours] = useState("");
  const [autoUnlock, setAutoUnlock] = useState(true);

  const adopt = useCallback((next: LockState) => {
    setState(next);
    setLocked(next.locked);
    setHeadline(next.headline);
    setMessage(next.message);
    setAutoUnlock(next.autoUnlock);
    setPin("");
    setHours("");
  }, []);

  // The loader is defined inside the effect (the same shape AdminDashboard
  // uses): nothing sets state synchronously in the effect body, so the first
  // render is not immediately invalidated. `loading` already starts true, and
  // `cancelled` keeps a resolved fetch from writing to an unmounted panel.
  useEffect(() => {
    let cancelled = false;

    const loadLockState = async () => {
      try {
        const response = await fetch("/api/admin/site-lock", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          state?: LockState;
          error?: string;
        };
        if (cancelled) return;

        if (!response.ok || !payload.state) {
          setError(payload.error || "Could not read the site lock.");
          return;
        }
        adopt(payload.state);
      } catch {
        if (!cancelled) setError("Could not reach the server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadLockState();
    return () => {
      cancelled = true;
    };
  }, [adopt]);

  const apply = useCallback(
    async (options?: { clearLaunch?: boolean }) => {
      if (saving) return;
      setSaving(true);
      setError(null);
      setNotice(null);

      try {
        const response = await fetch("/api/admin/site-lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locked,
            pin: pin || undefined,
            headline,
            message,
            launchInHours: options?.clearLaunch ? undefined : hours || undefined,
            clearLaunch: options?.clearLaunch === true,
            autoUnlock,
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          state?: LockState;
          error?: string;
        };

        if (!response.ok || !payload.state) {
          setError(payload.error || "Could not update the site lock.");
          return;
        }

        adopt(payload.state);
        setNotice(
          payload.state.effectiveLocked
            ? "The website is locked. Visitors see the holding page."
            : "The website is live."
        );
      } catch {
        setError("Could not reach the server.");
      } finally {
        setSaving(false);
      }
    },
    [adopt, autoUnlock, headline, hours, locked, message, pin, saving]
  );

  const isLocked = state?.effectiveLocked ?? false;
  const remaining = state ? countdownLabel(state.launchAt, state.serverNow) : null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 select-none print:hidden">
      {open && (
        <div className="w-[19rem] sm:w-[21rem] max-h-[75vh] overflow-y-auto bg-white border border-[#E5DFD3] shadow-[0_18px_50px_rgba(140,98,57,0.16)] rounded-sm">
          {/* Header */}
          {/* NB: `bg-stone-100` rather than an arbitrary `bg-[#F3EFE9]`. The
              admin theme in AdminShell forces `div[class*="bg-[#"]` to white
              with !important, which an inline style cannot outrank. Several
              elements below pick their tag for the same reason — see the note
              on <small> and <div> in place of <span>/<p>. */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5DFD3] bg-stone-100 sticky top-0">
            <span className="text-[9px] tracking-[0.28em] uppercase font-black text-[#5C4E46]">
              Website Access
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close website access panel"
              className="p-1 text-[#5C4E46] hover:text-[#1C120C]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="px-4 py-8 flex items-center justify-center text-[#7C6E65]">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div className="px-4 py-4 flex flex-col gap-4">
              {/* The switch */}
              <button
                type="button"
                onClick={() => setLocked((v) => !v)}
                className={`w-full flex items-center justify-between px-3.5 py-3 border transition-colors ${
                  locked
                    ? "border-[#8C6239] bg-[#8C6239]/[0.06]"
                    : "border-[#D8CFBF] bg-white hover:border-[#8C6239]/40"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {locked ? (
                    <Lock className="w-3.5 h-3.5 text-[#8C6239]" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-[#7C6E65]" />
                  )}
                  <span className="text-[10px] tracking-[0.18em] uppercase font-black text-[#1C120C]">
                    Lock website
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`w-9 h-5 rounded-full relative transition-colors ${
                    locked ? "bg-[#8C6239]" : "bg-[#D8CFBF]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      locked ? "left-[1.15rem]" : "left-0.5"
                    }`}
                  />
                </span>
              </button>

              {/* PIN */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[8.5px] tracking-[0.22em] uppercase font-black text-[#5C4E46] flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" />
                  {state?.hasPin ? "Change PIN" : "Set PIN"}
                  {/* <small>, not <span>: the admin theme repaints every span
                      near-black, which would erase the muted hierarchy. */}
                  <small className="font-medium tracking-normal normal-case text-[10px] text-[#7C6E65]">
                    {state?.hasPin ? "(a PIN is set)" : "(required to lock)"}
                  </small>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder={state?.hasPin ? "Leave blank to keep the current PIN" : "4 to 12 digits"}
                  className="w-full border border-[#D8CFBF] px-3 py-2 text-[12px] tracking-[0.2em] outline-none focus:border-[#8C6239]"
                />
                <small className="text-[10px] text-[#7C6E65] leading-snug">
                  Anyone with this PIN can view the site while it is locked. Changing it signs
                  everyone else out.
                </small>
              </label>

              {/* Countdown */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-[#E5DFD3]">
                <span className="text-[8.5px] tracking-[0.22em] uppercase font-black text-[#5C4E46] flex items-center gap-1.5 pt-3">
                  <Timer className="w-3 h-3" />
                  Launch countdown
                </span>

                {state?.launchAt ? (
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[#7C6E65]">
                    <small className="text-[10px] text-[#7C6E65]">
                      {new Date(state.launchAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {remaining ? ` · ${remaining}` : ""}
                    </small>
                    <button
                      type="button"
                      onClick={() => void apply({ clearLaunch: true })}
                      className="text-[9px] tracking-[0.15em] uppercase font-black text-[#b91c1c] hover:underline shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <small className="text-[10px] text-[#7C6E65]">No countdown set.</small>
                )}

                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="0.25"
                    max="8760"
                    step="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="Hours"
                    className="w-24 border border-[#D8CFBF] px-3 py-2 text-[12px] outline-none focus:border-[#8C6239]"
                  />
                  <small className="text-[10px] text-[#7C6E65] leading-snug">
                    hours from now until launch
                  </small>
                </div>

                <label className="flex items-start gap-2 mt-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoUnlock}
                    onChange={(e) => setAutoUnlock(e.target.checked)}
                    className="mt-0.5 accent-[#8C6239]"
                  />
                  <small className="text-[10px] text-[#5C4E46] leading-snug">
                    Open the website automatically when the countdown ends
                  </small>
                </label>
              </div>

              {/* Copy shown on the holding page */}
              <div className="flex flex-col gap-2 pt-3 border-t border-[#E5DFD3]">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[8.5px] tracking-[0.22em] uppercase font-black text-[#5C4E46]">
                    Headline
                  </span>
                  <input
                    type="text"
                    value={headline}
                    maxLength={80}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="w-full border border-[#D8CFBF] px-3 py-2 text-[12px] outline-none focus:border-[#8C6239]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[8.5px] tracking-[0.22em] uppercase font-black text-[#5C4E46]">
                    Message
                  </span>
                  <textarea
                    value={message}
                    maxLength={240}
                    rows={2}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full border border-[#D8CFBF] px-3 py-2 text-[12px] outline-none focus:border-[#8C6239] resize-none"
                  />
                </label>
              </div>

              {error ? (
                <div role="alert" className="text-[10.5px] text-[#b91c1c] leading-snug">
                  {error}
                </div>
              ) : null}
              {notice && !error ? (
                <div className="text-[10.5px] text-[#15803d] leading-snug">{notice}</div>
              ) : null}

              <button
                type="button"
                onClick={() => void apply()}
                disabled={saving}
                className="w-full bg-amber-600 text-white text-[9.5px] tracking-[0.28em] uppercase font-black py-3 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      {/* The dock. Always shows the live state, so the operator can see at a
          glance from any tab whether the storefront is open. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-2.5 px-4 py-3 border shadow-[0_10px_30px_rgba(140,98,57,0.14)] transition-colors ${
          isLocked
            ? "bg-[#8C6239] border-[#8C6239] text-white"
            : "bg-white border-[#E5DFD3] text-[#1C120C] hover:border-[#8C6239]/50"
        }`}
      >
        {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        {/* Deliberately not wrapped in a <span>: the admin theme forces every
            span to near-black, which would be unreadable on the locked state's
            brown. A button's own text is not covered by that rule. */}
        {loading ? "Checking" : isLocked ? "Site locked" : "Site live"}
      </button>
    </div>
  );
}
