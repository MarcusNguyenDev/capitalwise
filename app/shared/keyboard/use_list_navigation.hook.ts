"use client";

import { useState } from "react";

import { useKeyboardShortcut } from "./use_keyboard_shortcut.hook";

interface ListNavigationOptions {
  item_ids: string[];
  selected_id: string | null;
  onOpen: (item_id: string) => void;
  /** The list's DOM id; rows carry `data-list-item-id` so the highlighted one can be scrolled into view. */
  list_element_id: string;
  is_enabled?: boolean;
}

export interface ListNavigation {
  highlighted_id: string | null;
  setHighlightedId: (item_id: string | null) => void;
}

/** Moves keyboard focus to the row too, so Enter opens it and never re-triggers whatever was focused before. */
function focusRow(list_element_id: string, item_id: string): void {
  const row = document.getElementById(list_element_id)?.querySelector(`[data-list-item-id="${CSS.escape(item_id)}"]`);
  row?.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
  row?.scrollIntoView({ block: "nearest" });
}

/**
 * J and K move a highlight (and keyboard focus) through a queue, Enter opens
 * the highlighted item. Moving starts from the open item, so J from an open
 * call goes to the next one.
 */
export function useListNavigation({ item_ids, selected_id, onOpen, list_element_id, is_enabled = true }: ListNavigationOptions): ListNavigation {
  const [chosen_highlight_id, setHighlightedId] = useState<string | null>(null);
  const highlighted_id = chosen_highlight_id && item_ids.includes(chosen_highlight_id) ? chosen_highlight_id : null;

  const moveHighlight = (step: 1 | -1) => {
    if (item_ids.length === 0) {
      return;
    }
    const starting_id = highlighted_id ?? selected_id;
    const current_index = starting_id ? item_ids.indexOf(starting_id) : -1;
    const next_index = current_index === -1 ? (step === 1 ? 0 : item_ids.length - 1) : Math.min(item_ids.length - 1, Math.max(0, current_index + step));
    const next_id = item_ids[next_index];
    setHighlightedId(next_id);
    focusRow(list_element_id, next_id);
  };

  useKeyboardShortcut("j", () => moveHighlight(1), { is_enabled });
  useKeyboardShortcut("k", () => moveHighlight(-1), { is_enabled });
  useKeyboardShortcut(
    "Enter",
    (key_event) => {
      const target = key_event.target as Element | null;
      // A focused button or link already handles Enter itself.
      if (!highlighted_id || target?.closest("button, a")) {
        return false;
      }
      onOpen(highlighted_id);
    },
    { is_enabled },
  );

  return { highlighted_id, setHighlightedId };
}
