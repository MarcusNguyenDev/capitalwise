export const REPLAY_SPEED = 4;
export const REPLAY_TICK_MS = 100;

/** Silences longer than this (in call time) are shortened so a replay never sits idle. */
export const MAX_REPLAY_GAP_MS = 8000;

/** Call time left after the last event so the final line can be read before the replay stops. */
export const REPLAY_TAIL_MS = 2000;
