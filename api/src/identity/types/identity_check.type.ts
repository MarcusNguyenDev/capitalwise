import {
  CheckLevel,
  IdentityLevel,
} from '../../identity_records/types/identity_attempt.type';
import { IdentityQuestion } from '../../identity_records/types/identity_challenge.type';

// POST /api/identity/challenges
export interface StartedIdentityCheck {
  challenge_id: string;
  level: CheckLevel;
  questions: IdentityQuestion[];
  guidance: string;
}

// POST /api/identity/challenges/:challenge_id/answers. The customer fields
// are null unless the check passed. Never says which answer was wrong.
export interface IdentityCheckResult {
  is_passed: boolean;
  identity_level: IdentityLevel;
  method: 'KNOWLEDGE';
  customer_id: string | null;
  first_name: string | null;
  full_name: string | null;
  remaining_attempts: number;
  is_locked: boolean;
  concern_case_number: string | null;
}

export interface AnswerVerdict {
  is_passed: boolean;
  resolved_customer: {
    customer_id: string;
    first_name: string;
    last_name: string;
  } | null;
  resolution: string;
}
