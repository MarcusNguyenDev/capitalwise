import { Injectable } from '@nestjs/common';

import { AuditRecorderService } from '../audit/audit_recorder.service';
import { AUDIT_EVENT_TYPES } from '../audit/constants/audit_event_type.constant';
import { CoreBankingAdapter } from '../core_banking/core_banking.adapter';
import { TransactionClient } from '../database/types/transaction_client.type';
import { ACTION_CODES } from '../facts/constants/action_code.constant';
import { formatCurrency } from '../shared_kernel/utils/format_currency.util';
import {
  DEFAULT_ARRANGEMENT_MONTHS,
  DEFAULT_ARRANGEMENT_TYPE,
  FRAUD_SKILL,
} from './constants/execution_defaults.constant';
import { SkillRequiredError } from './errors/skill_required.error';
import {
  ExecutionOutcome,
  ExecutionRequest,
  ExecutionResult,
} from './types/execution_request.type';

// Carries out a decided action through the CoreBankingAdapter. Always runs
// inside the caller's transaction, so the bank write, the case status change
// and the audit trail commit or roll back together.
@Injectable()
export class ExecutorService {
  constructor(
    private readonly core_banking_adapter: CoreBankingAdapter,
    private readonly audit_recorder_service: AuditRecorderService,
  ) {}

  async executeCase(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionResult> {
    const execution_outcome = await this.runAction(
      transaction,
      execution_request,
    );
    await this.audit_recorder_service.recordEvent(transaction, {
      event_type: AUDIT_EVENT_TYPES.ACTION_EXECUTED,
      call_id: execution_request.call_id,
      case_number: execution_request.case_number,
      detail: {
        action_code: execution_request.action_code,
        result: execution_outcome.result,
      },
    });
    await this.core_banking_adapter.recordContact(transaction, {
      customer_id: execution_request.customer_id,
      event_type: execution_outcome.contact_event_type,
      summary: `${execution_outcome.contact_summary} Case ${execution_request.case_number}.`,
    });
    return execution_outcome.result;
  }

  private runAction(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    switch (execution_request.action_code) {
      case ACTION_CODES.LOCK_CARD:
        return this.lockCard(transaction, execution_request);
      case ACTION_CODES.REFUND_FEE:
        return this.refundFee(transaction, execution_request);
      case ACTION_CODES.HARDSHIP_REQUEST:
        return this.recordArrangement(transaction, execution_request);
      case ACTION_CODES.RELEASE_HELD_PAYMENT:
        return this.releaseHeldPayment(transaction, execution_request);
      default:
        return Promise.resolve(this.recordHumanHandover(execution_request));
    }
  }

  private async lockCard(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const lock_result = await this.core_banking_adapter.lockCard(
      transaction,
      String(execution_request.params.card_id),
    );
    return {
      result: lock_result,
      contact_event_type: 'CARD_LOCKED',
      contact_summary: `Card ending ${lock_result.card_last4} temporarily locked over the phone.`,
    };
  }

  private async refundFee(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const refund_result = await this.core_banking_adapter.refundFee(
      transaction,
      {
        fee_txn_id: String(execution_request.params.fee_txn_id),
        amount: Number(execution_request.params.amount),
      },
    );
    return {
      result: refund_result,
      contact_event_type: 'FEE_REFUND',
      contact_summary: `Fee refund of ${formatCurrency(refund_result.amount)} approved and credited.`,
    };
  }

  private async recordArrangement(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const { params } = execution_request;
    const account_id = String(params.account_id);
    const months = Number(params.months ?? DEFAULT_ARRANGEMENT_MONTHS);
    const loan = await this.core_banking_adapter.getLoan(account_id);
    const arrangement =
      await this.core_banking_adapter.recordHardshipArrangement(transaction, {
        account_id,
        customer_id: execution_request.customer_id,
        arrangement_type: String(
          params.arrangement_type ?? DEFAULT_ARRANGEMENT_TYPE,
        ),
        months,
        case_number: execution_request.case_number,
      });
    return {
      result: { ...arrangement, months, account_nickname: loan.nickname },
      contact_event_type: 'HARDSHIP_ARRANGEMENT',
      contact_summary: `Hardship arrangement approved: ${months}-month ${arrangement.arrangement_type} from ${arrangement.start_on}.`,
    };
  }

  // Releasing held money is never automatic: only a fraud specialist's
  // decision can reach this line.
  private async releaseHeldPayment(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const has_fraud_skill =
      execution_request.decided_by?.skills.includes(FRAUD_SKILL) ?? false;
    if (!has_fraud_skill) {
      throw new SkillRequiredError(FRAUD_SKILL, execution_request.action_code);
    }
    const release_result = await this.core_banking_adapter.releaseHeldPayment(
      transaction,
      String(execution_request.params.txn_id),
    );
    return {
      result: release_result,
      contact_event_type: 'HELD_PAYMENT_RELEASED',
      contact_summary: `Held payment of ${formatCurrency(release_result.amount)} released by a fraud specialist.`,
    };
  }

  private recordHumanHandover(
    execution_request: ExecutionRequest,
  ): ExecutionOutcome {
    const staff_name = execution_request.decided_by?.name ?? 'a specialist';
    return {
      result: {
        handled_by_staff_id: execution_request.decided_by?.staff_id ?? null,
      },
      contact_event_type: 'HUMAN_HANDOVER',
      contact_summary: `Call handed from the AI specialist to ${staff_name}.`,
    };
  }
}
