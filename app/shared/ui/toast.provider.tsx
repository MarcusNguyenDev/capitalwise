"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

const TOAST_VISIBLE_MS = 6000;

export interface ToastMessage {
  title: string;
  description?: string;
  tone?: "info" | "success" | "error";
  action_label?: string;
  onAction?: () => void;
  /** Keep the toast until dismissed (used when it offers an action). */
  is_sticky?: boolean;
}

interface VisibleToast extends ToastMessage {
  toast_id: number;
}

interface ToastContextValue {
  showToast: (toast_message: ToastMessage) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => undefined });

const TONE_CLASS_NAMES = {
  info: "border-line",
  success: "border-positive",
  error: "border-accent",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible_toasts, setVisibleToasts] = useState<VisibleToast[]>([]);
  const next_toast_id_ref = useRef(1);

  const dismissToast = useCallback((toast_id: number) => {
    setVisibleToasts((current_toasts) => current_toasts.filter((toast) => toast.toast_id !== toast_id));
  }, []);

  const showToast = useCallback(
    (toast_message: ToastMessage) => {
      const toast_id = next_toast_id_ref.current++;
      setVisibleToasts((current_toasts) => [...current_toasts, { ...toast_message, toast_id }]);
      if (!toast_message.is_sticky) {
        setTimeout(() => dismissToast(toast_id), TOAST_VISIBLE_MS);
      }
    },
    [dismissToast],
  );

  const context_value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={context_value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[26rem] flex-col gap-3" aria-live="polite">
        {visible_toasts.map((toast) => (
          <div
            key={toast.toast_id}
            className={`pointer-events-auto animate-slide-in rounded-xl border-l-4 bg-white px-5 py-4 shadow-xl ring-1 ring-line ${TONE_CLASS_NAMES[toast.tone ?? "info"]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{toast.title}</p>
              <button type="button" aria-label="Dismiss" className="text-xl leading-none text-ink-faint" onClick={() => dismissToast(toast.toast_id)}>
                ×
              </button>
            </div>
            {toast.description ? <p className="mt-1 text-ink-soft">{toast.description}</p> : null}
            {toast.action_label ? (
              <button
                type="button"
                className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark"
                onClick={() => {
                  toast.onAction?.();
                  dismissToast(toast.toast_id);
                }}
              >
                {toast.action_label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
