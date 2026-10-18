import { requireAdmin } from "../../../../lib/auth";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { loadCollectionEditor } from "../../../_lib/collection-data";
import { PageHeader } from "../../../_ui/PageHeader";
import CollectionForm from "../_components/CollectionForm";

export const metadata = { title: "New collection" };
export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  await requireAdmin("/admin/collections/new");
  const supabase = await createSessionSupabase();
  const { tagCounts } = await loadCollectionEditor(supabase, null);

  return (
    <>
      <PageHeader
        title="New collection"
        description="Name it, pick a cover, and choose how its perfumes are chosen. Hand-picked perfumes are added on the next screen."
        back={{ href: "/admin/collections", label: "Collections" }}
      />
      <div className="max-w-3xl">
        <CollectionForm initial={null} tagCounts={tagCounts} />
      </div>
    </>
  );
}
