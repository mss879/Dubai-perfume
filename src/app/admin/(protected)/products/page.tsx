import Form from "next/form";
import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { aed } from "../../_lib/format";
import { loadCatalogue, type AdminProduct, type StockEntry } from "../../_lib/product-data";
import { Badge } from "../../_ui/Badge";
import { ButtonLink } from "../../_ui/Button";
import { Card } from "../../_ui/Card";
import { EmptyState } from "../../_ui/EmptyState";
import { LinkTabs, type LinkTab } from "../../_ui/LinkTabs";
import { PageHeader } from "../../_ui/PageHeader";
import StockChips from "./_components/StockChips";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const STOCK_VIEWS = ["all", "low", "out", "untracked", "hidden"] as const;
type StockView = (typeof STOCK_VIEWS)[number];

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function chipsFor(product: AdminProduct, rows: StockEntry[]) {
  return product.sizes.map((size) => {
    const row = rows.find((r) => r.size === size);
    return { size, level: row ? row.stock_level : null, threshold: row ? row.low_stock_threshold : null };
  });
}

function matches(view: StockView, product: AdminProduct, rows: StockEntry[]): boolean {
  const chips = chipsFor(product, rows);
  switch (view) {
    case "low":
      return chips.some((c) => c.level !== null && c.level > 0 && c.level <= (c.threshold ?? 5));
    case "out":
      return chips.some((c) => c.level !== null && c.level <= 0);
    case "untracked":
      return chips.some((c) => c.level === null);
    case "hidden":
      return !product.isPublished;
    default:
      return true;
  }
}

function hrefFor(params: { stock?: string; q?: string; brand?: string }): string {
  const search = new URLSearchParams();
  if (params.stock && params.stock !== "all") search.set("stock", params.stock);
  if (params.q) search.set("q", params.q);
  if (params.brand) search.set("brand", params.brand);
  const query = search.toString();
  return query ? `/admin/products?${query}` : "/admin/products";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/products");
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 80);
  const brand = one(params.brand).trim().toUpperCase().slice(0, 255);
  const requested = one(params.stock);
  const view: StockView = (STOCK_VIEWS as readonly string[]).includes(requested) ? (requested as StockView) : "all";

  const supabase = await createSessionSupabase();
  const { products, stock, ready, failed } = await loadCatalogue(supabase);

  const needle = q.toLowerCase();
  const filtered = products.filter((product) => {
    if (brand && product.brand.toUpperCase() !== brand) return false;
    if (needle) {
      const haystack = [product.name, product.brand, ...product.tags].join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return matches(view, product, stock.get(product.id) ?? []);
  });

  const count = (v: StockView) => products.filter((p) => matches(v, p, stock.get(p.id) ?? [])).length;
  const tabs: LinkTab[] = [
    { key: "all", label: "All", href: hrefFor({ q, brand }), count: products.length },
    { key: "low", label: "Low stock", href: hrefFor({ stock: "low", q, brand }), count: count("low"), urgent: true },
    { key: "out", label: "Sold out", href: hrefFor({ stock: "out", q, brand }), count: count("out"), urgent: true },
    { key: "untracked", label: "Not tracked", href: hrefFor({ stock: "untracked", q, brand }), count: count("untracked") },
    ...(ready ? [{ key: "hidden", label: "Hidden", href: hrefFor({ stock: "hidden", q, brand }), count: count("hidden") }] : []),
  ];
  const brands = [...new Set(products.map((p) => p.brand.toUpperCase()).filter(Boolean))].sort();

  return (
    <>
      <PageHeader
        title="Products"
        description="Tap a size to record stock that arrived, or to correct a count."
        actions={
          ready ? (
            <ButtonLink href="/admin/products/new" variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />}>
              Add product
            </ButtonLink>
          ) : null
        }
      />

      {!ready ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          <strong className="font-semibold">Adding and editing products needs database migration 64.</strong> Run{" "}
          <code className="rounded bg-amber-100 px-1">supabase/migrations/64_admin_products_and_stock.sql</code> in the
          Supabase SQL editor, then reload this page. Until then you can browse and check stock here.
        </div>
      ) : null}

      <Form action="/admin/products" className="mb-4 flex flex-col gap-2 sm:flex-row">
        {view !== "all" ? <input type="hidden" name="stock" value={view} /> : null}
        <label htmlFor="products-search" className="sr-only">
          Search products
        </label>
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            id="products-search"
            name="q"
            type="search"
            defaultValue={q}
            autoComplete="off"
            placeholder="Name, brand or tag"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-[16px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 sm:h-10 sm:text-[14px]"
          />
        </div>
        <label htmlFor="products-brand" className="sr-only">
          Brand
        </label>
        <select
          id="products-brand"
          name="brand"
          defaultValue={brand}
          className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-[16px] text-neutral-900 focus:border-neutral-900 focus:outline-none sm:h-10 sm:text-[14px]"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-11 rounded-lg bg-white px-4 text-[15px] font-medium text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 sm:h-10 sm:text-[14px]"
        >
          Search
        </button>
      </Form>

      <div className="mb-4">
        <LinkTabs tabs={tabs} active={view} label="Stock views" />
      </div>

      <Card>
        {failed ? (
          <p role="alert" className="px-5 py-4 text-[14px] text-red-700">
            Some products couldn&rsquo;t be loaded. Refresh the page to try again.
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Package className="h-8 w-8" aria-hidden />}
            title={q || brand ? "No products match" : view === "all" ? "No products yet" : "Nothing here"}
            description={
              q || brand
                ? "Try another name, or clear the brand filter."
                : view === "low"
                  ? "No sizes are running low."
                  : view === "out"
                    ? "Nothing is sold out."
                    : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((product) => (
              <li key={product.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-4 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                >
                  {product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail from our own bucket
                    <img
                      src={product.images[0]}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 object-contain"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-neutral-300 bg-neutral-50" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium uppercase tracking-wide text-neutral-500">{product.brand}</p>
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-neutral-900 group-hover:underline">
                      {product.name}
                      {!product.isPublished ? <Badge tone="neutral">Hidden</Badge> : null}
                    </p>
                    <p className="text-[14px] tabular-nums text-neutral-700">
                      {aed(product.price)}
                      {product.compareAtPrice && product.compareAtPrice > product.price ? (
                        <span className="ml-2 text-neutral-400 line-through">{aed(product.compareAtPrice)}</span>
                      ) : null}
                    </p>
                  </div>
                </Link>
                <div className="sm:max-w-[50%]">
                  <StockChips
                    productId={product.id}
                    productName={product.name}
                    chips={chipsFor(product, stock.get(product.id) ?? [])}
                    editable={ready}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
