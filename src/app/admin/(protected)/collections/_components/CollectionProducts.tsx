"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { adminFetch } from "../../../_lib/admin-fetch";
import { Button } from "../../../_ui/Button";
import { Card, CardHeader } from "../../../_ui/Card";
import { useToast } from "../../../_ui/Toast";

type Pickable = { id: number; brand: string; name: string; image: string | null };

/** Tick the perfumes that belong in a hand-picked collection, then save once. */
export default function CollectionProducts({
  collectionId,
  products,
  members,
  locked = [],
  lockedReason,
}: {
  collectionId: string;
  products: Pickable[];
  members: number[];
  /** Shown on the page whatever is ticked (e.g. every perfume of the page's brand). */
  locked?: number[];
  lockedReason?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(() => new Set(members));
  const [picked, setPicked] = useState(() => new Set(members));
  const [query, setQuery] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();

  const lockedSet = useMemo(() => new Set(locked), [locked]);
  const shownCount = new Set([...picked, ...locked]).size;
  const dirty = picked.size !== saved.size || [...picked].some((id) => !saved.has(id));
  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      products.filter(
        (p) =>
          (!onlyPicked || picked.has(p.id) || lockedSet.has(p.id)) &&
          (!needle || `${p.brand} ${p.name}`.toLowerCase().includes(needle))
      ),
    [products, onlyPicked, picked, lockedSet, needle]
  );

  const toggle = (id: number) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    const result = await adminFetch(
      `/api/admin/collections/${encodeURIComponent(collectionId)}/products`,
      "PUT",
      { productIds: [...picked] },
      "The products could not be saved."
    );
    setSaving(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setSaved(new Set(picked));
    toast("Products saved.");
    startTransition(() => router.refresh());
  };

  return (
    <Card>
      <CardHeader
        title="Perfumes in this collection"
        description={`${shownCount} on the page`}
        actions={
          <Button size="sm" onClick={save} busy={saving || refreshing} disabled={!dirty}>
            Save products
          </Button>
        }
      />
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <label className="relative flex-1">
          <span className="sr-only">Find a perfume</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a perfume or brand"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-[16px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none sm:h-10 sm:text-[14px]"
          />
        </label>
        <label className="flex items-center gap-2 text-[14px] text-neutral-700">
          <input type="checkbox" className="h-4 w-4 accent-neutral-900" checked={onlyPicked} onChange={(e) => setOnlyPicked(e.target.checked)} />
          Only show chosen
        </label>
      </div>
      {lockedReason && locked.length > 0 ? (
        <p className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-[13px] text-neutral-600 sm:px-5">{lockedReason}</p>
      ) : null}
      {dirty ? <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[13px] text-amber-900 sm:px-5">Unsaved changes. Press &ldquo;Save products&rdquo;.</p> : null}
      <ul className="max-h-[32rem] divide-y divide-neutral-100 overflow-y-auto">
        {shown.length === 0 ? <li className="px-5 py-6 text-[14px] text-neutral-500">No perfumes match.</li> : null}
        {shown.map((product) => (
          <li key={product.id}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 sm:px-5">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-neutral-900 disabled:opacity-60"
                checked={picked.has(product.id) || lockedSet.has(product.id)}
                disabled={lockedSet.has(product.id)}
                onChange={() => toggle(product.id)}
              />
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                <img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-md border border-neutral-200 bg-neutral-50 object-contain" />
              ) : (
                <span className="h-10 w-10 shrink-0 rounded-md border border-dashed border-neutral-300" aria-hidden />
              )}
              <span className="min-w-0">
                <span className="block text-[12px] font-medium uppercase tracking-wide text-neutral-500">{product.brand}</span>
                <span className="block truncate text-[14px] text-neutral-900">{product.name}</span>
                {lockedSet.has(product.id) ? <span className="block text-[12px] text-neutral-500">Included automatically</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
