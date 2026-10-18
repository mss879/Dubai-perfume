import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { readAgentSettingsFresh } from "../../../lib/agent-settings";
import { DEFAULT_GREETING } from "../../../lib/concierge/greeting";
import { isModelConfigured, isVisionEnabled } from "../../../lib/concierge/model";
import { isMissingFunction } from "../../../lib/rpc-errors";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { CONCIERGE_PAGE_SIZE, WINDOWS, hourLabel, outcomeOf } from "../../_lib/concierge";
import { dubaiDate, dubaiDateTime, plural } from "../../_lib/format";
import { pageParam, param } from "../../_lib/search";
import { Badge } from "../../_ui/Badge";
import { Card, CardBody, CardHeader } from "../../_ui/Card";
import { EmptyState } from "../../_ui/EmptyState";
import { LinkTabs } from "../../_ui/LinkTabs";
import { PageHeader } from "../../_ui/PageHeader";
import { Pager } from "../../_ui/Pager";
import { cn } from "../../_ui/cn";
import AgentSettingsForm from "./_components/AgentSettingsForm";

export const metadata = { title: "Agent" };
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v) || 0;

function hrefFor(days: number, troubled: boolean, page = 1): string {
  const search = new URLSearchParams();
  if (days !== 30) search.set("days", String(days));
  if (troubled) search.set("troubled", "1");
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/admin/agent?${query}` : "/admin/agent";
}

/** A row of horizontal bars, each scaled against the largest. */
function Bars({ rows }: { rows: { key: string; label: string; value: number; note?: string; tone?: "bad" }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate text-neutral-800">{row.label}</span>
            <span className="shrink-0 tabular-nums text-neutral-600">{row.note ?? row.value}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-neutral-100">
            <div className={cn("h-2 rounded-full", row.tone === "bad" ? "bg-amber-500" : "bg-neutral-800")} style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ConciergePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/agent");
  const params = await searchParams;
  const requestedDays = Number(param(params.days));
  const days = (WINDOWS as readonly number[]).includes(requestedDays) ? requestedDays : 30;
  const troubled = param(params.troubled) === "1";
  const page = pageParam(params.page);

  const supabase = await createSessionSupabase();
  const [agentRead, overview, photos, sessions] = await Promise.all([
    readAgentSettingsFresh(supabase),
    supabase.rpc("admin_concierge_overview", { p_days: days }),
    supabase.rpc("admin_concierge_photo_demand", { p_days: days }),
    supabase.rpc("admin_concierge_sessions", {
      p_days: days,
      p_struggles_only: troubled,
      p_limit: CONCIERGE_PAGE_SIZE,
      p_offset: (page - 1) * CONCIERGE_PAGE_SIZE,
    }),
  ]);

  const missing = overview.error && isMissingFunction(overview.error);
  const data = (overview.error ? {} : (overview.data ?? {})) as Row;
  const totals = (data.totals ?? {}) as Row;
  const outcomes = (data.outcomes ?? []) as Row[];
  const hours = (data.hours ?? []) as Row[];
  const terms = (data.terms ?? []) as Row[];
  const demand = (data.demand ?? []) as Row[];
  const tools = (data.tools ?? []) as Row[];
  const photoDemand = (photos.error ? [] : (photos.data ?? [])) as Row[];
  const sessionRows = (sessions.error ? [] : (sessions.data ?? [])) as Row[];
  const total = n(sessionRows[0]?.total_count);
  const turns = n(totals.turns);
  const struggles = n(totals.struggles);
  const busiest = Math.max(1, ...hours.map((h) => n(h.turns)));
  const peak = hours.reduce<Row | null>((best, h) => (!best || n(h.turns) > n(best.turns) ? h : best), null);

  const figures = [
    { label: "Conversations", value: String(n(totals.sessions)) },
    { label: "Replies", value: String(turns) },
    { label: "Bottles added to bags", value: String(n(totals.adds)) },
    { label: "Photos sent", value: String(n(totals.photo_turns)) },
    { label: "Replies with a problem", value: turns > 0 ? `${Math.round((struggles / turns) * 100)}%` : "—" },
    { label: "Typical reply time", value: n(totals.median_latency_ms) ? `${(n(totals.median_latency_ms) / 1000).toFixed(1)} s` : "—" },
  ];

  return (
    <>
      <PageHeader title="Agent" description="The chat assistant on your shop: switch it on or off, choose what it may do, and read its conversations." />

      <div className="mb-8 max-w-3xl">
        {agentRead.failed ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
            The agent&rsquo;s settings couldn&rsquo;t be loaded. Refresh the page to try again.
          </p>
        ) : (
          <AgentSettingsForm
            initial={{
              enabled: agentRead.settings.enabled,
              greeting: agentRead.settings.greeting ?? "",
              photosEnabled: agentRead.settings.photosEnabled,
              offersEnabled: agentRead.settings.offersEnabled,
              orderHelpEnabled: agentRead.settings.orderHelpEnabled,
              nudgesEnabled: agentRead.settings.nudgesEnabled,
            }}
            defaultGreeting={DEFAULT_GREETING}
            ready={!agentRead.missing}
            modelReady={isModelConfigured}
            visionReady={isVisionEnabled}
          />
        )}
      </div>

      <h2 className="mb-3 text-[18px] font-semibold text-neutral-900">Conversations and insights</h2>

      <div className="mb-6">
        <LinkTabs
          label="Time window"
          active={String(days)}
          tabs={WINDOWS.map((d) => ({ key: String(d), label: `Last ${d} days`, href: hrefFor(d, troubled) }))}
        />
      </div>

      {missing ? (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          Conversations aren&rsquo;t being recorded: the concierge&rsquo;s database migrations (53 and 54) haven&rsquo;t been applied.
        </p>
      ) : overview.error ? (
        <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
          The figures couldn&rsquo;t be loaded. Refresh the page to try again.
        </p>
      ) : null}

      {!overview.error && turns === 0 ? (
        <Card className="mb-6">
          <EmptyState icon={<MessagesSquare className="h-8 w-8" aria-hidden />} title="No conversations in this window" />
        </Card>
      ) : null}

      {!overview.error && turns > 0 ? (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {figures.map((figure) => (
              <div key={figure.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                <dt className="text-[13px] leading-snug text-neutral-500">{figure.label}</dt>
                <dd className="mt-1 text-[22px] font-semibold tabular-nums text-neutral-900">{figure.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Shown, and added to bag" description="A perfume shown often but rarely added is the one to look at." />
              <CardBody>
                {demand.length === 0 ? (
                  <p className="text-[14px] text-neutral-500">Nothing shown yet.</p>
                ) : (
                  <Bars
                    rows={demand.slice(0, 10).map((d) => {
                      const shown = n(d.shown);
                      const taken = n(d.taken);
                      return {
                        key: String(d.product_id),
                        label: String(d.name ?? "").replace(/_/g, " "),
                        value: shown,
                        note: `${taken} of ${shown} added`,
                      };
                    })}
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="How replies ended" />
              <CardBody>
                <Bars
                  rows={outcomes.map((o) => {
                    const meta = outcomeOf(String(o.outcome));
                    const count = n(o.turns);
                    return {
                      key: String(o.outcome),
                      label: meta.label,
                      value: count,
                      note: `${count} · ${turns > 0 ? Math.round((count / turns) * 100) : 0}%`,
                      tone: meta.bad ? "bad" : undefined,
                    };
                  })}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="When shoppers chat" description={`Dubai time${peak ? ` · busiest around ${hourLabel(n(peak.hour))}` : ""}`} />
              <CardBody>
                <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Replies by hour of the day">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const count = n(hours.find((h) => n(h.hour) === hour)?.turns);
                    return (
                      <div
                        key={hour}
                        title={`${hourLabel(hour)}: ${count} replies`}
                        className="flex-1 rounded-t bg-neutral-800"
                        style={{ height: `${Math.max(2, (count / busiest) * 100)}%` }}
                      />
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[12px] text-neutral-500">
                  <span>12am</span>
                  <span>6am</span>
                  <span>12pm</span>
                  <span>6pm</span>
                  <span>11pm</span>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="What they asked for" description="The assistant's own searches, in the shoppers' words." />
              <CardBody className="flex flex-col gap-4">
                {terms.length === 0 ? (
                  <p className="text-[14px] text-neutral-500">No searches recorded.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {terms.map((t) => (
                      <li key={String(t.term)}>
                        <Badge>
                          {String(t.term)} · {n(t.times)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {tools.length > 0 ? (
                  <details className="text-[14px]">
                    <summary className="cursor-pointer text-neutral-600">What the assistant looked up</summary>
                    <div className="mt-3">
                      <Bars rows={tools.map((t) => ({ key: String(t.tool), label: String(t.tool).replace(/_/g, " "), value: n(t.times) }))} />
                    </div>
                  </details>
                ) : null}
              </CardBody>
            </Card>
          </div>

          {photoDemand.length > 0 ? (
            <Card className="mb-6">
              <CardHeader title="Bottles shoppers photographed" description="Read from photos sent in the chat. A house that keeps appearing may be one worth stocking." />
              <CardBody>
                <Bars
                  rows={photoDemand.map((d) => ({
                    key: String(d.reading),
                    label: String(d.reading),
                    value: n(d.times),
                    note: `${n(d.times)}${d.last_seen ? ` · last ${dubaiDate(String(d.last_seen))}` : ""}`,
                  }))}
                />
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : null}

      {!overview.error ? (
        <Card>
          <CardHeader
            title="Conversations"
            actions={
              <LinkTabs
                label="Which conversations"
                active={troubled ? "troubled" : "all"}
                tabs={[
                  { key: "all", label: "All", href: hrefFor(days, false) },
                  { key: "troubled", label: "With a problem", href: hrefFor(days, true) },
                ]}
              />
            }
          />
          {sessionRows.length === 0 ? (
            <p className="px-5 py-6 text-[14px] text-neutral-500">{troubled ? "No conversations with a problem." : "No conversations recorded."}</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {sessionRows.map((s) => (
                <li key={String(s.session_id)}>
                  <Link
                    href={`/admin/agent/${String(s.session_id)}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-neutral-900">&ldquo;{String(s.opening || "—")}&rdquo;</span>
                      <span className="block text-[13px] text-neutral-500">
                        {s.last_seen_at ? dubaiDateTime(String(s.last_seen_at)) : "—"} · {plural(n(s.turns), "reply", "replies")}
                        {n(s.photos) > 0 ? ` · ${n(s.photos)} photo${n(s.photos) === 1 ? "" : "s"}` : ""}
                      </span>
                    </span>
                    {n(s.adds) > 0 ? <Badge tone="emerald">{`${n(s.adds)} added to bag`}</Badge> : null}
                    {n(s.struggles) > 0 ? <Badge tone="amber">{`${n(s.struggles)} problem${n(s.struggles) === 1 ? "" : "s"}`}</Badge> : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Pager page={page} pageSize={CONCIERGE_PAGE_SIZE} total={total} hrefFor={(p) => hrefFor(days, troubled, p)} />
    </>
  );
}
