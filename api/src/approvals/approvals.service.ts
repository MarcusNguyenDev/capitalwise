import { Injectable } from '@nestjs/common';

import { BatchCandidate, CasesRepository } from '../cases/cases.repository';
import { DecisionsService } from '../cases/decisions.service';
import { ExecutionResult } from '../execution/types/execution_request.type';
import { ACTION_CODES } from '../facts/constants/action_code.constant';
import { StaffDirectoryService } from '../routing/staff_directory.service';
import { BatchApproveDto } from './dto/batch_approve.dto';

const MIN_BATCH_SIZE = 2;

const BATCH_NOUNS: Record<string, string> = {
  [ACTION_CODES.REFUND_FEE]: 'fee refunds',
  [ACTION_CODES.HARDSHIP_REQUEST]: 'hardship requests',
  [ACTION_CODES.PAYMENT_ARRANGEMENT]: 'payment arrangements',
  [ACTION_CODES.RAISE_DISPUTE]: 'disputes',
  [ACTION_CODES.SERVICE_REQUEST]: 'service requests',
};

export interface BatchGroup {
  group_key: string;
  action_code: string;
  recommendation: string;
  matched_rule_id: string;
  route_reason: string;
  case_count: number;
  total_amount: number;
  label: string;
  cases: Pick<
    BatchCandidate,
    'case_number' | 'customer_name' | 'amount' | 'summary' | 'created_at'
  >[];
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly cases_repository: CasesRepository,
    private readonly decisions_service: DecisionsService,
    private readonly staff_directory_service: StaffDirectoryService,
  ) {}

  listInbox() {
    return this.cases_repository.selectApprovalInbox();
  }

  // Cases the same rule recommended approving can be approved together.
  async listBatchGroups(): Promise<BatchGroup[]> {
    const batch_candidates =
      await this.cases_repository.selectBatchCandidates();
    const groups_by_key = new Map<string, BatchGroup>();
    for (const batch_candidate of batch_candidates) {
      const group_key = `${batch_candidate.action_code}:${batch_candidate.recommendation}:${batch_candidate.matched_rule_id}`;
      const batch_group =
        groups_by_key.get(group_key) ??
        this.startBatchGroup(group_key, batch_candidate);
      batch_group.cases.push({
        case_number: batch_candidate.case_number,
        customer_name: batch_candidate.customer_name,
        amount: batch_candidate.amount,
        summary: batch_candidate.summary,
        created_at: batch_candidate.created_at,
      });
      groups_by_key.set(group_key, batch_group);
    }
    return [...groups_by_key.values()]
      .filter((batch_group) => batch_group.cases.length >= MIN_BATCH_SIZE)
      .map((batch_group) => this.summariseBatchGroup(batch_group));
  }

  // Each case commits on its own, so one failure never blocks the rest.
  async approveBatch(batch_approval: BatchApproveDto) {
    await this.staff_directory_service.getStaffMember(batch_approval.staff_id);
    const approved: {
      case_number: string;
      execution_result: ExecutionResult | null;
    }[] = [];
    const failed: { case_number: string; message: string }[] = [];
    for (const case_number of batch_approval.case_numbers) {
      try {
        const decision_result = await this.decisions_service.decideCase(
          case_number,
          {
            staff_id: batch_approval.staff_id,
            decision: 'APPROVED',
            reason_code: batch_approval.reason_code,
          },
        );
        approved.push({
          case_number,
          execution_result: decision_result.execution_result,
        });
      } catch (error) {
        failed.push({ case_number, message: (error as Error).message });
      }
    }
    return { approved, failed };
  }

  private startBatchGroup(
    group_key: string,
    first_candidate: BatchCandidate,
  ): BatchGroup {
    return {
      group_key,
      action_code: first_candidate.action_code,
      recommendation: first_candidate.recommendation,
      matched_rule_id: first_candidate.matched_rule_id,
      route_reason: first_candidate.route_reason,
      case_count: 0,
      total_amount: 0,
      label: '',
      cases: [],
    };
  }

  private summariseBatchGroup(batch_group: BatchGroup): BatchGroup {
    const case_count = batch_group.cases.length;
    const total_cents = batch_group.cases.reduce(
      (running_cents, batch_case) =>
        running_cents + Math.round((batch_case.amount ?? 0) * 100),
      0,
    );
    const batch_noun = BATCH_NOUNS[batch_group.action_code] ?? 'cases';
    return {
      ...batch_group,
      case_count,
      total_amount: total_cents / 100,
      label: `Approve ${case_count} matching ${batch_noun}`,
    };
  }
}
