"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

import { joinClassNames } from "./join_class_names.util";

export interface TabItem<TabKey extends string> {
  key: TabKey;
  label: string;
  count?: number;
  content: ReactNode;
}

interface TabsProps<TabKey extends string> {
  tabs: TabItem<TabKey>[];
  selected_key: TabKey;
  onSelect: (tab_key: TabKey) => void;
  label: string;
  className?: string;
  list_class_name?: string;
  panel_class_name?: string;
}

/** Tabs with arrow-key navigation between triggers. Only the selected panel is mounted. */
export function Tabs<TabKey extends string>({ tabs, selected_key, onSelect, label, className, list_class_name, panel_class_name }: TabsProps<TabKey>) {
  return (
    <TabsPrimitive.Root value={selected_key} onValueChange={(tab_key) => onSelect(tab_key as TabKey)} className={joinClassNames("flex min-h-0 flex-col", className)}>
      <TabsPrimitive.List aria-label={label} className={joinClassNames("flex shrink-0 gap-1 border-b border-line", list_class_name)}>
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.key}
            value={tab.key}
            className="-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink"
          >
            {tab.label}
            {tab.count !== undefined ? <span className="rounded-full bg-surface px-1.5 text-xs tabular-nums text-ink-soft">{tab.count}</span> : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) =>
        tab.key === selected_key ? (
          <TabsPrimitive.Content key={tab.key} value={tab.key} className={joinClassNames("min-h-0 flex-1 focus-visible:outline-none", panel_class_name)}>
            {tab.content}
          </TabsPrimitive.Content>
        ) : null,
      )}
    </TabsPrimitive.Root>
  );
}
