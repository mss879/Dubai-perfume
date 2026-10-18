"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "./cn";

/**
 * Short confirmations ("Order accepted") fade on their own; errors stay until
 * dismissed and are announced immediately (role="alert"). A failure never
 * shows a tick.
 */

type ToastTone = "success" | "info" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ShowToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, tone = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      if (tone !== "error") window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const render = (toast: ToastItem) => (
    <div
      key={toast.id}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-[14px] shadow-lg",
        toast.tone === "error"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-neutral-200 bg-white text-neutral-900"
      )}
    >
      {toast.tone === "error" ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
      ) : toast.tone === "info" ? (
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      )}
      <p className="flex-1 leading-relaxed">{toast.message}</p>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        className="-m-1 rounded p-1 text-neutral-500 hover:text-neutral-900"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end print:hidden">
        <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 lg:items-end">
          {toasts.filter((t) => t.tone !== "error").map(render)}
        </div>
        <div role="alert" className="flex w-full flex-col items-center gap-2 lg:items-end">
          {toasts.filter((t) => t.tone === "error").map(render)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>.");
  return show;
}
