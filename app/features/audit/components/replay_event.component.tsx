import { formatCodeLabel, formatDuration } from "@/shared/format/format_values.util";

import type { ReplayEvent } from "../utils/compress_timeline_gaps.util";

import { ToolCallCard } from "./tool_call_card.component";

const SPEAKER_LABELS: Record<string, string> = { CUSTOMER: "Customer", AI: "AI specialist", STAFF: "Staff member" };

const BUBBLE_CLASS_NAMES: Record<string, string> = {
  CUSTOMER: "mr-auto rounded-bl-sm bg-surface",
  AI: "ml-auto rounded-br-sm bg-accent-soft",
  STAFF: "ml-auto rounded-br-sm bg-info-soft",
};

function formatOffset(replay_event: ReplayEvent): string {
  return formatDuration(replay_event.offset_ms / 1000);
}

function TurnBubble({ replay_event }: { replay_event: ReplayEvent }) {
  const speaker = replay_event.speaker ?? "SYSTEM";
  if (!BUBBLE_CLASS_NAMES[speaker]) {
    return <p className="text-center italic text-ink-soft">{replay_event.text}</p>;
  }
  return (
    <div className={`max-w-[70%] rounded-2xl px-5 py-3 ${BUBBLE_CLASS_NAMES[speaker]}`}>
      <p className="text-sm font-semibold text-ink-soft">
        {SPEAKER_LABELS[speaker]} · {formatOffset(replay_event)}
      </p>
      <p className="text-lg">{replay_event.text}</p>
    </div>
  );
}

function InterventionMarker({ replay_event }: { replay_event: ReplayEvent }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-warning" />
      <p className="rounded-full bg-warning-soft px-4 py-1.5 font-semibold text-warning">
        {formatCodeLabel(replay_event.intervention_type)} · {replay_event.staff_name}
        {replay_event.text ? `: “${replay_event.text}”` : ""} · {formatOffset(replay_event)}
      </p>
      <span className="h-px flex-1 bg-warning" />
    </div>
  );
}

export function ReplayEventItem({ replay_event }: { replay_event: ReplayEvent }) {
  return (
    <li className="flex animate-slide-in flex-col">
      {replay_event.kind === "TURN" ? <TurnBubble replay_event={replay_event} /> : null}
      {replay_event.kind === "TOOL" ? (
        <div className="mx-auto w-[80%]">
          <ToolCallCard tool_name={replay_event.tool_name} tool_args={replay_event.tool_args} tool_result={replay_event.tool_result} />
        </div>
      ) : null}
      {replay_event.kind === "INTERVENTION" ? <InterventionMarker replay_event={replay_event} /> : null}
    </li>
  );
}
