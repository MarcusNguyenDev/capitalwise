import { ACTION_CODES } from '../facts/constants/action_code.constant';
import { formatCurrency } from '../shared_kernel/utils/format_currency.util';
import { buildCompletedMessage } from './completed_action_messages';
import { CASE_STATUSES } from './constants/case_status.constant';
import { ProposalOutcome } from './types/proposal_result.type';

export interface ProposalMessageContext {
  case_number: string;
  action_code: string;
  status: string;
  matched_rule_id: string;
  staff_name: string | null;
  expected_timing: string;
  facts: Record<string, unknown>;
  execution_result: Record<string, unknown> | null;
}

const UNNAMED_SPECIALIST = 'A specialist from our team';

const OUTCOMES_BY_STATUS: Record<string, ProposalOutcome> = {
  [CASE_STATUSES.AUTO_EXECUTED]: 'DONE',
  [CASE_STATUSES.EXECUTED]: 'DONE',
  [CASE_STATUSES.APPROVED]: 'DONE',
  [CASE_STATUSES.EDITED_AND_APPROVED]: 'DONE',
  [CASE_STATUSES.AUTO_DECLINED]: 'DECLINED',
  [CASE_STATUSES.REJECTED]: 'DECLINED',
  [CASE_STATUSES.ESCALATED]: 'WITH_SPECIALIST',
  [CASE_STATUSES.PENDING_APPROVAL]: 'PENDING_REVIEW',
};

export function resolveProposalOutcome(status: string): ProposalOutcome {
  return OUTCOMES_BY_STATUS[status] ?? 'PENDING_REVIEW';
}

// Why a specialist is needed, in the customer's terms, by the rule that sent
// it there: [lead-in, what the specialist will do].
const ESCALATION_REASONS: Record<string, [string | null, string]> = {
  'RC-1': ['To keep your money safe', 'to check this with you'],
  'UC-1': ['To keep your money safe', 'to check this with you'],
  'RD-1': ['To keep your money safe', 'to look into this with you'],
  'RC-2': [
    'Because your address changed recently',
    'to confirm where to send your new card',
  ],
  'RC-3': [
    'Because several cards have been replaced this year',
    'to check this with you',
  ],
  'RD-2': ['Because this could be fraud', 'to look into it with you'],
  'SR-1': ['For your security', 'to make this change with you'],
  'RF-1': ['So we can give you the right support', 'to help with this'],
  'PA-1': ['So we can give you the right support', 'to help with this'],
  'PA-2': ['So we can give you the right support', 'to help with this'],
};

const DEFAULT_ESCALATION_REASON: [string | null, string] = [null, 'to help'];

function buildSpecialistMessage(message_context: ProposalMessageContext) {
  const specialist = message_context.staff_name ?? UNNAMED_SPECIALIST;
  const { case_number, expected_timing } = message_context;
  if (message_context.action_code === ACTION_CODES.RELEASE_HELD_PAYMENT) {
    return `Your payment is safely on hold for now, and ${specialist} will speak with you in ${expected_timing}; your case number is ${case_number}.`;
  }
  const [lead_in, purpose] =
    ESCALATION_REASONS[message_context.matched_rule_id] ??
    DEFAULT_ESCALATION_REASON;
  const opening = lead_in ? `${lead_in}, ${specialist}` : specialist;
  return `${opening} will join you in ${expected_timing} ${purpose} and already has the full details; your case number is ${case_number}.`;
}

function buildDeclinedMessage(message_context: ProposalMessageContext) {
  const { action_code, case_number, facts } = message_context;
  if (message_context.status === CASE_STATUSES.REJECTED) {
    return `Our team has reviewed case ${case_number} and couldn't approve it this time.`;
  }
  if (action_code === ACTION_CODES.REFUND_FEE) {
    const fee_amount =
      typeof facts.fee_amount === 'number'
        ? `the ${formatCurrency(facts.fee_amount)} fee`
        : 'this fee';
    return `I'm sorry, I can't refund ${fee_amount}, because there have already been ${facts.refunds_last_12m} fee refunds in the last 12 months, but if you'd like, I can ask a specialist to review it.`;
  }
  if (action_code === ACTION_CODES.UNLOCK_CARD) {
    return `I can't unlock your card ending ${facts.card_last4}, because once a card is reported lost or stolen or replaced it stays blocked to keep you safe, but I can order you a replacement.`;
  }
  return `I'm sorry, I can't do that automatically, but if you'd like, I can ask a specialist to review it; your case number is ${case_number}.`;
}

function buildPendingMessage(message_context: ProposalMessageContext) {
  const specialist = message_context.staff_name ?? UNNAMED_SPECIALIST;
  const { action_code, case_number, expected_timing } = message_context;
  if (action_code === ACTION_CODES.HARDSHIP_REQUEST) {
    return `I've recorded your hardship notice as case ${case_number}, and ${specialist} will review it ${expected_timing}.`;
  }
  if (action_code === ACTION_CODES.SERVICE_REQUEST) {
    return `I've passed your request to our team as case ${case_number}, and ${specialist} will complete it and call you back ${expected_timing}.`;
  }
  return `I've sent your request to our team as case ${case_number}, and ${specialist} will review it and get back to you ${expected_timing}.`;
}

// One plain sentence (two for a card replacement, as the owner wrote it) the
// AI can say as it is: the concrete outcome, never more than the case shows.
export function buildCustomerMessage(
  message_context: ProposalMessageContext,
): string {
  switch (resolveProposalOutcome(message_context.status)) {
    case 'DONE':
      return (
        buildCompletedMessage(
          message_context.action_code,
          message_context.execution_result ?? {},
        ) ?? `That's done; your case number is ${message_context.case_number}.`
      );
    case 'DECLINED':
      return buildDeclinedMessage(message_context);
    case 'WITH_SPECIALIST':
      return buildSpecialistMessage(message_context);
    default:
      return buildPendingMessage(message_context);
  }
}
