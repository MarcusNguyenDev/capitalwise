"use client";

import { Dialog } from "@/shared/ui/dialog.component";
import { KeyboardKey } from "@/shared/ui/keyboard_key.component";

import { SHORTCUT_GROUPS } from "../constants/keyboard_shortcut.constant";

export function ShortcutHelpDialog({ is_open, onOpenChange }: { is_open: boolean; onOpenChange: (is_open: boolean) => void }) {
  return (
    <Dialog is_open={is_open} onOpenChange={onOpenChange} title="Keyboard shortcuts" description="Single-key shortcuts are off while you are typing.">
      <div className="flex flex-col gap-5">
        {SHORTCUT_GROUPS.map((shortcut_group) => (
          <section key={shortcut_group.title}>
            <h3 className="mb-2 text-sm font-semibold">{shortcut_group.title}</h3>
            <dl className="flex flex-col gap-1.5">
              {shortcut_group.shortcuts.map((shortcut) => (
                <div key={shortcut.description} className="flex items-center justify-between gap-4 text-sm">
                  <dt className="text-ink-soft">{shortcut.description}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {shortcut.keys.map((key) => (
                      <KeyboardKey key={key}>{key}</KeyboardKey>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
