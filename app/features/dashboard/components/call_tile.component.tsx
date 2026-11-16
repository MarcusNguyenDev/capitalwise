import { describeCallSource } from "@/features/call_detail/describe_call_source.util";
import { readActiveHold } from "@/shared/call_hold/apply_call_hold.util";
import { OnHoldChip } from "@/shared/call_hold/on_hold_chip.component";
import { formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import type { CallStatus, LiveCall, TurnSpeaker } from "@/shared/types/call.type";
import { Chip, RiskChip, SentimentChip } from "@/shared/ui/chip.component";

interface CallTileProps {
  call: LiveCall;
  is_selected: boolean;
  current_time_ms: number | null;
  onSelect: (call_id: string) => void;
}

const STATUS_LABELS: Record<CallStatus, string> = {
  AI_ACTIVE: "AI handling",
  NEEDS_ATTENTION: "Needs attention",
  HUMAN_ACTIVE: "Human on call",
  ENDED: "Ended",
};

const STATUS_BAR_CLASS_NAMES: Record<CallStatus, string> = {
  AI_ACTIVE: "bg-positive",
  NEEDS_ATTENTION: "bg-accent",
  HUMAN_ACTIVE: "bg-info",
  ENDED: "bg-ink-faint",
};

const STATUS_TEXT_CLASS_NAMES: Record<CallStatus, string> = {
  AI_ACTIVE: "text-positive",
  NEEDS_ATTENTION: "text-accent",
  HUMAN_ACTIVE: "text-info",
  ENDED: "text-ink-faint",
};

const LAST_SPEAKER_LABELS: Record<TurnSpeaker, string> = { CUSTOMER: "Customer", AI: "AI", STAFF: "Staff", SYSTEM: "System" };

function readDurationSeconds(call: LiveCall, current_time_ms: number | null): number {
  return call.status === "ENDED" || current_time_ms === null ? call.duration_seconds : secondsBetween(call.started_at, current_time_ms);
}

/** One live conversation. Its colour says who has the call; it pulses while it waits for a human. */
export function CallTile({ call, is_selected, current_time_ms, onSelect }: CallTileProps) {
  const is_ended = call.status === "ENDED";
  const needs_attention = call.status === "NEEDS_ATTENTION";
  const hold = readActiveHold(call);

  return (
    <button
      type="button"
      onClick={() => onSelect(call.call_id)}
      aria-pressed={is_selected}
      className={`relative flex animate-slide-in flex-col gap-2 overflow-hidden rounded-2xl border bg-white p-4 pl-5 text-left transition-all duration-500 hover:shadow-md ${needs_attention ? "animate-attention border-accent" : "border-line"} ${is_selected ? "ring-2 ring-ink" : ""} ${is_ended ? "opacity-50 grayscale" : ""}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${STATUS_BAR_CLASS_NAMES[call.status]}`} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold">{call.customer_name ?? "Unknown caller"}</p>
          <p className={`text-sm font-semibold ${STATUS_TEXT_CLASS_NAMES[call.status]}`}>
            {STATUS_LABELS[call.status]}
            {call.status === "HUMAN_ACTIVE" && call.assigned_staff_name ? ` · ${call.assigned_staff_name}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-lg font-semibold tabular-nums text-ink-soft">{formatDuration(readDurationSeconds(call, current_time_ms))}</span>
      </div>
      <p className="truncate font-semibold">{call.intent ?? "Listening for intent"}</p>
      <p key={call.last_line} className="line-clamp-2 min-h-[2.9rem] animate-fade-in text-ink-soft">
        {call.last_line ? (
          <>
            <span className="font-semibold text-ink-faint">{call.last_speaker ? `${LAST_SPEAKER_LABELS[call.last_speaker]}: ` : ""}</span>
            {call.last_line}
          </>
        ) : (
          "Call connecting"
        )}
      </p>
      {call.attention_reason && !is_ended ? <p className="truncate text-sm font-semibold text-accent">{call.attention_reason}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {hold ? <OnHoldChip hold={hold} current_time_ms={current_time_ms} /> : null}
        <SentimentChip sentiment={call.sentiment} />
        <RiskChip risk_level={call.risk_level} />
        <Chip>{describeCallSource(call)}</Chip>
        {call.identity_verified ? <Chip tone="positive">✓ Verified</Chip> : null}
      </div>
    </button>
  );
}
