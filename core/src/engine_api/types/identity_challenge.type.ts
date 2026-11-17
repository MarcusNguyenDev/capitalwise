import { IdentityLevel, IdentityMethod } from '../../calls/types/call_row.type';

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

// POST /api/identity/challenges. Never contains the expected answers.
export interface IdentityChallenge {
  challenge_id: string;
  level: IdentityLevel;
  questions: IdentityQuestion[];
  guidance: string;
}

export interface IdentityAnswer {
  question_id: string;
  answer: string;
}

export interface SubmitIdentityAnswersRequest {
  call_id: string;
  answers: IdentityAnswer[];
}

// POST /api/identity/challenges/:challenge_id/answers. The customer fields
// are null unless the answers passed.
export interface IdentityCheckResult {
  is_passed: boolean;
  identity_level: IdentityLevel;
  method: IdentityMethod;
  customer_id: string | null;
  first_name: string | null;
  full_name: string | null;
  remaining_attempts: number;
  is_locked: boolean;
  concern_case_number: string | null;
}
