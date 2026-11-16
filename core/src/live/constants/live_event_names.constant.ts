export const LIVE_EVENTS_CHANNEL = 'live_events';

// Events sent to socket.io clients.
export const LIVE_EVENT = {
  CALL_STARTED: 'call.started',
  CALL_UPDATED: 'call.updated',
  CALL_ENDED: 'call.ended',
  CALL_TURN: 'call.turn',
  CALL_TRANSCRIPT_DELTA: 'call.transcript_delta',
  CALL_INTERVENTION: 'call.intervention',
  CALL_COMMAND: 'call.command',
  CALL_HOLD: 'call.hold',
  SIMULATOR_STATUS: 'simulator.status',
  NOTIFICATION_UPDATED: 'notification.updated',
  DEMO_RESET: 'demo.reset',
} as const;

// Events that never leave the process (the internal event bus only).
export const INTERNAL_EVENT = {
  INTERVENTION_RECORDED: 'internal.intervention_recorded',
  CALL_ENDED: 'internal.call_ended',
  IDENTITY_PUSH_SENT: 'internal.identity_push_sent',
  // Every `call.command` (the voice agent acts on them for LIVE calls).
  CALL_COMMAND: 'internal.call_command',
} as const;
