import { IdentityQuestionKind } from '../../identity_records/types/identity_challenge.type';
import { AmountTolerance } from '../matchers/match_amount.util';

export const LEVEL_ONE_KINDS: IdentityQuestionKind[] = [
  'FULL_NAME',
  'DATE_OF_BIRTH',
  'POSTCODE',
];

// Offered in this order, the first two the customer's data supports. The
// card's last four digits come last: the AI can see them after level 1.
export const DYNAMIC_KIND_PREFERENCE: IdentityQuestionKind[] = [
  'LAST_INCOME_AMOUNT',
  'RECENT_CARD_MERCHANT',
  'LOAN_REPAYMENT_AMOUNT',
  'CARD_LAST_FOUR',
];

export const DYNAMIC_QUESTIONS_OFFERED = 2;
export const RECENT_CARD_MERCHANT_DAYS = 7;

export const LEVEL_ONE_PROMPTS: Record<string, string> = {
  FULL_NAME: 'Could I have your full name, please?',
  DATE_OF_BIRTH: "What's your date of birth?",
  POSTCODE: "And what's the postcode where you live?",
};

export const DYNAMIC_PROMPTS = {
  SALARY: 'Roughly how much was your last pay into your account?',
  GOVT_BENEFIT: 'Roughly how much was your last pension or Centrelink payment?',
  RECENT_CARD_MERCHANT:
    'Can you tell me the name of a shop or business where you used your card in the last week?',
  CARD_LAST_FOUR: 'What are the last four digits of one of your cards?',
  LOAN_REPAYMENT_AMOUNT: 'Roughly how much is your regular loan repayment?',
} as const;

export const LEVEL_ONE_GUIDANCE =
  'Ask these one at a time, in order: full name, date of birth, then postcode. Submit all three answers together.';
export const LEVEL_TWO_GUIDANCE =
  "Ask one of these two; offer the other if the caller can't answer. Submit what the caller said.";
export const LEVEL_TWO_SINGLE_GUIDANCE =
  'Ask this question. If the caller cannot answer it, offer a specialist instead.';

export const INCOME_TOLERANCE: AmountTolerance = { ratio: 0.1, absolute: 50 };
export const LOAN_REPAYMENT_TOLERANCE: AmountTolerance = {
  ratio: 0.1,
  absolute: 0,
};
