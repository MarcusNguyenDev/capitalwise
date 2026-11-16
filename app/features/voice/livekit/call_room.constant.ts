/** LiveKit participant identities in a call room (`call_<call_id>`), set by the tokens `core` mints. Staff join as `staff_<staff_id>`. */
export const CUSTOMER_IDENTITY = "customer";
export const AI_SPECIALIST_IDENTITY = "ai_specialist";

/** Used when `core` does not name a browser-facing LiveKit URL: the same host the page came from. */
export const DEFAULT_LIVEKIT_PORT = 7880;

/** The phone plays the AI and staff through its speakers, so the microphone must cancel that echo. */
export const MICROPHONE_CAPTURE_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;
