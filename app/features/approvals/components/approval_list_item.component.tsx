import { HeartHandshake } from "lucide-react";

import { formatCodeLabel, formatCurrency } from "@/shared/format/format_values.util";
import { RecommendationBadge } from "@/shared/status/recommendation_badge.component";
import type { EngineCase } from "@/shared/types/case.type";
import { QueueItem } from "@/shared/ui/queue_item.component";

import { readCaseAmount } from "../utils/read_case_params.util";
import { SlaCountdown } from "./sla_countdown.component";

interface ApprovalListItemProps {
  queued_case: EngineCase;
  is_selected: boolean;
  is_highlighted: boolean;
  current_time_ms: number | null;
  onOpen: (case_number: string) => void;
}

/** One case waiting for a decision: who, what, how much, what the AI recommends and when it is due. */
export function ApprovalListItem({ queued_case, is_selected, is_highlighted, current_time_ms, onOpen }: ApprovalListItemProps) {
  const case_amount = readCaseAmount(queued_case);
  return (
    <QueueItem
      item_id={queued_case.case_number}
      is_selected={is_selected}
      is_highlighted={is_highlighted}
      accent={queued_case.tier === 3 ? "attention" : null}
      onOpen={() => onOpen(queued_case.case_number)}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold">
          <span className="truncate">{queued_case.customer_name}</span>
          {queued_case.has_care_flag ? <HeartHandshake className="size-4 shrink-0 text-warning" aria-label="Care flag" /> : null}
        </span>
        <SlaCountdown sla_due_at={queued_case.sla_due_at} current_time_ms={current_time_ms} />
      </span>
      <span className="block truncate text-sm text-ink-soft">
        {formatCodeLabel(queued_case.action_code)}
        {case_amount === null ? "" : ` · ${formatCurrency(case_amount)}`}
        {queued_case.assigned_staff_name ? ` · ${queued_case.assigned_staff_name}` : ""}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <RecommendationBadge recommendation={queued_case.recommendation} confidence={queued_case.confidence} />
        <span className="font-mono text-xs text-ink-faint">{queued_case.matched_rule_id}</span>
      </span>
    </QueueItem>
  );
}
