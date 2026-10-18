import { redirect } from "next/navigation";
import { requireAdmin } from "../../../../lib/auth";
import { pathForOldTab } from "../../_shell/nav-model";

export const dynamic = "force-dynamic";

/** Round 1 kept the older screens here; each now has its own page. Old links follow it. */
export default async function MorePage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  await requireAdmin(`/admin/more/${encodeURIComponent(tab)}`);
  redirect(pathForOldTab(tab));
}
