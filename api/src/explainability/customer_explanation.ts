import { CaseExplanationRow } from '../cases/types/case_record.type';
import { ACTION_CODES } from '../facts/constants/action_code.constant';
import {
  AUTO_TIER,
  ESCALATION_TIER,
} from '../policies/constants/route_tier.constant';
import { formatCurrency } from '../shared_kernel/utils/format_currency.util';
import { formatLongDate } from '../shared_kernel/utils/format_long_date.util';

// "Explain to customer": a deterministic plain-English account of a decision,
// built only from the stored case. No LLM is involved, so it cannot drift
// from what actually happened.

type Facts = Record<string, unknown>;

const AUTO_DECLINED_STATUS = 'AUTO_DECLINED';

function readAmount(facts: Facts, fact: string): string {
  return formatCurrency(
    typeof facts[fact] === 'number' ? (facts[fact] as number) : 0,
  );
}

function describeCard(facts: Facts): string {
  return facts.card_last4 ? ` ending ${facts.card_last4}` : '';
}

const REQUEST_DESCRIPTIONS: Record<string, (facts: Facts) => string> = {
  [ACTION_CODES.LOCK_CARD]: (facts) =>
    `you asked us to lock your card${describeCard(facts)}.`,
  [ACTION_CODES.REPORT_LOST_STOLEN]: (facts) =>
    `you told us your card${describeCard(facts)} was ${String(facts.report_reason ?? 'lost').toLowerCase()}.`,
  [ACTION_CODES.UNLOCK_CARD]: (facts) =>
    `you asked us to unlock your card${describeCard(facts)}.`,
  [ACTION_CODES.REPLACE_CARD]: (facts) =>
    `you asked for a replacement for your card${describeCard(facts)}.`,
  [ACTION_CODES.ACTIVATE_CARD]: (facts) =>
    `you asked us to activate your new card${describeCard(facts)}.`,
  [ACTION_CODES.REFUND_FEE]: (facts) =>
    `you asked us to refund a fee of ${readAmount(facts, 'fee_amount')}.`,
  [ACTION_CODES.RAISE_DISPUTE]: (facts) =>
    `you disputed a charge of ${readAmount(facts, 'txn_amount')}${facts.merchant ? ` from ${facts.merchant}` : ''}.`,
  [ACTION_CODES.REQUEST_STATEMENT]: () =>
    'you asked us to send you your statements.',
  [ACTION_CODES.UPDATE_PREFERENCES]: () =>
    'you asked us to change how we contact you.',
  [ACTION_CODES.PAYMENT_ARRANGEMENT]: (facts) =>
    `you asked for a ${facts.arrangement_weeks}-week payment arrangement.`,
  [ACTION_CODES.HARDSHIP_REQUEST]: () =>
    'you told us you are finding it hard to keep up with your loan repayments and asked for help.',
  [ACTION_CODES.RELEASE_HELD_PAYMENT]: (facts) =>
    `you asked about a payment of ${readAmount(facts, 'held_amount')} that we had put on hold.`,
  [ACTION_CODES.SERVICE_REQUEST]: (facts) =>
    `you asked us to ${String(facts.request_type ?? 'help with a request')
      .toLowerCase()
      .replace(/_/g, ' ')}.`,
};

function describeRequest(case_explanation: CaseExplanationRow): string {
  const describeAction = REQUEST_DESCRIPTIONS[case_explanation.action_code];
  return describeAction
    ? describeAction(case_explanation.facts)
    : 'you needed to speak with a person.';
}

function describeIdentityCheck(facts: Facts): string {
  if (Number(facts.identity_level) >= 2) {
    return 'you confirmed your identity with your details and a question about your recent banking';
  }
  return Number(facts.identity_level) >= 1 || facts.identity_verified
    ? 'you confirmed your identity'
    : 'we could not confirm your identity';
}

