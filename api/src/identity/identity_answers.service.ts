import { Injectable } from '@nestjs/common';

import { AuditRecorderService } from '../audit/audit_recorder.service';
import {
  AUDIT_EVENT_TYPES,
  IDENTITY_CHECK_ACTOR,
} from '../audit/constants/audit_event_type.constant';
import { CallRecordsService } from '../call_records/call_records.service';
import { CallRecord } from '../call_records/types/call_record.type';
import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import {
  IDENTITY_LEVELS,
  IDENTITY_METHODS,
} from '../identity_records/constants/identity_level.constant';
import { IdentityLockedError } from '../identity_records/errors/identity_locked.error';
import { IdentityRecordsRepository } from '../identity_records/identity_records.repository';
import { IdentityRecordsService } from '../identity_records/identity_records.service';
import {
  IdentityAttempt,
  IdentitySummary,
} from '../identity_records/types/identity_attempt.type';
import { IdentityChallenge } from '../identity_records/types/identity_challenge.type';
import {
  countRemainingAttempts,
  summariseIdentityAttempts,
} from '../identity_records/utils/summarise_identity_attempts.util';
import { SubmitIdentityAnswersDto } from './dto/submit_identity_answers.dto';
import { IdentityAnswersIncompleteError } from './errors/identity_answers_incomplete.error';
import { IdentityChallengeNotFoundError } from './errors/identity_challenge_not_found.error';
import { LevelOneRequiredError } from './errors/level_one_required.error';
import { UnknownIdentityQuestionError } from './errors/unknown_identity_question.error';
import { IdentityAnswerCheckerService } from './identity_answer_checker.service';
import { IdentityLockoutService } from './identity_lockout.service';
import {
  AnswerVerdict,
  IdentityCheckResult,
} from './types/identity_check.type';

interface RecordedAttempt {
  attempt: IdentityAttempt;
  summary_after: IdentitySummary;
  is_newly_locked: boolean;
}

