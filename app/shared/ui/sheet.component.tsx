"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface SheetProps {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  title: string;
  description?: ReactNode;
  side?: "left" | "right";
  children: ReactNode;
}

const SIDE_CLASS_NAMES = {
  left: "left-0 border-r",
  right: "right-0 border-l",
};

/** A panel that slides in from the edge of the screen, for navigation and settings on small screens. */
export function Sheet({ is_open, onOpenChange, title, description, side = "right", children }: SheetProps) {
  return (
    <DialogPrimitive.Root open={is_open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/40" />
        <DialogPrimitive.Content
          className={`fixed inset-y-0 z-50 flex w-[min(24rem,calc(100vw-2.5rem))] animate-fade-in flex-col border-line bg-white shadow-overlay ${SIDE_CLASS_NAMES[side]}`}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="text-sm text-ink-soft">{description}</DialogPrimitive.Description> : null}
            </div>
            <DialogPrimitive.Close aria-label="Close" className="inline-flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-surface">
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
