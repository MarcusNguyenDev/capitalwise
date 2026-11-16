import { describeSla } from "../utils/describe_sla.util";

export function SlaCountdown({ sla_due_at, current_time_ms }: { sla_due_at: string | null; current_time_ms: number | null }) {
  const sla_state = describeSla(sla_due_at, current_time_ms);
  if (!sla_state) {
    return null;
  }
  const tone_class_name = sla_state.is_overdue ? "text-accent" : sla_state.is_urgent ? "text-warning" : "text-ink-soft";
  return <span className={`whitespace-nowrap font-mono text-sm font-semibold tabular-nums ${tone_class_name}`}>{sla_state.label}</span>;
}
