export const CASE_STATUSES = {
  AUTO_EXECUTED: 'AUTO_EXECUTED',
  // The policy declined on the spot (route AUTO, recommend DECLINE). Nothing
  // is executed; the customer can ask for a specialist review.
  AUTO_DECLINED: 'AUTO_DECLINED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ESCALATED: 'ESCALATED',
  APPROVED: 'APPROVED',
  EDITED_AND_APPROVED: 'EDITED_AND_APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
} as const;

// Waiting on a human decision.
export const UNDECIDED_STATUSES: string[] = [
  CASE_STATUSES.PENDING_APPROVAL,
  CASE_STATUSES.ESCALATED,
];

// A repeat proposal on the same call returns one of these instead of a duplicate.
export const DUPLICATE_GUARD_STATUSES: string[] = [
  ...UNDECIDED_STATUSES,
  CASE_STATUSES.AUTO_EXECUTED,
  CASE_STATUSES.AUTO_DECLINED,
];

export const EXECUTED_STATUSES: string[] = [
  CASE_STATUSES.AUTO_EXECUTED,
  CASE_STATUSES.EXECUTED,
];

export const DECLINED_STATUSES: string[] = [
  CASE_STATUSES.AUTO_DECLINED,
  CASE_STATUSES.REJECTED,
];

export const DEFAULT_CASE_LIMIT = 50;
export const MAX_CASE_LIMIT = 200;
export const UNKNOWN_AGENT_VERSION = 'unknown';
