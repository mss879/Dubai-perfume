"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { APPLIES_TO_LABELS, discountSchema } from "../../../_lib/discount-schema";
import { Button } from "../../../_ui/Button";
import { Dialog } from "../../../_ui/Dialog";
import { Field, Input, Select, Switch } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import { cn } from "../../../_ui/cn";

export type PickProduct = { id: number; brand: string; name: string };
export type PickCollection = { id: string; title: string };

type AppliesTo = keyof typeof APPLIES_TO_LABELS;
type DeliveryKind = "free" | "amount";

const toNumber = (v: string) => (v.trim() === "" ? NaN : Number(v));

const APPLIES_HINT: Record<AppliesTo, string> = {
  order: "Takes the discount off everything in the bag.",
  products: "Only the perfumes you choose are discounted.",
  collections: "Only perfumes in the chosen collections are discounted (a brand page covers all of that brand).",
  delivery: "Takes the discount off the AED 25 delivery fee. Orders of AED 300 or more already ship free.",
};

export default function NewDiscountButton({
  products,
  collections,
  targetsReady,
}: {
  products: PickProduct[];
  collections: PickCollection[];
  /** Migration 67 has run, so a code can cover perfumes, collections or delivery. */
  targetsReady: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [appliesTo, setAppliesTo] = useState<AppliesTo>("order");
  const [type, setType] = useState<"percentage" | "fixed_amount">("percentage");
  const [deliveryKind, setDeliveryKind] = useState<DeliveryKind>("free");
  const [value, setValue] = useState("");
  const [minimum, setMinimum] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [limit, setLimit] = useState("");
  const [conciergeOnly, setConciergeOnly] = useState(false);
  const [combines, setCombines] = useState(false);
  const [productIds, setProductIds] = useState<number[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const needle = productQuery.trim().toLowerCase();
  const shownProducts = useMemo(
    () => products.filter((p) => !needle || `${p.brand} ${p.name}`.toLowerCase().includes(needle)).slice(0, 200),
    [products, needle]
  );

  const reset = () => {
    setCode("");
    setAppliesTo("order");
    setType("percentage");
    setDeliveryKind("free");
    setValue("");
    setMinimum("");
    setEndsOn("");
    setLimit("");
    setConciergeOnly(false);
    setCombines(false);
    setProductIds([]);
    setCollectionIds([]);
    setProductQuery("");
    setErrors({});
    setFormError(null);
  };

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const save = async () => {
    setFormError(null);
    // Free delivery is 100% off the delivery fee.
    const freeDelivery = appliesTo === "delivery" && deliveryKind === "free";
    const checked = discountSchema.safeParse({
      code,
      type: freeDelivery ? "percentage" : appliesTo === "delivery" ? "fixed_amount" : type,
      value: freeDelivery ? 100 : toNumber(value),
      min_requirement: minimum.trim() === "" ? 0 : toNumber(minimum),
      ends_on: endsOn,
      usage_limit: limit.trim() === "" ? null : toNumber(limit),
      concierge_only: conciergeOnly,
      combines_with_offers: appliesTo === "order" && combines,
      applies_to: appliesTo,
      product_ids: appliesTo === "products" ? productIds : [],
      collection_ids: appliesTo === "collections" ? collectionIds : [],
    });
    if (!checked.success) {
      const next: Record<string, string> = {};
      for (const issue of checked.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    const result = await adminFetch<{ code?: string }>("/api/admin/discounts", "POST", checked.data, "The code could not be created.");
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    toast(`${checked.data.code} is ready to use.`);
    setOpen(false);
    reset();
    startTransition(() => router.refresh());
  };

  const chip = (active: boolean) =>
    cn(
      "rounded-lg border px-3 py-2 text-left text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50",
      active ? "border-neutral-900 bg-neutral-50 font-medium text-neutral-900" : "border-neutral-200 text-neutral-700 hover:border-neutral-300"
    );

  return (
    <>
      <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setOpen(true)}>
        New code
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        dismissable={!saving}
        wide
        title="New discount code"
        description="Customers type the code at checkout."
        footer={
          <>
            {formError ? (
              <p role="alert" className="mr-auto self-center text-[14px] font-medium text-red-700">
                {formError}
              </p>
            ) : null}
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} busy={saving}>
              Create code
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Code" required error={errors.code} hint="Letters and numbers, e.g. RAMADAN20.">
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={code}
                maxLength={40}
                autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            )}
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[14px] font-medium text-neutral-800">Applies to</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Applies to">
              {(Object.keys(APPLIES_TO_LABELS) as AppliesTo[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={appliesTo === key}
                  disabled={key !== "order" && !targetsReady}
                  onClick={() => setAppliesTo(key)}
                  className={chip(appliesTo === key)}
                >
                  {APPLIES_TO_LABELS[key]}
                </button>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-500">
              {targetsReady
                ? APPLIES_HINT[appliesTo]
                : "Codes for perfumes, collections or delivery need database migration 67 (supabase/migrations/67_discount_targets.sql)."}
            </p>
          </fieldset>

          {appliesTo === "products" ? (
            <div className="rounded-lg border border-neutral-200">
              <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                <input
                  type="search"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Find a perfume or brand"
                  aria-label="Find a perfume"
                  className="h-9 w-full bg-transparent text-[16px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none sm:text-[14px]"
                />
                <span className="shrink-0 text-[13px] text-neutral-500">{productIds.length} chosen</span>
              </div>
              <ul className="max-h-56 overflow-y-auto py-1">
                {shownProducts.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-[14px] hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-neutral-900"
                        checked={productIds.includes(p.id)}
                        onChange={() => setProductIds((list) => toggle(list, p.id))}
                      />
                      <span className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">{p.brand}</span>
                      <span className="truncate text-neutral-900">{p.name}</span>
                    </label>
                  </li>
                ))}
                {shownProducts.length === 0 ? <li className="px-3 py-2 text-[14px] text-neutral-500">No perfumes match.</li> : null}
              </ul>
              {errors.product_ids ? <p className="border-t border-neutral-100 px-3 py-2 text-[13px] font-medium text-red-700">{errors.product_ids}</p> : null}
            </div>
          ) : null}

          {appliesTo === "collections" ? (
            <div className="rounded-lg border border-neutral-200">
              <ul className="max-h-56 overflow-y-auto py-1">
                {collections.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-[14px] hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-neutral-900"
                        checked={collectionIds.includes(c.id)}
                        onChange={() => setCollectionIds((list) => toggle(list, c.id))}
                      />
                      <span className="text-neutral-900">{c.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {errors.collection_ids ? <p className="border-t border-neutral-100 px-3 py-2 text-[13px] font-medium text-red-700">{errors.collection_ids}</p> : null}
            </div>
          ) : null}

          {appliesTo === "delivery" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Delivery discount">
                {({ id }) => (
                  <Select id={id} value={deliveryKind} onChange={(e) => setDeliveryKind(e.target.value as DeliveryKind)}>
                    <option value="free">Free delivery</option>
                    <option value="amount">Amount off delivery (AED)</option>
                  </Select>
                )}
              </Field>
              {deliveryKind === "amount" ? (
                <Field label="Amount off (AED)" required error={errors.value}>
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} aria-describedby={describedBy} invalid={invalid} type="number" inputMode="decimal" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 10" />
                  )}
                </Field>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Type of discount">
                {({ id }) => (
                  <Select id={id} value={type} onChange={(e) => setType(e.target.value as "percentage" | "fixed_amount")}>
                    <option value="percentage">Percentage off</option>
                    <option value="fixed_amount">Amount off (AED)</option>
                  </Select>
                )}
              </Field>
              <Field label={type === "percentage" ? "Percentage" : "Amount (AED)"} required error={errors.value}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step={type === "percentage" ? "1" : "0.01"}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={type === "percentage" ? "e.g. 15" : "e.g. 50"}
                  />
                )}
              </Field>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Minimum order (AED)" hint="Optional. The whole bag's total." error={errors.min_requirement}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} type="number" inputMode="decimal" min="0" step="0.01" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
              )}
            </Field>
            <Field label="Last day" hint="Optional. Works until midnight, Dubai time." error={errors.ends_on}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              )}
            </Field>
            <Field label="Usage limit" hint="Optional. Total uses by everyone." error={errors.usage_limit}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} type="number" inputMode="numeric" min="1" step="1" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" />
              )}
            </Field>
          </div>
          <Switch
            checked={conciergeOnly}
            onChange={setConciergeOnly}
            label="Only the agent offers it"
            description="The shop's chat assistant may offer this code after a real conversation. Needs a usage limit."
          />
          {appliesTo === "order" ? (
            <Switch
              checked={combines}
              onChange={setCombines}
              label="Also on items already in an offer"
              description="Off: the code skips perfumes already discounted by a bundle or buy-more offer. On: it takes its saving off the whole bag after the offers."
            />
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
