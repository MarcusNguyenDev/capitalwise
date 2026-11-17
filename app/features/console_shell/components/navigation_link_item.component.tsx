import Link from "next/link";

import { joinClassNames } from "@/shared/ui/join_class_names.util";

import type { NavigationLink } from "../constants/navigation.constant";

interface NavigationLinkItemProps {
  navigation_link: NavigationLink;
  is_current: boolean;
  count: number;
  onNavigate?: () => void;
}

export function NavigationLinkItem({ navigation_link, is_current, count, onNavigate }: NavigationLinkItemProps) {
  const Icon = navigation_link.icon;
  const is_urgent = navigation_link.count_key === "NEEDS_ATTENTION" && count > 0;
  return (
    <li>
      <Link
        href={navigation_link.href}
        aria-current={is_current ? "page" : undefined}
        onClick={onNavigate}
        className={joinClassNames(
          "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
          is_current ? "bg-surface text-ink" : "text-ink-soft hover:bg-canvas hover:text-ink",
        )}
      >
        <Icon className={joinClassNames("size-4 shrink-0", is_current ? "text-ink" : "text-ink-faint")} aria-hidden />
        <span className="flex-1 truncate">{navigation_link.label}</span>
        {count > 0 ? (
          <span
            key={count}
            className={joinClassNames(
              "min-w-5 animate-fade-in rounded-full px-1.5 text-center text-xs font-semibold tabular-nums",
              is_urgent ? "bg-warning text-white" : "bg-surface text-ink-soft",
            )}
          >
            {count}
            <span className="sr-only">{is_urgent ? " need attention" : " waiting"}</span>
          </span>
        ) : null}
      </Link>
    </li>
  );
}
