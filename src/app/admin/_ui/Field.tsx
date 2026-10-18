"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * A labelled form control: the label, hint and error are wired to the input
 * (htmlFor / aria-describedby / aria-invalid), so screen readers announce them.
 * Inputs are 16px on phones so iOS does not zoom when one takes focus.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (control: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[14px] font-medium text-neutral-800">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-[13px] leading-relaxed text-neutral-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-[13px] font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const controlClasses =
  "block w-full rounded-lg border bg-white px-3 text-[16px] text-neutral-900 placeholder:text-neutral-400 sm:text-[14px] " +
  "focus:outline-none focus:ring-2 focus:ring-neutral-900/15 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500";

function borderFor(invalid?: boolean) {
  return invalid ? "border-red-500 focus:border-red-600" : "border-neutral-300 focus:border-neutral-900";
}

export function Input({ invalid, className, ...rest }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlClasses, borderFor(invalid), "h-11 sm:h-10", className)}
      {...rest}
    />
  );
}

export function Textarea({ invalid, className, ...rest }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlClasses, borderFor(invalid), "min-h-[96px] py-2 leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Select({ invalid, className, children, ...rest }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(controlClasses, borderFor(invalid), "h-11 pr-8 sm:h-10", className)}
      {...rest}
    >
      {children}
    </select>
  );
}

/** An on/off switch with its label, as one large tap target. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[14px] font-medium text-neutral-900">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50",
          checked ? "bg-neutral-900" : "bg-neutral-300"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
