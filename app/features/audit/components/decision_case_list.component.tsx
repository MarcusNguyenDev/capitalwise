"use client";

import { Search } from "lucide-react";

import { formatCodeLabel, formatDateTime } from "@/shared/format/format_values.util";
import { CASE_STATUS_LABELS } from "@/shared/status/status_wording.constant";
import type { EngineCase } from "@/shared/types/case.type";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { QueueItem } from "@/shared/ui/queue_item.component";

interface DecisionCaseListProps {
  cases: EngineCase[];
  list_element_id: string;
  search_text: string;
  selected_case_number: string | null;
  highlighted_case_number: string | null;
  onSearch: (search_text: string) => void;
  onOpen: (case_number: string) => void;
}

/** Search narrows by customer, case number, action or rule. */
export function DecisionCaseList({ cases, list_element_id, search_text, selected_case_number, highlighted_case_number, onSearch, onOpen }: DecisionCaseListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line p-3">
        <label className="relative block">
          <span className="sr-only">Find a case</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            className="h-9 w-full rounded-md border border-line-strong bg-white pl-8 pr-3 text-sm placeholder:text-ink-faint"
            placeholder="Customer, case, action or rule"
            value={search_text}
            onChange={(change_event) => onSearch(change_event.target.value)}
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {cases.length === 0 ? <EmptyState title="No cases match" description="Try a customer's name or a case number." /> : null}
        <ul id={list_element_id}>
          {cases.map((engine_case) => (
            <QueueItem
              key={engine_case.case_number}
              item_id={engine_case.case_number}
              is_selected={engine_case.case_number === selected_case_number}
              is_highlighted={engine_case.case_number === highlighted_case_number}
              onOpen={() => onOpen(engine_case.case_number)}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold">{engine_case.customer_name}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink-faint">{formatDateTime(engine_case.created_at)}</span>
              </span>
              <span className="block truncate text-sm text-ink-soft">
                {formatCodeLabel(engine_case.action_code)} · {CASE_STATUS_LABELS[engine_case.status] ?? engine_case.status}
              </span>
              <span className="block text-xs text-ink-faint">
                Tier {engine_case.tier} · rule <span className="font-mono">{engine_case.matched_rule_id}</span> · {engine_case.case_number}
              </span>
            </QueueItem>
          ))}
        </ul>
      </div>
    </div>
  );
}
