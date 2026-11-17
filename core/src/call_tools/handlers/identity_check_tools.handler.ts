import { Injectable } from '@nestjs/common';

import { CallsService } from '../../calls/calls.service';
import { readIdentityLevel } from '../../calls/read_identity_level.util';
import { CallChanges, CallRow } from '../../calls/types/call_row.type';
import { EngineApiClient } from '../../engine_api/engine_api.client';
import { EngineApiRejectedError } from '../../engine_api/errors/engine_api_rejected.error';
import { IdentityCheckResult } from '../../engine_api/types/identity_challenge.type';
import { StartIdentityCheckArgsDto } from '../dto/start_identity_check_args.dto';
import { SubmitIdentityAnswersArgsDto } from '../dto/submit_identity_answers_args.dto';
import { ToolRejectedError } from '../errors/tool_rejected.error';
import { ToolContext } from '../types/tool_context.type';

const LOCKED_ATTENTION_REASON = 'Identity locked after failed checks';

// Speech-to-text and models write amounts with thousands separators
// ("about $4,200"); the api reads "4,200" as two numbers, so they are dropped.
const THOUSANDS_SEPARATOR_PATTERN = /(\d),(?=\d{3}(?!\d))/g;

function normaliseAnswer(answer: string): string {
  return answer.replace(THOUSANDS_SEPARATOR_PATTERN, '$1');
}

// What the model should do next when the api refuses a challenge. The api's
// own messages are written for staff; these are written for the model.
const CHALLENGE_REFUSAL_MESSAGES: Record<string, string> = {
  IDENTITY_LOCKED:
    'Identity checks are locked on this call after failed attempts. Do not discuss any account. Say kindly that a specialist will help with this, and stop.',
  LEVEL_ONE_REQUIRED:
    'Confirm the basic details first: call start_identity_check with level 1, then level 2.',
  NO_DYNAMIC_QUESTION_AVAILABLE:
    'There is no extra security question available for this caller, so this task needs a specialist. Explain in one sentence that it is for their security, then offer request_human.',
};

const FAILED_CHECK_MESSAGE =
  'Those details did not match. Do not say which answer was wrong. Kindly ask the caller to check and say them again, one at a time, or offer the other question at level 2.';
const LOCKED_CHECK_MESSAGE =
  'Identity could not be confirmed and is now locked on this call. A fraud specialist has the case. Do not discuss any account or say which answer was wrong. Say kindly that, for their security, a specialist will help them, and stop.';

@Injectable()
export class IdentityCheckToolsHandler {
  constructor(
    private readonly engine_api_client: EngineApiClient,
    private readonly calls_service: CallsService,
  ) {}

  async startIdentityCheck(
    tool_context: ToolContext,
    tool_args: StartIdentityCheckArgsDto,
  ): Promise<Record<string, unknown>> {
    const { call } = tool_context;
    if (call.is_identity_locked) {
      throw this.buildChallengeRefusal('IDENTITY_LOCKED');
    }
    const current_level = readIdentityLevel(call);
    if (current_level >= tool_args.level) {
      return {
        is_already_confirmed: true,
        identity_level: current_level,
        message: `Identity is already confirmed to level ${current_level}. Carry on with the task.`,
      };
    }
    try {
      const identity_challenge =
        await this.engine_api_client.startIdentityChallenge({
          call_id: call.call_id,
          level: tool_args.level,
        });
      return {
        challenge_id: identity_challenge.challenge_id,
        level: identity_challenge.level,
        questions: identity_challenge.questions.map((question) => ({
          question_id: question.question_id,
          kind: question.kind,
          prompt: question.prompt,
        })),
        guidance: identity_challenge.guidance,
      };
    } catch (error) {
      throw this.translateChallengeError(error);
    }
  }

