import { Injectable } from '@nestjs/common';

import {
  ESCALATION_TIER,
  TIER_ROUTES,
} from '../policies/constants/route_tier.constant';
import { RouterService } from '../routing/router.service';
import { StaffDirectoryService } from '../routing/staff_directory.service';
import { StaffMember } from '../routing/types/staff_member.type';
import { CasesRepository } from './cases.repository';
import {
  CASE_STATUSES,
  EXECUTED_STATUSES,
} from './constants/case_status.constant';
import { CaseNotFoundError } from './errors/case_not_found.error';
import { buildCustomerMessage } from './proposal_messages';
import { CaseRecord } from './types/case_record.type';
import { ProposalResult } from './types/proposal_result.type';

// Builds the ProposalResult the AI reads back, always from the stored case so
// a first response and a repeated (idempotent) one say the same thing.
@Injectable()
export class ProposalResultFactory {
  constructor(
    private readonly cases_repository: CasesRepository,
    private readonly staff_directory_service: StaffDirectoryService,
    private readonly router_service: RouterService,
  ) {}

  async buildProposalResult(case_number: string): Promise<ProposalResult> {
    const case_record =
      await this.cases_repository.selectCaseExplanation(case_number);
    if (!case_record) {
      throw new CaseNotFoundError(case_number);
    }
    const assigned_staff = case_record.assigned_staff_id
      ? await this.staff_directory_service.findStaffMember(
          case_record.assigned_staff_id,
        )
      : null;
    const is_executed = EXECUTED_STATUSES.includes(case_record.status);
    const execution_result = is_executed
      ? await this.cases_repository.selectExecutionResult(case_number)
      : null;
    const expected_wait_minutes = this.estimateWait(
      case_record,
      assigned_staff,
    );
    const expected_timing = this.router_service.describeTiming({
      action_code: case_record.action_code,
      tier: case_record.tier,
      expected_wait_minutes,
      response_due_on: case_record.response_due_on,
    });
    return {
      case_number,
      action_code: case_record.action_code,
      tier: case_record.tier,
      route: TIER_ROUTES[case_record.tier],
      status: case_record.status,
      recommendation: case_record.recommendation,
      confidence: case_record.confidence,
      matched_rule_id: case_record.matched_rule_id,
      reason: case_record.route_reason,
      policy_id: case_record.policy_id,
      policy_version: case_record.policy_version,
      required_skill: case_record.required_skill,
      routing_rule: case_record.routing_rule,
      handled_by: assigned_staff
        ? {
            staff_id: assigned_staff.staff_id,
            name: assigned_staff.name,
            role: assigned_staff.role,
          }
        : null,
      expected_timing,
      expected_wait_minutes,
      response_due_on: case_record.response_due_on,
      is_executed,
      execution_result,
      customer_message: buildCustomerMessage({
        case_number,
        action_code: case_record.action_code,
        tier: case_record.tier,
        is_executed,
        staff_name: assigned_staff?.name ?? null,
        expected_timing,
        card_last4: this.readCardLast4(case_record, execution_result),
      }),
    };
  }

  private estimateWait(
    case_record: CaseRecord,
    assigned_staff: StaffMember | null,
  ): number | null {
    if (case_record.tier !== ESCALATION_TIER) {
      return null;
    }
    if (!assigned_staff) {
      return this.router_service.estimateWaitMinutes(null);
    }
    // The specialist's load already counts this case; the wait is for the
    // work ahead of it.
    const own_weight = case_record.status === CASE_STATUSES.ESCALATED ? 1 : 0;
    return this.router_service.estimateWaitMinutes({
      ...assigned_staff,
      current_load: Math.max(assigned_staff.current_load - own_weight, 0),
    });
  }

  private readCardLast4(
    case_record: CaseRecord,
    execution_result: Record<string, unknown> | null,
  ): string | null {
    const card_last4 =
      execution_result?.card_last4 ?? case_record.facts.card_last4;
    return typeof card_last4 === 'string' ? card_last4 : null;
  }
}
