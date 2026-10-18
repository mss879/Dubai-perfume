import { Inbox } from "lucide-react";
import { requireAdmin } from "../../../lib/auth";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { ago, dubaiDateTime, serverNow } from "../../_lib/format";
import { cleanSearch, ilikeAny, pageParam, param } from "../../_lib/search";
import { Badge } from "../../_ui/Badge";
import { Card } from "../../_ui/Card";
import { EmptyState } from "../../_ui/EmptyState";
import { LinkTabs } from "../../_ui/LinkTabs";
import { PageHeader } from "../../_ui/PageHeader";
import { Pager } from "../../_ui/Pager";
import { SearchForm } from "../../_ui/SearchForm";
import MessageActions from "./_components/MessageActions";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const VIEWS = ["new", "answered", "all"] as const;
type View = (typeof VIEWS)[number];
const SEARCH_COLUMNS = ["name", "email", "subject", "message"];

type Inquiry = {
  id: string;
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string | null;
  status: string | null;
  answered_at: string | null;
  admin_reply: string | null;
  replied_by: string | null;
  created_at: string;
};

function hrefFor(view: View, q: string, page = 1): string {
  const search = new URLSearchParams();
  if (view !== "new") search.set("view", view);
  if (q) search.set("q", q);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/admin/messages?${query}` : "/admin/messages";
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/messages");
  const params = await searchParams;
  const requested = param(params.view);
  const view: View = (VIEWS as readonly string[]).includes(requested) ? (requested as View) : "new";
  const q = cleanSearch(param(params.q));
  const page = pageParam(params.page);
  const filter = ilikeAny(q, SEARCH_COLUMNS);

  const supabase = await createSessionSupabase();
  const count = (status: "new" | "answered" | null) => {
    let query = supabase.from("contact_inquiries").select("id", { count: "exact", head: true });
    if (status === "answered") query = query.eq("status", "answered");
    if (status === "new") query = query.neq("status", "answered");
    if (filter) query = query.or(filter);
    return query;
  };

  let list = supabase
    .from("contact_inquiries")
    .select("id, name, email, subject, message, status, answered_at, admin_reply, replied_by, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (view === "answered") list = list.eq("status", "answered");
  if (view === "new") list = list.neq("status", "answered");
  if (filter) list = list.or(filter);

  const [rows, unanswered, answered, all] = await Promise.all([list, count("new"), count("answered"), count(null)]);
  const inquiries = (rows.data ?? []) as Inquiry[];
  const now = serverNow();

  return (
    <>
      <PageHeader title="Messages" description="What customers sent through the contact form. Replies go out by email." />

      <SearchForm action="/admin/messages" defaultValue={q} placeholder="Name, email or words in the message" label="Search messages" keep={{ view: view === "new" ? undefined : view }} />

      <div className="mb-4">
        <LinkTabs
          label="Message views"
          active={view}
          tabs={[
            { key: "new", label: "Unanswered", href: hrefFor("new", q), count: unanswered.count ?? 0, urgent: true },
            { key: "answered", label: "Answered", href: hrefFor("answered", q), count: answered.count ?? 0 },
            { key: "all", label: "All", href: hrefFor("all", q), count: all.count ?? 0 },
          ]}
        />
      </div>

      <Card>
        {rows.error ? (
          <p role="alert" className="px-5 py-4 text-[14px] text-red-700">
            Messages couldn&rsquo;t be loaded. Refresh the page to try again.
          </p>
        ) : inquiries.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" aria-hidden />}
            title={q ? "No messages match" : view === "new" ? "All caught up" : "No messages yet"}
            description={q ? "Try a name, an email address or another word." : view === "new" ? "Every message has been answered." : undefined}
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {inquiries.map((inquiry) => {
              const isAnswered = inquiry.status === "answered";
              return (
                <li key={inquiry.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-neutral-900">{inquiry.name || "No name given"}</p>
                      {inquiry.email ? (
                        <a href={`mailto:${inquiry.email}`} className="break-all text-[14px] text-blue-700 hover:underline">
                          {inquiry.email}
                        </a>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-neutral-500">
                      <time dateTime={inquiry.created_at} title={dubaiDateTime(inquiry.created_at)}>
                        {ago(inquiry.created_at, now)}
                      </time>
                      {isAnswered ? <Badge tone="emerald">Answered</Badge> : <Badge tone="amber">Waiting for a reply</Badge>}
                    </div>
                  </div>
                  {inquiry.subject ? <p className="text-[14px] font-medium text-neutral-700">{inquiry.subject}</p> : null}
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-neutral-800">{inquiry.message}</p>
                  {inquiry.admin_reply ? (
                    <div className="rounded-lg border-l-4 border-emerald-300 bg-emerald-50/50 px-4 py-3">
                      <p className="text-[13px] font-medium text-neutral-600">
                        Your reply{inquiry.replied_by ? ` · ${inquiry.replied_by}` : ""}
                        {inquiry.answered_at ? ` · ${dubaiDateTime(inquiry.answered_at)}` : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-neutral-700">{inquiry.admin_reply}</p>
                    </div>
                  ) : isAnswered && inquiry.answered_at ? (
                    <p className="text-[13px] text-neutral-500">
                      Marked answered {dubaiDateTime(inquiry.answered_at)}
                      {inquiry.replied_by ? ` by ${inquiry.replied_by}` : ""}
                    </p>
                  ) : null}
                  <MessageActions
                    inquiry={{
                      id: inquiry.id,
                      name: inquiry.name ?? "",
                      email: inquiry.email ?? "",
                      subject: inquiry.subject ?? "",
                      message: inquiry.message ?? "",
                      answered: isAnswered,
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Pager page={page} pageSize={PAGE_SIZE} total={rows.count ?? 0} hrefFor={(p) => hrefFor(view, q, p)} />
    </>
  );
}
