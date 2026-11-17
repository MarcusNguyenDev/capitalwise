"use client";

import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

interface DropdownMenuProps {
  trigger: ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom" | "right";
  children: ReactNode;
}

/** A menu of actions opened from a button. Arrow keys move, Enter picks, Escape closes. */
export function DropdownMenu({ trigger, align = "end", side = "bottom", children }: DropdownMenuProps) {
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger asChild>{trigger}</MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          align={align}
          side={side}
          sideOffset={6}
          className="z-[60] min-w-56 animate-fade-in rounded-lg border border-line bg-white p-1 shadow-overlay"
        >
          {children}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  is_destructive?: boolean;
  is_disabled?: boolean;
  hint?: ReactNode;
  onSelect: () => void;
  children: ReactNode;
}

export function MenuItem({ icon, is_destructive = false, is_disabled = false, hint, onSelect, children }: MenuItemProps) {
  return (
    <MenuPrimitive.Item
      disabled={is_disabled}
      onSelect={onSelect}
      className={joinClassNames(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-surface data-[disabled]:opacity-50",
        is_destructive ? "text-accent" : "text-ink",
      )}
    >
      {icon ? <span className="flex size-4 items-center justify-center text-current [&>svg]:size-4">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
    </MenuPrimitive.Item>
  );
}

interface MenuRadioGroupProps {
  label: string;
  value: string;
  options: { value: string; label: ReactNode; description?: string }[];
  onChange: (value: string) => void;
}

/** A labelled group of mutually exclusive options inside a menu, such as "Act as". */
export function MenuRadioGroup({ label, value, options, onChange }: MenuRadioGroupProps) {
  return (
    <MenuPrimitive.Group>
      <MenuPrimitive.Label className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</MenuPrimitive.Label>
      <MenuPrimitive.RadioGroup value={value} onValueChange={onChange}>
        {options.map((option) => (
          <MenuPrimitive.RadioItem
            key={option.value}
            value={option.value}
            className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-surface"
          >
            <span className="flex size-4 items-center justify-center">
              <MenuPrimitive.ItemIndicator>
                <span className="block size-2 rounded-full bg-ink" />
              </MenuPrimitive.ItemIndicator>
            </span>
            <span className="flex-1">
              <span className="block">{option.label}</span>
              {option.description ? <span className="block text-xs text-ink-faint">{option.description}</span> : null}
            </span>
          </MenuPrimitive.RadioItem>
        ))}
      </MenuPrimitive.RadioGroup>
    </MenuPrimitive.Group>
  );
}

export function MenuSeparator() {
  return <MenuPrimitive.Separator className="my-1 h-px bg-line" />;
}
