import type { ReactNode } from "react";

/** A keyboard key in a shortcut hint, for example <KeyboardKey>J</KeyboardKey>. */
export function KeyboardKey({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-white px-1 font-sans text-[0.7rem] font-semibold text-ink-soft shadow-card">
      {children}
    </kbd>
  );
}
