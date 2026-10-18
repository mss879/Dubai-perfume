import { NextRequest } from "next/server";
import { guardAdminWrite, isUniqueViolation, readAdminJson, reply } from "../../../lib/admin-route";
import { productsWithTag, setCollectionMembers } from "../../../lib/collection-members";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { DEFAULT_COVER, collectionSchema, rulesFor, slugify } from "../../../admin/_lib/collection-schema";

/** Create a collection. An automatic one is filled with every product carrying its tag. */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const parsed = await readAdminJson(request);
  if (!parsed.ok) return parsed.response;

  const result = collectionSchema.safeParse(parsed.body);
  if (!result.success) {
    const issue = result.error.issues[0];
    return reply(422, { error: issue?.message ?? "Check the collection details.", field: issue?.path?.join(".") });
  }
  const input = result.data;
  const id = slugify(input.title);
  if (!id) return reply(422, { error: "Use some letters or numbers in the name.", field: "title" });

  const supabase = await createSessionSupabase();
  const { error } = await supabase.from("collections").insert({
    id,
    title: input.title,
    description: input.description,
    cover_image: input.cover_image || DEFAULT_COVER,
    type: input.type,
    rules: rulesFor(input),
  });
  if (error) {
    if (isUniqueViolation(error)) {
      return reply(409, { error: "A collection with this name already exists. Choose another name.", field: "title" });
    }
    return reply(500, { error: "The collection could not be created. Try again." });
  }

  if (input.type === "automated") {
    const ids = await productsWithTag(supabase, input.tag);
    if (ids === null || !(await setCollectionMembers(supabase, id, ids))) {
      return reply(200, { ok: true, id, warning: "The collection was created, but its products couldn't be added. Save it again." });
    }
  }
  return reply(200, { ok: true, id });
}
