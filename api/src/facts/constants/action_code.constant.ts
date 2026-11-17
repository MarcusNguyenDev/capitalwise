export const ACTION_CODES = {
  LOCK_CARD: 'LOCK_CARD',
  REPORT_LOST_STOLEN: 'REPORT_LOST_STOLEN',
  UNLOCK_CARD: 'UNLOCK_CARD',
  REPLACE_CARD: 'REPLACE_CARD',
  ACTIVATE_CARD: 'ACTIVATE_CARD',
  REFUND_FEE: 'REFUND_FEE',
  RAISE_DISPUTE: 'RAISE_DISPUTE',
  REQUEST_STATEMENT: 'REQUEST_STATEMENT',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  PAYMENT_ARRANGEMENT: 'PAYMENT_ARRANGEMENT',
  HARDSHIP_REQUEST: 'HARDSHIP_REQUEST',
  RELEASE_HELD_PAYMENT: 'RELEASE_HELD_PAYMENT',
  SERVICE_REQUEST: 'SERVICE_REQUEST',
  HUMAN_CALLBACK: 'HUMAN_CALLBACK',
} as const;

export const CARD_ACTION_CODES: string[] = [
  ACTION_CODES.LOCK_CARD,
  ACTION_CODES.REPORT_LOST_STOLEN,
  ACTION_CODES.UNLOCK_CARD,
  ACTION_CODES.REPLACE_CARD,
  ACTION_CODES.ACTIVATE_CARD,
];

export const UNKNOWN_CUSTOMER_ID = 'UNKNOWN';
export const UNKNOWN_CUSTOMER_NAME = 'Unknown caller';

export const ARRANGEMENT_TYPES = [
  'REPAYMENT_PAUSE',
  'REDUCED_REPAYMENTS',
  'TERM_EXTENSION',
];
export const MAX_ARRANGEMENT_MONTHS = 24;

export const LOST_STOLEN_REASONS = ['LOST', 'STOLEN'];
export const DISPUTE_REASONS = [
  'DUPLICATE',
  'UNRECOGNISED',
  'NOT_RECEIVED',
  'WRONG_AMOUNT',
];
export const STATEMENT_DELIVERIES = ['POST', 'EMAIL'];
export const MAX_STATEMENT_MONTHS = 12;
export const MAX_PAYMENT_ARRANGEMENT_WEEKS = 12;
export const PREFERENCE_NAMES = [
  'paper_statements',
  'sms_alerts',
  'large_print_letters',
] as const;

// The param that identifies WHAT an action is about, used to spot duplicates.
export const ACTION_SUBJECT_PARAMS: Record<string, string | undefined> = {
  LOCK_CARD: 'card_id',
  REPORT_LOST_STOLEN: 'card_id',
  UNLOCK_CARD: 'card_id',
  REPLACE_CARD: 'card_id',
  ACTIVATE_CARD: 'card_id',
  REFUND_FEE: 'fee_txn_id',
  RAISE_DISPUTE: 'txn_id',
  REQUEST_STATEMENT: 'account_id',
  PAYMENT_ARRANGEMENT: 'account_id',
  SERVICE_REQUEST: 'request_type',
  RELEASE_HELD_PAYMENT: 'txn_id',
};

// Each request is its own change; a repeat on the same call is applied again.
export const ACTIONS_WITHOUT_DUPLICATE_GUARD: string[] = [
  ACTION_CODES.UPDATE_PREFERENCES,
];

// Which soft signals feed which action's policy facts.
export const ACTION_SOFT_SIGNAL_FACTS: Record<
  string,
  ('vulnerability_signals' | 'scam_coaching_signals')[] | undefined
> = {
  REFUND_FEE: ['vulnerability_signals'],
  PAYMENT_ARRANGEMENT: ['vulnerability_signals'],
  UNLOCK_CARD: ['scam_coaching_signals'],
  REPLACE_CARD: ['scam_coaching_signals'],
  RAISE_DISPUTE: ['scam_coaching_signals'],
  RELEASE_HELD_PAYMENT: ['scam_coaching_signals'],
};
