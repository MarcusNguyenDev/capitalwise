import { IdentityQuestionKind } from '../../identity_records/types/identity_challenge.type';
import {
  INCOME_TOLERANCE,
  LOAN_REPAYMENT_TOLERANCE,
} from '../constants/identity_question.constant';
import { isAmountMatch } from '../matchers/match_amount.util';
import { isFullNameMatch } from '../matchers/match_full_name.util';
import { isMerchantMatch } from '../matchers/match_merchant.util';
import {
  isCardLastFourMatch,
  isPostcodeMatch,
} from '../matchers/match_postcode.util';
import {
  isDateOfBirthMatch,
  ParsingClock,
} from '../matchers/parse_date_of_birth.util';
import {
  IdentityCandidate,
  IdentityKnowledge,
} from '../../core_banking/types/identity_knowledge.type';

// Level 1: is this caller this customer?
export function isLevelOneAnswerCorrect(
  kind: IdentityQuestionKind,
  answer: string,
  candidate: IdentityCandidate,
  clock?: ParsingClock,
): boolean {
  switch (kind) {
    case 'FULL_NAME':
      return isFullNameMatch(answer, candidate);
    case 'DATE_OF_BIRTH':
      return isDateOfBirthMatch(answer, candidate.date_of_birth, clock);
    case 'POSTCODE':
      return isPostcodeMatch(answer, candidate.postcode);
    default:
      return false;
  }
}

// Level 2: does the caller know the customer's own recent activity?
export function isLevelTwoAnswerCorrect(
  kind: IdentityQuestionKind,
  answer: string,
  knowledge: IdentityKnowledge,
): boolean {
  switch (kind) {
    case 'LAST_INCOME_AMOUNT':
      return (
        knowledge.last_income !== null &&
        isAmountMatch(answer, knowledge.last_income.amount, INCOME_TOLERANCE)
      );
    case 'RECENT_CARD_MERCHANT':
      return isMerchantMatch(answer, knowledge.recent_card_merchants);
    case 'CARD_LAST_FOUR':
      return isCardLastFourMatch(answer, knowledge.card_last_fours);
    case 'LOAN_REPAYMENT_AMOUNT':
      return knowledge.loan_repayment_amounts.some((repayment_amount) =>
        isAmountMatch(answer, repayment_amount, LOAN_REPAYMENT_TOLERANCE),
      );
    default:
      return false;
  }
}
