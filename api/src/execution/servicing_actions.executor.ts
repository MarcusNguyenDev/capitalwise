import { Injectable } from '@nestjs/common';

import { CardServicingAdapter } from '../core_banking/card_servicing.adapter';
import { CustomerServicingAdapter } from '../core_banking/customer_servicing.adapter';
import { TransactionClient } from '../database/types/transaction_client.type';
import { ACTION_CODES } from '../facts/constants/action_code.constant';
import {
  addBusinessDays,
  addCalendarDays,
  getBankToday,
} from '../shared_kernel/utils/bank_calendar.util';
import { formatCurrency } from '../shared_kernel/utils/format_currency.util';
import {
  DAYS_PER_WEEK,
  DISPUTE_INVESTIGATION_BUSINESS_DAYS,
  POSTED_STATEMENT_BUSINESS_DAYS,
} from './constants/execution_defaults.constant';
import {
  ExecutionOutcome,
  ExecutionRequest,
} from './types/execution_request.type';

// RAISE_DISPUTE, REQUEST_STATEMENT, UPDATE_PREFERENCES, PAYMENT_ARRANGEMENT
// and SERVICE_REQUEST.
@Injectable()
export class ServicingActionsExecutor {
  constructor(
    private readonly card_servicing_adapter: CardServicingAdapter,
    private readonly customer_servicing_adapter: CustomerServicingAdapter,
  ) {}

  runServicingAction(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    switch (execution_request.action_code) {
      case ACTION_CODES.RAISE_DISPUTE:
        return this.lodgeDispute(transaction, execution_request);
      case ACTION_CODES.REQUEST_STATEMENT:
        return this.requestStatement(transaction, execution_request);
      case ACTION_CODES.UPDATE_PREFERENCES:
        return this.updatePreferences(transaction, execution_request);
      case ACTION_CODES.PAYMENT_ARRANGEMENT:
        return this.setUpPaymentArrangement(transaction, execution_request);
      default:
        return Promise.resolve(this.completeServiceRequest(execution_request));
    }
  }

  // A provisional credit is only given when the matched rule proposed it
  // (RD-3: a duplicate confirmed by the ledger).
  private async lodgeDispute(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const { params } = execution_request;
    const dispute = await this.customer_servicing_adapter.lodgeDispute(
      transaction,
      {
        new_dispute: {
          txn_id: String(params.txn_id),
          account_id: String(params.account_id),
          customer_id: execution_request.customer_id,
          reason: String(params.reason),
          details: typeof params.details === 'string' ? params.details : null,
          amount: Number(params.amount),
          expected_by: addBusinessDays(
            getBankToday(),
            DISPUTE_INVESTIGATION_BUSINESS_DAYS,
          ),
          case_number: execution_request.case_number,
        },
        has_provisional_credit: params.provisional_credit === true,
        merchant: typeof params.merchant === 'string' ? params.merchant : null,
      },
    );
    const credit_note = dispute.provisional_credit_txn_id
      ? ` Provisional credit of ${formatCurrency(dispute.amount)} applied.`
      : '';
    return {
      result: dispute,
      contact_event_type: 'DISPUTE_LODGED',
      contact_summary: `Dispute ${dispute.dispute_id} lodged for ${formatCurrency(dispute.amount)} (${dispute.reason}).${credit_note}`,
    };
  }

  private async requestStatement(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const { params, customer_id } = execution_request;
    const delivery = params.delivery === 'EMAIL' ? 'EMAIL' : 'POST';
    const [address_profile, preferences, account] = await Promise.all([
      this.card_servicing_adapter.getAddressProfile(customer_id),
      this.customer_servicing_adapter.getPreferences(customer_id),
      this.customer_servicing_adapter.findAccountProfile(
        String(params.account_id),
      ),
    ]);
    const today = getBankToday();
    const statement_request =
      await this.customer_servicing_adapter.requestStatement(transaction, {
        customer_id,
        account_id: String(params.account_id),
        months: Number(params.months),
        delivery,
        delivery_to:
          delivery === 'EMAIL' ? address_profile.email : address_profile.suburb,
        is_large_print: preferences.large_print_letters,
        expected_by:
          delivery === 'EMAIL'
            ? today
            : addBusinessDays(today, POSTED_STATEMENT_BUSINESS_DAYS),
        case_number: execution_request.case_number,
      });
    return {
      result: {
        ...statement_request,
        account_nickname: account?.nickname ?? null,
      },
      contact_event_type: 'STATEMENT_REQUESTED',
      contact_summary: `${statement_request.months} months of statements requested by ${delivery === 'EMAIL' ? 'email' : 'post'}.`,
    };
  }

  private async updatePreferences(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const changed = execution_request.params as Record<string, boolean>;
    const preferences = await this.customer_servicing_adapter.updatePreferences(
      transaction,
      execution_request.customer_id,
      changed,
    );
    return {
      result: { changed, preferences },
      contact_event_type: 'PREFERENCES_UPDATED',
      contact_summary: `Contact preferences changed: ${Object.entries(changed)
        .map(
          ([preference_name, is_on]) =>
            `${preference_name} ${is_on ? 'on' : 'off'}`,
        )
        .join(', ')}.`,
    };
  }

  private async setUpPaymentArrangement(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const { params } = execution_request;
    const weeks = Number(params.weeks);
    const start_on = getBankToday();
    const account = await this.customer_servicing_adapter.findAccountProfile(
      String(params.account_id),
    );
    const arrangement =
      await this.customer_servicing_adapter.setUpPaymentArrangement(
        transaction,
        {
          account_id: String(params.account_id),
          customer_id: execution_request.customer_id,
          weeks,
          weekly_amount:
            typeof params.weekly_amount === 'number'
              ? params.weekly_amount
              : null,
          start_on,
          end_on: addCalendarDays(start_on, weeks * DAYS_PER_WEEK),
          case_number: execution_request.case_number,
        },
      );
    return {
      result: { ...arrangement, account_nickname: account?.nickname ?? null },
      contact_event_type: 'PAYMENT_ARRANGEMENT',
      contact_summary: `${weeks}-week payment arrangement set up until ${arrangement.end_on}. Late fees paused.`,
    };
  }

  private completeServiceRequest(
    execution_request: ExecutionRequest,
  ): ExecutionOutcome {
    const staff_name = execution_request.decided_by?.name ?? 'a staff member';
    return {
      result: {
        request_type: execution_request.params.request_type ?? null,
        completed_by_staff_id: execution_request.decided_by?.staff_id ?? null,
      },
      contact_event_type: 'SERVICE_REQUEST',
      contact_summary: `Service request ${String(execution_request.params.request_type)} completed by ${staff_name}.`,
    };
  }
}
