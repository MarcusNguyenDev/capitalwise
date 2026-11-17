import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

/**
 * primary: the one main action on a screen (brand red).
 * secondary: everything else that is a button.
 * danger: destructive actions (ending a call, rejecting).
 * ghost: low-emphasis actions inside toolbars and lists.
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "small" | "medium" | "large";

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-card hover:bg-accent-dark",
  secondary: "border border-line-strong bg-white text-brand-deep hover:border-brand-deep hover:bg-brand-soft",
  danger: "border border-danger/40 bg-white text-danger hover:bg-danger-soft",
  ghost: "text-ink-soft hover:bg-surface hover:text-ink",
};

const SIZE_CLASS_NAMES: Record<ButtonSize, string> = {
  small: "h-8 gap-1.5 px-2.5 text-sm",
  medium: "h-10 gap-2 px-4 text-sm",
  large: "h-11 gap-2 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  is_loading?: boolean;
}

export function Button({
  variant = "secondary",
  size = "medium",
  icon,
  is_loading = false,
  className,
  type = "button",
  disabled,
  children,
  ...button_props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || is_loading}
      aria-busy={is_loading || undefined}
      className={joinClassNames(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASS_NAMES[variant],
        SIZE_CLASS_NAMES[size],
        className,
      )}
      {...button_props}
    >
      {is_loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
