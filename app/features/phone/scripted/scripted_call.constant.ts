/** A short, natural beat before the AI answers; it is what the response-time metric measures in scripted mode. */
export const AI_THINKING_PAUSE_MIN_MS = 380;
export const AI_THINKING_PAUSE_MAX_MS = 780;

/** The optional banking app check: the script waits while the presenter taps Approve or Deny. */
export const APP_IDENTITY_CHECK_TOOL_NAME = "send_app_identity_check";
export const IDENTITY_ANSWERS_TOOL_NAME = "submit_identity_answers";
export const CALL_INSIGHT_TOOL_NAME = "update_call_insight";

export const UNVERIFIED_CALLER_LINE =
  "I wasn't able to confirm it's you, so I can't go any further with your accounts on this call. A specialist from our team will help you, and they'll have the details of this call. Goodbye for now.";

/** After too many answers that did not match, the AI does not discuss the account; the api has already raised a fraud case. */
export const IDENTITY_LOCKED_LINE =
  "I'm sorry, I haven't been able to confirm your details, so I can't discuss the account on this call. A specialist from our team will help you, and they'll have the details of this call. Thank you for your patience.";
