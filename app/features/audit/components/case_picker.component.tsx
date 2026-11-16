"use client";

import { useState } from "react";

import { formatCodeLabel, formatDateTime } from "@/shared/format/format_values.util";
import type { EngineCase } from "@/shared/types/case.type";
import { TierChip } from "@/shared/ui/chip.component";

interface CasePickerProps {
  cases: EngineCase[];
  selected_case_number: string | null;
  onSelect: (case_number: string) => void;
}

function matchesSearch(engine_case: EngineCase, search_text: string): boolean {
  const searchable_text = `${engine_case.case_number} ${engine_case.customer_name} ${engine_case.action_code} ${engine_case.matched_rule_id}`;
  return searchable_text.toLowerCase().includes(search_text.trim().toLowerCase());
}

export function CasePicker({ cases, selected_case_number, onSelect }: CasePickerProps) {
  const [search_text, setSearchText] = useState("");
  const matching_cases = cases.filter((engine_case) => matchesSearch(engine_case, search_text));

  return (
    <div>
      <input
        type="search"
        className="mb-3 w-full rounded-lg border border-line bg-white px-3 py-2"
        placeholder="Find a case, customer or rule"
        value={search_text}
        onChange={(change_event) => setSearchText(change_event.target.value)}
      />
      <ul className="max-h-[calc(100vh-20rem)] space-y-1.5 overflow-y-auto pr-1">
        {matching_cases.map((engine_case) => {
          const is_selected = engine_case.case_number === selected_case_number;
          return (
            <li key={engine_case.case_number}>
              <button
                type="button"
                aria-pressed={is_selected}
                className={`w-full rounded-xl border px-3 py-2 text-left ${is_selected ? "border-accent bg-accent-soft/50" : "border-line bg-white hover:bg-surface"}`}
                onClick={() => onSelect(engine_case.case_number)}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{engine_case.customer_name}</span>
                  <span className="font-mono text-sm text-ink-soft">{engine_case.case_number}</span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2 text-sm text-ink-soft">
                  <span>
                    {formatCodeLabel(engine_case.action_code)} · {engine_case.matched_rule_id} · {formatCodeLabel(engine_case.status)}
                  </span>
                  <span>{formatDateTime(engine_case.created_at)}</span>
                </span>
                <span className="mt-1 block">
                  <TierChip tier={engine_case.tier} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
