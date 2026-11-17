import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

interface DisclosureProps {
  summary: ReactNode;
  /** Shown on the right of the summary line, for example a count or a status. */
  meta?: ReactNode;
  is_open_by_default?: boolean;
  className?: string;
  children: ReactNode;
}

/** Technical or secondary detail, collapsed until asked for. Native details/summary, so it works with the keyboard. */
export function Disclosure({ summary, meta, is_open_by_default = false, className, children }: DisclosureProps) {
  return (
    <details open={is_open_by_default} className={joinClassNames("group rounded-lg border border-line bg-white", className)}>
      <summary className="flex list-none items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold hover:bg-canvas">
        <ChevronRight className="size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-90" aria-hidden />
        <span className="min-w-0 flex-1">{summary}</span>
        {meta ? <span className="shrink-0 text-sm font-normal text-ink-soft">{meta}</span> : null}
      </summary>
      <div className="border-t border-line px-4 py-3">{children}</div>
    </details>
  );
}
