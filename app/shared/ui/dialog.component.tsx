"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

const WIDTH_CLASS_NAMES = { small: "max-w-md", medium: "max-w-xl", large: "max-w-3xl" };

interface DialogProps {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  width?: keyof typeof WIDTH_CLASS_NAMES;
  children?: ReactNode;
}

/**
 * Moves focus to the control marked `data-autofocus`, or to the dialog itself
 * so screen readers announce its title, rather than to the close button.
 */
function focusInitialElement(open_event: Event): void {
  const dialog_element = open_event.currentTarget as HTMLElement | null;
  open_event.preventDefault();
  (dialog_element?.querySelector<HTMLElement>("[data-autofocus]") ?? dialog_element)?.focus();
}

/** A modal dialog. Focus is trapped inside, Escape and the close button dismiss it, and focus returns to the trigger. */
export function Dialog({ is_open, onOpenChange, title, description, footer, width = "medium", children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={is_open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/40" />
        <DialogPrimitive.Content
          className={joinClassNames(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-fade-in flex-col rounded-xl bg-white shadow-overlay focus:outline-none",
            WIDTH_CLASS_NAMES[width],
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
          tabIndex={-1}
          onOpenAutoFocus={focusInitialElement}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="mt-1 text-sm text-ink-soft">{description}</DialogPrimitive.Description> : null}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-surface hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </header>
          {children ? <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
