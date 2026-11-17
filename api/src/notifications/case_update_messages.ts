import { ACTION_CODES } from '../facts/constants/action_code.constant';
import {
  AUTO_TIER,
  ESCALATION_TIER,
} from '../policies/constants/route_tier.constant';
import { formatCurrency } from '../shared_kernel/utils/format_currency.util';
import { formatLongDate } from '../shared_kernel/utils/format_long_date.util';
import { formatSpokenDate } from '../shared_kernel/utils/format_spoken_date.util';
import {
  ARRANGEMENT_LABELS,
  DEBT_HELPLINE_TEXT,
} from './constants/notification_text.constant';
import { CaseMessageContext } from './types/notification.type';

// SMS and letter wording for case updates. Pure templates: no LLM writes to
// customers.

const AUTO_DECLINED_STATUS = 'AUTO_DECLINED';

type Result = Record<string, unknown>;

function readNumber(candidate: unknown): number {
  return typeof candidate === 'number' ? candidate : 0;
}

function readText(result: Result, key: string): string {
  return typeof result[key] === 'string' ? (result[key] as string) : '';
}

function readDate(result: Result, key: string): string {
  const iso_date = readText(result, key);
  return iso_date ? formatSpokenDate(iso_date) : 'soon';
}

function readCardLast4(message_context: CaseMessageContext): unknown {
  return (
    message_context.execution_result?.card_last4 ??
    message_context.facts.card_last4
  );
}

