import { Injectable } from '@nestjs/common';

import { CallRecord } from '../call_records/types/call_record.type';
import { DatabaseService } from '../database/database.service';
import { ExecutorService } from '../execution/executor.service';
import { ExecutionResult } from '../execution/types/execution_request.type';
import {
  ACTION_CODES,
  ACTION_SUBJECT_PARAMS,
  UNKNOWN_CUSTOMER_ID,
  UNKNOWN_CUSTOMER_NAME,
} from '../facts/constants/action_code.constant';
import { FactBuilderService } from '../facts/fact_builder.service';
import { BuiltFacts } from '../facts/types/fact_request.type';
import { SoftSignals } from '../facts/types/soft_signals.type';
import { mergeSoftSignals } from '../facts/utils/merge_soft_signals.util';
import { NotifierService } from '../notifications/notifier.service';
import {
  AUTO_TIER,
  ESCALATION_TIER,
  ROUTE_TIERS,
} from '../policies/constants/route_tier.constant';
import { PoliciesService } from '../policies/policies.service';
import { RouterService } from '../routing/router.service';
import { Actor } from '../shared_kernel/types/actor.type';
import { CaseBuilderService } from './case_builder.service';
import { CaseEventsPublisher } from './case_events.publisher';
import { CasesRepository, CaseSubject } from './cases.repository';
import {
  CASE_STATUSES,
  DUPLICATE_GUARD_STATUSES,
} from './constants/case_status.constant';
import { ProposalResultFactory } from './proposal_result.factory';
import { Caller, CaseDraft, CaseIntake } from './types/case_intake.type';
import { CaseRecord } from './types/case_record.type';
import { ProposalResult } from './types/proposal_result.type';

const TIER_STATUSES: Record<number, string> = {
  1: CASE_STATUSES.AUTO_EXECUTED,
  2: CASE_STATUSES.PENDING_APPROVAL,
  3: CASE_STATUSES.ESCALATED,
};

