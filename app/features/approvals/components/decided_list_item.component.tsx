import { CircleCheck, CircleX } from "lucide-react";

import { formatCodeLabel } from "@/shared/format/format_values.util";
import { QueueItem } from "@/shared/ui/queue_item.component";

import { DECISION_LABELS } from "../constants/approval_queue.constant";
import type { DecidedOutcome } from "../hooks/use_approval_queue.hook";

interface DecidedListItemProps {
  outcome: DecidedOutcome;
  is_selected: boolean;
  onOpen: (case_number: string) => void;
}

/** A case decided a moment ago, kept for a few seconds so the reviewer sees it go through. */
export function DecidedListItem({ outcome, is_selected, onOpen }: DecidedListItemProps) {
  const { decided_case } = outcome;
  const is_rejected = decided_case.decision === "REJECTED";
  const Icon = is_rejected ? CircleX : CircleCheck;
  return (
    <QueueItem item_id={decided_case.case_number} is_selected={is_selected} is_highlighted={false} onOpen={() => onOpen(decided_case.case_number)}>
      <span className="flex animate-slide-down items-center gap-2">
        <Icon className={`size-4 shrink-0 ${is_rejected ? "text-ink-soft" : "text-positive"}`} aria-hidden />
        <span className="min-w-0 flex-1 truncate font-semibold">{decided_case.customer_name}</span>
        <span className={`text-xs font-semibold ${is_rejected ? "text-ink-soft" : "text-positive"}`}>
          {DECISION_LABELS[decided_case.decision ?? ""] ?? formatCodeLabel(decided_case.status)}
        </span>
      </span>
      <span className="block truncate pl-6 text-sm text-ink-faint">
        {formatCodeLabel(decided_case.action_code)}
        {decided_case.decided_by_name ? ` · by ${decided_case.decided_by_name}` : ""}
      </span>
    </QueueItem>
  );
}
