import { notFound } from "next/navigation";
import { requireAdmin } from "../../../../lib/auth";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { outcomeOf } from "../../../_lib/concierge";
import { dubaiDateTime, plural } from "../../../_lib/format";
import { Badge } from "../../../_ui/Badge";
import { Card } from "../../../_ui/Card";
import { PageHeader } from "../../../_ui/PageHeader";
import { cn } from "../../../_ui/cn";

export const metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Turn = {
  id: number;
  role: string;
  content: string | null;
  product_ids: number[] | null;
  added_ids: number[] | null;
  outcome: string | null;
  search_terms: string[] | null;
  has_image: boolean | null;
  photo_reading: string | null;
  latency_ms: number | null;
  created_at: string | null;
};

/** One conversation with the concierge, as the shopper and the assistant had it. */
export default async function ConversationPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!UUID.test(sessionId)) notFound();
  await requireAdmin(`/admin/agent/${sessionId}`);

  const supabase = await createSessionSupabase();
  const { data, error } = await supabase.rpc("admin_concierge_transcript", { p_session_id: sessionId });
  const turns = (error ? [] : (data ?? [])) as Turn[];
  if (!error && turns.length === 0) notFound();

  const ids = [...new Set(turns.flatMap((t) => [...(t.product_ids ?? []), ...(t.added_ids ?? [])]))];
  const names = new Map<number, string>();
  if (ids.length > 0) {
    const { data: products } = await supabase.from("products").select("id, brand, name").in("id", ids.slice(0, 500));
    for (const p of (products ?? []) as { id: number; brand: string; name: string }[]) {
      names.set(p.id, `${p.brand} ${p.name}`.replace(/_/g, " ").trim());
    }
  }
  const nameOf = (id: number) => names.get(id) ?? `Product #${id}`;
  const replies = turns.filter((t) => t.role !== "user");
  const problems = replies.filter((t) => t.outcome && outcomeOf(t.outcome).bad).length;

  return (
    <>
      <PageHeader
        title="Conversation"
        description={turns[0]?.created_at ? `Started ${dubaiDateTime(turns[0].created_at)} · ${plural(replies.length, "reply", "replies")}${problems > 0 ? ` · ${problems} with a problem` : ""}` : undefined}
        back={{ href: "/admin/agent", label: "Agent" }}
      />

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
          This conversation couldn&rsquo;t be loaded. Refresh the page to try again.
        </p>
      ) : (
        <Card className="max-w-3xl">
          <ol className="flex flex-col gap-4 p-4 sm:p-5">
            {turns.map((turn) => {
              const shopper = turn.role === "user";
              const meta = turn.outcome ? outcomeOf(turn.outcome) : null;
              return (
                <li key={turn.id} className={cn("flex flex-col gap-1.5", shopper ? "items-end" : "items-start")}>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
                    <span className="font-medium text-neutral-700">{shopper ? "Shopper" : "Concierge"}</span>
                    {turn.created_at ? <span>{dubaiDateTime(turn.created_at)}</span> : null}
                    {turn.has_image ? <Badge>Photo</Badge> : null}
                    {meta?.bad ? <Badge tone="amber">{meta.label}</Badge> : null}
                    {!shopper && turn.latency_ms ? <span>{(turn.latency_ms / 1000).toFixed(1)} s</span> : null}
                  </div>
                  <div
                    className={cn(
                      "max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                      shopper ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-900"
                    )}
                  >
                    {turn.content || (turn.has_image ? "(sent a photo)" : "—")}
                  </div>
                  {turn.photo_reading ? <p className="text-[13px] text-neutral-500">Read the photo as: {turn.photo_reading}</p> : null}
                  {turn.product_ids && turn.product_ids.length > 0 ? (
                    <p className="max-w-[90%] text-[13px] text-neutral-500">Showed: {turn.product_ids.map(nameOf).join(" · ")}</p>
                  ) : null}
                  {turn.added_ids && turn.added_ids.length > 0 ? (
                    <p className="max-w-[90%] text-[13px] font-medium text-emerald-700">Added to bag: {turn.added_ids.map(nameOf).join(" · ")}</p>
                  ) : null}
                  {turn.search_terms && turn.search_terms.length > 0 ? (
                    <p className="max-w-[90%] text-[13px] text-neutral-500">Searched: {turn.search_terms.join(" · ")}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </>
  );
}
