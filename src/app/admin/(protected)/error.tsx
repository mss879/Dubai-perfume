"use client";

import { AlertTriangle } from "lucide-react";
import { Button, ButtonLink } from "../_ui/Button";

/**
 * Something on this page failed to load. Nothing is logged from here; the
 * reference lets the error be matched to the server's own record.
 */
export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
      <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
      <h1 className="mt-3 text-[18px] font-semibold text-neutral-900">This page didn&rsquo;t load</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">
        Check your connection and try again. If it keeps happening, the store&rsquo;s database may be
        unreachable for a moment.
      </p>
      {error.digest ? <p className="mt-2 text-[12px] text-neutral-400">Reference: {error.digest}</p> : null}
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <ButtonLink href="/admin" variant="secondary">
          Go to Today
        </ButtonLink>
      </div>
    </div>
  );
}
