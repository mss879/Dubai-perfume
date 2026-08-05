"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The closed door.
 *
 * Two things here are worth knowing:
 *
 *   * The countdown is anchored to the DATABASE clock, not the visitor's. The
 *     server sends both `launchAt` and the `serverNow` it was read at; the
 *     offset between that and the device clock is measured once on mount and
 *     applied to every tick. A visitor whose laptop is a day out still sees the
 *     right number of hours.
 *
 *   * Nothing time-dependent is rendered until after mount. The server and the
 *     first client render therefore agree, and the countdown appears a frame
 *     later rather than as a hydration mismatch.
 */

type Props = {
  siteName: string;
  headline: string;
  message: string;
  launchAt: string | null;
  serverNow: string;
  hasPin: boolean;
};

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function split(ms: number): Remaining {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function LaunchingSoonClient({
  siteName,
  headline,
  message,
  launchAt,
  serverNow,
  hasPin,
}: Props) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [elapsed, setElapsed] = useState(false);

  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!launchAt) return;

    const target = new Date(launchAt).getTime();
    const serverAt = new Date(serverNow).getTime();
    if (!Number.isFinite(target) || !Number.isFinite(serverAt)) return;

    // Positive when the visitor's clock runs behind the database's.
    const skew = serverAt - Date.now();

    const tick = () => {
      const left = target - (Date.now() + skew);
      setRemaining(split(left));
      setElapsed(left <= 0);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [launchAt, serverNow]);

  // The countdown reaching zero only opens the site when the owner chose
  // auto-unlock, and that decision lives in the database. Rather than encode it
  // here, ask the server once: it either serves the storefront or serves this
  // page again.
  useEffect(() => {
    if (!elapsed) return;
    const id = setTimeout(() => window.location.reload(), 1500);
    return () => clearTimeout(id);
  }, [elapsed]);

  const submitPin = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (submitting) return;

      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/site-lock/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };

        if (!response.ok) {
          setError(payload.error || "That PIN was not recognised.");
          setPin("");
          return;
        }

        // The bypass cookie is set; a full load re-runs the proxy, which now
        // lets this request through to the real page.
        window.location.reload();
      } catch {
        setError("Could not reach the maison. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [pin, submitting]
  );

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-16 text-center relative overflow-hidden bg-[#0f0702]">
      {/* The ground is the house's own material: the near-black of oud resin,
          lifted by the amber that runs through the hero gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 0%, rgba(230,168,108,0.16) 0%, rgba(178,96,39,0.06) 38%, rgba(15,7,2,0) 72%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full">
        <span className="text-[10px] sm:text-[11px] tracking-[0.55em] uppercase text-[#e6a86c]/70 font-medium">
          {siteName}
        </span>

        <div className="mt-8 h-px w-16 bg-gradient-to-r from-transparent via-[#e6a86c]/50 to-transparent" />

        <h1 className="mt-8 font-serif-luxury text-[clamp(2.25rem,7vw,4.25rem)] leading-[1.05] text-[#f7f2ec] font-light tracking-tight">
          {headline}
        </h1>

        {message ? (
          <p className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-[#f7f2ec]/55 font-light">
            {message}
          </p>
        ) : null}

        {launchAt ? (
          <div className="mt-12 w-full">
            {remaining ? (
              <div className="flex items-start justify-center gap-5 sm:gap-9">
                {[
                  { value: remaining.days, label: "Days" },
                  { value: remaining.hours, label: "Hours" },
                  { value: remaining.minutes, label: "Minutes" },
                  { value: remaining.seconds, label: "Seconds" },
                ].map((unit) => (
                  <div key={unit.label} className="flex flex-col items-center">
                    <span
                      className="font-serif-luxury text-[clamp(1.75rem,6vw,3rem)] leading-none text-[#f7f2ec] tabular-nums font-light"
                      // Fixed-width digits so the numerals do not jitter as the
                      // seconds roll over.
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {pad(unit.value)}
                    </span>
                    <span className="mt-3 text-[8.5px] sm:text-[9.5px] tracking-[0.32em] uppercase text-[#e6a86c]/50">
                      {unit.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              // Reserves the countdown's height so the layout does not jump
              // when the first tick lands.
              <div className="h-[76px] sm:h-[92px]" aria-hidden />
            )}

            <p aria-live="polite" className="sr-only">
              {remaining
                ? `Launching in ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes.`
                : "Loading the countdown."}
            </p>
          </div>
        ) : null}

        {hasPin ? (
          <div className="mt-14 w-full flex flex-col items-center">
            {showPin ? (
              <form onSubmit={submitPin} className="w-full max-w-[15rem] flex flex-col items-center">
                <label
                  htmlFor="site-pin"
                  className="text-[9px] tracking-[0.32em] uppercase text-[#f7f2ec]/40"
                >
                  Enter access PIN
                </label>
                <input
                  id="site-pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  className="mt-4 w-full bg-transparent border-b border-[#e6a86c]/25 focus:border-[#e6a86c]/70 outline-none text-center text-[1.35rem] tracking-[0.5em] text-[#f7f2ec] py-2 transition-colors"
                />
                <button
                  type="submit"
                  disabled={submitting || pin.length < 4}
                  className="mt-7 text-[9.5px] tracking-[0.32em] uppercase text-[#0f0702] bg-[#e6a86c] hover:bg-[#f0bb85] disabled:opacity-30 disabled:cursor-not-allowed px-8 py-3 transition-colors font-semibold"
                >
                  {submitting ? "Checking" : "Enter"}
                </button>
                {error ? (
                  <p role="alert" className="mt-4 text-[11px] text-[#e9927a]">
                    {error}
                  </p>
                ) : null}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowPin(true)}
                className="text-[9px] tracking-[0.32em] uppercase text-[#f7f2ec]/25 hover:text-[#e6a86c]/70 transition-colors py-2"
              >
                I have an access PIN
              </button>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
