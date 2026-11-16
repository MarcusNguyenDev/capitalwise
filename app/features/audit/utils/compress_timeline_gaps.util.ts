import type { CallTimelineEvent } from "@/shared/types/case.type";

import { MAX_REPLAY_GAP_MS } from "../constants/replay.constant";

export interface ReplayEvent extends CallTimelineEvent {
  replay_key: string;
  replay_offset_ms: number;
}

/** Keeps the call's real pacing but caps long silences (for example waiting for a supervisor). */
export function compressTimelineGaps(timeline_events: CallTimelineEvent[]): ReplayEvent[] {
  let previous_offset_ms = 0;
  let replay_offset_ms = 0;
  return timeline_events.map((timeline_event, event_index) => {
    replay_offset_ms += Math.min(MAX_REPLAY_GAP_MS, Math.max(0, timeline_event.offset_ms - previous_offset_ms));
    previous_offset_ms = timeline_event.offset_ms;
    return { ...timeline_event, replay_key: `${event_index}:${timeline_event.created_at}`, replay_offset_ms };
  });
}
