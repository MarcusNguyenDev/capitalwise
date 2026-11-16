import type { EngineCase } from "@/shared/types/case.type";

const LOWEST_PRIORITY = 99;

function readSlaTime(queued_case: EngineCase): number {
  return queued_case.sla_due_at ? new Date(queued_case.sla_due_at).getTime() : Number.MAX_SAFE_INTEGER;
}

/** Most urgent first: priority, then the nearest SLA, then the oldest case. */
export function sortApprovalQueue(queued_cases: EngineCase[]): EngineCase[] {
  return [...queued_cases].sort(
    (first_case, second_case) =>
      (first_case.priority ?? LOWEST_PRIORITY) - (second_case.priority ?? LOWEST_PRIORITY) ||
      readSlaTime(first_case) - readSlaTime(second_case) ||
      first_case.created_at.localeCompare(second_case.created_at),
  );
}
