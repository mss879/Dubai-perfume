import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "critical" | "plain";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 " +
  "disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-neutral-900 text-white shadow-sm hover:bg-neutral-800",
  secondary: "bg-white text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50",
  critical: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  plain: "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
};

// 44px tall on phones (a comfortable tap), 40px on larger screens.
const SIZES: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-[15px] sm:h-10 sm:text-[14px]",
  sm: "h-9 px-3 text-[13px]",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks further clicks while an action runs. */
  busy?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  busy = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function ButtonLink({ variant = "secondary", size = "md", icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
