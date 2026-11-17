export const IDENTITY_LEVELS = {
  NONE: 0,
  BASIC: 1,
  ENHANCED: 2,
} as const;

export const IDENTITY_METHODS = {
  KNOWLEDGE: 'KNOWLEDGE',
  APP_PUSH: 'APP_PUSH',
} as const;

// Two failed attempts at the same level on one call lock identity checks for
// the rest of the call and raise a fraud case.
export const MAX_FAILED_ATTEMPTS_PER_LEVEL = 2;

// The soft signal on the fraud case raised by a lockout.
export const IDENTITY_CHECK_FAILED_SIGNAL = 'IDENTITY_CHECK_FAILED';
