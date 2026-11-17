"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ReactNode } from "react";

interface PopoverProps {
  trigger: ReactNode;
  label: string;
  align?: "start" | "center" | "end";
  is_open?: boolean;
  onOpenChange?: (is_open: boolean) => void;
  children: ReactNode;
}

/** Non-modal floating panel for secondary controls such as filters or the simulator. */
export function Popover({ trigger, label, align = "end", is_open, onOpenChange, children }: PopoverProps) {
  return (
    <PopoverPrimitive.Root open={is_open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          aria-label={label}
          className="z-[60] w-80 max-w-[calc(100vw-1.5rem)] animate-fade-in rounded-lg border border-line bg-white p-4 shadow-overlay"
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
