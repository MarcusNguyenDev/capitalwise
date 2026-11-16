export const SPEAKING_MS_PER_CHARACTER = 60;
export const MIN_SPEAKING_DELAY_MS = 1_200;
export const MAX_SPEAKING_DELAY_MS = 5_000;

export const CALL_START_STAGGER_MS = 2_000;
export const TOOL_THINKING_DELAY_MS = 700;
export const IDENTITY_PUSH_APPROVAL_DELAY_MS = 2_000;
export const END_OF_CALL_PAUSE_MS = 1_500;

// Simulated "end of customer speech to first AI audio" times, so the
// dashboard's response-time KPI has realistic values without a voice model.
export const MIN_SIMULATED_LATENCY_MS = 420;
export const MAX_SIMULATED_LATENCY_MS = 800;

// "Start 5" must include the call that needs attention, so the order is fixed.
export const SIMULATION_START_ORDER = [
  'balance_query',
  'frustrated_caller',
  'card_lock',
  'supervisor_instruction',
  'confused_elderly',
  'fee_refund',
];
