import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

interface QueueItemProps {
  item_id: string;
  is_selected: boolean;
  is_highlighted: boolean;
  /** A coloured bar on the left edge, for items that need someone. */
  accent?: "attention" | "danger" | "info" | null;
  is_muted?: boolean;
  onOpen: () => void;
  children: ReactNode;
}

const ACCENT_CLASS_NAMES = { attention: "bg-warning", danger: "bg-accent", info: "bg-info" };

/** One row of a master list. Selected is the open item; highlighted is where J/K has moved to. */
export function QueueItem({ item_id, is_selected, is_highlighted, accent = null, is_muted = false, onOpen, children }: QueueItemProps) {
  return (
    <li data-list-item-id={item_id} className="relative">
      <button
        type="button"
        aria-current={is_selected ? "true" : undefined}
        onClick={onOpen}
        className={joinClassNames(
          "relative block w-full border-b border-line px-4 py-3 text-left transition-colors focus-visible:rounded-none focus-visible:outline-offset-[-2px]",
          is_selected ? "bg-info-soft/60" : "hover:bg-canvas",
          is_highlighted && !is_selected && "bg-canvas",
          is_muted && "opacity-60",
        )}
      >
        {accent ? <span className={joinClassNames("absolute inset-y-0 left-0 w-1", ACCENT_CLASS_NAMES[accent])} aria-hidden /> : null}
        {children}
      </button>
    </li>
  );
}
