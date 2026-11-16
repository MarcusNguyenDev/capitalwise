export interface ReasonCode {
  code: string;
  label: string;
}

export const APPROVE_REASON_CODES: ReasonCode[] = [
  { code: 'MEETS_POLICY', label: 'Meets policy' },
  { code: 'GOODWILL_EXCEPTION', label: 'Goodwill exception' },
  { code: 'ADJUSTED_TERMS', label: 'Approved with adjusted terms' },
  { code: 'VERIFIED_WITH_CUSTOMER', label: 'Verified with the customer' },
];

export const REJECT_REASON_CODES: ReasonCode[] = [
  { code: 'REPEAT_REQUEST', label: 'Repeat request' },
  { code: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient evidence' },
  { code: 'SUSPECTED_SCAM', label: 'Suspected scam' },
  { code: 'OUTSIDE_POLICY', label: 'Outside policy' },
];

// Recorded by the system when a specialist takes over the call.
export const HUMAN_JOINED_REASON_CODE: ReasonCode = {
  code: 'HUMAN_JOINED',
  label: 'A specialist joined the call',
};

export const SELECTABLE_REASON_CODES: string[] = [
  ...APPROVE_REASON_CODES,
  ...REJECT_REASON_CODES,
].map((reason_code) => reason_code.code);

export function describeReasonCode(code: string | null): string | null {
  if (!code) {
    return null;
  }
  const known_reason_code = [
    ...APPROVE_REASON_CODES,
    ...REJECT_REASON_CODES,
    HUMAN_JOINED_REASON_CODE,
  ].find((reason_code) => reason_code.code === code);
  return known_reason_code?.label ?? code;
}
