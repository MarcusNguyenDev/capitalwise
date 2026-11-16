import { formatLongDuration } from "@/shared/format/format_values.util";

import { SLA_URGENT_SECONDS } from "../constants/approval_queue.constant";

export interface SlaState {
  label: string;
  is_overdue: boolean;
  is_urgent: boolean;
}

export function describeSla(sla_due_at: string | null, current_time_ms: number | null): SlaState | null {
  if (!sla_due_at || current_time_ms === null) {
    return null;
  }
  const remaining_seconds = Math.round((new Date(sla_due_at).getTime() - current_time_ms) / 1000);
  if (remaining_seconds < 0) {
    return { label: `Overdue by ${formatLongDuration(-remaining_seconds)}`, is_overdue: true, is_urgent: true };
  }
  return {
    label: `Due in ${formatLongDuration(remaining_seconds)}`,
    is_overdue: false,
    is_urgent: remaining_seconds <= SLA_URGENT_SECONDS,
  };
}
