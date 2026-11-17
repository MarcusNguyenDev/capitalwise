"use client";

import { useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";

import { toast, Toaster } from "sonner";

const TOAST_VISIBLE_MS = 6000;
const TOASTER_STYLE = { "--width": "26rem" } as CSSProperties;

export interface ToastMessage {
  title: string;
  description?: string;
  tone?: "info" | "success" | "error";
  action_label?: string;
  onAction?: () => void;
  /** Keep the toast until dismissed (used when it offers an action). */
  is_sticky?: boolean;
}

interface ToastApi {
  showToast: (toast_message: ToastMessage) => void;
}

function showToast(toast_message: ToastMessage): void {
  const toast_options = {
    description: toast_message.description,
    duration: toast_message.is_sticky ? Infinity : TOAST_VISIBLE_MS,
    action:
      toast_message.action_label && toast_message.onAction
        ? { label: toast_message.action_label, onClick: toast_message.onAction }
        : undefined,
  };
  if (toast_message.tone === "success") {
    toast.success(toast_message.title, toast_options);
  } else if (toast_message.tone === "error") {
    toast.error(toast_message.title, toast_options);
  } else {
    toast(toast_message.title, toast_options);
  }
}

/** Toasts are announced politely to screen readers and can be reached with Alt+T. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        closeButton
        hotkey={["altKey", "KeyT"]}
        style={TOASTER_STYLE}
        toastOptions={{
          classNames: {
            toast: "!rounded-lg !border !border-line !bg-white !text-ink !shadow-overlay !font-sans",
            title: "!text-sm !font-semibold",
            description: "!text-sm !text-ink-soft",
            actionButton: "!bg-accent !text-white !font-semibold !rounded-md",
            success: "[&_[data-icon]]:!text-positive",
            error: "[&_[data-icon]]:!text-accent",
          },
        }}
      />
    </>
  );
}

export function useToast(): ToastApi {
  return useMemo(() => ({ showToast }), []);
}
