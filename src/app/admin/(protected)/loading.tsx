/** Shown instantly while a page's data loads, so a tap never feels ignored. */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="mb-6 h-8 w-48 rounded-lg bg-neutral-200/80" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 rounded-xl border border-neutral-200 bg-white" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-xl border border-neutral-200 bg-white" />
    </div>
  );
}
