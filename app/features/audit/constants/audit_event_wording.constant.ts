/** Plain names for audit events whose code alone does not read well. Unlisted events read as their code. */
export const AUDIT_EVENT_LABELS: Record<string, string> = {
  IDENTITY_CHECK_STARTED: "Identity check started",
  IDENTITY_CHECK_PASSED: "Identity check passed",
  IDENTITY_CHECK_FAILED: "Identity check failed",
  IDENTITY_LOCKED: "Identity locked after failed checks",
  IDENTITY_VERIFIED: "Identity confirmed",
};

/** How the caller proved who they are, as written into `IDENTITY_VERIFIED` detail. */
export const IDENTITY_METHOD_PHRASES: Record<string, string> = {
  KNOWLEDGE: "by questions",
  APP_PUSH: "in app",
  CALLER_ID_PLUS_APP_PUSH: "in app",
};

/** How a passed level 1 check found the customer, when it is worth saying (`IDENTITY_CHECK_PASSED` detail.resolution). */
export const IDENTITY_RESOLUTION_PHRASES: Record<string, string> = {
  SOLE_MATCH: "number not on file, answers matched one customer",
};

/** Events whose detail carries the identity level the check was for. */
export const LEVELLED_IDENTITY_EVENTS: readonly string[] = ["IDENTITY_CHECK_STARTED", "IDENTITY_CHECK_PASSED", "IDENTITY_CHECK_FAILED", "IDENTITY_VERIFIED"];
