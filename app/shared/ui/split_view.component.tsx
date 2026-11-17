import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

interface SplitViewProps {
  list: ReactNode;
  detail: ReactNode;
  /** On narrow screens only one pane shows: the detail once something is selected, otherwise the list. */
  has_selection: boolean;
  list_label: string;
  list_width_class_name?: string;
}

/** Queue on the left, the open item on the right. Each pane scrolls on its own. */
export function SplitView({ list, detail, has_selection, list_label, list_width_class_name = "lg:w-[22rem]" }: SplitViewProps) {
  return (
    <div className="flex min-h-0 flex-1 gap-4 p-3 sm:p-5">
      <section
        aria-label={list_label}
        className={joinClassNames(
          "min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-white shadow-card lg:flex",
          list_width_class_name,
          has_selection ? "hidden" : "flex",
        )}
      >
        {list}
      </section>
      <section className={joinClassNames("min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-white shadow-card lg:flex", has_selection ? "flex" : "hidden")}>{detail}</section>
    </div>
  );
}
