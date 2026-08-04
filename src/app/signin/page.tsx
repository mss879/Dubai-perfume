import type { Metadata } from "next";
import SigninClient from "./SigninClient";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.redirect;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  // Only same-site paths are honoured — never external URLs or
  // protocol-relative ("//evil.com") destinations.
  const redirectTo =
    candidate && candidate.startsWith("/") && !candidate.startsWith("//")
      ? candidate
      : null;

  return <SigninClient redirectTo={redirectTo} />;
}
