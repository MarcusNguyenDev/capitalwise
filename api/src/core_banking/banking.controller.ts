import { Controller, Get, Param, Query } from '@nestjs/common';

import { IDENTITY_LEVELS } from '../identity_records/constants/identity_level.constant';
import { IdentityRecordsService } from '../identity_records/identity_records.service';
import { IdentitySummary } from '../identity_records/types/identity_attempt.type';
import { CoreBankingAdapter } from './core_banking.adapter';
import { CallerQueryDto } from './dto/caller_query.dto';
import { FeeHistoryQueryDto } from './dto/fee_history_query.dto';
import { ListTransactionsQueryDto } from './dto/list_transactions_query.dto';
import { LookupCustomerQueryDto } from './dto/lookup_customer_query.dto';
import { reduceCustomerOverview } from './utils/reduce_customer_overview.util';

// Account reads. With ?call_id= (how core calls them for the AI) the caller
// must be verified as this very customer: level 1 for a reduced overview,
// level 2 for the full overview and everything else, because balances,
// transactions, income and card digits answer level 2 questions. Otherwise
// 403 IDENTITY_LEVEL_REQUIRED. Without call_id they are staff console reads.
@Controller('banking')
export class BankingController {
  constructor(
    private readonly core_banking_adapter: CoreBankingAdapter,
    private readonly identity_records_service: IdentityRecordsService,
  ) {}

  @Get('callers')
  listCallers() {
    return this.core_banking_adapter.listCallers();
  }

  @Get('customers/lookup')
  lookupCustomer(@Query() lookup_query: LookupCustomerQueryDto) {
    return this.core_banking_adapter.lookupCustomerByMobile(
      lookup_query.mobile_phone,
    );
  }

  @Get('customers/:customer_id/overview')
  async getOverview(
    @Param('customer_id') customer_id: string,
    @Query() caller_query: CallerQueryDto,
  ) {
    const identity_summary = await this.assertCallerAccess(
      customer_id,
      caller_query.call_id,
      IDENTITY_LEVELS.BASIC,
    );
    const profile =
      await this.core_banking_adapter.getCustomerProfile(customer_id);
    if (!identity_summary) {
      return profile;
    }
    if (identity_summary.identity_level < IDENTITY_LEVELS.ENHANCED) {
      return reduceCustomerOverview(profile, identity_summary.identity_level);
    }
    return {
      ...profile,
      identity_level: identity_summary.identity_level,
      is_reduced_view: false,
    };
  }

  @Get('customers/:customer_id/transactions')
  async getTransactions(
    @Param('customer_id') customer_id: string,
    @Query() transactions_query: ListTransactionsQueryDto,
  ) {
    await this.assertCallerAccess(
      customer_id,
      transactions_query.call_id,
      IDENTITY_LEVELS.ENHANCED,
    );
    return this.core_banking_adapter.getTransactions(
      customer_id,
      transactions_query.account_id,
      transactions_query.hours,
    );
  }

  @Get('customers/:customer_id/fee_history')
  async getFeeHistory(
    @Param('customer_id') customer_id: string,
    @Query() fee_history_query: FeeHistoryQueryDto,
  ) {
    await this.assertCallerAccess(
      customer_id,
      fee_history_query.call_id,
      IDENTITY_LEVELS.ENHANCED,
    );
    return this.core_banking_adapter.getFeeHistory(
      customer_id,
      fee_history_query.account_id,
    );
  }

  @Get('customers/:customer_id/income_summary')
  async getIncomeSummary(
    @Param('customer_id') customer_id: string,
    @Query() caller_query: CallerQueryDto,
  ) {
    await this.assertCallerAccess(
      customer_id,
      caller_query.call_id,
      IDENTITY_LEVELS.ENHANCED,
    );
    return this.core_banking_adapter.getIncomeSummary(customer_id);
  }

  @Get('customers/:customer_id/loans/:account_id')
  async getLoanDetails(
    @Param('customer_id') customer_id: string,
    @Param('account_id') account_id: string,
    @Query() caller_query: CallerQueryDto,
  ) {
    await this.assertCallerAccess(
      customer_id,
      caller_query.call_id,
      IDENTITY_LEVELS.ENHANCED,
    );
    return this.core_banking_adapter.getLoanDetails(customer_id, account_id);
  }

  @Get('customers/:customer_id/held_payments')
  async getHeldPayments(
    @Param('customer_id') customer_id: string,
    @Query() caller_query: CallerQueryDto,
  ) {
    await this.assertCallerAccess(
      customer_id,
      caller_query.call_id,
      IDENTITY_LEVELS.ENHANCED,
    );
    return this.core_banking_adapter.getHeldPayments(customer_id);
  }

  private async assertCallerAccess(
    customer_id: string,
    call_id: string | undefined,
    required_level: number,
  ): Promise<IdentitySummary | null> {
    if (!call_id) {
      return null;
    }
    return this.identity_records_service.assertAccountAccess({
      call_id,
      customer_id,
      required_level,
    });
  }
}
