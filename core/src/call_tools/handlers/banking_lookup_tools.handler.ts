import { Injectable } from '@nestjs/common';

import { EngineApiClient } from '../../engine_api/engine_api.client';
import { CallerReference } from '../../engine_api/types/caller_reference.type';
import { GetFeeHistoryArgsDto } from '../dto/get_fee_history_args.dto';
import { GetLoanDetailsArgsDto } from '../dto/get_loan_details_args.dto';
import { GetRecentTransactionsArgsDto } from '../dto/get_recent_transactions_args.dto';
import { ToolContext } from '../types/tool_context.type';

// The dispatcher only calls these for a confirmed caller, so the customer id
// is present. The call id lets the api check that it is the verified caller.
function readCaller(tool_context: ToolContext): CallerReference {
  return {
    customer_id: tool_context.call.customer_id as string,
    call_id: tool_context.call.call_id,
  };
}

@Injectable()
export class BankingLookupToolsHandler {
  constructor(private readonly engine_api_client: EngineApiClient) {}

  async getCustomerOverview(
    tool_context: ToolContext,
  ): Promise<Record<string, unknown>> {
    const customer_overview = await this.engine_api_client.getCustomerOverview(
      readCaller(tool_context),
    );
    // Only what the model needs to hold the conversation: no contact details,
    // no flag notes, no account numbers.
    return {
      // Level 1: no balances and no card digits (the api leaves them out).
      is_reduced_view: customer_overview.is_reduced_view === true,
      first_name: customer_overview.first_name,
      tenure_years: customer_overview.tenure_years,
      has_care_flag: customer_overview.has_care_flag,
      accounts: (customer_overview.accounts ?? []).map((account) => ({
        account_id: account.account_id,
        nickname: account.nickname,
        category: account.category,
        current_balance: account.current_balance,
        available_balance: account.available_balance,
      })),
      cards: (customer_overview.cards ?? []).map((card) => ({
        card_id: card.card_id,
        card_type: card.card_type,
        last4: card.last4,
        status: card.status,
      })),
    };
  }

  getRecentTransactions(
    tool_context: ToolContext,
    tool_args: GetRecentTransactionsArgsDto,
  ): Promise<Record<string, unknown>> {
    return this.engine_api_client.getTransactions(readCaller(tool_context), {
      account_id: tool_args.account_id,
      hours: tool_args.hours,
    });
  }

  getFeeHistory(
    tool_context: ToolContext,
    tool_args: GetFeeHistoryArgsDto,
  ): Promise<Record<string, unknown>> {
    return this.engine_api_client.getFeeHistory(
      readCaller(tool_context),
      tool_args.account_id,
    );
  }

  getIncomeSummary(
    tool_context: ToolContext,
  ): Promise<Record<string, unknown>> {
    return this.engine_api_client.getIncomeSummary(readCaller(tool_context));
  }

  getLoanDetails(
    tool_context: ToolContext,
    tool_args: GetLoanDetailsArgsDto,
  ): Promise<Record<string, unknown>> {
    return this.engine_api_client.getLoanDetails(
      readCaller(tool_context),
      tool_args.account_id,
    );
  }

  getHeldPayments(tool_context: ToolContext): Promise<Record<string, unknown>> {
    return this.engine_api_client.getHeldPayments(readCaller(tool_context));
  }
}
