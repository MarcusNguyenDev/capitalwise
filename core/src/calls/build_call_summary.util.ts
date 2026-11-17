import { readIdentityLevel } from './read_identity_level.util';
import { CallCaseSummary } from './types/call_case_summary.type';
import { CallRow } from './types/call_row.type';

const CASE_STATUS_LABELS: Record<string, string> = {
  AUTO_EXECUTED: 'completed automatically',
  AUTO_DECLINED: 'declined by policy',
  PENDING_APPROVAL: 'waiting for staff approval',
  ESCALATED: 'escalated to a specialist',
  APPROVED: 'approved',
  EDITED_AND_APPROVED: 'approved with changes',
  REJECTED: 'declined',
  EXECUTED: 'completed',
};

function describeCase(call_case: CallCaseSummary): string {
  const status_label =
    CASE_STATUS_LABELS[call_case.status] ?? call_case.status.toLowerCase();
  return `${call_case.case_number} ${call_case.action_code} (${status_label})`;
}

type SummarisedCall = Pick<
  CallRow,
  | 'intent'
  | 'identity_verified'
  | 'identity_level'
  | 'identity_method'
  | 'is_identity_locked'
  | 'customer_id'
  | 'assigned_staff_id'
  | 'status'
>;

function describeIdentity(call_row: SummarisedCall): string {
  const identity_level = readIdentityLevel(call_row);
  if (call_row.is_identity_locked) {
    return 'Identity locked after failed checks.';
  }
  if (identity_level === 0) {
    return call_row.customer_id
      ? 'Identity not confirmed.'
      : 'Caller ID not recognised; identity not confirmed.';
  }
  return call_row.identity_method === 'APP_PUSH'
    ? `Identity confirmed in the app, level ${identity_level}.`
    : `Identity confirmed by questions, level ${identity_level}.`;
}

// Deterministic end-of-call summary: intent, identity status and cases raised.
// No model is involved, so the same call always produces the same text.
export function buildCallSummary(
  call_row: SummarisedCall,
  call_cases: CallCaseSummary[],
): string {
  const intent_sentence = `${call_row.intent ?? 'General enquiry'}.`;
  const identity_sentence = describeIdentity(call_row);
  const cases_sentence =
    call_cases.length === 0
      ? 'No cases raised.'
      : `Cases raised: ${call_cases.map(describeCase).join('; ')}.`;
  const human_sentence =
    call_row.status === 'HUMAN_ACTIVE'
      ? ' A staff member joined the call.'
      : '';
  return `${intent_sentence} ${identity_sentence} ${cases_sentence}${human_sentence}`;
}
