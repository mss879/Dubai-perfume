"use client";

import { useMemo, useState } from "react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Badge } from "../../../_ui/Badge";
import { Button } from "../../../_ui/Button";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { Input, Select } from "../../../_ui/Field";
import { useToast } from "../../../_ui/Toast";
import type { AttributeProduct } from "../../../_lib/feature-data";
import { LONGEVITY, OCCASIONS, SEASONS, STRENGTHS } from "../../../../lib/scent-attributes";

type Row = Pick<AttributeProduct, "strength" | "longevity" | "seasons" | "occasions" | "inspiredBy">;
const pick = (p: AttributeProduct): Row => ({
  strength: p.strength,
  longevity: p.longevity,
  seasons: [...p.seasons],
  occasions: [...p.occasions],
  inspiredBy: p.inspiredBy,
});

/**
 * Fill in each perfume's filters (strength, how long it lasts, seasons,
 * occasions) or its "inspired by" line, row by row. Each row saves on its own.
 */
export default function AttributesEditor({
  products,
  ready,
  mode,
}: {
  products: AttributeProduct[];
  ready: boolean;
  mode: "filters" | "inspired";
}) {
  const [query, setQuery] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !`${p.brand} ${p.name} ${p.inspiredBy ?? ""}`.toLowerCase().includes(q)) return false;
      if (onlyEmpty) {
        if (mode === "inspired" ? Boolean(p.inspiredBy) : Boolean(p.strength && p.longevity && p.seasons.length && p.occasions.length)) return false;
      }
      return true;
    });
  }, [products, query, onlyEmpty, mode]);
  const filled = products.filter((p) => (mode === "inspired" ? p.inspiredBy : p.strength || p.longevity || p.seasons.length || p.occasions.length)).length;

  return (
    <Card>
      <CardHeader
        title={mode === "inspired" ? "Matches, perfume by perfume" : "Each perfume's filters"}
        description={
          mode === "inspired"
            ? `${filled} of ${products.length} perfumes have a match. Write the famous scent's house and name, e.g. "Creed Aventus".`
            : `${filled} of ${products.length} perfumes have filters filled in. Notes come from each perfume's pyramid (Products → edit).`
        }
      />
      <CardBody className="flex flex-col gap-3 border-b border-neutral-100">
        {!ready ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900">These fields need database migration 70.</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search perfumes" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" aria-label="Search perfumes" />
          <label className="flex items-center gap-2 text-[14px] text-neutral-700">
            <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} className="h-4 w-4 accent-neutral-900" />
            Only ones still to fill in
          </label>
        </div>
      </CardBody>
      <ul className="divide-y divide-neutral-100">
        {shown.map((p) => (
          <ProductRow key={p.id} product={p} mode={mode} disabled={!ready} />
        ))}
        {shown.length === 0 ? <li className="px-5 py-8 text-center text-[14px] text-neutral-500">No perfumes match.</li> : null}
      </ul>
    </Card>
  );
}

function ProductRow({ product, mode, disabled }: { product: AttributeProduct; mode: "filters" | "inspired"; disabled: boolean }) {
  const toast = useToast();
  const [saved, setSaved] = useState<Row>(() => pick(product));
  const [row, setRow] = useState<Row>(() => pick(product));
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(row) !== JSON.stringify(saved);

  const toggle = (key: "seasons" | "occasions", value: string) =>
    setRow((r) => ({ ...r, [key]: r[key].includes(value) ? r[key].filter((v) => v !== value) : [...r[key], value] }));

  const save = async () => {
    setBusy(true);
    const body =
      mode === "inspired"
        ? { inspired_by: row.inspiredBy?.trim() || null }
        : { strength: row.strength, longevity: row.longevity, seasons: row.seasons, occasions: row.occasions };
    const result = await adminFetch(`/api/admin/products/${product.id}/attributes`, "PATCH", body, "Couldn't save.");
    setBusy(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    const next = { ...row, inspiredBy: mode === "inspired" ? row.inspiredBy?.trim() || null : row.inspiredBy };
    setSaved(next);
    setRow(next);
    toast(`${product.name} saved.`);
  };

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[15px] font-medium text-neutral-900">{product.name}</span>
          <span className="ml-2 text-[13px] text-neutral-500">{product.brand.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
          {!product.published ? <Badge className="ml-2" tone="neutral">Hidden</Badge> : null}
        </div>
        <Button size="sm" onClick={save} busy={busy} disabled={disabled || !dirty}>
          {dirty ? "Save" : "Saved"}
        </Button>
      </div>

      {mode === "inspired" ? (
        <Input
          aria-label={`${product.name}: inspired by`}
          placeholder="e.g. Creed Aventus"
          maxLength={120}
          value={row.inspiredBy ?? ""}
          disabled={disabled}
          onChange={(e) => setRow((r) => ({ ...r, inspiredBy: e.target.value }))}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <Select aria-label={`${product.name}: strength`} value={row.strength ?? ""} disabled={disabled} onChange={(e) => setRow((r) => ({ ...r, strength: e.target.value || null }))}>
              <option value="">Strength…</option>
              {STRENGTHS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select aria-label={`${product.name}: how long it lasts`} value={row.longevity ?? ""} disabled={disabled} onChange={(e) => setRow((r) => ({ ...r, longevity: e.target.value || null }))}>
              <option value="">Lasts…</option>
              {LONGEVITY.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SEASONS.map((s) => (
              <Chip key={s.value} on={row.seasons.includes(s.value)} disabled={disabled} onClick={() => toggle("seasons", s.value)}>
                {s.label}
              </Chip>
            ))}
            <span className="mx-1 w-px self-stretch bg-neutral-200" aria-hidden />
            {OCCASIONS.map((s) => (
              <Chip key={s.value} on={row.occasions.includes(s.value)} disabled={disabled} onClick={() => toggle("occasions", s.value)}>
                {s.label}
              </Chip>
            ))}
          </div>
          {product.notes.length > 0 ? <p className="text-[12px] text-neutral-500 lg:col-span-2">Notes: {product.notes.join(", ")}</p> : null}
        </div>
      )}
    </li>
  );
}

function Chip({ on, disabled, onClick, children }: { on: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`h-8 rounded-full px-3 text-[13px] ring-1 ring-inset ${on ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50"}`}
    >
      {children}
    </button>
  );
}
