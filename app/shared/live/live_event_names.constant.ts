/** Server -> client socket events. Payload types are in shared/types. */
export const LIVE_EVENT = {
  CALL_STARTED: "call.started", // LiveCall
  CALL_UPDATED: "call.updated", // LiveCall
  CALL_ENDED: "call.ended", // LiveCall
  CALL_TURN: "call.turn", // CallTurn
  CALL_TRANSCRIPT_DELTA: "call.transcript_delta", // TranscriptDelta
  CALL_INTERVENTION: "call.intervention", // Intervention
  CALL_COMMAND: "call.command", // CallCommand (phone only)
  CALL_HOLD: "call.hold", // CallHoldEvent
  SIMULATOR_STATUS: "simulator.status", // SimulatorStatus
  CASE_CREATED: "case.created", // EngineCase
  CASE_UPDATED: "case.updated", // EngineCase
  NOTIFICATION_CREATED: "notification.created", // CustomerNotification
  NOTIFICATION_UPDATED: "notification.updated", // CustomerNotification
  STAFF_UPDATED: "staff.updated", // StaffMember
  DEMO_RESET: "demo.reset", // {}
} as const;

/** Client -> server socket messages. */
export const LIVE_MESSAGE = {
  JOIN: "join",
} as const;

export const CALL_EVENTS = [LIVE_EVENT.CALL_STARTED, LIVE_EVENT.CALL_UPDATED, LIVE_EVENT.CALL_ENDED] as const;
export const CASE_EVENTS = [LIVE_EVENT.CASE_CREATED, LIVE_EVENT.CASE_UPDATED] as const;
export const NOTIFICATION_EVENTS = [LIVE_EVENT.NOTIFICATION_CREATED, LIVE_EVENT.NOTIFICATION_UPDATED] as const;

/** Anything that can change what the audit log, KPIs or queues show. */
export const ANY_ACTIVITY_EVENTS = [
  ...CALL_EVENTS,
  ...CASE_EVENTS,
  ...NOTIFICATION_EVENTS,
  LIVE_EVENT.CALL_TURN,
  LIVE_EVENT.CALL_INTERVENTION,
  LIVE_EVENT.STAFF_UPDATED,
] as const;
