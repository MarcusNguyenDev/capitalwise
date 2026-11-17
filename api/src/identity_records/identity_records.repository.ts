import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { IDENTITY_CHECK_FAILED_SIGNAL } from './constants/identity_level.constant';
import {
  IdentityAttempt,
  NewIdentityAttempt,
} from './types/identity_attempt.type';
import {
  IdentityChallenge,
  NewIdentityChallenge,
} from './types/identity_challenge.type';

const ATTEMPTS_FOR_CALL_SQL = `
  SELECT attempt_id, call_id, challenge_id, method, level, question_kinds, is_passed, resolved_customer_id, created_at
  FROM engine.identity_attempts
  WHERE call_id = $1
  ORDER BY created_at, attempt_id`;

// engine.identity_challenges and engine.identity_attempts: the api's record of
// identity checks. No answers and no expected values are ever stored.
@Injectable()
export class IdentityRecordsRepository {
  constructor(private readonly database: DatabaseService) {}

  selectAttempts(call_id: string): Promise<IdentityAttempt[]> {
    return this.database.query<IdentityAttempt>(ATTEMPTS_FOR_CALL_SQL, [
      call_id,
    ]);
  }

  // Serialises identity work on one call, so two answers submitted at once
  // cannot both slip under the attempt limit.
  async lockCallIdentity(
    transaction: TransactionClient,
    call_id: string,
  ): Promise<IdentityAttempt[]> {
    await transaction.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      call_id,
    ]);
    return transaction.query<IdentityAttempt>(ATTEMPTS_FOR_CALL_SQL, [call_id]);
  }

  async insertAttempt(
    transaction: TransactionClient,
    new_attempt: NewIdentityAttempt,
  ): Promise<IdentityAttempt> {
    const attempt_rows = await transaction.query<IdentityAttempt>(
      `INSERT INTO engine.identity_attempts (call_id, challenge_id, method, level, question_kinds, is_passed, resolved_customer_id)
       VALUES ($1, $2, $3, $4, $5::text[], $6, $7)
       RETURNING *`,
      [
        new_attempt.call_id,
        new_attempt.challenge_id,
        new_attempt.method,
        new_attempt.level,
        new_attempt.question_kinds,
        new_attempt.is_passed,
        new_attempt.resolved_customer_id,
      ],
    );
    return attempt_rows[0];
  }

  async insertChallenge(
    transaction: TransactionClient,
    new_challenge: NewIdentityChallenge,
  ): Promise<IdentityChallenge> {
    const challenge_rows = await transaction.query<IdentityChallenge>(
      `INSERT INTO engine.identity_challenges (call_id, level, questions, subject_customer_id)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING *`,
      [
        new_challenge.call_id,
        new_challenge.level,
        JSON.stringify(new_challenge.questions),
        new_challenge.subject_customer_id,
      ],
    );
    return challenge_rows[0];
  }

  async selectChallenge(
    challenge_id: string,
  ): Promise<IdentityChallenge | null> {
    const challenge_rows = await this.database.query<IdentityChallenge>(
      `SELECT * FROM engine.identity_challenges WHERE challenge_id = $1`,
      [challenge_id],
    );
    return challenge_rows[0] ?? null;
  }

  async selectLockoutCaseNumber(call_id: string): Promise<string | null> {
    const case_rows = await this.database.query<{ case_number: string }>(
      `SELECT case_number FROM engine.cases
       WHERE call_id = $1 AND action_code = 'HUMAN_CALLBACK'
         AND COALESCE(soft_signals -> 'fraud_signals', '[]'::jsonb) ? $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [call_id, IDENTITY_CHECK_FAILED_SIGNAL],
    );
    return case_rows[0]?.case_number ?? null;
  }
}
