import type { CallHold, CallHoldEvent, LiveCall } from "@/shared/types/call.type";

/** A `call.hold` event can arrive before the `call.updated` that carries it, so it is applied to the call directly. */
export function applyCallHold(call: LiveCall, hold_event: CallHoldEvent): LiveCall {
  const hold: CallHold = {
    is_on_hold: hold_event.is_on_hold,
    reason: hold_event.reason,
    tool_name: hold_event.tool_name,
    started_at: hold_event.started_at,
  };
  return { ...call, metrics: { ...call.metrics, hold } };
}

/** The hold in progress, or null when the caller is not on hold (an ended call never is). */
export function readActiveHold(call: Pick<LiveCall, "status" | "metrics">): CallHold | null {
  const hold = call.metrics?.hold;
  return hold?.is_on_hold && call.status !== "ENDED" ? hold : null;
}
