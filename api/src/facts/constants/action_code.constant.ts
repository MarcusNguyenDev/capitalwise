export const ACTION_CODES = {
  LOCK_CARD: 'LOCK_CARD',
  REFUND_FEE: 'REFUND_FEE',
  HARDSHIP_REQUEST: 'HARDSHIP_REQUEST',
  RELEASE_HELD_PAYMENT: 'RELEASE_HELD_PAYMENT',
  HUMAN_CALLBACK: 'HUMAN_CALLBACK',
} as const;

export const UNKNOWN_CUSTOMER_ID = 'UNKNOWN';
export const UNKNOWN_CUSTOMER_NAME = 'Unknown caller';

export const ARRANGEMENT_TYPES = [
  'REPAYMENT_PAUSE',
  'REDUCED_REPAYMENTS',
  'TERM_EXTENSION',
];
export const MAX_ARRANGEMENT_MONTHS = 24;

// The param that identifies WHAT an action is about, used to spot duplicates.
export const ACTION_SUBJECT_PARAMS: Record<string, string | undefined> = {
  LOCK_CARD: 'card_id',
  REFUND_FEE: 'fee_txn_id',
  RELEASE_HELD_PAYMENT: 'txn_id',
};

// Which soft signals feed which action's policy facts.
export const ACTION_SOFT_SIGNAL_FACTS: Record<
  string,
  ('vulnerability_signals' | 'scam_coaching_signals')[] | undefined
> = {
  REFUND_FEE: ['vulnerability_signals'],
  RELEASE_HELD_PAYMENT: ['scam_coaching_signals'],
};
