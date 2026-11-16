import { formatCodeLabel } from "@/shared/format/format_values.util";
import { Chip } from "@/shared/ui/chip.component";

import { DECISION_LABELS } from "../constants/approval_queue.constant";
import type { DecidedOutcome } from "../hooks/use_approval_queue.hook";

import { ExecutionResultList } from "./execution_result_list.component";

/** A case that was just decided, shown for a few seconds before it leaves the queue. */
export function DecidedRow({ outcome, onSelect }: { outcome: DecidedOutcome; onSelect: (case_number: string) => void }) {
  const { decided_case, execution_result } = outcome;
  const is_rejected = decided_case.decision === "REJECTED";
  return (
    <button
      type="button"
      className={`w-full animate-slide-down rounded-xl border px-4 py-3 text-left ${is_rejected ? "border-accent bg-accent-soft" : "border-positive bg-positive-soft"}`}
      onClick={() => onSelect(decided_case.case_number)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-bold">{decided_case.customer_name}</span>
        <Chip tone={is_rejected ? "accent" : "positive"}>
          {is_rejected ? "✕" : "✓"} {DECISION_LABELS[decided_case.decision ?? ""] ?? formatCodeLabel(decided_case.status)}
        </Chip>
      </div>
      <p className="mt-0.5 text-ink-soft">
        {formatCodeLabel(decided_case.action_code)} · {decided_case.case_number}
        {decided_case.decided_by_name ? ` · by ${decided_case.decided_by_name}` : ""}
      </p>
      {execution_result ? <ExecutionResultList execution_result={execution_result} is_compact /> : null}
    </button>
  );
}
