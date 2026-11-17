"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";

import { formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import { formatActionLabel } from "@/shared/status/format_action_label.util";
import { UNIDENTIFIED_CALLER_NAME } from "@/shared/status/status_wording.constant";
import { TierBadge } from "@/shared/status/tier_badge.component";
import type { Escalation } from "@/shared/types/resources.type";
import { Badge } from "@/shared/ui/badge.component";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { QueueItem } from "@/shared/ui/queue_item.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

interface EscalationListProps {
  escalations: Escalation[];
  is_loading: boolean;
  error_message: string | null;
  selected_call_id: string | null;
  current_time_ms: number | null;
  onOpenCall: (call_id: string) => void;
  onRetry: () => void;
}

function EscalationSummary({ escalation, current_time_ms }: { escalation: Escalation; current_time_ms: number | null }) {
  const waiting_seconds = current_time_ms === null ? escalation.waiting_seconds : secondsBetween(escalation.created_at, current_time_ms);
  return (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate font-semibold">{escalation.customer_name ?? UNIDENTIFIED_CALLER_NAME}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums text-warning">waiting {formatDuration(waiting_seconds)}</span>
      </span>
      <span className="block truncate text-sm text-ink-soft">{escalation.reason ?? "Waiting for a specialist"}</span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {escalation.tier ? <TierBadge tier={escalation.tier} has_tooltip={false} /> : <Badge tone="attention">Needs attention</Badge>}
        {escalation.risk_level === "HIGH" ? <Badge tone="danger">High risk</Badge> : null}
        {escalation.action_code ? <Badge>{formatActionLabel(escalation.action_code)}</Badge> : null}
      </span>
      <span className="mt-1 block text-xs text-ink-faint">
        {escalation.assigned_staff_name ? `Routed to ${escalation.assigned_staff_name}` : "Not assigned yet"}
        {escalation.case_number ? ` · ${escalation.case_number}` : ""}
      </span>
    </>
  );
}

/** Tier 3 cases and calls waiting for a person, longest wait first. */
export function EscalationList({ escalations, is_loading, error_message, selected_call_id, current_time_ms, onOpenCall, onRetry }: EscalationListProps) {
  if (error_message) {
    return <ErrorState className="m-3" message={error_message} onRetry={onRetry} />;
  }
  if (is_loading && escalations.length === 0) {
    return <SkeletonList label="Loading escalations" />;
  }
  if (escalations.length === 0) {
    return <EmptyState icon={<CircleCheck aria-hidden />} title="Nobody is waiting for a person" description="Scam, vulnerability and “I want a person” signals land here with the specialist they were routed to." />;
  }
  return (
    <ul>
      {escalations.map((escalation) =>
        escalation.call_id ? (
          <QueueItem
            key={escalation.escalation_key}
            item_id={escalation.escalation_key}
            is_selected={escalation.call_id === selected_call_id}
            is_highlighted={false}
            accent={escalation.risk_level === "HIGH" ? "danger" : "attention"}
            onOpen={() => escalation.call_id && onOpenCall(escalation.call_id)}
          >
            <EscalationSummary escalation={escalation} current_time_ms={current_time_ms} />
          </QueueItem>
        ) : (
          <li key={escalation.escalation_key} className="relative border-b border-line">
            <Link href={`/approvals?case=${escalation.case_number}`}className="block px-4 py-3 hover:bg-canvas">
              <span className="absolute inset-y-0 left-0 w-1 bg-warning" aria-hidden />
              <EscalationSummary escalation={escalation} current_time_ms={current_time_ms} />
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
