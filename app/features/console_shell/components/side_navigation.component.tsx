"use client";

import { ExternalLink, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { useDemoConfig } from "@/shared/demo/demo_config.provider";
import { KeyboardKey } from "@/shared/ui/keyboard_key.component";

import { CUSTOMER_PHONE_PATH, NAVIGATION_SECTIONS } from "../constants/navigation.constant";
import { useNavigationCounts } from "../hooks/use_navigation_counts.hook";
import { ConnectionStatus } from "./connection_status.component";
import { NavigationLinkItem } from "./navigation_link_item.component";
import { UserMenu } from "./user_menu.component";

interface SideNavigationProps {
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
  onResetDemo: () => void;
  onNavigate?: () => void;
}

/** The console's main navigation: search first, then the work queues, then team, governance and review. */
export function SideNavigation({ onOpenSearch, onOpenShortcuts, onResetDemo, onNavigate }: SideNavigationProps) {
  const pathname = usePathname();
  const { bank_name } = useDemoConfig();
  const navigation_counts = useNavigationCounts();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="flex size-8 items-center justify-center rounded-md bg-accent text-sm font-black text-white" aria-hidden>
          {bank_name.charAt(0)}
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold">{bank_name}</span>
          <span className="block text-xs text-ink-faint">Specialist console</span>
        </span>
      </div>
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-canvas px-2.5 text-sm text-ink-faint hover:border-line-strong"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search or jump to…</span>
          <KeyboardKey>⌘K</KeyboardKey>
        </button>
      </div>
      <nav aria-label="Console" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {NAVIGATION_SECTIONS.map((navigation_section) => (
          <div key={navigation_section.title} className="mt-3">
            <p className="px-2.5 pb-1 text-xs font-semibold text-ink-faint">{navigation_section.title}</p>
            <ul className="flex flex-col gap-0.5">
              {navigation_section.links.map((navigation_link) => (
                <NavigationLinkItem
                  key={navigation_link.href}
                  navigation_link={navigation_link}
                  is_current={pathname === navigation_link.href}
                  count={navigation_link.count_key ? navigation_counts[navigation_link.count_key] : 0}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
        <a
          href={CUSTOMER_PHONE_PATH}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-ink-soft hover:bg-canvas hover:text-ink"
        >
          <ExternalLink className="size-4 text-ink-faint" aria-hidden />
          Customer phone
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </nav>
      <div className="border-t border-line p-3">
        <UserMenu onOpenShortcuts={onOpenShortcuts} onResetDemo={onResetDemo} />
        <div className="mt-2 flex items-center justify-between gap-2 px-2">
          <ConnectionStatus />
        </div>
        <p className="mt-1 px-2 text-xs text-ink-faint">Prototype, mock data only</p>
      </div>
    </div>
  );
}
