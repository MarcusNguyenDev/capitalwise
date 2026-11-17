"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Mounted once at the root so every tooltip shares the same open delay. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={150}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

/** A short hint on hover or keyboard focus. Never the only place important information lives. */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[70] max-w-xs animate-fade-in rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-raised"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
