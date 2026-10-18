"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Badge } from "../../../_ui/Badge";
import { Button } from "../../../_ui/Button";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { Field, Switch, Textarea } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";

export type AgentSwitches = {
  enabled: boolean;
  greeting: string;
  photosEnabled: boolean;
  offersEnabled: boolean;
  orderHelpEnabled: boolean;
  nudgesEnabled: boolean;
};

/** The owner's controls for the shop's chat assistant. Changes are staged, then saved together. */
export default function AgentSettingsForm({
  initial,
  defaultGreeting,
  ready,
  modelReady,
  visionReady,
}: {
  initial: AgentSwitches;
  defaultGreeting: string;
  /** Migration 65 has run, so the switches can be saved. */
  ready: boolean;
  /** The server has its AI key, so the agent can answer at all. */
  modelReady: boolean;
  /** Photo reading is allowed on the server (CONCIERGE_VISION). */
  visionReady: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();

  const dirty = (Object.keys(draft) as (keyof AgentSwitches)[]).some((k) => draft[k] !== saved[k]);
  const set = <K extends keyof AgentSwitches>(key: K, value: AgentSwitches[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const live = saved.enabled && modelReady;

  const save = async () => {
    setSaving(true);
    setError(null);
    const greeting = draft.greeting.trim();
    const result = await adminFetch<{ settings?: Record<string, unknown> }>(
      "/api/admin/agent",
      "PATCH",
      {
        enabled: draft.enabled,
        greeting: greeting === "" || greeting === defaultGreeting ? null : greeting,
        photos_enabled: draft.photosEnabled,
        offers_enabled: draft.offersEnabled,
        order_help_enabled: draft.orderHelpEnabled,
        nudges_enabled: draft.nudgesEnabled,
      },
      "The settings could not be saved."
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = { ...draft, greeting: greeting === defaultGreeting ? "" : greeting };
    setSaved(next);
    setDraft(next);
    toast(next.enabled ? "Agent settings saved. Changes reach the shop within a minute." : "The agent is off. The chat button disappears from the shop within a minute.");
    startTransition(() => router.refresh());
  };

  return (
    <Card>
      <CardHeader
        title="Agent on your shop"
        description="Changes reach the shop within a minute."
        actions={live ? <Badge tone="emerald" dot>On</Badge> : <Badge tone="neutral" dot>Off</Badge>}
      />
      <CardBody className="flex flex-col gap-4">
        {!modelReady ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
            The agent can&rsquo;t answer anyone: the server has no AI key (OPENAI_API_KEY). Until it does, the chat button stays hidden whatever these switches say.
          </p>
        ) : null}
        {!ready ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
            <strong className="font-semibold">These switches need database migration 65.</strong> Run{" "}
            <code className="rounded bg-amber-100 px-1">supabase/migrations/65_agent_settings.sql</code> in the Supabase SQL
            editor, then reload. Until then the agent works as it always has, with everything on.
          </p>
        ) : null}

        <div className="rounded-lg border border-neutral-200 px-4 py-3">
          <Switch
            checked={draft.enabled}
            onChange={(v) => set("enabled", v)}
            disabled={!ready}
            label="Agent is on"
            description={draft.enabled ? "Shoppers see the chat button and can talk to it." : "The chat button is hidden from the shop and the agent answers nobody."}
          />
        </div>

        <div className="flex flex-col divide-y divide-neutral-100">
          <div className="py-2">
            <Switch
              checked={draft.photosEnabled}
              onChange={(v) => set("photosEnabled", v)}
              disabled={!ready || !draft.enabled}
              label="Read photos shoppers send"
              description={
                visionReady
                  ? "Shoppers can photograph a bottle and ask if you carry it or something like it."
                  : "Switched off on the server (CONCIERGE_VISION), so photos stay off whatever this says."
              }
            />
          </div>
          <div className="py-2">
            <Switch
              checked={draft.offersEnabled}
              onChange={(v) => set("offersEnabled", v)}
              disabled={!ready || !draft.enabled}
              label="Talk about discount codes"
              description="It may offer codes marked “Concierge only” (see Discount codes) and check codes shoppers name. Off: it never discusses codes."
            />
          </div>
          <div className="py-2">
            <Switch
              checked={draft.orderHelpEnabled}
              onChange={(v) => set("orderHelpEnabled", v)}
              disabled={!ready || !draft.enabled}
              label="Help find an order"
              description="Shoppers can check where their order is from the chat. Off: it points them to the tracking page."
            />
          </div>
          <div className="py-2">
            <Switch
              checked={draft.nudgesEnabled}
              onChange={(v) => set("nudgesEnabled", v)}
              disabled={!ready || !draft.enabled}
              label="Pop-up hints"
              description="Small suggestions beside the chat button, for example on a product page or a full bag."
            />
          </div>
        </div>

        <Field label="Greeting" hint="Its first words when a shopper opens the chat. Leave empty for the house greeting." error={error}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              rows={3}
              maxLength={400}
              disabled={!ready}
              placeholder={defaultGreeting}
              value={draft.greeting}
              onChange={(e) => set("greeting", e.target.value)}
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {dirty ? <span className="mr-auto text-[14px] text-neutral-500">Unsaved changes</span> : null}
          {dirty ? (
            <Button variant="secondary" onClick={() => setDraft(saved)} disabled={saving}>
              Undo changes
            </Button>
          ) : null}
          <Button onClick={save} busy={saving || refreshing} disabled={!ready || !dirty}>
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