// submit_identity_answers: checks what the caller said, records the attempt
// (never the answers), audits it, and locks the call after two failures.
@Injectable()
export class IdentityAnswersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly call_records_service: CallRecordsService,
    private readonly identity_records_service: IdentityRecordsService,
    private readonly identity_records_repository: IdentityRecordsRepository,
    private readonly identity_answer_checker_service: IdentityAnswerCheckerService,
    private readonly identity_lockout_service: IdentityLockoutService,
    private readonly audit_recorder_service: AuditRecorderService,
  ) {}

  async submitAnswers(
    challenge_id: string,
    submission: SubmitIdentityAnswersDto,
  ): Promise<IdentityCheckResult> {
    const challenge = await this.getCallChallenge(
      challenge_id,
      submission.call_id,
    );
    this.assertAnswersFit(challenge, submission);
    const call = await this.call_records_service.getCall(submission.call_id);
    const summary_before = await this.identity_records_service.summariseCall(
      call.call_id,
    );
    if (summary_before.is_locked) {
      throw new IdentityLockedError(call.call_id);
    }
    const verdict = await this.checkAnswers(
      challenge,
      submission,
      call,
      summary_before,
    );
    const recorded = await this.recordAttempt(call, challenge, {
      verdict,
      question_kinds: this.listAnsweredKinds(challenge, submission),
    });
    const concern_case_number = recorded.is_newly_locked
      ? await this.lockCall(call, recorded.attempt)
      : null;
    return this.describeResult(recorded, verdict, concern_case_number);
  }

  private async getCallChallenge(
    challenge_id: string,
    call_id: string,
  ): Promise<IdentityChallenge> {
    const challenge =
      await this.identity_records_repository.selectChallenge(challenge_id);
    if (!challenge || challenge.call_id !== call_id) {
      throw new IdentityChallengeNotFoundError(challenge_id);
    }
    return challenge;
  }

  private assertAnswersFit(
    challenge: IdentityChallenge,
    submission: SubmitIdentityAnswersDto,
  ): void {
    const question_ids = challenge.questions.map(
      (question) => question.question_id,
    );
    const unknown_answer = submission.answers.find(
      (answer) => !question_ids.includes(answer.question_id),
    );
    if (unknown_answer) {
      throw new UnknownIdentityQuestionError(
        unknown_answer.question_id,
        challenge.challenge_id,
      );
    }
    if (challenge.level === IDENTITY_LEVELS.BASIC) {
      const answered_ids = submission.answers.map(
        (answer) => answer.question_id,
      );
      const missing_ids = question_ids.filter(
        (question_id) => !answered_ids.includes(question_id),
      );
      if (missing_ids.length > 0) {
        throw new IdentityAnswersIncompleteError(missing_ids);
      }
    }
  }

  private checkAnswers(
    challenge: IdentityChallenge,
    submission: SubmitIdentityAnswersDto,
    call: CallRecord,
    summary_before: IdentitySummary,
  ): Promise<AnswerVerdict> {
    if (challenge.level === IDENTITY_LEVELS.BASIC) {
      return this.identity_answer_checker_service.checkLevelOne(
        challenge,
        submission.answers,
        call.customer_id,
      );
    }
    // Level 2 is about the customer verified at level 1, and only while they
    // are still the verified caller.
    if (
      !challenge.subject_customer_id ||
      summary_before.customer_id !== challenge.subject_customer_id
    ) {
      throw new LevelOneRequiredError();
    }
    return this.identity_answer_checker_service.checkLevelTwo(
      challenge,
      submission.answers,
      challenge.subject_customer_id,
    );
  }

  private listAnsweredKinds(
    challenge: IdentityChallenge,
    submission: SubmitIdentityAnswersDto,
  ): string[] {
    return submission.answers.flatMap((answer) =>
      challenge.questions
        .filter((question) => question.question_id === answer.question_id)
        .map((question) => question.kind),
    );
  }

  private recordAttempt(
    call: CallRecord,
    challenge: IdentityChallenge,
    outcome: { verdict: AnswerVerdict; question_kinds: string[] },
  ): Promise<RecordedAttempt> {
    return this.database.runInTransaction(
      { actor_type: 'AI', actor_id: call.handled_by_agent_id },
      async (transaction) => {
        const earlier_attempts =
          await this.identity_records_repository.lockCallIdentity(
            transaction,
            call.call_id,
          );
        const summary_before = summariseIdentityAttempts(earlier_attempts);
        if (summary_before.is_locked) {
          throw new IdentityLockedError(call.call_id);
        }
        const attempt = await this.identity_records_repository.insertAttempt(
          transaction,
          {
            call_id: call.call_id,
            challenge_id: challenge.challenge_id,
            method: IDENTITY_METHODS.KNOWLEDGE,
            level: challenge.level,
            question_kinds: outcome.question_kinds,
            is_passed: outcome.verdict.is_passed,
            resolved_customer_id:
              outcome.verdict.resolved_customer?.customer_id ?? null,
          },
        );
        const summary_after = summariseIdentityAttempts([
          ...earlier_attempts,
          attempt,
        ]);
        await this.auditAttempt(transaction, {
          attempt,
          summary_after,
          resolution: outcome.verdict.resolution,
        });
        return {
          attempt,
          summary_after,
          is_newly_locked: summary_after.is_locked,
        };
      },
    );
  }

  private async auditAttempt(
    transaction: TransactionClient,
    audit_context: {
      attempt: IdentityAttempt;
      summary_after: IdentitySummary;
      resolution: string;
    },
  ): Promise<void> {
    const { attempt, summary_after } = audit_context;
    const detail = {
      challenge_id: attempt.challenge_id,
      attempt_id: attempt.attempt_id,
      level: attempt.level,
      question_kinds: attempt.question_kinds,
    };
    if (!attempt.is_passed) {
      await this.audit_recorder_service.recordEvent(transaction, {
        event_type: AUDIT_EVENT_TYPES.IDENTITY_CHECK_FAILED,
        call_id: attempt.call_id,
        actor: IDENTITY_CHECK_ACTOR,
        detail: {
          ...detail,
          remaining_attempts: countRemainingAttempts(
            summary_after,
            attempt.level,
          ),
        },
      });
      return;
    }
    await this.audit_recorder_service.recordEvent(transaction, {
      event_type: AUDIT_EVENT_TYPES.IDENTITY_CHECK_PASSED,
      call_id: attempt.call_id,
      actor: IDENTITY_CHECK_ACTOR,
      detail: {
        ...detail,
        resolved_customer_id: attempt.resolved_customer_id,
        resolution: audit_context.resolution,
      },
    });
    await this.audit_recorder_service.recordEvent(transaction, {
      event_type: AUDIT_EVENT_TYPES.IDENTITY_VERIFIED,
      call_id: attempt.call_id,
      actor: { actor_type: 'CUSTOMER', actor_id: attempt.resolved_customer_id },
      detail: {
        method: IDENTITY_METHODS.KNOWLEDGE,
        level: attempt.level,
        attempt_id: attempt.attempt_id,
      },
    });
  }

  private async lockCall(
    call: CallRecord,
    attempt: IdentityAttempt,
  ): Promise<string> {
    const concern_case_number =
      await this.identity_lockout_service.raiseFraudCase(call);
    await this.database.runInTransaction(IDENTITY_CHECK_ACTOR, (transaction) =>
      this.audit_recorder_service.recordEvent(transaction, {
        event_type: AUDIT_EVENT_TYPES.IDENTITY_LOCKED,
        call_id: call.call_id,
        case_number: concern_case_number,
        detail: {
          level: attempt.level,
          attempt_id: attempt.attempt_id,
          concern_case_number,
        },
      }),
    );
    return concern_case_number;
  }

  private describeResult(
    recorded: RecordedAttempt,
    verdict: AnswerVerdict,
    concern_case_number: string | null,
  ): IdentityCheckResult {
    const resolved_customer = verdict.is_passed
      ? verdict.resolved_customer
      : null;
    return {
      is_passed: verdict.is_passed,
      identity_level: recorded.summary_after.identity_level,
      method: IDENTITY_METHODS.KNOWLEDGE,
      customer_id: resolved_customer?.customer_id ?? null,
      first_name: resolved_customer?.first_name ?? null,
      full_name: resolved_customer
        ? `${resolved_customer.first_name} ${resolved_customer.last_name}`
        : null,
      remaining_attempts: countRemainingAttempts(
        recorded.summary_after,
        recorded.attempt.level,
      ),
      is_locked: recorded.summary_after.is_locked,
      concern_case_number,
    };
  }
}
