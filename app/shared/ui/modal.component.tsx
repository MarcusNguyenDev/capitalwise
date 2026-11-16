"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width_class_name?: string;
}

export function Modal({ title, onClose, children, footer, width_class_name = "max-w-2xl" }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (keyboard_event: KeyboardEvent) => {
      if (keyboard_event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[88vh] w-full animate-slide-in flex-col rounded-2xl bg-white shadow-2xl ${width_class_name}`}
        onClick={(click_event) => click_event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" aria-label="Close" className="rounded-lg px-2 py-1 text-2xl leading-none text-ink-faint hover:bg-surface" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <footer className="flex justify-end gap-3 border-t border-line px-6 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}
