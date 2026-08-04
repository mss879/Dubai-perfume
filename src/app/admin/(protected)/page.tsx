import { requireAdmin } from "../../lib/auth";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Re-verified here (not only in the layout) so every request to /admin —
  // including tab navigations — is checked against `customers.is_admin`.
  await requireAdmin();

  return <AdminDashboard />;
}
