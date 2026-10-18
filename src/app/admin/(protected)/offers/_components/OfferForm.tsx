"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { aed } from "../../../_lib/format";
import { OFFER_TEMPLATES, offerSchema, type OfferInput, type OfferKind } from "../../../_lib/offer-schema";
import { Button, ButtonLink } from "../../../_ui/Button";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { Field, Input, Select, Switch, Textarea } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import { cn } from "../../../_ui/cn";

export type FormProduct = { id: number; brand: string; name: string; price: number; sizes: string[]; published: boolean };
export type FormCollection = { id: string; title: string };

type Scope = OfferInput["scope"];
type TierDraft = { min_qty: string; percent: string; free_delivery: boolean };
type LineDraft = { product_id: number; size: string; qty: string };

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const SCOPE_LABELS: Record<Scope, string> = {
  all: "Any perfume",
  brands: "Brands",
  collections: "Collections",
  products: "Chosen perfumes",
};

export default function OfferForm({
  offerId,
  initial,
  products,
  brands,
  collections,
  ready,
}: {
  /** null for a new offer. */
  offerId: number | null;
  initial: OfferInput;
  products: FormProduct[];
  brands: string[];
  collections: FormCollection[];
  /** Migration 69 has run. */
  ready: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const template = OFFER_TEMPLATES[initial.template];
  const kind = template.kind as OfferKind;

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [isActive, setIsActive] = useState(initial.is_active);
  const [startsOn, setStartsOn] = useState(initial.starts_on);
  const [endsOn, setEndsOn] = useState(initial.ends_on);
  const [scope, setScope] = useState<Scope>(initial.scope);
  const [scopeBrands, setScopeBrands] = useState<string[]>(initial.scope_brands.map((b) => b.toUpperCase()));
  const [scopeCollections, setScopeCollections] = useState<string[]>(initial.scope_collection_ids);
  const [scopeProducts, setScopeProducts] = useState<number[]>(initial.scope_product_ids);
  const [tiers, setTiers] = useState<TierDraft[]>(
    initial.tiers.map((t) => ({ min_qty: String(t.min_qty), percent: String(t.percent), free_delivery: t.free_delivery }))
  );
  const [lines, setLines] = useState<LineDraft[]>(
    initial.bundle_lines.map((l) => ({ product_id: l.product_id, size: l.size, qty: String(l.qty) }))
  );
  const [priceMode, setPriceMode] = useState<"price" | "percent">(initial.price_mode);
  const [bundlePrice, setBundlePrice] = useState(initial.bundle_price != null ? String(initial.bundle_price) : "");
  const [bundlePercent, setBundlePercent] = useState(initial.bundle_percent != null ? String(initial.bundle_percent) : "");
  const [freeDelivery, setFreeDelivery] = useState(initial.free_delivery);
  const [giftWrap, setGiftWrap] = useState(initial.gift_wrap);
  const [productId, setProductId] = useState<number | null>(initial.product_id);
  const [productSize, setProductSize] = useState(initial.product_size);
  const [addonPrice, setAddonPrice] = useState(initial.addon_price != null ? String(initial.addon_price) : "");
  const [minSubtotal, setMinSubtotal] = useState(initial.min_subtotal ? String(initial.min_subtotal) : "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shopProducts = useMemo(() => products.filter((p) => p.published), [products]);

  // The set's value at shop prices, for the live "saves AED X" line.
  const setBase = lines.reduce((sum, l) => sum + (byId.get(l.product_id)?.price ?? 0) * (Number(l.qty) || 1), 0);
  const setPrice =
    priceMode === "price" ? num(bundlePrice) : Math.round(setBase * (100 - (num(bundlePercent) || 0))) / 100;

  const payload = (): Record<string, unknown> => ({
    template: initial.template,
    title,
    description,
    is_active: isActive,
    starts_on: startsOn,
    ends_on: endsOn,
    priority: initial.priority,
    scope: kind === "tiered" || kind === "addon" ? scope : "all",
    scope_brands: scopeBrands,
    scope_collection_ids: scopeCollections,
    scope_product_ids: scopeProducts,
    tiers: tiers.map((t) => ({ min_qty: num(t.min_qty), percent: num(t.percent) || 0, free_delivery: t.free_delivery })),
    bundle_lines: lines.map((l) => ({ product_id: l.product_id, size: l.size, qty: num(l.qty) })),
    price_mode: priceMode,
    bundle_price: priceMode === "price" ? num(bundlePrice) : null,
    bundle_percent: priceMode === "percent" ? num(bundlePercent) : null,
    free_delivery: freeDelivery,
    gift_wrap: giftWrap,
    product_id: productId,
    product_size: productSize,
    addon_price: kind === "addon" ? num(addonPrice) : null,
    min_subtotal: kind === "addon" || kind === "gift" ? (minSubtotal.trim() === "" ? 0 : num(minSubtotal)) : 0,
  });

  const save = async () => {
    setFormError(null);
    const checked = offerSchema.safeParse(payload());
    if (!checked.success) {
      const next: Record<string, string> = {};
      for (const issue of checked.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setFormError("Some details need another look.");
      return;
    }
    setErrors({});
    setSaving(true);
    const result = await adminFetch<{ id?: number; field?: string }>(
      offerId ? `/api/admin/offers/${offerId}` : "/api/admin/offers",
      offerId ? "PATCH" : "POST",
      checked.data,
      "The offer could not be saved."
    );
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    toast(offerId ? `“${checked.data.title}” saved.` : `“${checked.data.title}” is ${checked.data.is_active ? "live" : "saved, paused"}.`);
    startTransition(() => {
      router.push("/admin/offers");
      router.refresh();
    });
  };

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <div className="flex flex-col gap-6 pb-28">
      {!ready ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-900">
          <strong className="font-semibold">Offers need database migration 69.</strong> You can fill this in, but saving waits
          until <code className="rounded bg-amber-100 px-1">69_offers.sql</code> has run.
        </div>
      ) : null}

      <Card>
        <CardHeader title={template.label} description={template.blurb} />
        <CardBody className="flex flex-col gap-5">
          <Field label="Name shoppers see" required error={errors.title} hint={`For example: ${template.example}`}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
            )}
          </Field>
          <Field label="A line of detail" hint="Optional. Shown under the name on the product page and the offers page." error={errors.description}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                maxLength={300}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Starts" hint="Leave empty to start now." error={errors.starts_on}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="date" aria-describedby={describedBy} invalid={invalid} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              )}
            </Field>
            <Field
              label="Ends"
              required={initial.template === "occasion"}
              hint={initial.template === "occasion" ? "The countdown runs to the end of this day (Dubai time)." : "Optional. Ends at midnight, Dubai time."}
              error={errors.ends_on}
            >
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="date" aria-describedby={describedBy} invalid={invalid} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              )}
            </Field>
          </div>
          <Switch
            checked={isActive}
            onChange={setIsActive}
            label="Running"
            description="Off keeps the offer saved without the shop applying it."
          />
        </CardBody>
      </Card>

      {kind === "tiered" ? (
        <>
          <ScopeCard
            title="Which perfumes count"
            description={
              initial.template === "backup"
                ? "Two bottles of the same perfume from these get the saving."
                : "Every perfume from these counts towards the steps below."
            }
            scope={scope}
            setScope={setScope}
            brands={brands}
            scopeBrands={scopeBrands}
            onBrand={(b) => setScopeBrands(toggle(scopeBrands, b))}
            collections={collections}
            scopeCollections={scopeCollections}
            onCollection={(c) => setScopeCollections(toggle(scopeCollections, c))}
            products={shopProducts}
            scopeProducts={scopeProducts}
            onProduct={(p) => setScopeProducts(toggle(scopeProducts, p))}
            errors={errors}
          />
          <Card>
            <CardHeader
              title="The saving"
              description={
                initial.template === "backup"
                  ? "Each step applies to every bottle of that perfume in the bag."
                  : "The highest step reached applies to every qualifying perfume in the bag."
              }
            />
            <CardBody className="flex flex-col gap-3">
              {tiers.map((tier, index) => (
                <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-3">
                  <Field label={initial.template === "backup" ? "Bottles of the same" : "Perfumes in the bag"} className="w-36">
                    {({ id }) => (
                      <Input
                        id={id}
                        type="number"
                        inputMode="numeric"
                        min={2}
                        max={20}
                        value={tier.min_qty}
                        onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, min_qty: e.target.value } : t)))}
                      />
                    )}
                  </Field>
                  <Field label="% off" className="w-28">
                    {({ id }) => (
                      <Input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={90}
                        value={tier.percent}
                        onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, percent: e.target.value } : t)))}
                      />
                    )}
                  </Field>
                  <label className="flex h-10 items-center gap-2 text-[14px] text-neutral-800">
                    <input
                      type="checkbox"
                      checked={tier.free_delivery}
                      onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, free_delivery: e.target.checked } : t)))}
                      className="h-4 w-4 accent-neutral-900"
                    />
                    Plus free delivery
                  </label>
                  {tiers.length > 1 ? (
                    <Button
                      size="sm"
                      variant="plain"
                      className="ml-auto"
                      icon={<X className="h-3.5 w-3.5" aria-hidden />}
                      onClick={() => setTiers(tiers.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              {errors.tiers ? <p className="text-[13px] font-medium text-red-700">{errors.tiers}</p> : null}
              {tiers.length < 5 ? (
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
                    onClick={() => {
                      const last = tiers[tiers.length - 1];
                      setTiers([
                        ...tiers,
                        { min_qty: String((Number(last?.min_qty) || 1) + 1), percent: String((Number(last?.percent) || 5) + 5), free_delivery: false },
                      ]);
                    }}
                  >
                    Add a step
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </>
      ) : null}

      {kind === "bundle" ? (
        <Card>
          <CardHeader
            title="The set"
            description="The perfumes, the set's price and its extras. A shopper gets the set price once their bag holds the whole set."
          />
          <CardBody className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              {lines.map((line, index) => {
                const product = byId.get(line.product_id);
                return (
                  <div key={`${line.product_id}-${index}`} className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-neutral-900">
                        {product ? `${titleCase(product.brand)} · ${product.name}` : `Perfume #${line.product_id}`}
                      </p>
                      <p className="text-[13px] text-neutral-500">{product ? aed(product.price) : "No longer in the catalogue"}</p>
                    </div>
                    <Field label="Size" className="w-36">
                      {({ id }) => (
                        <Select
                          id={id}
                          value={line.size}
                          onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, size: e.target.value } : l)))}
                        >
                          <option value="">Any size</option>
                          {(product?.sizes ?? []).map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label="Bottles" className="w-24">
                      {({ id }) => (
                        <Input
                          id={id}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={5}
                          value={line.qty}
                          onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, qty: e.target.value } : l)))}
                        />
                      )}
                    </Field>
                    <Button
                      size="sm"
                      variant="plain"
                      icon={<X className="h-3.5 w-3.5" aria-hidden />}
                      onClick={() => setLines(lines.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
              {lines.length < 6 ? (
                <ProductPicker
                  label={lines.length === 0 ? "Add the first perfume" : "Add another perfume"}
                  products={shopProducts.filter((p) => !lines.some((l) => l.product_id === p.id))}
                  onPick={(p) => setLines([...lines, { product_id: p.id, size: p.sizes[0] ?? "", qty: "1" }])}
                />
              ) : null}
              {errors.bundle_lines ? <p className="text-[13px] font-medium text-red-700">{errors.bundle_lines}</p> : null}
            </div>

            <div className="flex flex-col gap-3">
              <div role="radiogroup" aria-label="How the set is priced" className="grid grid-cols-2 gap-2 sm:max-w-md">
                {(["percent", "price"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={priceMode === mode}
                    onClick={() => setPriceMode(mode)}
                    className={chip(priceMode === mode)}
                  >
                    {mode === "percent" ? "Percentage off" : "A set price (AED)"}
                  </button>
                ))}
              </div>
              {priceMode === "percent" ? (
                <Field label="% off the set" required error={errors.bundle_percent} className="sm:max-w-[12rem]">
                  {({ id, invalid }) => (
                    <Input id={id} type="number" inputMode="decimal" min={1} max={90} invalid={invalid} value={bundlePercent} onChange={(e) => setBundlePercent(e.target.value)} />
                  )}
                </Field>
              ) : (
                <Field label="Set price (AED)" required error={errors.bundle_price} className="sm:max-w-[12rem]">
                  {({ id, invalid }) => (
                    <Input id={id} type="number" inputMode="decimal" min={1} step="0.01" invalid={invalid} value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} />
                  )}
                </Field>
              )}
              {lines.length > 0 && Number.isFinite(setPrice) && setPrice > 0 ? (
                <p className={cn("text-[14px]", setPrice < setBase ? "text-neutral-700" : "font-medium text-red-700")}>
                  At shop prices {aed(setBase)}. As a set {aed(setPrice)}
                  {setPrice < setBase ? `: saves ${aed(setBase - setPrice)}.` : ". That's no saving: lower the set price."}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col divide-y divide-neutral-100">
              <Switch checked={freeDelivery} onChange={setFreeDelivery} label="Free delivery with the set" description="Delivery is free on the whole order when the bag holds this set." />
              <Switch
                checked={giftWrap}
                onChange={setGiftWrap}
                label="Arrives gift-wrapped"
                description="Shown to shoppers, and on the order and packing slip so it's wrapped before it leaves."
              />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {kind === "addon" || kind === "gift" ? (
        <Card>
          <CardHeader
            title={kind === "addon" ? "The add-on" : "The gift"}
            description={
              kind === "addon"
                ? "Offered as one tick box at checkout. One bottle per order at this price."
                : "Added free to any order that reaches the amount (after offer savings), while it's in stock."
            }
          />
          <CardBody className="flex flex-col gap-5">
            {productId ? (
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-neutral-900">
                    {byId.get(productId) ? `${titleCase(byId.get(productId)!.brand)} · ${byId.get(productId)!.name}` : `Perfume #${productId}`}
                  </p>
                  <p className="text-[13px] text-neutral-500">Shop price {aed(byId.get(productId)?.price ?? 0)}</p>
                </div>
                <Field label="Size" className="w-36" error={errors.product_size}>
                  {({ id }) => (
                    <Select id={id} value={productSize} onChange={(e) => setProductSize(e.target.value)}>
                      {(byId.get(productId)?.sizes ?? []).length === 0 ? <option value="">One size</option> : null}
                      {(byId.get(productId)?.sizes ?? []).map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Button size="sm" variant="plain" onClick={() => setProductId(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <ProductPicker
                label={kind === "addon" ? "Choose the perfume to offer" : "Choose the gift"}
                products={shopProducts}
                onPick={(p) => {
                  setProductId(p.id);
                  setProductSize(p.sizes[0] ?? "");
                }}
              />
            )}
            {errors.product_id ? <p className="text-[13px] font-medium text-red-700">{errors.product_id}</p> : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {kind === "addon" ? (
                <Field label="Add-on price (AED)" required error={errors.addon_price} hint="Below its shop price.">
                  {({ id, describedBy, invalid }) => (
                    <Input id={id} type="number" inputMode="decimal" min={0} step="0.01" aria-describedby={describedBy} invalid={invalid} value={addonPrice} onChange={(e) => setAddonPrice(e.target.value)} />
                  )}
                </Field>
              ) : null}
              <Field
                label={kind === "addon" ? "Rest of the bag at least (AED)" : "Spend that earns it (AED)"}
                required={kind === "gift"}
                error={errors.min_subtotal}
                hint={kind === "addon" ? "Offered once the other perfumes come to this. 0 for any order." : "Measured on the perfumes after offer savings, before a code."}
              >
                {({ id, describedBy, invalid }) => (
                  <Input id={id} type="number" inputMode="decimal" min={0} step="0.01" aria-describedby={describedBy} invalid={invalid} value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} />
                )}
              </Field>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {kind === "addon" ? (
        <ScopeCard
          title="Only when the bag holds"
          description="Optional: offer it only alongside these, e.g. a Lattafa add-on for Lattafa bags."
          scope={scope}
          setScope={setScope}
          brands={brands}
          scopeBrands={scopeBrands}
          onBrand={(b) => setScopeBrands(toggle(scopeBrands, b))}
          collections={collections}
          scopeCollections={scopeCollections}
          onCollection={(c) => setScopeCollections(toggle(scopeCollections, c))}
          products={shopProducts}
          scopeProducts={scopeProducts}
          onProduct={(p) => setScopeProducts(toggle(scopeProducts, p))}
          errors={errors}
        />
      ) : null}

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60 print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          {formError ? (
            <p role="alert" className="text-[14px] font-medium text-red-700">
              {formError}
            </p>
          ) : (
            <span className="text-[13px] text-neutral-500">The shop applies it as soon as it&rsquo;s saved and running.</span>
          )}
          <div className="flex gap-2">
            <ButtonLink href="/admin/offers" variant="secondary">
              Cancel
            </ButtonLink>
            <Button onClick={save} busy={saving} disabled={!ready}>
              {offerId ? "Save offer" : "Create offer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return cn(
    "rounded-lg border px-3 py-2 text-left text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
    active ? "border-neutral-900 bg-neutral-50 font-medium text-neutral-900" : "border-neutral-200 text-neutral-700 hover:border-neutral-300"
  );
}

/** Search the catalogue and pick one perfume. */
function ProductPicker({ label, products, onPick }: { label: string; products: FormProduct[]; onPick: (p: FormProduct) => void }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? products.filter((p) => `${p.brand} ${p.name}`.toLowerCase().includes(needle)).slice(0, 8)
    : [];
  return (
    <Field label={label} hint="Type a few letters of the name or the brand.">
      {({ id, describedBy }) => (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input id={id} aria-describedby={describedBy} className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search perfumes" />
          </div>
          {shown.length > 0 ? (
            <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {shown.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(p);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[14px] hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
                  >
                    <span>
                      <span className="text-neutral-500">{titleCase(p.brand)}</span> · <span className="font-medium text-neutral-900">{p.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-neutral-600">{aed(p.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : needle ? (
            <p className="text-[13px] text-neutral-500">No perfume matches &ldquo;{query}&rdquo;.</p>
          ) : null}
        </div>
      )}
    </Field>
  );
}

function ScopeCard({
  title,
  description,
  scope,
  setScope,
  brands,
  scopeBrands,
  onBrand,
  collections,
  scopeCollections,
  onCollection,
  products,
  scopeProducts,
  onProduct,
  errors,
}: {
  title: string;
  description: string;
  scope: Scope;
  setScope: (s: Scope) => void;
  brands: string[];
  scopeBrands: string[];
  onBrand: (b: string) => void;
  collections: FormCollection[];
  scopeCollections: string[];
  onCollection: (c: string) => void;
  products: FormProduct[];
  scopeProducts: number[];
  onProduct: (p: number) => void;
  errors: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = products.filter((p) => !needle || `${p.brand} ${p.name}`.toLowerCase().includes(needle)).slice(0, 150);
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="flex flex-col gap-4">
        <div role="radiogroup" aria-label={title} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(SCOPE_LABELS) as Scope[]).map((key) => (
            <button key={key} type="button" role="radio" aria-checked={scope === key} onClick={() => setScope(key)} className={chip(scope === key)}>
              {SCOPE_LABELS[key]}
            </button>
          ))}
        </div>

        {scope === "brands" ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {brands.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  aria-pressed={scopeBrands.includes(brand)}
                  onClick={() => onBrand(brand)}
                  className={chip(scopeBrands.includes(brand))}
                >
                  {titleCase(brand)}
                </button>
              ))}
            </div>
            {errors.scope_brands ? <p className="text-[13px] font-medium text-red-700">{errors.scope_brands}</p> : null}
          </div>
        ) : null}

        {scope === "collections" ? (
          <div className="flex flex-col gap-2">
            <ul className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200">
              {collections.map((c) => (
                <li key={c.id} className="border-b border-neutral-100 last:border-0">
                  <label className="flex items-center gap-3 px-3 py-2.5 text-[14px] text-neutral-800">
                    <input type="checkbox" checked={scopeCollections.includes(c.id)} onChange={() => onCollection(c.id)} className="h-4 w-4 accent-neutral-900" />
                    {c.title}
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-neutral-500">A brand page counts every perfume of that brand.</p>
            {errors.scope_collection_ids ? <p className="text-[13px] font-medium text-red-700">{errors.scope_collection_ids}</p> : null}
          </div>
        ) : null}

        {scope === "products" ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
              <Input aria-label="Search perfumes" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search perfumes" />
            </div>
            <ul className="max-h-72 overflow-y-auto rounded-lg border border-neutral-200">
              {shown.map((p) => (
                <li key={p.id} className="border-b border-neutral-100 last:border-0">
                  <label className="flex items-center gap-3 px-3 py-2.5 text-[14px] text-neutral-800">
                    <input type="checkbox" checked={scopeProducts.includes(p.id)} onChange={() => onProduct(p.id)} className="h-4 w-4 accent-neutral-900" />
                    <span className="text-neutral-500">{titleCase(p.brand)}</span> · {p.name}
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-neutral-500">{scopeProducts.length} chosen.</p>
            {errors.scope_product_ids ? <p className="text-[13px] font-medium text-red-700">{errors.scope_product_ids}</p> : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
