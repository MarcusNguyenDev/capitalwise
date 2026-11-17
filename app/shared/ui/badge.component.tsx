import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

/** danger is for genuine risk (high risk, overdue); attention for "a person is needed". */
export type BadgeTone = "neutral" | "positive" | "attention" | "info" | "danger" | "strong";

const TONE_CLASS_NAMES: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink-soft",
  positive: "bg-positive-soft text-positive",
  attention: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  danger: "bg-accent-soft text-accent",
  strong: "bg-ink text-white",
};

const DOT_CLASS_NAMES: Record<BadgeTone, string> = {
  neutral: "bg-ink-faint",
  positive: "bg-positive",
  attention: "bg-warning",
  info: "bg-info",
  danger: "bg-accent",
  strong: "bg-white",
};

interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  has_dot?: boolean;
  is_pulsing?: boolean;
  className?: string;
  children: ReactNode;
}

/** A short status label. Colour is never the only signal: the text always says it. */
export function Badge({ tone = "neutral", icon, has_dot = false, is_pulsing = false, className, children }: BadgeProps) {
  return (
    <span
      className={joinClassNames(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-semibold",
        TONE_CLASS_NAMES[tone],
        className,
      )}
    >
      {has_dot ? <span className={joinClassNames("size-1.5 rounded-full", DOT_CLASS_NAMES[tone], is_pulsing && "animate-pulse-dot")} aria-hidden /> : null}
      {icon}
      {children}
    </span>
  );
}
