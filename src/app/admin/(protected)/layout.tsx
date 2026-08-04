import type { Metadata } from "next";
import { requireAdmin } from "../../lib/auth";
import AdminShell from "../AdminShell";

export const metadata: Metadata = {
  title: "Operations",
  robots: { index: false, follow: false },
};

// The admin panel is per-viewer and never cacheable.
export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative gate: redirects before any admin markup is produced.
  // The protected page re-checks, because a layout is not re-rendered on
  // every navigation within its segment.
  const admin = await requireAdmin();

  return <AdminShell activeUser={admin.email}>{children}</AdminShell>;
}
