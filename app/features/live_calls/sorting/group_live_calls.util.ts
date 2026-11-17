import { CALL_STATUS_LABELS } from "@/shared/status/status_wording.constant";
import type { CallStatus, LiveCall, RiskLevel } from "@/shared/types/call.type";

export interface LiveCallGroup {
  status: CallStatus;
  title: string;
  calls: LiveCall[];
}

/** Calls waiting for a person come first, then calls a person is on, then the AI's, then the ones just ended. */
const STATUS_ORDER: CallStatus[] = ["NEEDS_ATTENTION", "HUMAN_ACTIVE", "AI_ACTIVE", "ENDED"];

const RISK_RANK: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Within a group, high risk first, then the longest-running call, so rows only move when something changes. */
function compareCalls(first_call: LiveCall, second_call: LiveCall): number {
  return (
    RISK_RANK[first_call.risk_level] - RISK_RANK[second_call.risk_level] ||
    new Date(first_call.started_at).getTime() - new Date(second_call.started_at).getTime()
  );
}

export function groupLiveCalls(live_calls: LiveCall[]): LiveCallGroup[] {
  return STATUS_ORDER.map((status) => ({
    status,
    title: status === "ENDED" ? "Just ended" : CALL_STATUS_LABELS[status],
    calls: live_calls.filter((call) => call.status === status).sort(compareCalls),
  })).filter((call_group) => call_group.calls.length > 0);
}
