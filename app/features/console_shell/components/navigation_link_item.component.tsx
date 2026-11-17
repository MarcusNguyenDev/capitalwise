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
          "relative flex min-h-[42px] items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
          is_current ? "bg-accent-soft font-semibold text-brand-deep" : "text-ink-soft hover:bg-canvas hover:text-brand-deep",
        )}
      >
        {is_current ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden /> : null}
        <Icon className={joinClassNames("size-[18px] shrink-0", is_current ? "text-accent" : "text-ink-faint")} aria-hidden />
        <span className="flex-1 truncate">{navigation_link.label}</span>
        {count > 0 ? (
          <span
            key={count}
            className={joinClassNames(
              "flex h-5 min-w-5 animate-fade-in items-center justify-center rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums",
              is_urgent ? "bg-warning text-white" : "bg-brand-soft text-brand-deep",
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
