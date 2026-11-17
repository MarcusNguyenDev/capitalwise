import { formatCodeLabel, formatDuration } from "@/shared/format/format_values.util";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

import type { ReplayEvent } from "../utils/compress_timeline_gaps.util";
import { TraceToolCall } from "./trace_tool_call.component";

const SPEAKER_LABELS: Record<string, string> = { CUSTOMER: "Customer", AI: "AI specialist", STAFF: "Staff" };

const BUBBLE_CLASS_NAMES: Record<string, string> = {
  CUSTOMER: "mr-auto rounded-bl-sm bg-surface",
  AI: "ml-auto rounded-br-sm border border-line bg-white",
  STAFF: "ml-auto rounded-br-sm bg-info-soft",
};

function formatOffset(replay_event: ReplayEvent): string {
  return formatDuration(replay_event.offset_ms / 1000);
}

function TurnBubble({ replay_event }: { replay_event: ReplayEvent }) {
  const speaker = replay_event.speaker ?? "SYSTEM";
  if (!BUBBLE_CLASS_NAMES[speaker]) {
    return <p className="text-center text-sm italic text-ink-soft">{replay_event.text}</p>;
  }
  return (
    <div className={joinClassNames("max-w-[75%] rounded-xl px-3.5 py-2", BUBBLE_CLASS_NAMES[speaker])}>
      <p className="text-xs font-semibold text-ink-faint">
        {SPEAKER_LABELS[speaker]} · <span className="tabular-nums">{formatOffset(replay_event)}</span>
      </p>
      <p className="leading-snug">{replay_event.text}</p>
    </div>
  );
}

function InterventionMarker({ replay_event }: { replay_event: ReplayEvent }) {
  return (
    <p className="self-center rounded-full bg-warning-soft px-3 py-1 text-center text-xs font-semibold text-warning">
      {formatCodeLabel(replay_event.intervention_type)} · {replay_event.staff_name}
      {replay_event.text ? `: “${replay_event.text}”` : ""} · {formatOffset(replay_event)}
    </p>
  );
}

export function ReplayEventItem({ replay_event }: { replay_event: ReplayEvent }) {
  return (
    <li className="flex animate-slide-in flex-col">
      {replay_event.kind === "TURN" ? <TurnBubble replay_event={replay_event} /> : null}
      {replay_event.kind === "TOOL" ? (
        <TraceToolCall tool_name={replay_event.tool_name} tool_args={replay_event.tool_args} tool_result={replay_event.tool_result} />
      ) : null}
      {replay_event.kind === "INTERVENTION" ? <InterventionMarker replay_event={replay_event} /> : null}
    </li>
  );
}
