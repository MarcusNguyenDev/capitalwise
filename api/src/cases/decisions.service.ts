import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { ExecutorService } from '../execution/executor.service';
import { ExecutionResult } from '../execution/types/execution_request.type';
import { ACTION_CODES } from '../facts/constants/action_code.constant';
import { NotifierService } from '../notifications/notifier.service';
import { NotificationRecord } from '../notifications/types/notification.type';
import { StaffDirectoryService } from '../routing/staff_directory.service';
import { StaffMember } from '../routing/types/staff_member.type';
import { CaseEventsPublisher } from './case_events.publisher';
import { CasesRepository } from './cases.repository';
import {
  CASE_STATUSES,
  UNDECIDED_STATUSES,
} from './constants/case_status.constant';
import { HUMAN_JOINED_REASON_CODE } from './constants/reason_code.constant';
import { CaseDecision } from './dto/decide_case.dto';
import { mergeEditedParams } from './edited_params';
import { CaseAlreadyDecidedError } from './errors/case_already_decided.error';
import { CaseNotFoundError } from './errors/case_not_found.error';
import { CaseExplanationRow, CaseRecord } from './types/case_record.type';

export interface DecisionRequest {
  staff_id: string;
  decision: CaseDecision;
  reason_code: string;
  edited_params?: Record<string, unknown>;
}

export interface DecisionResult {
  case: CaseExplanationRow;
  is_executed: boolean;
  execution_result: ExecutionResult | null;
}

interface DecisionOutcome {
  execution_result: ExecutionResult | null;
  notification: NotificationRecord | null;
}

const REJECTED_DECISION: CaseDecision = 'REJECTED';

// Human oversight: a staff member approves, edits or rejects what the AI
// proposed. The decision, the bank write and the customer SMS are one
// transaction, recorded under the staff member's name.
@Injectable()
export class DecisionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly cases_repository: CasesRepository,
    private readonly staff_directory_service: StaffDirectoryService,
    private readonly executor_service: ExecutorService,
    private readonly notifier_service: NotifierService,
    private readonly case_events_publisher: CaseEventsPublisher,
  ) {}

  async decideCase(
    case_number: string,
    decision_request: DecisionRequest,
  ): Promise<DecisionResult> {
    const staff_member = await this.staff_directory_service.getStaffMember(
      decision_request.staff_id,
    );
    const decision_outcome = await this.database.runInTransaction(
      { actor_type: 'STAFF', actor_id: staff_member.staff_id },
      (transaction) =>
        this.applyDecision(
          transaction,
          case_number,
          decision_request,
          staff_member,
        ),
    );
    await this.case_events_publisher.publishCaseUpdated(case_number);
    await this.notifier_service.publishCreated(decision_outcome.notification);
    const decided_case =
      await this.cases_repository.selectCaseExplanation(case_number);
    return {
      case: decided_case as CaseExplanationRow,
      is_executed: decision_request.decision !== REJECTED_DECISION,
      execution_result: decision_outcome.execution_result,
    };
  }

  // Called when a specialist takes over the call: the customer asked for a
  // person and got one, so the open handover cases are complete.
  async closeHandoverCases(
    call_id: string,
    staff_id: string,
  ): Promise<string[]> {
    await this.staff_directory_service.getStaffMember(staff_id);
    const undecided_cases = await this.cases_repository.selectCallCases(
      call_id,
      UNDECIDED_STATUSES,
    );
    const handover_cases = undecided_cases.filter(
      (undecided_case) =>
        undecided_case.action_code === ACTION_CODES.HUMAN_CALLBACK,
    );
    for (const handover_case of handover_cases) {
      await this.decideCase(handover_case.case_number, {
        staff_id,
        decision: 'APPROVED',
        reason_code: HUMAN_JOINED_REASON_CODE.code,
      });
    }
    return handover_cases.map((handover_case) => handover_case.case_number);
  }

  private async applyDecision(
    transaction: TransactionClient,
    case_number: string,
    decision_request: DecisionRequest,
    staff_member: StaffMember,
  ): Promise<DecisionOutcome> {
    const case_record = await this.lockUndecidedCase(transaction, case_number);
    const is_approved = decision_request.decision !== REJECTED_DECISION;
    const params =
      decision_request.decision === 'EDITED_AND_APPROVED'
        ? mergeEditedParams(case_record, decision_request.edited_params)
        : case_record.params;
    await this.cases_repository.updateCaseDecision(transaction, {
      case_number,
      decision: decision_request.decision,
      reason_code: decision_request.reason_code,
      staff_id: staff_member.staff_id,
      params,
    });
    const execution_result = is_approved
      ? await this.executeApprovedCase(transaction, {
          case_record,
          params,
          staff_member,
        })
      : null;
    const notification = await this.notifier_service.notifyCaseDecided(
      transaction,
      {
        case_number,
        call_id: case_record.call_id,
        customer_id: case_record.customer_id,
        action_code: case_record.action_code,
        tier: case_record.tier,
        facts: case_record.facts,
        params,
        response_due_on: case_record.response_due_on,
        execution_result,
        is_approved,
      },
    );
    return { execution_result, notification };
  }

  private async lockUndecidedCase(
    transaction: TransactionClient,
    case_number: string,
  ): Promise<CaseRecord> {
    const case_record = await this.cases_repository.selectCaseForUpdate(
      transaction,
      case_number,
    );
    if (!case_record) {
      throw new CaseNotFoundError(case_number);
    }
    if (!UNDECIDED_STATUSES.includes(case_record.status)) {
      throw new CaseAlreadyDecidedError(case_number, case_record.status);
    }
    return case_record;
  }

  private async executeApprovedCase(
    transaction: TransactionClient,
    approval: {
      case_record: CaseRecord;
      params: Record<string, unknown>;
      staff_member: StaffMember;
    },
  ): Promise<ExecutionResult> {
    const { case_record } = approval;
    const execution_result = await this.executor_service.executeCase(
      transaction,
      {
        case_number: case_record.case_number,
        call_id: case_record.call_id,
        action_code: case_record.action_code,
        customer_id: case_record.customer_id,
        params: approval.params,
        decided_by: approval.staff_member,
      },
    );
    await this.cases_repository.updateCaseStatus(
      transaction,
      case_record.case_number,
      CASE_STATUSES.EXECUTED,
    );
    return execution_result;
  }
}
