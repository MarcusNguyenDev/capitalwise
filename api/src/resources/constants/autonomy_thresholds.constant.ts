export const MIN_AGREEMENT_PCT = 90;
export const MIN_DECIDED_CASES = 30;
export const RECENT_ROUTE_COUNT = 20;
export const PENDING_SIGN_OFF_STATUS = 'PENDING_SIGN_OFF';

// What staff have effectively been agreeing with, in plain words.
export const AUTONOMY_SUBJECTS: Record<string, string | undefined> = {
  REFUND_FEE: 'Fee refunds under $30, first request',
  HARDSHIP_REQUEST: 'Hardship requests with verified income loss',
};
