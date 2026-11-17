import {
  IdentityQuestion,
  IdentityQuestionKind,
} from '../../identity_records/types/identity_challenge.type';
import {
  DYNAMIC_KIND_PREFERENCE,
  DYNAMIC_PROMPTS,
  DYNAMIC_QUESTIONS_OFFERED,
  LEVEL_ONE_KINDS,
  LEVEL_ONE_PROMPTS,
} from '../constants/identity_question.constant';
import { IdentityKnowledge } from '../../core_banking/types/identity_knowledge.type';

function buildQuestion(
  index: number,
  kind: IdentityQuestionKind,
  prompt: string,
): IdentityQuestion {
  return { question_id: `Q${index + 1}`, kind, prompt };
}

export function buildLevelOneQuestions(): IdentityQuestion[] {
  return LEVEL_ONE_KINDS.map((kind, index) =>
    buildQuestion(index, kind, LEVEL_ONE_PROMPTS[kind]),
  );
}

function isSupported(
  kind: IdentityQuestionKind,
  knowledge: IdentityKnowledge,
): boolean {
  switch (kind) {
    case 'LAST_INCOME_AMOUNT':
      return knowledge.last_income !== null;
    case 'RECENT_CARD_MERCHANT':
      return knowledge.recent_card_merchants.length > 0;
    case 'LOAN_REPAYMENT_AMOUNT':
      return knowledge.loan_repayment_amounts.length > 0;
    case 'CARD_LAST_FOUR':
      return knowledge.card_last_fours.length > 0;
    default:
      return false;
  }
}

function describeDynamicPrompt(
  kind: IdentityQuestionKind,
  knowledge: IdentityKnowledge,
): string {
  if (kind === 'LAST_INCOME_AMOUNT') {
    return knowledge.last_income?.txn_type === 'GOVT_BENEFIT'
      ? DYNAMIC_PROMPTS.GOVT_BENEFIT
      : DYNAMIC_PROMPTS.SALARY;
  }
  return DYNAMIC_PROMPTS[kind as keyof typeof DYNAMIC_PROMPTS];
}

// Up to two questions about the customer's own recent activity, in a fixed
// order of preference, from what their data supports. The prompts never
// contain the expected answer.
export function buildLevelTwoQuestions(
  knowledge: IdentityKnowledge,
): IdentityQuestion[] {
  return DYNAMIC_KIND_PREFERENCE.filter((kind) => isSupported(kind, knowledge))
    .slice(0, DYNAMIC_QUESTIONS_OFFERED)
    .map((kind, index) =>
      buildQuestion(index, kind, describeDynamicPrompt(kind, knowledge)),
    );
}
