import { ACTION_CODES } from '../facts/constants/action_code.constant';
import { formatSpokenDate } from '../shared_kernel/utils/format_spoken_date.util';
import { formatCurrency } from '../shared_kernel/utils/format_currency.util';

// What the AI says once an action has really been carried out. Built only
// from the stored execution result, so it states exactly what happened.

type ExecutionResult = Record<string, unknown>;

function readText(execution_result: ExecutionResult, key: string): string {
  const value = execution_result[key];
  return typeof value === 'string' ? value : '';
}

function readAmount(execution_result: ExecutionResult, key: string): string {
  const value = execution_result[key];
  return formatCurrency(typeof value === 'number' ? value : 0);
}

function readSpokenDate(execution_result: ExecutionResult, key: string) {
  const value = readText(execution_result, key);
  return value ? formatSpokenDate(value) : 'soon';
}

// "card ending 4821", or "debit card" when the digits were withheld from a
// caller confirmed only to level 1.
function describeCard(execution_result: ExecutionResult): string {
  const card_last4 = readText(execution_result, 'card_last4');
  if (card_last4) {
    return `card ending ${card_last4}`;
  }
  const card_type = readText(execution_result, 'card_type').toLowerCase();
  return card_type ? `${card_type} card` : 'card';
}

function describeAccount(execution_result: ExecutionResult): string {
  const nickname = readText(execution_result, 'account_nickname');
  return nickname ? `${nickname.toLowerCase()} account` : 'account';
}

function describeStatementMonths(months: unknown): string {
  return months === 1
    ? 'the last month of statements'
    : `${months} months of statements`;
}

const PREFERENCE_PHRASES: Record<string, [string, string]> = {
  paper_statements: [
    "you'll get paper statements in the post",
    "you won't get paper statements",
  ],
  sms_alerts: ["you'll get SMS alerts", 'SMS alerts are off'],
  large_print_letters: [
    'our letters will come in large print',
    'our letters will come in standard print',
  ],
};

function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) {
    return phrases.join('');
  }
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
}

function describePreferenceChanges(execution_result: ExecutionResult): string {
  const changes = (execution_result.changed ?? {}) as Record<string, boolean>;
  const phrases = Object.entries(changes)
    .filter(([preference_name]) => preference_name in PREFERENCE_PHRASES)
    .map(([preference_name, is_on]) =>
      is_on
        ? PREFERENCE_PHRASES[preference_name][0]
        : PREFERENCE_PHRASES[preference_name][1],
    );
  return `Done: from now on ${joinPhrases(phrases)}.`;
}

function describeStatementRequest(execution_result: ExecutionResult): string {
  const large_print = execution_result.is_large_print ? ' in large print' : '';
  const statements = `I've ordered ${describeStatementMonths(execution_result.months)} for your ${describeAccount(execution_result)}${large_print}`;
  return execution_result.delivery === 'EMAIL'
    ? `${statements}, and they'll be emailed today to the address we have on file.`
    : `${statements}, and they'll be posted to your address in ${readText(execution_result, 'delivery_to')} by ${readSpokenDate(execution_result, 'expected_by')}.`;
}

function describeDispute(execution_result: ExecutionResult): string {
  const charge = `the ${readAmount(execution_result, 'amount')} charge from ${readText(execution_result, 'merchant')}`;
  const outcome_date = readSpokenDate(execution_result, 'expected_by');
  return execution_result.provisional_credit_txn_id
    ? `I've lodged a dispute for ${charge} and put ${readAmount(execution_result, 'provisional_credit_amount')} back in your account while we investigate, and we'll let you know the outcome by ${outcome_date}.`
    : `I've lodged a dispute for ${charge}, and we'll investigate and let you know the outcome by ${outcome_date}.`;
}

function describeArrangement(execution_result: ExecutionResult): string {
  const weekly_amount =
    typeof execution_result.weekly_amount === 'number'
      ? ` of ${formatCurrency(execution_result.weekly_amount)} a week`
      : '';
  return `I've set up a ${execution_result.weeks}-week payment arrangement on your ${describeAccount(execution_result)}${weekly_amount}, from today until ${readSpokenDate(execution_result, 'end_on')}, and late fees are paused while it's in place.`;
}

export function buildCompletedMessage(
  action_code: string,
  execution_result: ExecutionResult,
): string | null {
  const card = describeCard(execution_result);
  switch (action_code) {
    case ACTION_CODES.LOCK_CARD:
      return `Your ${card} is now temporarily locked, so nobody can use it, and we can unlock it whenever you're ready.`;
    case ACTION_CODES.REPORT_LOST_STOLEN:
      return `I've blocked your ${card} for good, so nobody can use it, and I can order you a replacement whenever you're ready.`;
    case ACTION_CODES.UNLOCK_CARD:
      return `Your ${card} is unlocked and ready to use again.`;
    case ACTION_CODES.ACTIVATE_CARD:
      return `Your new ${card} is now active and ready to use.`;
    case ACTION_CODES.REPLACE_CARD:
      return `I've ordered a replacement card. It will arrive at your address in ${readText(execution_result, 'delivery_suburb')} by ${readSpokenDate(execution_result, 'expected_by')}, and your old card is now blocked.`;
    case ACTION_CODES.REFUND_FEE:
      return `I've refunded the ${readAmount(execution_result, 'amount')} ${readText(execution_result, 'fee_description').toLowerCase() || 'fee'}, and it's back in your ${describeAccount(execution_result)} now.`;
    case ACTION_CODES.RAISE_DISPUTE:
      return describeDispute(execution_result);
    case ACTION_CODES.REQUEST_STATEMENT:
      return describeStatementRequest(execution_result);
    case ACTION_CODES.UPDATE_PREFERENCES:
      return describePreferenceChanges(execution_result);
    case ACTION_CODES.PAYMENT_ARRANGEMENT:
      return describeArrangement(execution_result);
    default:
      return null;
  }
}
