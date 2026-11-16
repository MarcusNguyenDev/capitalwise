import { Injectable } from '@nestjs/common';

import { AuditRecorderService } from '../audit/audit_recorder.service';
import {
  AUDIT_EVENT_TYPES,
  POLICY_ENGINE_ACTOR,
} from '../audit/constants/audit_event_type.constant';
import { TransactionClient } from '../database/types/transaction_client.type';
import { PolicyDecision } from '../policies/policies.service';
import { CasesRepository } from './cases.repository';
import {
  CASE_STATUSES,
  UNKNOWN_AGENT_VERSION,
} from './constants/case_status.constant';
import { CaseDraft, CaseReevaluation } from './types/case_intake.type';

interface PolicyAuditContext {
  call_id: string | null;
  case_number: string;
  action_code: string;
  facts: Record<string, unknown>;
  policy_decision: PolicyDecision;
}

// Writes the case row with everything needed to explain the decision later:
// facts, soft signals, the policy and rule that decided, and the model and
// prompt version of the AI agent on the call.
@Injectable()
export class CaseBuilderService {
  constructor(
    private readonly cases_repository: CasesRepository,
    private readonly audit_recorder_service: AuditRecorderService,
  ) {}

  async createCase(
    transaction: TransactionClient,
    case_draft: CaseDraft,
  ): Promise<string> {
    const { call } = case_draft.intake;
    const case_number = await this.cases_repository.insertCase(
      transaction,
      case_draft,
      {
        model: call.agent_model ?? UNKNOWN_AGENT_VERSION,
        prompt_version: call.agent_prompt_version ?? UNKNOWN_AGENT_VERSION,
      },
    );
    await this.recordPolicyEvaluation(transaction, {
      call_id: call.call_id,
      case_number,
      action_code: case_draft.intake.action_type.action_code,
      facts: case_draft.facts,
      policy_decision: case_draft.policy_decision,
    });
    return case_number;
  }

  // A concern flagged later in the call re-ran the policy with the new
  // signals. The evaluation is always stored; the case is re-routed only when
  // it now needs a (different) specialist.
  async applyReevaluation(
    transaction: TransactionClient,
    reevaluation: CaseReevaluation,
    should_escalate: boolean,
  ): Promise<void> {
    await this.cases_repository.updateCaseEvaluation(transaction, reevaluation);
    if (should_escalate) {
      await this.cases_repository.updateCaseRouting(
        transaction,
        reevaluation,
        CASE_STATUSES.ESCALATED,
      );
    }
    await this.recordPolicyEvaluation(transaction, reevaluation);
  }

  private recordPolicyEvaluation(
    transaction: TransactionClient,
    audit_context: PolicyAuditContext,
  ): Promise<void> {
    const { policy, evaluation } = audit_context.policy_decision;
    return this.audit_recorder_service.recordEvent(transaction, {
      event_type: AUDIT_EVENT_TYPES.POLICY_EVALUATED,
      call_id: audit_context.call_id,
      case_number: audit_context.case_number,
      actor: POLICY_ENGINE_ACTOR,
      detail: {
        action_code: audit_context.action_code,
        policy_id: policy.policy_id,
        policy_version: policy.version,
        route: evaluation.route,
        recommend: evaluation.recommend,
        confidence: evaluation.confidence,
        matched_rule_id: evaluation.matched_rule_id,
        reason: evaluation.reason,
        facts: audit_context.facts,
        conditions_evaluated: evaluation.conditions_evaluated,
      },
    });
  }
}
