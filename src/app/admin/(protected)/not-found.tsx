import { SearchX } from "lucide-react";
import { ButtonLink } from "../_ui/Button";

export default function AdminNotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
      <SearchX className="mx-auto h-8 w-8 text-neutral-400" aria-hidden />
      <h1 className="mt-3 text-[18px] font-semibold text-neutral-900">Not found</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">
        This page or order doesn&rsquo;t exist, or it was removed.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <ButtonLink href="/admin/orders" variant="secondary">
          Orders
        </ButtonLink>
        <ButtonLink href="/admin" variant="primary">
          Today
        </ButtonLink>
      </div>
    </div>
  );
}
