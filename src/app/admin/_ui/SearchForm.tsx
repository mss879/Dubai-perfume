import Form from "next/form";
import { Search } from "lucide-react";

/**
 * A plain GET search: the term lands in the URL, so the back button and a
 * bookmark both keep it. `keep` carries the current view along.
 */
export function SearchForm({
  action,
  defaultValue,
  placeholder,
  label,
  keep = {},
}: {
  action: string;
  defaultValue: string;
  placeholder: string;
  label: string;
  keep?: Record<string, string | undefined>;
}) {
  return (
    <Form action={action} className="mb-4 flex gap-2 print:hidden">
      {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <label htmlFor={`search-${action}`} className="sr-only">
        {label}
      </label>
      <div className="relative flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
        <input
          id={`search-${action}`}
          name="q"
          type="search"
          defaultValue={defaultValue}
          autoComplete="off"
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-[16px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 sm:h-10 sm:text-[14px]"
        />
      </div>
      <button
        type="submit"
        className="h-11 rounded-lg bg-white px-4 text-[15px] font-medium text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 sm:h-10 sm:text-[14px]"
      >
        Search
      </button>
    </Form>
  );
}
