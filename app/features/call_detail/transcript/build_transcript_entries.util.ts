import type { CallTurn, Intervention } from "@/shared/types/call.type";

import type { InProgressLine, TranscriptEntry } from "./transcript_entry.type";

interface TimedEntry {
  occurred_at_ms: number;
  entry: TranscriptEntry;
}

function buildTurnEntry(turn: CallTurn): TranscriptEntry {
  const entry_key = `turn-${turn.turn_id}`;
  if (turn.tool_name) {
    return { kind: "TOOL", entry_key, turn };
  }
  if (turn.speaker === "SYSTEM") {
    return { kind: "STAFF_ONLY", entry_key, text: turn.text ?? "" };
  }
  return { kind: "SPEECH", entry_key, speaker: turn.speaker, text: turn.text ?? "", latency_ms: turn.latency_ms, is_in_progress: false };
}

function buildWhisperEntry(intervention: Intervention): TranscriptEntry {
  return {
    kind: "STAFF_ONLY",
    entry_key: `intervention-${intervention.intervention_id}`,
    text: `${intervention.staff_name} whispered: ${intervention.text ?? ""}`,
  };
}

/**
 * Merges stored turns, whispered instructions and lines still being spoken
 * into one chronological transcript. Takeovers and handbacks already arrive
 * as system turns, so only whispers are taken from the interventions.
 */
export function buildTranscriptEntries(transcript: {
  turns: CallTurn[];
  interventions: Intervention[];
  in_progress_lines: InProgressLine[];
}): TranscriptEntry[] {
  const turn_entries: TimedEntry[] = [...transcript.turns]
    .sort((first_turn, second_turn) => first_turn.seq - second_turn.seq)
    .map((turn) => ({ occurred_at_ms: new Date(turn.created_at).getTime(), entry: buildTurnEntry(turn) }));
  const whisper_entries: TimedEntry[] = transcript.interventions
    .filter((intervention) => intervention.type === "INSTRUCTION")
    .map((intervention) => ({ occurred_at_ms: new Date(intervention.created_at).getTime(), entry: buildWhisperEntry(intervention) }));
  const in_progress_entries: TranscriptEntry[] = transcript.in_progress_lines.map((in_progress_line) => ({
    kind: "SPEECH",
    entry_key: `live-${in_progress_line.item_id}`,
    speaker: in_progress_line.speaker,
    text: in_progress_line.text,
    latency_ms: null,
    is_in_progress: true,
  }));

  // Array.prototype.sort is stable, so turns with the same timestamp keep their sequence order.
  const stored_entries = [...turn_entries, ...whisper_entries]
    .sort((first_entry, second_entry) => first_entry.occurred_at_ms - second_entry.occurred_at_ms)
    .map((timed_entry) => timed_entry.entry);
  return [...stored_entries, ...in_progress_entries];
}
