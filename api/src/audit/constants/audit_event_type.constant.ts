export const AUDIT_EVENT_TYPES = {
  POLICY_EVALUATED: 'POLICY_EVALUATED',
  IDENTITY_VERIFIED: 'IDENTITY_VERIFIED',
  // Knowledge checks. Details never contain answers or expected values.
  IDENTITY_CHECK_STARTED: 'IDENTITY_CHECK_STARTED',
  IDENTITY_CHECK_PASSED: 'IDENTITY_CHECK_PASSED',
  IDENTITY_CHECK_FAILED: 'IDENTITY_CHECK_FAILED',
  IDENTITY_LOCKED: 'IDENTITY_LOCKED',
  ACTION_EXECUTED: 'ACTION_EXECUTED',
  AUTONOMY_PROPOSED: 'AUTONOMY_PROPOSED',
  AUTONOMY_SIGNED_OFF: 'AUTONOMY_SIGNED_OFF',
  STAFF_STATUS_CHANGED: 'STAFF_STATUS_CHANGED',
  DEMO_RESET: 'DEMO_RESET',
} as const;

// The deterministic policy engine decides, so it is the recorded actor of
// POLICY_EVALUATED (matching the seeded history).
export const POLICY_ENGINE_ACTOR = {
  actor_type: 'SYSTEM',
  actor_id: 'policy-engine',
} as const;

// Identity outcomes are decided by the api's matching, not by the AI.
export const IDENTITY_CHECK_ACTOR = {
  actor_type: 'SYSTEM',
  actor_id: 'identity-check',
} as const;

export const DEFAULT_AUDIT_LIMIT = 100;
export const MAX_AUDIT_LIMIT = 500;
