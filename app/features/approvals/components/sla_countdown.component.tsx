import { joinClassNames } from "@/shared/ui/join_class_names.util";

import { describeSla } from "../utils/describe_sla.util";

/** "Due in 1h 9m", amber when close, red once overdue. */
export function SlaCountdown({ sla_due_at, current_time_ms }: { sla_due_at: string | null; current_time_ms: number | null }) {
  const sla_state = describeSla(sla_due_at, current_time_ms);
  if (!sla_state) {
    return null;
  }
  const tone_class_name = sla_state.is_overdue ? "font-semibold text-accent" : sla_state.is_urgent ? "font-semibold text-warning" : "text-ink-faint";
  return <span className={joinClassNames("whitespace-nowrap text-xs tabular-nums", tone_class_name)}>{sla_state.label}</span>;
}
