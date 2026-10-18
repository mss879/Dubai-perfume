import type { Metadata } from "next";
import SigninClient from "./SigninClient";
import { safeLocalPath, signinNoticeText } from "../lib/safe-path";

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
  // Only same-site paths are honoured — never external URLs, protocol-relative
  // ("//evil.com") or backslash ("/\evil.com") destinations.
  const redirectTo = safeLocalPath(Array.isArray(raw) ? raw[0] : raw);

  // Set by /auth/callback when a confirmation link has been followed, so the
  // shopper arrives knowing why they are being asked to sign in. Only one of
  // the store's own messages, chosen by key.
  const rawNotice = params.notice;
  const notice = signinNoticeText(Array.isArray(rawNotice) ? rawNotice[0] : rawNotice);

  return <SigninClient redirectTo={redirectTo} notice={notice} />;
}
