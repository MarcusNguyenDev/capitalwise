import { ACTION_CODES } from '../facts/constants/action_code.constant';
import {
  AUTO_TIER,
  ESCALATION_TIER,
} from '../policies/constants/route_tier.constant';
import { formatCurrency } from '../shared_kernel/utils/format_currency.util';
import { formatLongDate } from '../shared_kernel/utils/format_long_date.util';
import {
  ARRANGEMENT_LABELS,
  DEBT_HELPLINE_TEXT,
} from './constants/notification_text.constant';
import { CaseMessageContext } from './types/notification.type';

// SMS wording for case updates. Pure templates: no LLM writes to customers.

function readNumber(candidate: unknown): number {
  return typeof candidate === 'number' ? candidate : 0;
}

function buildCardLockedSms(message_context: CaseMessageContext): string {
  const card_last4 =
    message_context.execution_result?.card_last4 ??
    message_context.facts.card_last4;
  return `Your card ending ${card_last4} has been temporarily locked. You can unlock it any time in the app.`;
}

function buildArrangementSms(message_context: CaseMessageContext): string {
  const arrangement = message_context.execution_result ?? {};
  const arrangement_label =
    ARRANGEMENT_LABELS[String(arrangement.arrangement_type)] ?? 'arrangement';
  const account_label = String(
    arrangement.account_nickname ?? 'loan',
  ).toLowerCase();
  return `Your hardship request is approved: a ${arrangement.months}-month ${arrangement_label} on your ${account_label} from ${formatLongDate(String(arrangement.start_on))}. We'll write to confirm.`;
}

export function buildCaseCreatedSms(
  message_context: CaseMessageContext,
): string | null {
  const { action_code, case_number, tier } = message_context;
  if (action_code === ACTION_CODES.LOCK_CARD) {
    return tier === AUTO_TIER ? buildCardLockedSms(message_context) : null;
  }
  if (action_code === ACTION_CODES.REFUND_FEE) {
    return tier === ESCALATION_TIER
      ? `We've received your fee refund request (${case_number}). A specialist will speak with you about it shortly.`
      : `We've received your fee refund request (${case_number}). You'll hear back within 4 business hours.`;
  }
  if (action_code === ACTION_CODES.HARDSHIP_REQUEST) {
    const respond_by = message_context.response_due_on
      ? formatLongDate(message_context.response_due_on)
      : 'the end of 21 days';
    return `We've recorded your hardship notice (${case_number}). A specialist will respond by ${respond_by}. ${DEBT_HELPLINE_TEXT}`;
  }
  if (action_code === ACTION_CODES.RELEASE_HELD_PAYMENT) {
    const held_amount = formatCurrency(
      readNumber(message_context.facts.held_amount),
    );
    return `Your ${held_amount} payment is safely on hold while a specialist reviews it. We will never ask you to move money to keep it safe.`;
  }
  return null;
}

function buildApprovedSms(message_context: CaseMessageContext): string | null {
  const execution_result = message_context.execution_result ?? {};
  switch (message_context.action_code) {
    case ACTION_CODES.LOCK_CARD:
      return buildCardLockedSms(message_context);
    case ACTION_CODES.REFUND_FEE:
      return `Your ${formatCurrency(readNumber(execution_result.amount))} fee refund has been approved and credited.`;
    case ACTION_CODES.HARDSHIP_REQUEST:
      return buildArrangementSms(message_context);
    case ACTION_CODES.RELEASE_HELD_PAYMENT:
      return `Your ${formatCurrency(readNumber(execution_result.amount))} payment has been reviewed by a specialist and released.`;
    default:
      return null;
  }
}

function buildRejectedSms(message_context: CaseMessageContext): string | null {
  const { action_code, case_number } = message_context;
  switch (action_code) {
    case ACTION_CODES.REFUND_FEE:
      return `We've reviewed your fee refund request (${case_number}) and can't refund it this time. Reply or call us if you'd like to talk it through.`;
    case ACTION_CODES.HARDSHIP_REQUEST:
      return `We've reviewed your hardship request (${case_number}) and can't offer that arrangement right now. A specialist will call you to talk through other options. ${DEBT_HELPLINE_TEXT}`;
    case ACTION_CODES.RELEASE_HELD_PAYMENT:
      return `Your ${formatCurrency(readNumber(message_context.facts.held_amount))} payment has been stopped and the money has not left your account. We will never ask you to move money to keep it safe.`;
    default:
      return null;
  }
}

export function buildCaseDecidedSms(
  message_context: CaseMessageContext,
): string | null {
  return message_context.is_approved
    ? buildApprovedSms(message_context)
    : buildRejectedSms(message_context);
}
