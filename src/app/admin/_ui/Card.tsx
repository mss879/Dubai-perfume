import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cn("rounded-xl border border-neutral-200 bg-white shadow-sm", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <h2 id={id} className="text-[16px] font-semibold text-neutral-900">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}
