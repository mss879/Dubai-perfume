"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

/**
 * Online payment (Paymob) at a glance, and the owner's switch.
 *
 * Shows whether this deployment is configured — variable NAMES only, never
 * values — whether the database accepts the payment secret, which mode the
 * store is in, and the two URLs to paste into Paymob's dashboard. The switch
 * refuses 'online' until everything is ready (the server checks again).
 */

type Settings = {
  configured: boolean;
  keyMode: "test" | "live" | null;
  missing: string[];
  invalid: string[];
  secretAccepted: boolean;
  migrationApplied: boolean;
  storeMode: "cod" | "online";
  cronConfigured: boolean;
  webhookUrl: string;
  redirectUrl: string;
};

const chip = (good: boolean) =>
  `text-[7.5px] tracking-widest px-2 py-0.5 border font-black ${
    good ? "border-green-800/40 bg-green-950/15 text-green-400" : "border-amber-700/40 bg-amber-950/20 text-amber-400"
  }`;

async function fetchSettings(): Promise<{ ok: true; settings: Settings } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/admin/payments/settings", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as (Settings & { error?: string }) | null;
    if (!res.ok || !json) return { ok: false, error: json?.error || "Payment settings are unavailable." };
    return { ok: true, settings: json };
  } catch {
    return { ok: false, error: "Payment settings are unavailable." };
  }
}

export default function PaymentsPanel({ onToast }: { onToast: (message: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"mode" | "check" | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchSettings();
      if (cancelled) return;
      if (result.ok) {
        setLoadError(null);
        setSettings(result.settings);
      } else {
        setLoadError(result.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const switchMode = async (mode: "cod" | "online") => {
    const question =
      mode === "online"
        ? "Switch the store to online payment? Cash on delivery will be refused from now on — at checkout and in the database."
        : "Switch the store back to cash on delivery? Online payment will no longer be offered.";
    if (!window.confirm(question)) return;
    setBusy("mode");
    try {
      const res = await fetch("/api/admin/payments/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const json = (await res.json().catch(() => null)) as (Settings & { error?: string }) | null;
      if (!res.ok || !json) {
        onToast(json?.error || "The payment mode could not be changed.");
      } else {
        setSettings(json);
        onToast(mode === "online" ? "The store now takes payment online." : "The store is back on cash on delivery.");
      }
    } catch {
      onToast("The payment mode could not be changed.");
    } finally {
      setBusy(null);
    }
  };

  const checkNow = async () => {
    setBusy("check");
    try {
      const res = await fetch("/api/payments/reconcile", { method: "POST" });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; checked?: number; expired?: number; emailed?: number; reason?: string }
        | null;
      if (!res.ok || !json?.ok) {
        onToast(json?.reason === "payments_not_configured" ? "Online payments are not configured." : "The payment check failed.");
      } else {
        onToast(
          `Payment check done — ${json.checked ?? 0} checked, ${json.expired ?? 0} released, ${json.emailed ?? 0} emails sent.`
        );
      }
    } catch {
      onToast("The payment check failed.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      onToast("Copied.");
    } catch {
      onToast(value);
    }
  };

  return (
    <div className="bg-white/[0.015] border border-white/[0.04] p-5 flex flex-col gap-4 text-[9px] tracking-wider font-semibold uppercase">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[8px] tracking-[0.35em] text-amber-500 font-black">ONLINE PAYMENT — PAYMOB</span>
          {settings && (
            <>
              <span className={chip(settings.storeMode === "online")}>
                STORE: {settings.storeMode === "online" ? "ONLINE PAYMENT" : "CASH ON DELIVERY"}
              </span>
              <span className={chip(settings.configured)}>
                KEYS: {settings.configured ? (settings.keyMode === "live" ? "LIVE" : "TEST") : "NOT SET"}
              </span>
              <span className={chip(settings.secretAccepted)}>
                DATABASE SECRET: {settings.secretAccepted ? "OK" : "NOT ACCEPTED"}
              </span>
              <span className={chip(settings.cronConfigured)}>
                SCHEDULER: {settings.cronConfigured ? "SET" : "NOT SET"}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={checkNow}
            disabled={busy !== null}
            className="flex items-center gap-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] text-[8px] tracking-[0.2em] font-black px-3 py-1.5 cursor-pointer disabled:opacity-40"
          >
            {busy === "check" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            CHECK PAYMENTS NOW
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] text-[8px] tracking-[0.2em] font-black px-3 py-1.5 cursor-pointer"
          >
            {open ? "HIDE SETUP" : "SETUP"}
          </button>
        </div>
      </div>

      {loadError && <p className="text-amber-400 normal-case tracking-normal text-[10px]">{loadError}</p>}

      {open && settings && (
        <div className="flex flex-col gap-3 border-t border-white/[0.05] pt-4 normal-case tracking-normal text-[10px] font-medium text-[#EAE3DB]/70">
          {!settings.migrationApplied && (
            <p className="text-amber-400">Migration 63 has not been applied to the database yet.</p>
          )}
          {settings.missing.length > 0 && (
            <p>
              <span className="text-[#EAE3DB]/40">Not set: </span>
              {settings.missing.join(", ")}
            </p>
          )}
          {settings.invalid.length > 0 && (
            <p className="text-amber-400">
              <span className="text-[#EAE3DB]/40">Set but not usable: </span>
              {settings.invalid.join(", ")}
            </p>
          )}
          {settings.configured && !settings.secretAccepted && (
            <p className="text-amber-400">
              The database does not accept PAYMENTS_RPC_SECRET. Store the same value in app_config row
              &lsquo;payments&rsquo; (see docs/payments-paymob.md).
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[#EAE3DB]/40">
              In Paymob&rsquo;s dashboard, set these on every integration ID (card, Apple Pay, Google Pay):
            </span>
            {[
              ["Webhook URL", settings.webhookUrl],
              ["Redirect URL", settings.redirectUrl],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-center gap-2">
                <span className="text-[#EAE3DB]/40 w-24">{label}</span>
                <code className="text-amber-200 break-all">{value}</code>
                <button
                  type="button"
                  onClick={() => copy(value)}
                  className="text-[8px] tracking-[0.2em] font-black uppercase text-[#EAE3DB]/50 hover:text-white cursor-pointer"
                >
                  COPY
                </button>
              </div>
            ))}
          </div>
          <div className="pt-1">
            {settings.storeMode === "online" ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => switchMode("cod")}
                className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] text-[8px] tracking-[0.2em] font-black uppercase px-3 py-2 cursor-pointer disabled:opacity-40"
              >
                SWITCH BACK TO CASH ON DELIVERY
              </button>
            ) : (
              <button
                type="button"
                disabled={busy !== null || !settings.configured || !settings.secretAccepted}
                onClick={() => switchMode("online")}
                className="bg-amber-600 hover:bg-amber-500 text-white text-[8px] tracking-[0.2em] font-black uppercase px-3 py-2 cursor-pointer disabled:opacity-40"
              >
                SWITCH TO ONLINE PAYMENT
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
