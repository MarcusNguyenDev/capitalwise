import { CheckLevel } from './identity_attempt.type';

export type IdentityQuestionKind =
  | 'FULL_NAME'
  | 'DATE_OF_BIRTH'
  | 'POSTCODE'
  | 'LAST_INCOME_AMOUNT'
  | 'RECENT_CARD_MERCHANT'
  | 'CARD_LAST_FOUR'
  | 'LOAN_REPAYMENT_AMOUNT';

export interface IdentityQuestion {
  question_id: string;
  kind: IdentityQuestionKind;
  // A plain question the AI can say as it is.
  prompt: string;
}

// A row of engine.identity_challenges.
export interface IdentityChallenge {
  challenge_id: string;
  call_id: string;
  level: CheckLevel;
  questions: IdentityQuestion[];
  subject_customer_id: string | null;
  created_at: Date;
}

export interface NewIdentityChallenge {
  call_id: string;
  level: CheckLevel;
  questions: IdentityQuestion[];
  subject_customer_id: string | null;
}
