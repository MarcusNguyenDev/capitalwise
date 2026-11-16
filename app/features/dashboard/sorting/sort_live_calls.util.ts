import type { LiveCall } from "@/shared/types/call.type";

/** Lower sorts first: high risk jumps to the top, then calls waiting for a human, then calls a human is on. */
function rankUrgency(call: LiveCall): number {
  if (call.status === "ENDED") {
    return 4;
  }
  if (call.risk_level === "HIGH") {
    return 0;
  }
  if (call.status === "NEEDS_ATTENTION") {
    return 1;
  }
  return call.status === "HUMAN_ACTIVE" ? 2 : 3;
}

/** Within the same urgency the longest-running call comes first, so tiles only move when their urgency changes. */
export function sortLiveCalls(live_calls: LiveCall[]): LiveCall[] {
  return [...live_calls].sort(
    (first_call, second_call) =>
      rankUrgency(first_call) - rankUrgency(second_call) || new Date(first_call.started_at).getTime() - new Date(second_call.started_at).getTime(),
  );
}
