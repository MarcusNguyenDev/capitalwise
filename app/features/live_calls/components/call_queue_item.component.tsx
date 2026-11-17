import { readActiveHold } from "@/shared/call_hold/apply_call_hold.util";
import { OnHoldBadge } from "@/shared/call_hold/on_hold_badge.component";
import { formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import { CallIdentityBadge } from "@/shared/status/call_identity_badge.component";
import { CallSignalBadges } from "@/shared/status/call_signal_badges.component";
import { describeFailedAttempts } from "@/shared/status/describe_call_identity.util";
import { UNIDENTIFIED_CALLER_NAME } from "@/shared/status/status_wording.constant";
import type { LiveCall, TurnSpeaker } from "@/shared/types/call.type";
import { Badge } from "@/shared/ui/badge.component";
import { QueueItem } from "@/shared/ui/queue_item.component";

const LAST_SPEAKER_LABELS: Record<TurnSpeaker, string> = { CUSTOMER: "Customer", AI: "AI", STAFF: "Staff", SYSTEM: "System" };

interface CallQueueItemProps {
  call: LiveCall;
  is_selected: boolean;
  is_highlighted: boolean;
  current_time_ms: number | null;
  onOpen: (call_id: string) => void;
}

function readDurationSeconds(call: LiveCall, current_time_ms: number | null): number {
  return call.status === "ENDED" || current_time_ms === null ? call.duration_seconds : secondsBetween(call.started_at, current_time_ms);
}

/** One call in the queue: who, what they want, and the one reason to look at it now. */
export function CallQueueItem({ call, is_selected, is_highlighted, current_time_ms, onOpen }: CallQueueItemProps) {
  const hold = readActiveHold(call);
  const needs_attention = call.status === "NEEDS_ATTENTION";

  return (
    <QueueItem
      item_id={call.call_id}
      is_selected={is_selected}
      is_highlighted={is_highlighted}
      accent={call.risk_level === "HIGH" && call.status !== "ENDED" ? "danger" : needs_attention ? "attention" : call.status === "HUMAN_ACTIVE" ? "info" : null}
      is_muted={call.status === "ENDED"}
      onOpen={() => onOpen(call.call_id)}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate font-semibold">{call.customer_name ?? UNIDENTIFIED_CALLER_NAME}</span>
        <span className="shrink-0 text-sm tabular-nums text-ink-faint">{formatDuration(readDurationSeconds(call, current_time_ms))}</span>
      </span>
      <span className="block truncate text-sm text-ink-soft">{call.intent ?? "Listening for what they need"}</span>
      {needs_attention && call.attention_reason ? (
        <span className="mt-1 block truncate text-sm font-medium text-warning">{call.attention_reason}</span>
      ) : call.last_line ? (
        <span key={call.last_line} className="mt-1 block animate-fade-in truncate text-sm text-ink-faint">
          {call.last_speaker ? `${LAST_SPEAKER_LABELS[call.last_speaker]}: ` : ""}
          {call.last_line}
        </span>
      ) : null}
      <span className="mt-1.5 flex flex-wrap gap-1 empty:hidden">
        {hold ? <OnHoldBadge hold={hold} current_time_ms={current_time_ms} /> : null}
        {call.status === "HUMAN_ACTIVE" && call.assigned_staff_name ? <span className="text-xs font-medium text-info">{call.assigned_staff_name} has the call</span> : null}
        {call.status === "ENDED" ? null : (
          <>
            <CallIdentityBadge call={call} />
            {!call.is_identity_locked && (call.identity_failed_attempts ?? 0) > 0 ? (
              <Badge tone="attention">{describeFailedAttempts(call.identity_failed_attempts ?? 0)}</Badge>
            ) : null}
            <CallSignalBadges call={call} />
          </>
        )}
      </span>
    </QueueItem>
  );
}
