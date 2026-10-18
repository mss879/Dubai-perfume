import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "../../lib/auth";
import { loadCounts, loadLockState } from "../_lib/queries";
import { ToastProvider } from "../_ui/Toast";
import { AdminFrame } from "./_shell/AdminFrame";
import { CountsProvider } from "./_shell/CountsProvider";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Gharib admin" },
  robots: { index: false, follow: false },
};

// The admin panel is per-viewer and never cacheable.
export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  // Authoritative gate: redirects before any admin markup is produced. Every
  // page re-checks too, because a layout is not re-rendered on every
  // navigation within its segment.
  const admin = await requireAdmin();
  const [counts, lock] = await Promise.all([loadCounts(), loadLockState()]);

  return (
    <ToastProvider>
      <CountsProvider initial={counts}>
        <AdminFrame email={admin.email} lock={lock}>
          {children}
        </AdminFrame>
      </CountsProvider>
    </ToastProvider>
  );
}
