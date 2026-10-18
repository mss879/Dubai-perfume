import Link from "next/link";
import { ChevronRight, Layers, Plus } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { loadCollections, type CollectionRow } from "../../_lib/collection-data";
import { plural } from "../../_lib/format";
import { Badge } from "../../_ui/Badge";
import { ButtonLink } from "../../_ui/Button";
import { Card, CardHeader } from "../../_ui/Card";
import { EmptyState } from "../../_ui/EmptyState";
import { PageHeader } from "../../_ui/PageHeader";

export const metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

const SECTIONS: { kind: CollectionRow["kind"]; title: string; description: string }[] = [
  { kind: "curated", title: "Collections", description: "Your own selections, shown on the Collections page." },
  { kind: "brand", title: "Brand pages", description: "One page per perfume house." },
  { kind: "line", title: "Ranges", description: "Lines within a brand, shown on that brand's page." },
];

function CollectionItem({ collection }: { collection: CollectionRow }) {
  return (
    <li>
      <Link
        href={`/admin/collections/edit/${encodeURIComponent(collection.id)}`}
        className="group flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:px-5"
      >
        {collection.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
          <img src={collection.cover} alt="" className="h-12 w-16 shrink-0 rounded-md border border-neutral-200 object-cover" />
        ) : (
          <div className="h-12 w-16 shrink-0 rounded-md border border-dashed border-neutral-300 bg-neutral-50" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-900 group-hover:underline">{collection.title}</p>
          <p className="text-[13px] text-neutral-500">{plural(collection.count, "product")}</p>
        </div>
        {collection.automated ? (
          <Badge tone="violet">{collection.tag ? `Tag: ${collection.tag}` : "Automatic"}</Badge>
        ) : (
          <Badge>Hand-picked</Badge>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      </Link>
    </li>
  );
}

export default async function CollectionsPage() {
  await requireAdmin("/admin/collections");
  const supabase = await createSessionSupabase();
  const { collections, failed } = await loadCollections(supabase);

  return (
    <>
      <PageHeader
        title="Collections"
        description="Groups of perfumes with their own page in the shop. Hand-pick the products, or let a tag choose them."
        actions={
          <ButtonLink href="/admin/collections/new" variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />}>
            New collection
          </ButtonLink>
        }
      />

      {failed ? (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
          Some collections couldn&rsquo;t be loaded. Refresh the page to try again.
        </p>
      ) : null}

      {collections.length === 0 ? (
        <Card>
          <EmptyState icon={<Layers className="h-8 w-8" aria-hidden />} title="No collections yet" description="Create one to group perfumes on their own page." />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {SECTIONS.map((section) => {
            const items = collections.filter((c) => c.kind === section.kind);
            if (items.length === 0) return null;
            return (
              <Card key={section.kind}>
                <CardHeader title={section.title} description={section.description} />
                <ul className="divide-y divide-neutral-100">
                  {items.map((collection) => (
                    <CollectionItem key={collection.id} collection={collection} />
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
