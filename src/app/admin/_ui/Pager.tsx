import { ButtonLink } from "./Button";

/** "Showing 26–50 of 112" with Previous / Next links. Renders nothing for a single page. */
export function Pager({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (total <= pageSize) return null;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[14px] text-neutral-600 print:hidden">
      <span>{first > total ? "Nothing on this page" : `Showing ${first}–${last} of ${total}`}</span>
      <span className="flex gap-2">
        {page > 1 ? (
          <ButtonLink href={hrefFor(Math.min(page - 1, lastPage))} variant="secondary" size="sm">
            Previous
          </ButtonLink>
        ) : null}
        {page < lastPage ? (
          <ButtonLink href={hrefFor(page + 1)} variant="secondary" size="sm">
            Next
          </ButtonLink>
        ) : null}
      </span>
    </nav>
  );
}
