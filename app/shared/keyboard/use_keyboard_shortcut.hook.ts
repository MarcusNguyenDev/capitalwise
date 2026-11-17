"use client";

import { useEffect, useEffectEvent } from "react";

const TYPING_SELECTOR = "input, textarea, select, [contenteditable='true'], [role='combobox']";
const OPEN_OVERLAY_SELECTOR = "[role='dialog'][data-state='open'], [role='menu'][data-state='open'], [role='alertdialog']";

interface KeyboardShortcutOptions {
  is_enabled?: boolean;
  /** Cmd on macOS or Ctrl elsewhere must be held, as in Cmd+K. */
  needs_command_key?: boolean;
}

/** True when a single-letter shortcut must not fire: the person is typing, or a dialog or menu has focus. */
function shouldIgnore(key_event: KeyboardEvent, needs_command_key: boolean): boolean {
  if (needs_command_key) {
    return !(key_event.metaKey || key_event.ctrlKey);
  }
  if (key_event.metaKey || key_event.ctrlKey || key_event.altKey) {
    return true;
  }
  const target = key_event.target as Element | null;
  return Boolean(target?.closest(TYPING_SELECTOR)) || document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
}

/**
 * Runs `handleShortcut` when `key` is pressed, for example "j", "?" or "Enter".
 * A handler that returns false leaves the key to the browser.
 */
export function useKeyboardShortcut(
  key: string,
  handleShortcut: (key_event: KeyboardEvent) => boolean | void,
  options: KeyboardShortcutOptions = {},
): void {
  const { is_enabled = true, needs_command_key = false } = options;
  const handleLatestShortcut = useEffectEvent(handleShortcut);

  useEffect(() => {
    if (!is_enabled) {
      return;
    }
    const handleKeyDown = (key_event: KeyboardEvent) => {
      if (key_event.key.toLowerCase() !== key.toLowerCase() || key_event.repeat || shouldIgnore(key_event, needs_command_key)) {
        return;
      }
      if (handleLatestShortcut(key_event) !== false) {
        key_event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, is_enabled, needs_command_key]);
}
