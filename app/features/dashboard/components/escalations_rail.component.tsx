"use client";

import { fetchEscalations } from "@/shared/api_client/engine_api.client";
import { formatCodeLabel, formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { CALL_EVENTS, CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { Escalation } from "@/shared/types/resources.type";
import { Chip, RiskChip, TierChip } from "@/shared/ui/chip.component";
import { ErrorState, SectionHeading } from "@/shared/ui/surface.component";

const ESCALATION_REFRESH_EVENTS = [...CALL_EVENTS, ...CASE_EVENTS] as const;

interface EscalationItemProps {
  escalation: Escalation;
  current_time_ms: number | null;
  is_selected: boolean;
  onOpenCall: (call_id: string) => void;
}

function EscalationItem({ escalation, current_time_ms, is_selected, onOpenCall }: EscalationItemProps) {
  const waiting_seconds = current_time_ms === null ? escalation.waiting_seconds : secondsBetween(escalation.created_at, current_time_ms);
  const call_id = escalation.call_id;

  return (
    <li>
      <button
        type="button"
        disabled={!call_id}
        onClick={() => call_id && onOpenCall(call_id)}
        className={`flex w-full animate-slide-in flex-col gap-1.5 rounded-xl border bg-white p-3.5 text-left transition-shadow hover:shadow-md disabled:cursor-default ${is_selected ? "border-ink ring-1 ring-ink" : "border-line"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-lg font-bold">{escalation.customer_name ?? "Unknown caller"}</span>
          <span className="shrink-0 rounded-lg bg-accent-soft px-2 py-0.5 font-semibold tabular-nums text-accent" title="Time waiting">
            {formatDuration(waiting_seconds)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {escalation.tier ? <TierChip tier={escalation.tier} /> : <Chip tone="accent">Needs attention</Chip>}
          {escalation.risk_level === "HIGH" ? <RiskChip risk_level="HIGH" /> : null}
          {escalation.action_code ? <Chip>{formatCodeLabel(escalation.action_code)}</Chip> : null}
        </div>
        <p className="text-ink-soft">{escalation.reason ?? "Waiting for a specialist"}</p>
        <p className="text-sm">
          {escalation.assigned_staff_name ? (
            <>
              Routed to <span className="font-semibold">{escalation.assigned_staff_name}</span>
            </>
          ) : (
            <span className="text-ink-faint">Not assigned yet</span>
          )}
          {escalation.case_number ? <span className="block font-mono text-ink-faint">{escalation.case_number}</span> : null}
        </p>
      </button>
    </li>
  );
}

interface EscalationsRailProps {
  selected_call_id: string | null;
  onOpenCall: (call_id: string) => void;
}

/** Tier 3 cases and calls waiting for a person, longest wait first. Asking for a human gets you a human. */
export function EscalationsRail({ selected_call_id, onOpenCall }: EscalationsRailProps) {
  const escalations_query = useLiveQuery(fetchEscalations, ESCALATION_REFRESH_EVENTS);
  const current_time_ms = useCurrentTime();
  const escalations = escalations_query.data ?? [];

  return (
    <aside className="max-h-[calc(100vh-21.5rem)] min-h-[20rem] min-w-0 overflow-y-auto rounded-2xl border border-line bg-surface p-4">
      <SectionHeading title="Escalations" description="Routed to a specialist with full context." />
      {escalations_query.error_message ? <ErrorState message={escalations_query.error_message} /> : null}
      {escalations.length === 0 && !escalations_query.error_message ? (
        <p className="rounded-xl border border-dashed border-line bg-white px-4 py-8 text-center text-ink-faint">
          {escalations_query.is_loading ? "Loading" : "Nothing is waiting for a person"}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2.5">
        {escalations.map((escalation) => (
          <EscalationItem
            key={escalation.escalation_key}
            escalation={escalation}
            current_time_ms={current_time_ms}
            is_selected={escalation.call_id !== null && escalation.call_id === selected_call_id}
            onOpenCall={onOpenCall}
          />
        ))}
      </ul>
    </aside>
  );
}
