import Link from "next/link";

/**
 * Shared maison-styled empty state — design-system.md: serif uppercase title,
 * muted body, outline CTA, no cards or shadows.
 */
export default function EmptyState({
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      {eyebrow && (
        <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">{eyebrow}</p>
      )}
      <h2 className="font-display text-[24px] leading-none tracking-[0.08em] uppercase text-black">
        {title}
      </h2>
      {body && (
        <p className="max-w-[46ch] text-[14px] font-light leading-relaxed text-[#646464]">
          {body}
        </p>
      )}
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="maison-btn-outline">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
