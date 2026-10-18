import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "../../../../../lib/auth";
import { createSessionSupabase } from "../../../../../lib/supabase-server";
import { loadCollectionEditor } from "../../../../_lib/collection-data";
import { collectionIdFrom } from "../../../../_lib/collection-schema";
import { Badge } from "../../../../_ui/Badge";
import { ButtonLink } from "../../../../_ui/Button";
import { Card, CardHeader } from "../../../../_ui/Card";
import { PageHeader } from "../../../../_ui/PageHeader";
import CollectionForm from "../../_components/CollectionForm";
import CollectionProducts from "../../_components/CollectionProducts";

export const dynamic = "force-dynamic";

// Shared by the page and its title, so the collection is read once per request.
const loadEditor = cache(async (id: string) => loadCollectionEditor(await createSessionSupabase(), id));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = collectionIdFrom((await params).id);
  const editor = id ? await loadEditor(id) : null;
  return { title: editor?.collection?.title ?? "Collection" };
}

const KIND_LABEL = { brand: "Brand page", line: "Range", curated: null } as const;

// These four also name shop shelves, which follow switches on each product rather than this list.
const SHELF_NOTES: Record<string, string> = {
  new: "The homepage “New in” shelf and the shop's “New” filter show every perfume switched to New arrival on its product page. This list sets only the New Arrivals collection page.",
  bestsellers: "The homepage “Best sellers” shelf and the shop's filter show every perfume switched to Bestseller on its product page. This list sets only this collection's page.",
  trending: "The shop's “Trending” filter shows every perfume switched to New arrival or Bestseller. This list sets only this collection's page.",
  favorites: "The homepage “Exclusive offers” tab and the shop's “Favorites” filter show each shopper's own wishlist. This list sets only this collection's page.",
};

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = collectionIdFrom((await params).id);
  if (!id) notFound();
  await requireAdmin(`/admin/collections/edit/${encodeURIComponent(id)}`);

  const { collection, products, members, brandMatched, tagCounts, failed } = await loadEditor(id);
  if (!collection) notFound();
  const memberSet = new Set(members);
  const kindLabel = KIND_LABEL[collection.kind];

  return (
    <>
      <PageHeader
        title={collection.title}
        back={{ href: "/admin/collections", label: "Collections" }}
        badges={kindLabel ? <Badge>{kindLabel}</Badge> : null}
        actions={
          <ButtonLink href={`/collection/${encodeURIComponent(collection.id)}`} target="_blank" rel="noopener" size="sm" icon={<ExternalLink className="h-4 w-4" aria-hidden />}>
            View in shop
          </ButtonLink>
        }
      />

      {failed ? (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
          Part of this collection couldn&rsquo;t be loaded. Refresh the page before saving.
        </p>
      ) : null}
      {SHELF_NOTES[collection.id] ? (
        <p className="mb-4 max-w-3xl rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[14px] text-sky-900">{SHELF_NOTES[collection.id]}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CollectionForm
            initial={{
              id: collection.id,
              title: collection.title,
              description: collection.description,
              cover: collection.cover,
              automated: collection.automated,
              tag: collection.tag,
              kind: collection.kind,
            }}
            tagCounts={tagCounts}
          />
        </div>
        <div className="lg:col-span-2">
          {collection.automated ? (
            <Card>
              <CardHeader
                title="Perfumes in this collection"
                description={`Every perfume tagged “${collection.tag}”. Change a perfume's tags on its own page.`}
              />
              <ul className="max-h-[32rem] divide-y divide-neutral-100 overflow-y-auto">
                {products.filter((p) => memberSet.has(p.id)).length === 0 ? (
                  <li className="px-5 py-6 text-[14px] text-neutral-500">No perfume carries this tag yet.</li>
                ) : null}
                {products
                  .filter((p) => memberSet.has(p.id))
                  .map((product) => (
                    <li key={product.id}>
                      <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 sm:px-5">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                          <img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-md border border-neutral-200 bg-neutral-50 object-contain" />
                        ) : (
                          <span className="h-10 w-10 shrink-0 rounded-md border border-dashed border-neutral-300" aria-hidden />
                        )}
                        <span className="min-w-0">
                          <span className="block text-[12px] font-medium uppercase tracking-wide text-neutral-500">{product.brand}</span>
                          <span className="block truncate text-[14px] text-neutral-900">{product.name}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : (
            <CollectionProducts
              collectionId={collection.id}
              products={products.map(({ id: productId, brand, name, image }) => ({ id: productId, brand, name, image }))}
              members={members}
              locked={brandMatched}
              lockedReason={collection.brand ? `Every ${collection.brand} perfume appears on this page automatically. Tick others to add them as well.` : undefined}
            />
          )}
        </div>
      </div>
    </>
  );
}
