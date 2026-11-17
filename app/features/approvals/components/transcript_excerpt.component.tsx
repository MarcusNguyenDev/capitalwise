import { formatClockTime } from "@/shared/format/format_values.util";
import type { CallTurn } from "@/shared/types/call.type";

const SPEAKER_LABELS: Record<string, string> = { CUSTOMER: "Customer", AI: "AI specialist", STAFF: "Staff", SYSTEM: "System" };

export function TranscriptExcerpt({ transcript_turns }: { transcript_turns: CallTurn[] }) {
  if (transcript_turns.length === 0) {
    return <p className="text-sm text-ink-faint">No call transcript is linked to this case.</p>;
  }
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {transcript_turns.map((turn) => (
        <li key={turn.turn_id} className="grid grid-cols-[6.5rem_1fr_auto] gap-3">
          <span className={turn.speaker === "CUSTOMER" ? "font-semibold" : "text-ink-soft"}>{SPEAKER_LABELS[turn.speaker] ?? turn.speaker}</span>
          <span className={turn.speaker === "SYSTEM" ? "italic text-ink-soft" : ""}>{turn.text}</span>
          <span className="text-xs tabular-nums text-ink-faint">{formatClockTime(turn.created_at)}</span>
        </li>
      ))}
    </ol>
  );
}