  // The call row is updated BEFORE the result goes back, so the next tool
  // (and the console) already sees the confirmed caller.
  async submitIdentityAnswers(
    tool_context: ToolContext,
    tool_args: SubmitIdentityAnswersArgsDto,
  ): Promise<Record<string, unknown>> {
    const { call } = tool_context;
    if (call.is_identity_locked) {
      throw this.buildChallengeRefusal('IDENTITY_LOCKED');
    }
    let identity_check_result: IdentityCheckResult;
    try {
      identity_check_result =
        await this.engine_api_client.submitIdentityAnswers(
          tool_args.challenge_id,
          {
            call_id: call.call_id,
            answers: tool_args.answers.map((identity_answer) => ({
              question_id: identity_answer.question_id,
              answer: normaliseAnswer(identity_answer.answer),
            })),
          },
        );
    } catch (error) {
      throw this.translateChallengeError(error);
    }
    if (identity_check_result.is_passed) {
      await this.recordPassedCheck(call, identity_check_result);
      return {
        is_passed: true,
        identity_level: identity_check_result.identity_level,
        first_name: identity_check_result.first_name,
      };
    }
    if (identity_check_result.is_locked) {
      await this.recordLockedIdentity(call, identity_check_result);
      return {
        is_passed: false,
        is_locked: true,
        remaining_attempts: 0,
        message: LOCKED_CHECK_MESSAGE,
      };
    }
    return {
      is_passed: false,
      is_locked: false,
      remaining_attempts: identity_check_result.remaining_attempts,
      message: FAILED_CHECK_MESSAGE,
    };
  }

  private async recordPassedCheck(
    call: CallRow,
    identity_check_result: IdentityCheckResult,
  ): Promise<void> {
    await this.calls_service.changeCall(
      call.call_id,
      {
        actor_type: 'CUSTOMER',
        actor_id: identity_check_result.customer_id ?? call.customer_id,
      },
      (locked_call) =>
        buildPassedIdentityChanges(locked_call, identity_check_result),
    );
  }

  private async recordLockedIdentity(
    call: CallRow,
    identity_check_result: IdentityCheckResult,
  ): Promise<void> {
    await this.calls_service.changeCall(
      call.call_id,
      this.calls_service.buildAgentActor(call),
      async (locked_call, transaction) => {
        const concern_staff_id = identity_check_result.concern_case_number
          ? await this.calls_service.findCaseAssignedStaffIdInTransaction(
              transaction,
              identity_check_result.concern_case_number,
            )
          : null;
        const locked_changes: CallChanges = {
          is_identity_locked: true,
          risk_level: 'HIGH',
        };
        // A person who already has the call keeps it.
        if (locked_call.status === 'HUMAN_ACTIVE') {
          return locked_changes;
        }
        return {
          ...locked_changes,
          status: 'NEEDS_ATTENTION',
          attention_reason: LOCKED_ATTENTION_REASON,
          assigned_staff_id: concern_staff_id ?? locked_call.assigned_staff_id,
          metrics: {
            ...locked_call.metrics,
            human_requested_at:
              locked_call.metrics.human_requested_at ??
              new Date().toISOString(),
          },
        };
      },
    );
  }

  private translateChallengeError(error: unknown): unknown {
    if (
      error instanceof EngineApiRejectedError &&
      error.api_error_code in CHALLENGE_REFUSAL_MESSAGES
    ) {
      return this.buildChallengeRefusal(error.api_error_code);
    }
    return error;
  }

  private buildChallengeRefusal(error_code: string): ToolRejectedError {
    return new ToolRejectedError(
      error_code,
      CHALLENGE_REFUSAL_MESSAGES[error_code],
    );
  }
}

// Exported for the tests: the columns a passed check writes on engine.calls.
export function buildPassedIdentityChanges(
  locked_call: CallRow,
  identity_check_result: IdentityCheckResult,
): CallChanges {
  const verified_at = new Date();
  const resolved_customer_id =
    identity_check_result.customer_id ?? locked_call.customer_id;
  // A different person (a spouse on a shared number) starts from scratch.
  const is_same_person =
    locked_call.identity_verified &&
    locked_call.customer_id === resolved_customer_id;
  const is_first_confirmation = !is_same_person;
  return {
    customer_id: resolved_customer_id,
    customer_name: identity_check_result.full_name ?? locked_call.customer_name,
    identity_level: (is_same_person
      ? Math.max(
          readIdentityLevel(locked_call),
          identity_check_result.identity_level,
        )
      : identity_check_result.identity_level) as CallChanges['identity_level'],
    identity_method: identity_check_result.method,
    identity_verified: true,
    verified_at: is_first_confirmation ? verified_at : locked_call.verified_at,
    metrics: {
      ...locked_call.metrics,
      // The first confirmation on the call is what the KPI measures.
      time_to_identity_ms:
        locked_call.metrics.time_to_identity_ms ??
        verified_at.getTime() - new Date(locked_call.started_at).getTime(),
    },
  };
}