function listCheckedFacts(case_explanation: CaseExplanationRow): string[] {
  const { facts } = case_explanation;
  switch (case_explanation.action_code) {
    case ACTION_CODES.LOCK_CARD:
    case ACTION_CODES.REPORT_LOST_STOLEN:
    case ACTION_CODES.UNLOCK_CARD:
    case ACTION_CODES.ACTIVATE_CARD:
      return [
        describeIdentityCheck(facts),
        facts.card_belongs_to_caller
          ? 'the card is yours'
          : 'we could not match the card to you',
      ];
    case ACTION_CODES.REPLACE_CARD:
      return [
        describeIdentityCheck(facts),
        Number(facts.address_age_days) <= 30
          ? 'your address changed in the last 30 days'
          : 'your address has not changed recently',
        `you have had ${facts.replacements_last_12m} replacement cards in the last 12 months`,
      ];
    case ACTION_CODES.RAISE_DISPUTE:
      return [
        describeIdentityCheck(facts),
        facts.is_duplicate_confirmed
          ? 'our records show the same charge twice'
          : 'we checked the charge in our records',
      ];
    case ACTION_CODES.PAYMENT_ARRANGEMENT:
      return [
        describeIdentityCheck(facts),
        facts.days_in_arrears === null || facts.days_in_arrears === undefined
          ? 'we checked the account'
          : `the account is ${facts.days_in_arrears} days behind`,
      ];
    case ACTION_CODES.REQUEST_STATEMENT:
    case ACTION_CODES.UPDATE_PREFERENCES:
    case ACTION_CODES.SERVICE_REQUEST:
      return [describeIdentityCheck(facts)];
    case ACTION_CODES.REFUND_FEE:
      return [
        `you have been with us for ${facts.tenure_years} years`,
        `you have had ${facts.refunds_last_12m} fee refunds in the last 12 months`,
        `the fee was ${readAmount(facts, 'fee_amount')}`,
      ];
    case ACTION_CODES.HARDSHIP_REQUEST:
      return [
        `your income over the last 30 days was ${facts.income_drop_pct}% lower than before`,
        `your next repayment of ${readAmount(facts, 'repayment_amount')} is due in ${facts.repayment_due_in_days} days`,
        Number(facts.days_in_arrears) > 0
          ? `your loan is ${facts.days_in_arrears} days behind`
          : 'your loan is not behind',
      ];
    case ACTION_CODES.RELEASE_HELD_PAYMENT:
      return [
        facts.payee_name_check === 'NO_MATCH'
          ? 'the name on the receiving account did not match the name you entered'
          : 'we checked the name on the receiving account',
        facts.device_trusted === false
          ? 'the payment came from a device we had not seen you use before'
          : 'we checked the device the payment came from',
        `the payee was added ${facts.payee_age_hours} hours ago`,
      ];
    default:
      return [];
  }
}

function describePolicyStep(case_explanation: CaseExplanationRow): string {
  const rule_label = `rule ${case_explanation.matched_rule_id}: ${case_explanation.route_reason}`;
  if (case_explanation.status === AUTO_DECLINED_STATUS) {
    return `Our policy (${rule_label}) does not allow this, so we could not do it on the call. You can ask for a specialist to review it.`;
  }
  if (case_explanation.tier === AUTO_TIER) {
    return `Because this is low risk or protects you, and our records confirm it, our policy (${rule_label}) lets it happen straight away.`;
  }
  if (case_explanation.tier === ESCALATION_TIER) {
    return `Under our policy (${rule_label}), a request like this is never decided automatically. It goes straight to a specialist.`;
  }
  const recommendation =
    case_explanation.recommendation === 'APPROVE'
      ? 'approving'
      : 'not approving';
  return `Under our policy (${rule_label}), a person always makes the final call on requests like this. Our system recommended ${recommendation} it.`;
}

function describeHumanStep(case_explanation: CaseExplanationRow): string {
  if (case_explanation.tier === AUTO_TIER) {
    return 'No staff member needed to be involved.';
  }
  if (case_explanation.decision && case_explanation.decided_at) {
    const decision_verb =
      case_explanation.decision === 'REJECTED'
        ? 'declined it'
        : case_explanation.decision === 'EDITED_AND_APPROVED'
          ? 'approved it with adjusted terms'
          : 'approved it';
    const decided_on = formatLongDate(
      new Date(case_explanation.decided_at).toISOString(),
    );
    return `${case_explanation.decided_by_name ?? 'A member of our team'} reviewed the case and ${decision_verb} on ${decided_on}.`;
  }
  const reviewer =
    case_explanation.assigned_staff_name ?? 'a member of our team';
  const deadline = case_explanation.response_due_on
    ? ` You will hear from us no later than ${formatLongDate(case_explanation.response_due_on)}.`
    : '';
  return `It is with ${reviewer} now.${deadline}`;
}

export function buildCustomerExplanation(
  case_explanation: CaseExplanationRow,
): string {
  const first_name = case_explanation.customer_name.split(' ')[0];
  const checked_facts = listCheckedFacts(case_explanation);
  const checked_sentence =
    checked_facts.length > 0
      ? `We checked our own records rather than relying on what was said on the call: ${checked_facts.join(', ')}.`
      : '';
  return [
    `Hi ${first_name}, ${describeRequest(case_explanation)}`,
    checked_sentence,
    describePolicyStep(case_explanation),
    describeHumanStep(case_explanation),
    'If you think we got this wrong, tell us and a person will look at it again.',
  ]
    .filter((sentence) => sentence !== '')
    .join(' ');
}
