import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { CallNotFoundError } from '../call_records/errors/call_not_found.error';
import { CasesService } from '../cases/cases.service';
import { describeReasonCode } from '../cases/constants/reason_code.constant';
import { CaseExplanationRow } from '../cases/types/case_record.type';
import { normaliseSoftSignals } from '../facts/utils/merge_soft_signals.util';
import { TIER_ROUTES } from '../policies/constants/route_tier.constant';
import { explainPolicy } from '../policies/policy_engine';
import { clampLimit } from '../shared_kernel/utils/clamp_limit.util';
import { buildCustomerExplanation } from './customer_explanation';
import { ListCallsQueryDto } from './dto/list_calls_query.dto';
import {
  ExplainabilityRepository,
  TimelineIntervention,
  TimelineTurn,
} from './explainability.repository';

const DEFAULT_CALL_LIMIT = 50;
const MAX_CALL_LIMIT = 200;

@Injectable()
export class ExplainabilityService {
  constructor(
    private readonly explainability_repository: ExplainabilityRepository,
    private readonly cases_service: CasesService,
    private readonly audit_service: AuditService,
  ) {}

  // The full trace of one decision: what the customer said, what the AI
  // looked up, the facts, every policy condition, the versions in force and
  // the human who decided.
  async explainCase(case_number: string) {
    const case_explanation = await this.cases_service.getCase(case_number);
    const [tool_calls, interventions, audit_trail] = await Promise.all([
      this.explainability_repository.selectCaseToolCalls(case_number),
      case_explanation.call_id
        ? this.explainability_repository.selectCallInterventions(
            case_explanation.call_id,
          )
        : Promise.resolve([]),
      this.audit_service.listCaseTrail(case_number),
    ]);
    return {
      case: case_explanation,
      customer_said: {
        statement: case_explanation.customer_statement,
        quotes: normaliseSoftSignals(case_explanation.soft_signals).quotes,
      },
      tool_calls,
      facts: this.cases_service
        .buildEvidence(case_explanation)
        .map(({ fact, label, value, source }) => ({
          fact,
          label,
          value,
          source,
        })),
      rules: explainPolicy(
        case_explanation.policy_definition,
        case_explanation.facts,
      ),
      outcome: {
        route: TIER_ROUTES[case_explanation.tier],
        tier: case_explanation.tier,
        recommendation: case_explanation.recommendation,
        confidence: case_explanation.confidence,
        matched_rule_id: case_explanation.matched_rule_id,
        reason: case_explanation.route_reason,
      },
      versions: {
        model: case_explanation.model,
        prompt_version: case_explanation.prompt_version,
        policy_id: case_explanation.policy_id,
        policy_version: case_explanation.policy_version,
        policy_approved_by: case_explanation.policy_approved_by,
      },
      interventions,
      human_decision: this.describeHumanDecision(case_explanation),
      audit_trail,
      customer_explanation: buildCustomerExplanation(case_explanation),
    };
  }

  listCalls(calls_query: ListCallsQueryDto) {
    return this.explainability_repository.selectCalls(
      calls_query.status ?? 'ended',
      clampLimit(calls_query.limit, {
        default_limit: DEFAULT_CALL_LIMIT,
        max_limit: MAX_CALL_LIMIT,
      }),
    );
  }

  async getCallTimeline(call_id: string) {
    const call = await this.explainability_repository.selectCall(call_id);
    if (!call) {
      throw new CallNotFoundError(call_id);
    }
    const [turns, interventions] = await Promise.all([
      this.explainability_repository.selectCallTurns(call_id),
      this.explainability_repository.selectCallInterventions(call_id),
    ]);
    const started_at_ms = new Date(call.started_at).getTime();
    const events = [
      ...turns.map((turn) => this.describeTurn(turn, started_at_ms)),
      ...interventions.map((intervention) =>
        this.describeIntervention(intervention, started_at_ms),
      ),
    ].sort((first, second) => first.offset_ms - second.offset_ms);
    return { call, events };
  }

  private describeHumanDecision(case_explanation: CaseExplanationRow) {
    if (!case_explanation.decision) {
      return null;
    }
    return {
      decision: case_explanation.decision,
      reason_code: case_explanation.decision_reason_code,
      reason_label: describeReasonCode(case_explanation.decision_reason_code),
      decided_by: case_explanation.decided_by,
      decided_by_name: case_explanation.decided_by_name,
      decided_by_role: case_explanation.decided_by_role,
      decided_at: case_explanation.decided_at,
    };
  }

  private describeTurn(turn: TimelineTurn, started_at_ms: number) {
    const offset_ms = Math.max(
      new Date(turn.created_at).getTime() - started_at_ms,
      0,
    );
    if (turn.tool_name) {
      return {
        offset_ms,
        kind: 'TOOL' as const,
        speaker: turn.speaker,
        tool_name: turn.tool_name,
        tool_args: turn.tool_args,
        tool_result: turn.tool_result,
        latency_ms: turn.latency_ms,
        created_at: turn.created_at,
      };
    }
    return {
      offset_ms,
      kind: 'TURN' as const,
      speaker: turn.speaker,
      text: turn.text,
      latency_ms: turn.latency_ms,
      created_at: turn.created_at,
    };
  }

  private describeIntervention(
    intervention: TimelineIntervention,
    started_at_ms: number,
  ) {
    return {
      offset_ms: Math.max(
        new Date(intervention.created_at).getTime() - started_at_ms,
        0,
      ),
      kind: 'INTERVENTION' as const,
      intervention_type: intervention.type,
      staff_name: intervention.staff_name,
      text: intervention.text,
      created_at: intervention.created_at,
    };
  }
}
