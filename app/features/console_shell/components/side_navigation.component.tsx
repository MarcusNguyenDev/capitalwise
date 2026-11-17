"use client";

import { ArrowUpRight, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { WestpacBrand } from "@/shared/brand/westpac_brand.component";
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
      <div className="flex h-15 shrink-0 items-center gap-3 border-b border-line px-6">
        <WestpacBrand bank_name={bank_name} />
        <span className="border-l border-line pl-3 text-sm font-semibold text-brand-deep">{bank_name}</span>
      </div>
      <div className="px-6 pb-4 pt-6">
        <p className="text-xl font-bold tracking-tight text-brand-deep">CapitalWise<span className="text-accent">.</span></p>
        <p className="mt-1 text-xs text-ink-faint">Specialist console</p>
      </div>
      <div className="px-4 pb-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-10 w-full items-center gap-2 rounded-md border border-line bg-canvas px-3 text-xs text-ink-soft transition-colors hover:border-line-strong hover:bg-white"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search the console</span>
          <KeyboardKey>⌘K</KeyboardKey>
        </button>
      </div>
      <nav aria-label="Console" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {NAVIGATION_SECTIONS.map((navigation_section) => (
          <div key={navigation_section.title} className="mt-5">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{navigation_section.title}</p>
            <ul className="flex flex-col gap-1">
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
          className="mt-5 flex min-h-11 items-center gap-2.5 rounded-md border border-line px-3 text-sm font-medium text-brand-deep transition-colors hover:bg-brand-soft"
        >
          <span className="flex-1">Customer phone</span>
          <ArrowUpRight className="size-4" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </nav>
      <div className="shrink-0 border-t border-line bg-canvas/60 p-3">
        <UserMenu onOpenShortcuts={onOpenShortcuts} onResetDemo={onResetDemo} />
        <div className="mt-2 flex items-center justify-between gap-2 px-2">
          <ConnectionStatus />
        </div>
        <p className="mt-1 px-2 text-xs text-ink-faint">Prototype, mock data only</p>
      </div>
    </div>
  );
}
