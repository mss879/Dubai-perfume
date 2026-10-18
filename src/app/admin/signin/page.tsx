import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminIdentity } from "../../lib/auth";
import SignInForm from "./SignInForm";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Only same-site admin paths may be returned to after signing in, so
 * ?redirect= can never bounce an admin to someone else's site.
 */
function safeReturnPath(raw: string | undefined): string {
  if (!raw) return "/admin";
  const value = raw.trim().slice(0, 512);
  if (!value.startsWith("/admin") || value.startsWith("//") || value.includes("\\")) return "/admin";
  if (value.startsWith("/admin/signin")) return "/admin";
  return value;
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
  const returnTo = safeReturnPath(requested);

  // Already signed in as an admin: skip the form.
  if (await getAdminIdentity()) redirect(returnTo);

  return (
    <div
      className="flex min-h-dvh flex-col bg-neutral-50 px-4 text-neutral-900"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <header className="mx-auto flex w-full max-w-md items-center justify-between py-5">
        <Link href="/" className="text-[14px] text-neutral-500 hover:text-neutral-900">
          &larr; Back to the shop
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-16">
        <div className="mb-6 text-center">
          <p className="text-[26px] font-semibold text-neutral-900" style={{ fontFamily: "var(--font-playfair), serif" }}>
            Gharib
          </p>
          <h1 className="mt-1 text-[16px] font-medium text-neutral-500">Sign in to the admin</h1>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <SignInForm redirectTo={returnTo} />
        </div>
        <p className="mt-4 text-center text-[13px] text-neutral-500">Only store admins can sign in here.</p>
      </main>
    </div>
  );
}
