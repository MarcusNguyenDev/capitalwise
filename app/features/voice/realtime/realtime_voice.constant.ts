/** GA Realtime API: the browser posts its SDP offer here with the ephemeral client secret. */
export const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
export const REALTIME_EVENTS_CHANNEL_LABEL = "oai-events";
export const SUPERVISOR_INSTRUCTION_PREFIX = "Supervisor instruction: ";

/** Matches the turn detection `core` mints the session with, used until the session reports its own. */
export const DEFAULT_TURN_DETECTION = {
  type: "server_vad",
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 500,
};

/** How long an AI turn waits for the customer's (slower) transcription so the transcript stays in order. */
export const CUSTOMER_TRANSCRIPT_WAIT_MS = 2500;

export const LIVE_TAKEOVER_ANNOUNCEMENT = "You're now speaking with a specialist from our team";
