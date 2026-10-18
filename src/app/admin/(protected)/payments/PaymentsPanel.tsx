"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "../../_ui/Button";
import { cn } from "../../_ui/cn";
import { useToast } from "../../_ui/Toast";

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
  inquiry: boolean;
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

function StatusItem({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-3">
      <dt className="text-[13px] text-neutral-500">{label}</dt>
      <dd className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", good ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
        {value}
      </dd>
    </div>
  );
}

export default function PaymentsPanel() {
  const toast = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"mode" | "check" | null>(null);

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
        toast(json?.error || "The payment mode could not be changed.", "error");
      } else {
        setSettings(json);
        toast(mode === "online" ? "The store now takes payment online." : "The store is back on cash on delivery.");
        router.refresh();
      }
    } catch {
      toast("The payment mode could not be changed.", "error");
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
        toast(
          json?.reason === "payments_not_configured" ? "Online payments are not configured." : "The payment check failed.",
          "error"
        );
      } else {
        toast(
          `Payment check done — ${json.checked ?? 0} checked, ${json.expired ?? 0} released, ${json.emailed ?? 0} emails sent.`
        );
      }
    } catch {
      toast("The payment check failed.", "error");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied.");
    } catch {
      toast(value, "info");
    }
  };

  if (loadError) {
    return (
      <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
        {loadError}
      </p>
    );
  }

  if (!settings) {
    return <div className="h-24 animate-pulse rounded-lg bg-neutral-100" aria-busy="true" />;
  }

  const online = settings.storeMode === "online";

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatusItem
          label="Customers pay"
          value={online ? "Online (card, Apple Pay, Google Pay)" : "Cash on delivery"}
          good={online}
        />
        <StatusItem
          label="Paymob keys"
          value={settings.configured ? (settings.keyMode === "live" ? "Live" : "Test") : "Not set"}
          good={settings.configured}
        />
        <StatusItem
          label="Database secret"
          value={settings.secretAccepted ? "Matches" : "Not accepted"}
          good={settings.secretAccepted}
        />
        <StatusItem
          label="Payment check (every 10 min)"
          value={settings.cronConfigured ? "Scheduled" : "Not set"}
          good={settings.cronConfigured}
        />
        {settings.configured ? (
          <StatusItem
            label="Backup checks"
            value={settings.inquiry ? "On" : "Off (no API key)"}
            good={settings.inquiry}
          />
        ) : null}
      </dl>

      <div className="flex flex-col gap-2 text-[14px] leading-relaxed">
        {!settings.migrationApplied ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
            Migration 63 has not been applied to the database yet.
          </p>
        ) : null}
        {settings.missing.length > 0 ? (
          <p className="text-neutral-700">
            <span className="text-neutral-500">Not set on this deployment: </span>
            {settings.missing.join(", ")}
          </p>
        ) : null}
        {settings.invalid.length > 0 ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
            Set but not usable: {settings.invalid.join(", ")}
          </p>
        ) : null}
        {settings.configured && !settings.inquiry ? (
          <p className="text-neutral-600">
            Running on Paymob&rsquo;s notifications alone (PAYMOB_API_KEY is not set). Payments are confirmed
            the moment Paymob reports them. Without the key the store cannot ask Paymob about a notification that
            never arrived, and refunds made in Paymob&rsquo;s own dashboard do not show here. Refunds made from an
            order&rsquo;s page do.
          </p>
        ) : null}
        {settings.configured && !settings.secretAccepted ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
            The database does not accept PAYMENTS_RPC_SECRET. Store the same value in app_config row
            &lsquo;payments&rsquo; (see docs/payments-paymob.md).
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-neutral-200 p-4">
        <p className="text-[14px] font-medium text-neutral-900">Paymob dashboard</p>
        <p className="mt-0.5 text-[13px] text-neutral-500">
          Set these on every integration (card, Apple Pay, Google Pay) under Integrations &amp; Webhooks.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {[
            ["Webhook URL", settings.webhookUrl],
            ["Redirect URL", settings.redirectUrl],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-28 shrink-0 text-[13px] text-neutral-500">{label}</span>
              <code className="min-w-0 flex-1 break-all rounded-md bg-neutral-50 px-2.5 py-1.5 text-[13px] text-neutral-800">
                {value}
              </code>
              <Button variant="secondary" size="sm" onClick={() => copy(value)} icon={<Copy className="h-3.5 w-3.5" aria-hidden />}>
                Copy
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {online ? (
          <Button variant="secondary" disabled={busy !== null} busy={busy === "mode"} onClick={() => switchMode("cod")}>
            Switch back to cash on delivery
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={busy !== null || !settings.configured || !settings.secretAccepted}
            busy={busy === "mode"}
            onClick={() => switchMode("online")}
          >
            Switch to online payment
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={busy !== null}
          busy={busy === "check"}
          onClick={checkNow}
          icon={<RefreshCw className="h-4 w-4" aria-hidden />}
        >
          Check payments now
        </Button>
      </div>
    </div>
  );
}
