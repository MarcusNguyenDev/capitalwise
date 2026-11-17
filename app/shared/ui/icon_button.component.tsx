"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";
import { Tooltip } from "./tooltip.component";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  icon: ReactNode;
  size?: "small" | "medium";
  has_tooltip?: boolean;
}

const SIZE_CLASS_NAMES = { small: "size-8", medium: "size-9" };

/** A button that shows only an icon. The label is required: it is the accessible name and the tooltip. */
export function IconButton({ label, icon, size = "medium", has_tooltip = true, className, type = "button", ...button_props }: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      className={joinClassNames(
        "inline-flex shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
        SIZE_CLASS_NAMES[size],
        className,
      )}
      {...button_props}
    >
      {icon}
    </button>
  );
  return has_tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
}
