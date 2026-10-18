import { NextRequest } from "next/server";
import { guardAdminWrite, readAdminJson, reply } from "../../../../lib/admin-route";
import { productsWithTag, setCollectionMembers } from "../../../../lib/collection-members";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { DEFAULT_COVER, collectionIdFrom, collectionSchema, rulesFor } from "../../../../admin/_lib/collection-schema";

/**
 * Edit or delete one collection. Turning a collection automatic (or changing
 * its tag) re-derives its products straight away: the links are what the shop
 * reads, so stale ones would show the old products under the new rule.
 */

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const id = collectionIdFrom((await params).id);
  if (!id) return reply(404, { error: "Collection not found." });

  const parsed = await readAdminJson(request);
  if (!parsed.ok) return parsed.response;
  const result = collectionSchema.safeParse(parsed.body);
  if (!result.success) {
    const issue = result.error.issues[0];
    return reply(422, { error: issue?.message ?? "Check the collection details.", field: issue?.path?.join(".") });
  }
  const input = result.data;

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase
    .from("collections")
    .update({
      title: input.title,
      description: input.description,
      cover_image: input.cover_image || DEFAULT_COVER,
      type: input.type,
      rules: rulesFor(input),
    })
    .eq("id", id)
    .select("id");
  if (error) return reply(500, { error: "The collection could not be saved. Try again." });
  if (!data || data.length === 0) return reply(404, { error: "Collection not found." });

  if (input.type === "automated") {
    const ids = await productsWithTag(supabase, input.tag);
    if (ids === null || !(await setCollectionMembers(supabase, id, ids))) {
      return reply(200, { ok: true, warning: "Saved, but its products couldn't be updated. Save it again." });
    }
  }
  return reply(200, { ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const id = collectionIdFrom((await params).id);
  if (!id) return reply(404, { error: "Collection not found." });

  // Its product links go with it (ON DELETE CASCADE); the products stay.
  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.from("collections").delete().eq("id", id).select("id");
  if (error) return reply(500, { error: "The collection could not be deleted. Try again." });
  if (!data || data.length === 0) return reply(404, { error: "Collection not found." });
  return reply(200, { ok: true });
}
