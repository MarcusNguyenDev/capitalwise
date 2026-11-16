import { formatCodeLabel, formatCurrency } from "@/shared/format/format_values.util";
import { RecommendationChip } from "@/shared/policy/recommendation_chip.component";
import type { EngineCase } from "@/shared/types/case.type";
import { CareFlagChip, TierChip } from "@/shared/ui/chip.component";

import { readCaseAmount } from "../utils/read_case_params.util";

import { SlaCountdown } from "./sla_countdown.component";

interface QueueRowProps {
  queued_case: EngineCase;
  is_selected: boolean;
  current_time_ms: number | null;
  onSelect: (case_number: string) => void;
}

export function QueueRow({ queued_case, is_selected, current_time_ms, onSelect }: QueueRowProps) {
  const case_amount = readCaseAmount(queued_case);
  return (
    <button
      type="button"
      aria-pressed={is_selected}
      className={`w-full animate-slide-in rounded-xl border px-4 py-3 text-left transition-colors ${is_selected ? "border-accent bg-accent-soft/50" : "border-line bg-white hover:bg-surface"}`}
      onClick={() => onSelect(queued_case.case_number)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-bold">{queued_case.customer_name}</span>
        <SlaCountdown sla_due_at={queued_case.sla_due_at} current_time_ms={current_time_ms} />
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-3 text-ink-soft">
        <span>
          {formatCodeLabel(queued_case.action_code)}
          {case_amount === null ? "" : ` · ${formatCurrency(case_amount)}`}
        </span>
        <span className="font-mono text-sm">{queued_case.case_number}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TierChip tier={queued_case.tier} />
        <RecommendationChip recommendation={queued_case.recommendation} confidence={queued_case.confidence} />
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-sm text-ink-soft">{queued_case.matched_rule_id}</span>
        {queued_case.has_care_flag ? <CareFlagChip /> : null}
      </div>
    </button>
  );
}
