// No customer audio this long after the agent joined: the call is ended.
export const CUSTOMER_JOIN_TIMEOUT_MS = 30_000;

// The customer left the room and did not come back: the call is ended.
export const CUSTOMER_RECONNECT_GRACE_MS = 10_000;

// Model calls per customer turn that may end in tool calls before the
// agent gives up with a fallback line. Chat models often call one tool per
// round, and an ordinary lookup already takes four (insight, identity push,
// overview, transactions), so the limit leaves room for the action itself.
// A customer message that arrives mid-turn starts a fresh budget.
export const MAX_TOOL_ROUNDS = 6;

// How often the soft hold tone may repeat between hold lines.
export const HOLD_TONE_INTERVAL_MS = 3_000;

// The caller's audio stopped arriving mid-utterance (a muted or dropped
// track): the utterance is closed as if the caller had gone quiet.
export const CALLER_AUDIO_STALL_MS = 1_000;
