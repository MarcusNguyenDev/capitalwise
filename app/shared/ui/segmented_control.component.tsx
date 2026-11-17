"use client";

import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

export interface SegmentOption<Value extends string | number> {
  value: Value;
  label: ReactNode;
  is_disabled?: boolean;
  title?: string;
}

interface SegmentedControlProps<Value extends string | number> {
  label: string;
  value: Value | null;
  options: SegmentOption<Value>[];
  is_disabled?: boolean;
  size?: "small" | "medium";
  onChange: (value: Value) => void;
}

const SIZE_CLASS_NAMES = { small: "h-7 px-2.5 text-xs", medium: "h-8 px-3 text-sm" };

/** A radio group drawn as joined buttons. Left and right arrows move between the enabled options. */
export function SegmentedControl<Value extends string | number>({
  label,
  value,
  options,
  is_disabled = false,
  size = "medium",
  onChange,
}: SegmentedControlProps<Value>) {
  const option_refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled_indexes = options.flatMap((option, option_index) => (option.is_disabled || is_disabled ? [] : [option_index]));

  const moveSelection = (key_event: KeyboardEvent<HTMLButtonElement>, option_index: number) => {
    const step = key_event.key === "ArrowRight" || key_event.key === "ArrowDown" ? 1 : key_event.key === "ArrowLeft" || key_event.key === "ArrowUp" ? -1 : 0;
    if (step === 0 || enabled_indexes.length === 0) {
      return;
    }
    key_event.preventDefault();
    const position = enabled_indexes.indexOf(option_index);
    const next_index = enabled_indexes[(position + step + enabled_indexes.length) % enabled_indexes.length];
    option_refs.current[next_index]?.focus();
    onChange(options[next_index].value);
  };

  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {options.map((option, option_index) => {
        const is_checked = option.value === value;
        return (
          <button
            key={String(option.value)}
            ref={(button) => {
              option_refs.current[option_index] = button;
            }}
            type="button"
            role="radio"
            aria-checked={is_checked}
            tabIndex={is_checked || (value === null && option_index === enabled_indexes[0]) ? 0 : -1}
            disabled={is_disabled || option.is_disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            onKeyDown={(key_event) => moveSelection(key_event, option_index)}
            className={joinClassNames(
              "inline-flex items-center gap-1.5 rounded font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              SIZE_CLASS_NAMES[size],
              is_checked ? "bg-white text-ink shadow-card" : "text-ink-soft hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
