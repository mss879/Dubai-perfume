"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Badge } from "../../../_ui/Badge";
import { Button } from "../../../_ui/Button";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { Field, Input, Select, Switch, Textarea } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import {
  TRUST_ICONS,
  WEEKDAYS,
  type FeatureKey,
  type FeatureSettings,
  type FieldGroup,
  type FieldSpec,
  type TrustItem,
} from "../../../../lib/features";

export type PickerProduct = { id: number; label: string; sizes: string[] };

const TRUST_ICON_LABELS: Record<(typeof TRUST_ICONS)[number], string> = {
  shield: "Shield (authentic)",
  lock: "Lock (secure payment)",
  return: "Arrow (returns)",
  truck: "Truck (delivery)",
  gift: "Gift",
  sparkle: "Sparkle",
  chat: "Speech bubble (help)",
};

/**
 * A feature's switch and settings (Admin → Features → one feature). Changes
 * are staged, then saved together; the shop picks them up within a minute.
 */
export default function FeatureForm({
  featureKey,
  name,
  initialEnabled,
  initialSettings,
  groups,
  products = [],
  ready,
  onLabel,
  offLabel,
}: {
  featureKey: FeatureKey;
  name: string;
  initialEnabled: boolean;
  initialSettings: FeatureSettings;
  groups: FieldGroup[];
  products?: PickerProduct[];
  /** Migration 70 has run, so the switch can be saved. */
  ready: boolean;
  onLabel: string;
  offLabel: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState({ enabled: initialEnabled, settings: initialSettings });
  const [enabled, setEnabled] = useState(initialEnabled);
  const [settings, setSettings] = useState<FeatureSettings>(initialSettings);
  // Numbers are typed as text, and only read as numbers on save.
  const [numberText, setNumberText] = useState<Record<string, string>>(() => numberTexts(groups, initialSettings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [, startTransition] = useTransition();

  const dirty =
    enabled !== saved.enabled ||
    JSON.stringify(withNumbers(groups, settings, numberText).settings) !== JSON.stringify(saved.settings);

  const set = (key: string, value: FeatureSettings[string]) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    const parsed = withNumbers(groups, settings, numberText);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await adminFetch<{ enabled: boolean; settings: FeatureSettings }>(
      `/api/admin/features/${featureKey}`,
      "PATCH",
      { enabled, settings: parsed.settings },
      "The settings could not be saved."
    );
    setSaving(false);
    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      return;
    }
    const next = { enabled: result.data.enabled, settings: result.data.settings };
    setSaved(next);
    setEnabled(next.enabled);
    setSettings(next.settings);
    setNumberText(numberTexts(groups, next.settings));
    toast(next.enabled ? `${name} is on. The shop shows the change within a minute.` : `${name} is off.`);
    startTransition(() => router.refresh());
  };

  const reset = () => {
    setEnabled(saved.enabled);
    setSettings(saved.settings);
    setNumberText(numberTexts(groups, saved.settings));
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4 pb-40 lg:pb-24">
      <Card>
        <CardHeader
          title={name}
          description={enabled ? onLabel : offLabel}
          actions={saved.enabled ? <Badge tone="emerald" dot>On</Badge> : <Badge tone="neutral" dot>Off</Badge>}
        />
        <CardBody>
          <div className="rounded-lg border border-neutral-200 px-4 py-3">
            <Switch
              checked={enabled}
              onChange={setEnabled}
              disabled={!ready}
              label={`${name} is on`}
              description={enabled ? "Switched on: shoppers see it once you save." : "Switched off: shoppers don't see it. Your settings are kept."}
            />
          </div>
        </CardBody>
      </Card>

      {groups.map((group) => (
        <Card key={group.title}>
          <CardHeader title={group.title} description={group.description} />
          <CardBody className="flex flex-col gap-5">
            {group.fields.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                settings={settings}
                numberText={numberText}
                setNumber={(k, v) => setNumberText((t) => ({ ...t, [k]: v }))}
                set={set}
                products={products}
                disabled={!ready}
                error={error?.field === field.key ? error.message : null}
              />
            ))}
          </CardBody>
        </Card>
      ))}

      {error && !error.field ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-[14px] text-red-800">
          {error.message}
        </p>
      ) : null}

      {/* Save bar: always in reach, above the phone's bottom navigation. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60 print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-neutral-500">
            {error ? <span className="font-medium text-red-700">{error.message}</span> : dirty ? "Unsaved changes" : "All changes saved"}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} disabled={!dirty || saving}>
              Discard
            </Button>
            <Button onClick={save} busy={saving} disabled={!dirty || !ready}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function numberTexts(groups: FieldGroup[], settings: FeatureSettings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of groups.flatMap((g) => g.fields)) {
    if (f.kind === "number") out[f.key] = String(settings[f.key] ?? f.default);
  }
  return out;
}

/** The settings with the typed numbers read back, or the first number that isn't one. */
function withNumbers(
  groups: FieldGroup[],
  settings: FeatureSettings,
  text: Record<string, string>
): { settings: FeatureSettings; error: { message: string; field: string } | null } {
  const out: FeatureSettings = { ...settings };
  for (const f of groups.flatMap((g) => g.fields)) {
    if (f.kind !== "number") continue;
    const raw = (text[f.key] ?? "").trim();
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) return { settings: out, error: { message: `${f.label}: enter a number.`, field: f.key } };
    if (value < f.min || value > f.max) return { settings: out, error: { message: `${f.label}: enter ${f.min} to ${f.max}.`, field: f.key } };
    if (f.integer && !Number.isInteger(value)) return { settings: out, error: { message: `${f.label}: enter a whole number.`, field: f.key } };
    out[f.key] = value;
  }
  return { settings: out, error: null };
}

