"use client";

import { ChevronRight, Keyboard, Menu, Search } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { BankBrand } from "@/shared/brand/bank_brand.component";
import { useDemoConfig } from "@/shared/demo/demo_config.provider";
import { useKeyboardShortcut } from "@/shared/keyboard/use_keyboard_shortcut.hook";
import { IconButton } from "@/shared/ui/icon_button.component";
import { Sheet } from "@/shared/ui/sheet.component";

import { AttentionAlerts } from "./attention_alerts.component";
import { CommandPalette } from "./command_palette.component";
import { ResetDemoDialog } from "./reset_demo_dialog.component";
import { ShortcutHelpDialog } from "./shortcut_help_dialog.component";
import { SideNavigation } from "./side_navigation.component";

/** Sidebar navigation on wide screens, a menu sheet on narrow ones, and the console-wide dialogs. */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const [is_palette_open, setIsPaletteOpen] = useState(false);
  const [is_shortcut_help_open, setIsShortcutHelpOpen] = useState(false);
  const [is_reset_open, setIsResetOpen] = useState(false);
  const [is_mobile_menu_open, setIsMobileMenuOpen] = useState(false);
  const { bank_name } = useDemoConfig();

  useKeyboardShortcut("k", () => setIsPaletteOpen((was_open) => !was_open), { needs_command_key: true });
  useKeyboardShortcut("?", () => setIsShortcutHelpOpen(true));

  const navigation_actions = {
    onOpenSearch: () => setIsPaletteOpen(true),
    onOpenShortcuts: () => setIsShortcutHelpOpen(true),
    onResetDemo: () => setIsResetOpen(true),
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main_content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow-overlay">
        Skip to content
      </a>
      <aside className="hidden w-[248px] shrink-0 border-r border-line bg-white lg:block">
        <SideNavigation {...navigation_actions} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-15 shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <IconButton label="Open menu" icon={<Menu className="size-5" aria-hidden />} onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden" />
            <BankBrand bank_name={bank_name} className="w-10 lg:hidden" />
            <span className="truncate text-sm font-semibold text-brand-deep sm:hidden">CapitalWise</span>
            <p className="hidden items-center gap-2 text-xs sm:flex">
              <span className="text-ink-faint">Customer care</span>
              <ChevronRight className="size-3.5 text-ink-faint" aria-hidden />
              <span className="font-semibold text-brand-deep">Specialist console</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden rounded-sm border border-line bg-canvas px-2 py-1 text-[10px] font-semibold tracking-wide text-ink-soft sm:inline-flex">PROTOTYPE</span>
            <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
            <IconButton label="Search the console" icon={<Search className="size-4" aria-hidden />} onClick={navigation_actions.onOpenSearch} />
            <IconButton label="Keyboard shortcuts" icon={<Keyboard className="size-4" aria-hidden />} onClick={navigation_actions.onOpenShortcuts} />
          </div>
        </header>
        <main id="main_content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
      <Sheet is_open={is_mobile_menu_open} onOpenChange={setIsMobileMenuOpen} title="Menu" side="left">
        <SideNavigation {...navigation_actions} onNavigate={() => setIsMobileMenuOpen(false)} />
      </Sheet>
      <CommandPalette is_open={is_palette_open} onOpenChange={setIsPaletteOpen} {...navigation_actions} />
      <ShortcutHelpDialog is_open={is_shortcut_help_open} onOpenChange={setIsShortcutHelpOpen} />
      <ResetDemoDialog is_open={is_reset_open} onOpenChange={setIsResetOpen} />
      <AttentionAlerts />
    </div>
  );
}
