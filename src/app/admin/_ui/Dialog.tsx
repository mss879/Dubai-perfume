"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button";
import { cn } from "./cn";

/**
 * A real modal: the native <dialog> traps focus, closes on Esc and returns
 * focus to whatever opened it, with no extra code.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissable = true,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** False while an action is running, so Esc or a backdrop tap can't abandon it. */
  dismissable?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Layout effect: open/close before paint, so an emptied dialog never flashes.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
      onCancel={(event) => {
        if (!dismissable) event.preventDefault();
      }}
      onClick={(event) => {
        if (dismissable && event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-xl",
        "backdrop:bg-neutral-900/40",
        wide ? "max-w-xl" : "max-w-md"
      )}
    >
      {open ? (
        <>
          <div className="px-5 pb-2 pt-5">
            <h2 id={titleId} className="text-[17px] font-semibold">
              {title}
            </h2>
            {description ? <div className="mt-2 text-[14px] leading-relaxed text-neutral-600">{description}</div> : null}
          </div>
          {children ? <div className="px-5 py-3">{children}</div> : null}
          {footer ? (
            <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 px-5 py-4 sm:flex-row sm:justify-end">
              {footer}
            </div>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}

/** "Are you sure?" with the consequence spelled out, and one clear button. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      dismissable={!busy}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={confirmVariant} busy={busy} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
