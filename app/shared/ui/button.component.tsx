import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "small" | "medium" | "large";

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-dark",
  secondary: "border border-line bg-white text-ink hover:bg-surface",
  danger: "border border-accent bg-white text-accent hover:bg-accent-soft",
  ghost: "text-ink-soft hover:bg-surface",
};

const SIZE_CLASS_NAMES: Record<ButtonSize, string> = {
  small: "px-3 py-1.5 text-sm",
  medium: "px-4 py-2 text-base",
  large: "px-6 py-3 text-lg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "secondary", size = "medium", className = "", type = "button", ...button_props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS_NAMES[variant]} ${SIZE_CLASS_NAMES[size]} ${className}`}
      {...button_props}
    />
  );
}
