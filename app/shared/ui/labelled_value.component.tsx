import type { ReactNode } from "react";

/** A small label above its value, for summaries and context panels. */
export function LabelledValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}
