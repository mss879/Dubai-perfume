"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { aed } from "../../../_lib/format";
import { MAX_IMAGES, SIZE_PRESETS, productSchema, type ProductInput } from "../../../_lib/product-schema";
import { Badge } from "../../../_ui/Badge";
import { Button } from "../../../_ui/Button";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { ConfirmDialog } from "../../../_ui/Dialog";
import { Field, Input, Select, Switch, Textarea } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import { cn } from "../../../_ui/cn";
import StockDialog, { type StockTarget } from "./StockDialog";
import { uploadProductImage } from "../../../_lib/image-upload";

export type ProductFormInitial = {
  id: number;
  brand: string;
  name: string;
  olfactory_group: string;
  price: number;
  compare_at_price: number | null;
  cost_price: number;
  tagline: string;
  description: string;
  sizes: string[];
  images: string[];
  tags: string[];
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  is_new: boolean;
  is_bestseller: boolean;
  is_featured_large: boolean;
  is_published: boolean;
  collections: string[];
};

export type StockRow = { size: string; stock_level: number; low_stock_threshold: number };
export type CollectionOption = { id: string; title: string; automated: boolean };

const split = (value: string) =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const toMoney = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

export default function ProductForm({
  initial,
  stock,
  collections,
  brands,
  families,
  migrationReady,
}: {
  initial: ProductFormInitial | null;
  stock: StockRow[];
  collections: CollectionOption[];
  brands: string[];
  families: string[];
  migrationReady: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = initial !== null;

  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [family, setFamily] = useState(initial?.olfactory_group ?? families[0] ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [topNotes, setTopNotes] = useState((initial?.top_notes ?? []).join(", "));
  const [heartNotes, setHeartNotes] = useState((initial?.heart_notes ?? []).join(", "));
  const [baseNotes, setBaseNotes] = useState((initial?.base_notes ?? []).join(", "));
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [wasPrice, setWasPrice] = useState(initial?.compare_at_price != null ? String(initial.compare_at_price) : "");
  const [cost, setCost] = useState(initial ? String(initial.cost_price || "") : "");
  const [sizes, setSizes] = useState<string[]>(initial?.sizes ?? ["50ml", "100ml"]);
  const [startCounts, setStartCounts] = useState<Record<string, string>>({});
  const [customSize, setCustomSize] = useState("");
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [uploading, setUploading] = useState(0);
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? true);
  const [isNew, setIsNew] = useState(initial?.is_new ?? true);
  const [isBestseller, setIsBestseller] = useState(initial?.is_bestseller ?? false);
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured_large ?? false);
  const [picked, setPicked] = useState<string[]>(
    (initial?.collections ?? []).filter((id) => collections.some((c) => c.id === id && !c.automated))
  );

  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null);
  const [removeSize, setRemoveSize] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const stockBySize = useMemo(() => new Map(stock.map((row) => [row.size, row])), [stock]);
  const savedSizes = useMemo(() => new Set(initial?.sizes ?? []), [initial]);
  const touch = () => setDirty(true);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const priceValue = toMoney(price);
  const costValue = toMoney(cost);
  const wasValue = toMoney(wasPrice);
  const margin =
    priceValue && priceValue > 0 && costValue !== null && Number.isFinite(costValue)
      ? Math.round(((priceValue - costValue) / priceValue) * 100)
      : null;

  const addSize = (size: string) => {
    const clean = size.trim();
    if (!clean || sizes.includes(clean) || sizes.length >= 12) return;
    setSizes((current) => [...current, clean]);
    setStartCounts((current) => ({ ...current, [clean]: "0" }));
    touch();
  };

  const dropSize = (size: string) => {
    setSizes((current) => current.filter((s) => s !== size));
    setStartCounts((current) => {
      const next = { ...current };
      delete next[size];
      return next;
    });
    touch();
  };

  const onFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (fileInput.current) fileInput.current.value = "";
    if (list.length === 0) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast(`Up to ${MAX_IMAGES} photos. Remove one first.`, "error");
      return;
    }
    const batch = list.slice(0, room);
    if (list.length > room) toast(`Only ${room} more photo${room === 1 ? "" : "s"} fit; the rest were skipped.`, "info");
    setUploading((n) => n + batch.length);
    for (const file of batch) {
      const result = await uploadProductImage(file);
      setUploading((n) => n - 1);
      if (result.ok) {
        setImages((current) => (current.length < MAX_IMAGES ? [...current, result.url] : current));
        touch();
      } else {
        toast(result.error, "error");
      }
    }
  };

  const move = (index: number, by: -1 | 1) => {
    setImages((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    touch();
  };

  const save = async () => {
    setFormError(null);
    const newSizes = sizes.filter((size) => !savedSizes.has(size));
    const stockPayload: ProductInput["stock"] = {};
    for (const size of newSizes) {
      const raw = (startCounts[size] ?? "0").trim();
      const count = raw === "" ? 0 : Number(raw);
      stockPayload[size] = { initial: Number.isInteger(count) ? count : -1 };
    }
    const payload = {
      ...(initial ? { id: initial.id } : {}),
      brand: brand.trim(),
      name: name.trim(),
      olfactory_group: family,
      price: priceValue ?? NaN,
      compare_at_price: wasValue,
      cost_price: costValue ?? 0,
      tagline: tagline.trim(),
      description: description.trim(),
      sizes,
      images,
      tags: split(tags).map((t) => t.toLowerCase()),
      top_notes: split(topNotes),
      heart_notes: split(heartNotes),
      base_notes: split(baseNotes),
      is_new: isNew,
      is_bestseller: isBestseller,
      is_featured_large: isFeatured,
      is_published: isPublished,
      stock: stockPayload,
      collections: picked,
    };

    const checked = productSchema.safeParse(payload);
    if (!checked.success) {
      const next: Record<string, string> = {};
      for (const issue of checked.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setFormError("Some details need a look. They're marked below.");
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.data),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; id?: number; created?: boolean; error?: string } | null;
      if (!response.ok || !json?.ok || typeof json.id !== "number") {
        setFormError(json?.error || "The product could not be saved. Try again.");
        return;
      }
      setDirty(false);
      setStartCounts({});
      toast(json.created ? `${checked.data.name} added.` : `${checked.data.name} saved.`);
      if (json.created) {
        router.replace(`/admin/products/${json.id}`);
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!initial) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/products/${initial.id}`, { method: "DELETE" });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !json?.ok) {
        setConfirmDelete(false);
        toast(json?.error || "The product could not be deleted.", "error");
        return;
      }
      setDirty(false);
      toast(`${initial.name} deleted.`);
      router.replace("/admin/products");
    } catch {
      toast("Couldn't reach the server. Try again.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const familyOptions = family && !families.includes(family) ? [family, ...families] : families;
  const busy = saving || refreshing;

  return (
    <div className="pb-28">
      {!migrationReady ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          <strong className="font-semibold">Saving is switched off until database migration 64 is run.</strong> Run{" "}
          <code className="rounded bg-amber-100 px-1">supabase/migrations/64_admin_products_and_stock.sql</code> in the
          Supabase SQL editor, then reload this page.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Basics" />
            <CardBody className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Brand" required error={errors.brand}>
                  {({ id, describedBy, invalid }) => (
                    <>
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        list="product-brands"
                        value={brand}
                        maxLength={255}
                        onChange={(e) => {
                          setBrand(e.target.value);
                          touch();
                        }}
                        placeholder="e.g. Lattafa"
                      />
                      <datalist id="product-brands">
                        {brands.map((b) => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="Perfume name" required error={errors.name}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      value={name}
                      maxLength={255}
                      onChange={(e) => {
                        setName(e.target.value);
                        touch();
                      }}
                    />
                  )}
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Scent family" required error={errors.olfactory_group}>
                  {({ id, invalid }) => (
                    <Select
                      id={id}
                      invalid={invalid}
                      value={family}
                      onChange={(e) => {
                        setFamily(e.target.value);
                        touch();
                      }}
                    >
                      {familyOptions.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Tagline" hint="One line under the name, e.g. “Eau de Parfum”.">
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      value={tagline}
                      maxLength={255}
                      onChange={(e) => {
                        setTagline(e.target.value);
                        touch();
                      }}
                    />
                  )}
                </Field>
              </div>
              <Field label="Description" hint="Plain text. Shown on the perfume's page.">
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    rows={5}
                    value={description}
                    maxLength={5000}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      touch();
                    }}
                  />
                )}
              </Field>
              <Field label="Tags" hint="Separated by commas, e.g. oud, amber, evening. Tags also place it in automatic collections.">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    value={tags}
                    onChange={(e) => {
                      setTags(e.target.value);
                      touch();
                    }}
                  />
                )}
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(
                  [
                    ["Top notes", topNotes, setTopNotes],
                    ["Heart notes", heartNotes, setHeartNotes],
                    ["Base notes", baseNotes, setBaseNotes],
                  ] as const
                ).map(([label, value, setter]) => (
                  <Field key={label} label={label} hint="Separated by commas.">
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        value={value}
                        onChange={(e) => {
                          setter(e.target.value);
                          touch();
                        }}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Price" />
            <CardBody className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Price (AED)" required error={errors.price}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value);
                        touch();
                      }}
                    />
                  )}
                </Field>
                <Field label="“Was” price (AED)" hint="Optional. Shown struck through." error={errors.compare_at_price}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={wasPrice}
                      onChange={(e) => {
                        setWasPrice(e.target.value);
                        touch();
                      }}
                    />
                  )}
                </Field>
                <Field label="Your cost (AED)" hint="For your margin. Never displayed in the shop." error={errors.cost_price}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={cost}
                      onChange={(e) => {
                        setCost(e.target.value);
                        touch();
                      }}
                    />
                  )}
                </Field>
              </div>
              {priceValue && priceValue > 0 ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-neutral-50 px-4 py-3 text-[14px]">
                  <span className="text-neutral-600">
                    Customers see:{" "}
                    <strong className="font-semibold text-neutral-900">{aed(priceValue)}</strong>
                    {wasValue && wasValue > priceValue ? (
                      <span className="ml-2 text-neutral-400 line-through">{aed(wasValue)}</span>
                    ) : null}
                  </span>
                  {margin !== null ? (
                    <span className={cn("text-neutral-600", margin < 0 && "font-medium text-red-700")}>
                      Margin: {margin}%{margin < 0 ? " (below cost)" : ""}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Sizes and stock"
              description={
                editing
                  ? "Counts change from orders and from the Adjust button, never from saving this form."
                  : "Enter how many bottles of each size you have."
              }
            />
            <ul className="divide-y divide-neutral-100">
              {sizes.map((size) => {
                const row = stockBySize.get(size);
                const unsaved = !savedSizes.has(size);
                const low = row && row.stock_level > 0 && row.stock_level <= row.low_stock_threshold;
                const out = row && row.stock_level <= 0;
                return (
                  <li key={size} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="w-20 shrink-0 text-[15px] font-semibold text-neutral-900">{size}</span>
                    <div className="min-w-0 flex-1">
                      {unsaved ? (
                        <label className="flex items-center gap-2 text-[14px] text-neutral-600">
                          Starting stock
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            className="w-24"
                            aria-label={`Starting stock for ${size}`}
                            value={startCounts[size] ?? "0"}
                            onChange={(e) => {
                              setStartCounts((current) => ({ ...current, [size]: e.target.value }));
                              touch();
                            }}
                          />
                        </label>
                      ) : row ? (
                        <span className="flex flex-wrap items-center gap-2 text-[14px] text-neutral-700">
                          <strong className="tabular-nums">{row.stock_level}</strong> in stock
                          {out ? <Badge tone="red">Sold out</Badge> : low ? <Badge tone="amber">Low</Badge> : null}
                        </span>
                      ) : (
                        <span className="text-[14px] text-neutral-500">Always available (not tracked)</span>
                      )}
                    </div>
                    {!unsaved && initial ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!migrationReady}
                        onClick={() =>
                          setStockTarget({
                            productId: initial.id,
                            productName: initial.name,
                            size,
                            level: row ? row.stock_level : null,
                            threshold: row ? row.low_stock_threshold : null,
                          })
                        }
                      >
                        {row ? "Adjust" : "Set count"}
                      </Button>
                    ) : null}
                    <Button
                      variant="plain"
                      size="sm"
                      aria-label={`Remove ${size}`}
                      onClick={() => (row && row.stock_level > 0 ? setRemoveSize(size) : dropSize(size))}
                      icon={<X className="h-4 w-4" aria-hidden />}
                    />
                  </li>
                );
              })}
            </ul>
            <CardBody className="flex flex-col gap-3 border-t border-neutral-100">
              {errors.sizes ? <p className="text-[13px] font-medium text-red-700">{errors.sizes}</p> : null}
              {errors.stock ? <p className="text-[13px] font-medium text-red-700">{errors.stock}</p> : null}
              <div className="flex flex-wrap gap-2">
                {SIZE_PRESETS.filter((preset) => !sizes.includes(preset)).map((preset) => (
                  <Button key={preset} variant="secondary" size="sm" onClick={() => addSize(preset)} icon={<Plus className="h-3.5 w-3.5" aria-hidden />}>
                    {preset}
                  </Button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addSize(customSize);
                  setCustomSize("");
                }}
              >
                <Input
                  value={customSize}
                  maxLength={50}
                  onChange={(e) => setCustomSize(e.target.value)}
                  placeholder="Another size, e.g. 3ml sample"
                  aria-label="Another size"
                  className="max-w-xs"
                />
                <Button type="submit" variant="secondary" disabled={!customSize.trim()}>
                  Add size
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Photos" description={`Up to ${MAX_IMAGES}. The first one is the main photo.`} />
            <CardBody className="flex flex-col gap-4">
              {errors.images ? <p className="text-[13px] font-medium text-red-700">{errors.images}</p> : null}
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {images.map((url, index) => (
                  <li key={url} className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded file */}
                    <img src={url} alt={`Photo ${index + 1}`} className="aspect-square w-full object-contain" />
                    {index === 0 ? (
                      <span className="absolute left-2 top-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[12px] font-medium text-white">Main</span>
                    ) : null}
                    <div className="flex items-center justify-between border-t border-neutral-200 bg-white px-1 py-1">
                      <button
                        type="button"
                        aria-label="Move left"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => {
                          setImages((current) => current.filter((u) => u !== url));
                          touch();
                        }}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Move right"
                        disabled={index === images.length - 1}
                        onClick={() => move(index, 1)}
                        className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
                      >
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
                {Array.from({ length: uploading }, (_, i) => (
                  <li key={`up-${i}`} className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-neutral-300 text-neutral-400">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    <span className="sr-only">Uploading</span>
                  </li>
                ))}
              </ul>
              {images.length + uploading < MAX_IMAGES ? (
                <div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    id="product-photos"
                    onChange={(e) => void onFiles(e.target.files)}
                  />
                  <label
                    htmlFor="product-photos"
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-white px-4 text-[15px] font-medium text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 sm:h-10 sm:text-[14px]"
                  >
                    <ImagePlus className="h-4 w-4" aria-hidden />
                    Add photos
                  </label>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Visibility" />
            <CardBody className="flex flex-col gap-3">
              <Switch
                checked={isPublished}
                onChange={(v) => {
                  setIsPublished(v);
                  touch();
                }}
                disabled={!migrationReady}
                label="Show in shop"
                description={isPublished ? "Customers can find and buy it." : "Hidden: only you can see it. Past orders keep it."}
              />
              <Switch
                checked={isNew}
                onChange={(v) => {
                  setIsNew(v);
                  touch();
                }}
                label="New arrival"
                description="Shows the “New” mark."
              />
              <Switch
                checked={isBestseller}
                onChange={(v) => {
                  setIsBestseller(v);
                  touch();
                }}
                label="Bestseller"
                description="Shows the “Bestseller” mark."
              />
              <Switch
                checked={isFeatured}
                onChange={(v) => {
                  setIsFeatured(v);
                  touch();
                }}
                label="Feature on the homepage"
                description="Shown large in the homepage selection."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Collections" description="Pages this perfume appears on." />
            <CardBody className="flex flex-col gap-2">
              {collections.length === 0 ? <p className="text-[14px] text-neutral-500">No collections yet.</p> : null}
              {collections
                .filter((c) => !c.automated)
                .map((collection) => (
                  <label key={collection.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5 text-[14px] text-neutral-800 hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-neutral-900"
                      checked={picked.includes(collection.id)}
                      onChange={(e) => {
                        setPicked((current) =>
                          e.target.checked ? [...current, collection.id] : current.filter((id) => id !== collection.id)
                        );
                        touch();
                      }}
                    />
                    {collection.title}
                  </label>
                ))}
              {collections.some((c) => c.automated) ? (
                <div className="mt-2 border-t border-neutral-100 pt-3">
                  <p className="text-[13px] text-neutral-500">Added automatically from tags:</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {collections
                      .filter((c) => c.automated && (initial?.collections ?? []).includes(c.id))
                      .map((c) => (
                        <li key={c.id}>
                          <Badge>{c.title}</Badge>
                        </li>
                      ))}
                    {collections.filter((c) => c.automated && (initial?.collections ?? []).includes(c.id)).length === 0 ? (
                      <li className="text-[13px] text-neutral-400">None</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {editing ? (
            <Card>
              <CardBody>
                <Button
                  variant="plain"
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => setConfirmDelete(true)}
                  disabled={!migrationReady}
                  icon={<Trash2 className="h-4 w-4" aria-hidden />}
                >
                  Delete product
                </Button>
                <p className="mt-1 text-[13px] text-neutral-500">
                  Only possible if it was never ordered. Otherwise turn off &ldquo;Show in shop&rdquo;.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Save bar: always in reach, above the phone's bottom navigation. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
          {formError ? (
            <p role="alert" className="mr-auto text-[14px] font-medium text-red-700">
              {formError}
            </p>
          ) : dirty ? (
            <p className="mr-auto text-[14px] text-neutral-500">Unsaved changes</p>
          ) : null}
          <Button variant="secondary" onClick={() => router.push("/admin/products")} disabled={busy}>
            {dirty ? "Cancel" : "Back"}
          </Button>
          <Button onClick={save} busy={busy} disabled={!migrationReady || uploading > 0}>
            {editing ? "Save product" : "Add product"}
          </Button>
        </div>
      </div>

      {stockTarget ? <StockDialog key={`${stockTarget.size}-${stockTarget.level}`} target={stockTarget} onClose={() => setStockTarget(null)} /> : null}

      <ConfirmDialog
        open={removeSize !== null}
        title={`Remove ${removeSize}?`}
        description={`It has ${removeSize ? stockBySize.get(removeSize)?.stock_level ?? 0 : 0} bottles in stock. Removing the size deletes its stock count when you save.`}
        confirmLabel="Remove size"
        confirmVariant="critical"
        onConfirm={() => {
          if (removeSize) dropSize(removeSize);
          setRemoveSize(null);
        }}
        onCancel={() => setRemoveSize(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${initial?.name ?? "this product"}?`}
        description="It disappears from the shop and from this admin. This can't be undone."
        confirmLabel="Delete product"
        confirmVariant="critical"
        busy={deleting}
        onConfirm={destroy}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