// The decision pipeline: FactBuilder -> PolicyEngine -> Router -> CaseBuilder
// -> (Tier 1 only) Executor -> Notifier. The AI proposes, deterministic policy
// decides, humans oversee.
@Injectable()
export class CaseIntakeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly fact_builder_service: FactBuilderService,
    private readonly policies_service: PoliciesService,
    private readonly router_service: RouterService,
    private readonly case_builder_service: CaseBuilderService,
    private readonly executor_service: ExecutorService,
    private readonly notifier_service: NotifierService,
    private readonly cases_repository: CasesRepository,
    private readonly case_events_publisher: CaseEventsPublisher,
    private readonly proposal_result_factory: ProposalResultFactory,
  ) {}

  resolveCaller(call: CallRecord): Caller {
    return {
      customer_id: call.customer_id ?? UNKNOWN_CUSTOMER_ID,
      customer_name: call.customer_name ?? UNKNOWN_CUSTOMER_NAME,
    };
  }

  buildAiActor(call: CallRecord): Actor {
    return { actor_type: 'AI', actor_id: call.handled_by_agent_id };
  }

  // Idempotent: a repeat of the same request on the same call returns the
  // case that already exists.
  async openOrReuseCase(case_intake: CaseIntake): Promise<ProposalResult> {
    const built_facts = await this.buildFacts(case_intake);
    const existing_case = await this.findDuplicate(case_intake, built_facts);
    if (existing_case) {
      return this.proposal_result_factory.buildProposalResult(
        existing_case.case_number,
      );
    }
    return this.openCase(case_intake, built_facts);
  }

  // Used when a concern is flagged: an existing case on the same subject is
  // re-evaluated with the new signals instead of being duplicated.
  async openOrUpgradeCase(case_intake: CaseIntake): Promise<ProposalResult> {
    const built_facts = await this.buildFacts(case_intake);
    const existing_case = await this.findDuplicate(case_intake, built_facts);
    if (
      !existing_case ||
      existing_case.status === CASE_STATUSES.AUTO_EXECUTED
    ) {
      return this.openCase(case_intake, built_facts);
    }
    await this.reevaluateCase(existing_case, {
      call: case_intake.call,
      added_soft_signals: case_intake.soft_signals,
      escalation_skill: case_intake.required_skill_override,
    });
    return this.proposal_result_factory.buildProposalResult(
      existing_case.case_number,
    );
  }

  // Merges new soft signals into an undecided case and re-runs its policy.
  // A case can only move up (to Tier 3) this way, never down.
  async reevaluateCase(
    case_record: CaseRecord,
    reevaluation_request: {
      call: CallRecord;
      added_soft_signals: SoftSignals;
      escalation_skill: string | null;
    },
  ): Promise<void> {
    const soft_signals = mergeSoftSignals(
      case_record.soft_signals,
      reevaluation_request.added_soft_signals,
    );
    const facts = this.fact_builder_service.applySoftSignals(
      case_record.action_code,
      case_record.facts,
      soft_signals,
    );
    const policy_decision = await this.policies_service.decide(
      case_record.action_code,
      facts,
    );
    const tier = ROUTE_TIERS[policy_decision.evaluation.route];
    const required_skill = this.pickEscalationSkill(
      case_record,
      reevaluation_request.escalation_skill,
    );
    const should_escalate =
      tier === ESCALATION_TIER &&
      (case_record.tier !== ESCALATION_TIER ||
        required_skill !== case_record.required_skill);
    const routing_decision = await this.router_service.routeCase({
      action_code: case_record.action_code,
      tier,
      required_skill,
    });
    const reevaluation = {
      case_number: case_record.case_number,
      call_id: case_record.call_id,
      action_code: case_record.action_code,
      facts,
      soft_signals,
      policy_decision,
      routing_decision,
      tier,
    };
    await this.database.runInTransaction(
      this.buildAiActor(reevaluation_request.call),
      (transaction) =>
        this.case_builder_service.applyReevaluation(
          transaction,
          reevaluation,
          should_escalate,
        ),
    );
    await this.case_events_publisher.publishCaseUpdated(
      case_record.case_number,
    );
  }

  private buildFacts(case_intake: CaseIntake): Promise<BuiltFacts> {
    return this.fact_builder_service.buildFacts({
      action_code: case_intake.action_type.action_code,
      call: case_intake.call,
      customer_id: case_intake.caller.customer_id,
      params: case_intake.params,
      customer_statement: case_intake.customer_statement,
      soft_signals: case_intake.soft_signals,
    });
  }

  private findDuplicate(
    case_intake: CaseIntake,
    built_facts: BuiltFacts,
  ): Promise<CaseRecord | null> {
    const action_code = case_intake.action_type.action_code;
    const subject_param = ACTION_SUBJECT_PARAMS[action_code];
    const case_subject: CaseSubject | null = subject_param
      ? {
          param_name: subject_param,
          param_value: String(built_facts.resolved_params[subject_param]),
        }
      : null;
    return this.cases_repository.selectOpenCase(
      case_intake.call.call_id,
      action_code,
      case_subject,
      DUPLICATE_GUARD_STATUSES,
    );
  }

  private async openCase(
    case_intake: CaseIntake,
    built_facts: BuiltFacts,
  ): Promise<ProposalResult> {
    const case_draft = await this.draftCase(case_intake, built_facts);
    const { case_number, notification } = await this.database.runInTransaction(
      this.buildAiActor(case_intake.call),
      async (transaction) => {
        const new_case_number = await this.case_builder_service.createCase(
          transaction,
          case_draft,
        );
        const execution_result =
          case_draft.tier === AUTO_TIER
            ? await this.executor_service.executeCase(transaction, {
                case_number: new_case_number,
                call_id: case_intake.call.call_id,
                action_code: case_intake.action_type.action_code,
                customer_id: case_intake.caller.customer_id,
                params: case_draft.params,
                decided_by: null,
              })
            : null;
        const created_notification =
          await this.notifier_service.notifyCaseCreated(
            transaction,
            this.buildMessageContext(
              new_case_number,
              case_draft,
              execution_result,
            ),
          );
        return {
          case_number: new_case_number,
          notification: created_notification,
        };
      },
    );
    await this.case_events_publisher.publishCaseCreated(case_number);
    await this.notifier_service.publishCreated(notification);
    return this.proposal_result_factory.buildProposalResult(case_number);
  }

  private async draftCase(
    case_intake: CaseIntake,
    built_facts: BuiltFacts,
  ): Promise<CaseDraft> {
    const action_code = case_intake.action_type.action_code;
    const policy_decision = await this.policies_service.decide(
      action_code,
      built_facts.facts,
    );
    const tier = ROUTE_TIERS[policy_decision.evaluation.route];
    const routing_decision = await this.router_service.routeCase({
      action_code,
      tier,
      required_skill:
        case_intake.required_skill_override ??
        case_intake.action_type.required_skill,
    });
    return {
      intake: case_intake,
      // Terms the model did not specify come from the matched rule's proposal
      // (for example a 3-month repayment pause on HR-3).
      params:
        action_code === ACTION_CODES.HARDSHIP_REQUEST
          ? {
              ...(policy_decision.evaluation.proposal ?? {}),
              ...built_facts.resolved_params,
            }
          : built_facts.resolved_params,
      facts: built_facts.facts,
      policy_decision,
      routing_decision,
      tier,
      status: TIER_STATUSES[tier],
    };
  }

  private buildMessageContext(
    case_number: string,
    case_draft: CaseDraft,
    execution_result: ExecutionResult | null,
  ) {
    return {
      case_number,
      call_id: case_draft.intake.call.call_id,
      customer_id: case_draft.intake.caller.customer_id,
      action_code: case_draft.intake.action_type.action_code,
      tier: case_draft.tier,
      facts: case_draft.facts,
      params: case_draft.params,
      response_due_on: case_draft.routing_decision.response_due_on,
      execution_result,
    };
  }

  private pickEscalationSkill(
    case_record: CaseRecord,
    escalation_skill: string | null,
  ): string | null {
    // A person-to-person handover follows the newest concern; any other case
    // already at Tier 3 stays with the specialist skill it was routed to.
    const should_follow_concern =
      case_record.tier !== ESCALATION_TIER ||
      case_record.action_code === ACTION_CODES.HUMAN_CALLBACK;
    return should_follow_concern && escalation_skill
      ? escalation_skill
      : case_record.required_skill;
  }
}