function buildCardLockedSms(message_context: CaseMessageContext): string {
  return `Your card ending ${readCardLast4(message_context)} has been temporarily locked. Call us any time to unlock it.`;
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

function buildDisputeSms(message_context: CaseMessageContext): string {
  const dispute = message_context.execution_result ?? {};
  const charge = `${formatCurrency(readNumber(dispute.amount))} at ${readText(dispute, 'merchant')}`;
  const credit = dispute.provisional_credit_txn_id
    ? ` and credited ${formatCurrency(readNumber(dispute.provisional_credit_amount))} while we investigate`
    : '';
  return `We've lodged your dispute for ${charge} (${message_context.case_number})${credit}. We'll tell you the outcome by ${readDate(dispute, 'expected_by')}.`;
}

function buildStatementSms(message_context: CaseMessageContext): string {
  const statement_request = message_context.execution_result ?? {};
  const statements = `Your statements for the last ${statement_request.months} month${statement_request.months === 1 ? '' : 's'}`;
  return statement_request.delivery === 'EMAIL'
    ? `${statements} have been emailed to the address we have on file.`
    : `${statements} will be posted to your address in ${readText(statement_request, 'delivery_to')} by ${readDate(statement_request, 'expected_by')}.`;
}

function buildPaymentArrangementSms(
  message_context: CaseMessageContext,
): string {
  const arrangement = message_context.execution_result ?? {};
  const account_label = String(
    arrangement.account_nickname ?? 'account',
  ).toLowerCase();
  return `Your ${arrangement.weeks}-week payment arrangement on your ${account_label} is in place until ${readDate(arrangement, 'end_on')}. Late fees are paused.`;
}

// What happened, once an action has been carried out (automatically or after
// a staff approval).
function buildExecutedSms(message_context: CaseMessageContext): string | null {
  const execution_result = message_context.execution_result ?? {};
  switch (message_context.action_code) {
    case ACTION_CODES.LOCK_CARD:
      return buildCardLockedSms(message_context);
    case ACTION_CODES.REPORT_LOST_STOLEN:
      return `Your card ending ${readCardLast4(message_context)} has been blocked permanently. If you didn't call us about it, contact us straight away.`;
    case ACTION_CODES.UNLOCK_CARD:
      return `Your card ending ${readCardLast4(message_context)} has been unlocked and is ready to use.`;
    case ACTION_CODES.ACTIVATE_CARD:
      return `Your new card ending ${readCardLast4(message_context)} is now active.`;
    case ACTION_CODES.REPLACE_CARD:
      return `Your replacement card is on its way to your address in ${readText(execution_result, 'delivery_suburb')} and should arrive by ${readDate(execution_result, 'expected_by')}. Your old card is now blocked.`;
    case ACTION_CODES.REFUND_FEE:
      return `Your ${formatCurrency(readNumber(execution_result.amount))} fee refund has been approved and credited.`;
    case ACTION_CODES.RAISE_DISPUTE:
      return buildDisputeSms(message_context);
    case ACTION_CODES.REQUEST_STATEMENT:
      return buildStatementSms(message_context);
    case ACTION_CODES.UPDATE_PREFERENCES:
      return 'Your contact preferences have been updated. If you did not ask for this, call us straight away.';
    case ACTION_CODES.PAYMENT_ARRANGEMENT:
      return buildPaymentArrangementSms(message_context);
    case ACTION_CODES.HARDSHIP_REQUEST:
      return buildArrangementSms(message_context);
    case ACTION_CODES.RELEASE_HELD_PAYMENT:
      return `Your ${formatCurrency(readNumber(execution_result.amount))} payment has been reviewed by a specialist and released.`;
    case ACTION_CODES.SERVICE_REQUEST:
      return `Your request (${message_context.case_number}) has been completed by our team.`;
    default:
      return null;
  }
}

function buildAutoDeclinedSms(message_context: CaseMessageContext): string {
  const { action_code, case_number, facts } = message_context;
  if (action_code === ACTION_CODES.REFUND_FEE) {
    return `We've looked at your request to refund the ${formatCurrency(readNumber(facts.fee_amount))} fee (${case_number}) and can't refund it this time. If you'd like a specialist to look at it again, just call us.`;
  }
  if (action_code === ACTION_CODES.UNLOCK_CARD) {
    return `Your card ending ${facts.card_last4} is blocked and can't be unlocked. Call us any time to order a replacement.`;
  }
  return `We couldn't go ahead with your request (${case_number}). If you'd like a specialist to look at it, just call us.`;
}

function buildEscalatedSms(message_context: CaseMessageContext): string | null {
  const { action_code, case_number } = message_context;
  if (action_code === ACTION_CODES.REFUND_FEE) {
    return `We've received your fee refund request (${case_number}). A specialist will speak with you about it shortly.`;
  }
  if (action_code === ACTION_CODES.RELEASE_HELD_PAYMENT) {
    const held_amount = formatCurrency(
      readNumber(message_context.facts.held_amount),
    );
    return `Your ${held_amount} payment is safely on hold while a specialist reviews it. We will never ask you to move money to keep it safe.`;
  }
  return null;
}

function buildPendingSms(message_context: CaseMessageContext): string | null {
  const { action_code, case_number } = message_context;
  switch (action_code) {
    case ACTION_CODES.REFUND_FEE:
      return `We've received your fee refund request (${case_number}). You'll hear back within 4 business hours.`;
    case ACTION_CODES.HARDSHIP_REQUEST: {
      const respond_by = message_context.response_due_on
        ? formatLongDate(message_context.response_due_on)
        : 'the end of 21 days';
      return `We've recorded your hardship notice (${case_number}). A specialist will respond by ${respond_by}. ${DEBT_HELPLINE_TEXT}`;
    }
    case ACTION_CODES.LOCK_CARD:
      return null;
    default:
      return `We've received your request (${case_number}). A member of our team will get back to you within 4 business hours.`;
  }
}

export function buildCaseCreatedSms(
  message_context: CaseMessageContext,
): string | null {
  if (message_context.status === AUTO_DECLINED_STATUS) {
    return buildAutoDeclinedSms(message_context);
  }
  if (message_context.tier === AUTO_TIER) {
    return buildExecutedSms(message_context);
  }
  if (message_context.action_code === ACTION_CODES.HARDSHIP_REQUEST) {
    return buildPendingSms(message_context);
  }
  return message_context.tier === ESCALATION_TIER
    ? buildEscalatedSms(message_context)
    : buildPendingSms(message_context);
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
    case ACTION_CODES.HUMAN_CALLBACK:
      return null;
    default:
      return `We've reviewed your request (${case_number}) and can't go ahead with it this time. Call us if you'd like to talk it through.`;
  }
}

export function buildCaseDecidedSms(
  message_context: CaseMessageContext,
): string | null {
  return message_context.is_approved
    ? buildExecutedSms(message_context)
    : buildRejectedSms(message_context);
}
