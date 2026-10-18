import { NextRequest } from "next/server";
import { z } from "zod";
import { guardAdminWrite, readAdminJson, reply } from "../../../../../lib/admin-route";
import { setCollectionMembers } from "../../../../../lib/collection-members";
import { createSessionSupabase } from "../../../../../lib/supabase-server";
import { collectionIdFrom } from "../../../../../admin/_lib/collection-schema";

/** The hand-picked products of a collection, saved as one list. */

export const dynamic = "force-dynamic";

const body = z.object({
  productIds: z.array(z.number().int().positive()).max(2000),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardAdminWrite(request);
  if (!gate.ok) return gate.response;
  const id = collectionIdFrom((await params).id);
  if (!id) return reply(404, { error: "Collection not found." });

  const parsed = await readAdminJson(request, 32 * 1024);
  if (!parsed.ok) return parsed.response;
  const result = body.safeParse(parsed.body);
  if (!result.success) return reply(422, { error: "Invalid product list." });

  const supabase = await createSessionSupabase();
  const { data: collection, error } = await supabase.from("collections").select("id, type").eq("id", id).maybeSingle();
  if (error) return reply(500, { error: "The collection could not be loaded. Try again." });
  if (!collection) return reply(404, { error: "Collection not found." });
  if (collection.type === "automated") {
    return reply(409, { error: "This collection follows a tag. Change the products' tags, or make it hand-picked first." });
  }

  const ok = await setCollectionMembers(supabase, id, [...new Set(result.data.productIds)]);
  if (!ok) return reply(500, { error: "The products could not be saved. Try again." });
  return reply(200, { ok: true });
}
