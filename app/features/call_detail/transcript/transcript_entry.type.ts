import type { CallTurn } from "@/shared/types/call.type";

export type SpokenSpeaker = "CUSTOMER" | "AI" | "STAFF";

/** One row of the supervisor's transcript. */
export type TranscriptEntry =
  | { kind: "SPEECH"; entry_key: string; speaker: SpokenSpeaker; text: string; latency_ms: number | null; is_in_progress: boolean }
  | { kind: "TOOL"; entry_key: string; turn: CallTurn }
  | { kind: "STAFF_ONLY"; entry_key: string; text: string };

/** Text still being spoken on a live voice call, keyed by the model's item id. */
export interface InProgressLine {
  item_id: string;
  speaker: "CUSTOMER" | "AI";
  text: string;
}
