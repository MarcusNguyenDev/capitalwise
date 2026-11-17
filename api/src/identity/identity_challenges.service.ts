import { Injectable } from '@nestjs/common';

import { AuditRecorderService } from '../audit/audit_recorder.service';
import { AUDIT_EVENT_TYPES } from '../audit/constants/audit_event_type.constant';
import { CallRecordsService } from '../call_records/call_records.service';
import { IdentityKnowledgeAdapter } from '../core_banking/identity_knowledge.adapter';
import { DatabaseService } from '../database/database.service';
import { IDENTITY_LEVELS } from '../identity_records/constants/identity_level.constant';
import { IdentityLockedError } from '../identity_records/errors/identity_locked.error';
import { IdentityRecordsRepository } from '../identity_records/identity_records.repository';
import { IdentityRecordsService } from '../identity_records/identity_records.service';
import { CheckLevel } from '../identity_records/types/identity_attempt.type';
import { IdentityQuestion } from '../identity_records/types/identity_challenge.type';
import {
  LEVEL_ONE_GUIDANCE,
  LEVEL_TWO_GUIDANCE,
  LEVEL_TWO_SINGLE_GUIDANCE,
  RECENT_CARD_MERCHANT_DAYS,
} from './constants/identity_question.constant';
import { StartIdentityCheckDto } from './dto/start_identity_check.dto';
import { LevelOneRequiredError } from './errors/level_one_required.error';
import { NoDynamicQuestionAvailableError } from './errors/no_dynamic_question_available.error';
import { StartedIdentityCheck } from './types/identity_check.type';
import {
  buildLevelOneQuestions,
  buildLevelTwoQuestions,
} from './utils/build_identity_questions.util';

interface PlannedQuestions {
  questions: IdentityQuestion[];
  subject_customer_id: string | null;
  guidance: string;
}

// start_identity_check: which questions to ask, as plain sentences. The
// answers the bank expects are never part of the response.
@Injectable()
export class IdentityChallengesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly call_records_service: CallRecordsService,
    private readonly identity_records_service: IdentityRecordsService,
    private readonly identity_records_repository: IdentityRecordsRepository,
    private readonly identity_knowledge_adapter: IdentityKnowledgeAdapter,
    private readonly audit_recorder_service: AuditRecorderService,
  ) {}

  async startChallenge(
    start_request: StartIdentityCheckDto,
  ): Promise<StartedIdentityCheck> {
    const call = await this.call_records_service.getCall(start_request.call_id);
    const level = start_request.level as CheckLevel;
    const planned_questions = await this.planQuestions(call.call_id, level);
    const challenge = await this.database.runInTransaction(
      { actor_type: 'AI', actor_id: call.handled_by_agent_id },
      async (transaction) => {
        const new_challenge =
          await this.identity_records_repository.insertChallenge(transaction, {
            call_id: call.call_id,
            level,
            questions: planned_questions.questions,
            subject_customer_id: planned_questions.subject_customer_id,
          });
        await this.audit_recorder_service.recordEvent(transaction, {
          event_type: AUDIT_EVENT_TYPES.IDENTITY_CHECK_STARTED,
          call_id: call.call_id,
          detail: {
            challenge_id: new_challenge.challenge_id,
            level,
            question_kinds: planned_questions.questions.map(
              (question) => question.kind,
            ),
          },
        });
        return new_challenge;
      },
    );
    return {
      challenge_id: challenge.challenge_id,
      level,
      questions: planned_questions.questions,
      guidance: planned_questions.guidance,
    };
  }

  private async planQuestions(
    call_id: string,
    level: CheckLevel,
  ): Promise<PlannedQuestions> {
    const summary = await this.identity_records_service.summariseCall(call_id);
    if (summary.is_locked) {
      throw new IdentityLockedError(call_id);
    }
    if (level === IDENTITY_LEVELS.BASIC) {
      return {
        questions: buildLevelOneQuestions(),
        subject_customer_id: null,
        guidance: LEVEL_ONE_GUIDANCE,
      };
    }
    if (
      summary.identity_level < IDENTITY_LEVELS.BASIC ||
      !summary.customer_id
    ) {
      throw new LevelOneRequiredError();
    }
    const knowledge = await this.identity_knowledge_adapter.getKnowledge(
      summary.customer_id,
      RECENT_CARD_MERCHANT_DAYS,
    );
    const questions = buildLevelTwoQuestions(knowledge);
    if (questions.length === 0) {
      throw new NoDynamicQuestionAvailableError();
    }
    return {
      questions,
      subject_customer_id: summary.customer_id,
      guidance:
        questions.length > 1 ? LEVEL_TWO_GUIDANCE : LEVEL_TWO_SINGLE_GUIDANCE,
    };
  }
}
