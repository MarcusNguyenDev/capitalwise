export type IdentityMethod = 'KNOWLEDGE' | 'APP_PUSH';
export type IdentityLevel = 0 | 1 | 2;
export type CheckLevel = 1 | 2;

// A row of engine.identity_attempts. Never holds answers or expected values.
export interface IdentityAttempt {
  attempt_id: string;
  call_id: string;
  challenge_id: string | null;
  method: IdentityMethod;
  level: CheckLevel;
  question_kinds: string[];
  is_passed: boolean;
  resolved_customer_id: string | null;
  created_at: Date;
}

export interface NewIdentityAttempt {
  call_id: string;
  challenge_id: string | null;
  method: IdentityMethod;
  level: CheckLevel;
  question_kinds: string[];
  is_passed: boolean;
  resolved_customer_id: string | null;
}

// What a call's attempts add up to.
export interface IdentitySummary {
  // The level the caller may act at now: 0 when locked.
  identity_level: IdentityLevel;
  method: IdentityMethod | null;
  is_locked: boolean;
  failed_attempts: number;
  failed_attempts_by_level: Record<CheckLevel, number>;
  // The customer of the latest passed attempt; null when locked or unverified.
  customer_id: string | null;
}

// GET /api/identity/calls/:call_id
export interface CallIdentity {
  call_id: string;
  identity_level: IdentityLevel;
  method: IdentityMethod | null;
  is_locked: boolean;
  failed_attempts: number;
  customer_id: string | null;
  concern_case_number: string | null;
}
