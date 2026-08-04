/**
 * Segment-scoped loading state.
 *
 * Deliberately NOT placed at the app root: a root loading.tsx wraps every route
 * in a Suspense boundary, which makes Next.js flush a 200 status before the
 * page resolves — so `notFound()` on product/collection/article routes could
 * only ever produce a soft 404. These three segments never call notFound(),
 * so a boundary here is safe. Note a loading.tsx also covers CHILD
 * segments — /collections is the list page; /collection/[id] is a SEPARATE segment and is not covered by this boundary, which is why /blogs has none (it would
 * have made /blogs/[slug] soft-404).
 */
export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-[12px] uppercase tracking-[0.2em] text-[#646464]" role="status">
        Loading
      </p>
    </main>
  );
}