function FieldControl({
  field,
  settings,
  numberText,
  setNumber,
  set,
  products,
  disabled,
  error,
}: {
  field: FieldSpec;
  settings: FeatureSettings;
  numberText: Record<string, string>;
  setNumber: (key: string, value: string) => void;
  set: (key: string, value: FeatureSettings[string]) => void;
  products: PickerProduct[];
  disabled: boolean;
  error: string | null;
}) {
  const value = settings[field.key];
  switch (field.kind) {
    case "switch":
      return (
        <div>
          <Switch checked={value === true} onChange={(v) => set(field.key, v)} disabled={disabled} label={field.label} description={field.hint} />
          {error ? <p className="mt-1 text-[13px] font-medium text-red-700">{error}</p> : null}
        </div>
      );
    case "number":
      return (
        <Field label={field.label} hint={field.hint} error={error}>
          {({ id, describedBy, invalid }) => (
            <div className="flex items-center gap-2">
              {field.prefix ? <span className="text-[14px] text-neutral-500">{field.prefix}</span> : null}
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                value={numberText[field.key] ?? ""}
                onChange={(e) => setNumber(field.key, e.target.value)}
                disabled={disabled}
                className="max-w-[140px]"
              />
              {field.suffix ? <span className="text-[14px] text-neutral-500">{field.suffix}</span> : null}
            </div>
          )}
        </Field>
      );
    case "text":
      return (
        <Field label={field.label} hint={hintWithCount(field.hint, String(value ?? ""), field.max)} error={error}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={String(value ?? "")}
              maxLength={field.max}
              placeholder={field.placeholder}
              onChange={(e) => set(field.key, e.target.value)}
              disabled={disabled}
            />
          )}
        </Field>
      );
    case "textarea":
      return (
        <Field label={field.label} hint={hintWithCount(field.hint, String(value ?? ""), field.max)} error={error}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              rows={field.rows ?? 3}
              value={String(value ?? "")}
              maxLength={field.max}
              placeholder={field.placeholder}
              onChange={(e) => set(field.key, e.target.value)}
              disabled={disabled}
            />
          )}
        </Field>
      );
    case "select":
      return (
        <Field label={field.label} hint={field.hint} error={error}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} value={String(value ?? field.default)} onChange={(e) => set(field.key, e.target.value)} disabled={disabled}>
              {field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      );
    case "numberList":
      return (
        <ChipList
          label={field.label}
          hint={field.hint}
          error={error}
          values={(Array.isArray(value) ? value : []).map(String)}
          maxItems={field.maxItems}
          inputMode="numeric"
          suffix={field.suffix}
          disabled={disabled}
          accept={(raw) => {
            const n = Number(raw);
            return Number.isInteger(n) && n >= field.min && n <= field.max ? String(n) : null;
          }}
          rejectMessage={`Enter a whole amount from ${field.min} to ${field.max}.`}
          onChange={(next) => set(field.key, next.map(Number).sort((a, b) => a - b))}
        />
      );
    case "textList":
      return (
        <ChipList
          label={field.label}
          hint={field.hint}
          error={error}
          values={(Array.isArray(value) ? value : []).map(String)}
          maxItems={field.maxItems}
          placeholder={field.placeholder}
          disabled={disabled}
          accept={(raw) => (raw.trim() && raw.trim().length <= field.max ? raw.trim() : null)}
          rejectMessage={`Up to ${field.max} characters.`}
          onChange={(next) => set(field.key, next)}
        />
      );
    case "dateList":
      return (
        <ChipList
          label={field.label}
          hint={field.hint ?? "Pick a date, then Add."}
          error={error}
          values={(Array.isArray(value) ? value : []).map(String)}
          maxItems={field.maxItems}
          type="date"
          disabled={disabled}
          accept={(raw) => (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null)}
          rejectMessage="Choose a date."
          onChange={(next) => set(field.key, [...next].sort())}
        />
      );
    case "weekdays": {
      const days = Array.isArray(value) ? (value as number[]) : [];
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium text-neutral-800">{field.label}</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day, index) => {
              const on = days.includes(index);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => set(field.key, on ? days.filter((d) => d !== index) : [...days, index].sort())}
                  className={`h-10 rounded-lg px-3 text-[14px] ring-1 ring-inset ${on ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-800 ring-neutral-300 hover:bg-neutral-50"}`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <p className="text-[13px] text-neutral-500">{days.length === 0 ? "None: every day counts." : `Skipped: ${days.map((d) => WEEKDAYS[d]).join(", ")}.`}</p>
          {error ? <p className="text-[13px] font-medium text-red-700">{error}</p> : null}
        </div>
      );
    }
    case "trustItems":
      return <TrustItemsEditor items={(Array.isArray(value) ? value : []) as TrustItem[]} onChange={(next) => set(field.key, next)} disabled={disabled} error={error} />;
    case "product": {
      const id = typeof value === "number" ? value : null;
      const product = products.find((p) => p.id === id) ?? null;
      const size = String(settings[field.sizeKey] ?? "");
      return (
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field label={field.label} hint={field.hint} error={error}>
            {({ id: controlId, describedBy, invalid }) => (
              <Select
                id={controlId}
                aria-describedby={describedBy}
                invalid={invalid}
                value={id ? String(id) : ""}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.value ? Number(e.target.value) : null;
                  set(field.key, next);
                  set(field.sizeKey, products.find((p) => p.id === next)?.sizes[0] ?? "");
                }}
              >
                <option value="">Choose a perfume…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Size">
            {({ id: controlId }) => (
              <Select id={controlId} value={size} disabled={disabled || !product} onChange={(e) => set(field.sizeKey, e.target.value)}>
                {(product?.sizes ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      );
    }
  }
}

function hintWithCount(hint: string | undefined, value: string, max: number) {
  const count = `${value.length}/${max}`;
  return hint ? `${hint} (${count})` : count;
}

function ChipList({
  label,
  hint,
  error,
  values,
  maxItems,
  accept,
  rejectMessage,
  onChange,
  disabled,
  inputMode,
  type = "text",
  suffix,
  placeholder,
}: {
  label: string;
  hint?: string;
  error: string | null;
  values: string[];
  maxItems: number;
  accept: (raw: string) => string | null;
  rejectMessage: string;
  onChange: (next: string[]) => void;
  disabled: boolean;
  inputMode?: "numeric" | "text";
  type?: "text" | "date";
  suffix?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const add = () => {
    const clean = accept(draft);
    if (!clean) {
      setProblem(rejectMessage);
      return;
    }
    if (values.includes(clean)) {
      setDraft("");
      return;
    }
    if (values.length >= maxItems) {
      setProblem(`At most ${maxItems}.`);
      return;
    }
    onChange([...values, clean]);
    setDraft("");
    setProblem(null);
  };
  return (
    <Field label={label} hint={hint} error={problem ?? error}>
      {({ id, describedBy, invalid }) => (
        <div className="flex flex-col gap-2">
          {values.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {values.map((v) => (
                <li key={v} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1 text-[13px] text-neutral-800">
                  {v}
                  {suffix ? ` ${suffix}` : ""}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(values.filter((x) => x !== v))}
                    className="rounded-full p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                    aria-label={`Remove ${v}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-neutral-500">None yet.</p>
          )}
          <div className="flex gap-2">
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type={type}
              inputMode={inputMode}
              value={draft}
              placeholder={placeholder}
              disabled={disabled}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              className="max-w-[220px]"
            />
            <Button variant="secondary" onClick={add} disabled={disabled || !draft} icon={<Plus className="h-4 w-4" aria-hidden />}>
              Add
            </Button>
          </div>
        </div>
      )}
    </Field>
  );
}

function TrustItemsEditor({
  items,
  onChange,
  disabled,
  error,
}: {
  items: TrustItem[];
  onChange: (next: TrustItem[]) => void;
  disabled: boolean;
  error: string | null;
}) {
  const update = (index: number, patch: Partial<TrustItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[180px_1fr_1fr_auto] sm:items-end">
          <Field label="Icon">
            {({ id }) => (
              <Select id={id} value={item.icon} disabled={disabled} onChange={(e) => update(index, { icon: e.target.value as TrustItem["icon"] })}>
                {TRUST_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {TRUST_ICON_LABELS[icon]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Title">
            {({ id }) => <Input id={id} value={item.title} maxLength={40} disabled={disabled} onChange={(e) => update(index, { title: e.target.value })} />}
          </Field>
          <Field label="Line under it">
            {({ id }) => <Input id={id} value={item.text} maxLength={80} disabled={disabled} onChange={(e) => update(index, { text: e.target.value })} />}
          </Field>
          <Button variant="plain" disabled={disabled} onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label={`Remove badge ${index + 1}`}>
            Remove
          </Button>
        </div>
      ))}
      {items.length < 4 ? (
        <div>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => onChange([...items, { icon: "sparkle", title: "", text: "" }])}
            icon={<Plus className="h-4 w-4" aria-hidden />}
          >
            Add a badge
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-[13px] font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
