import { Controller, Get, Param, Query } from '@nestjs/common';

import { CoreBankingAdapter } from './core_banking.adapter';
import { FeeHistoryQueryDto } from './dto/fee_history_query.dto';
import { ListTransactionsQueryDto } from './dto/list_transactions_query.dto';
import { LookupCustomerQueryDto } from './dto/lookup_customer_query.dto';

@Controller('banking')
export class BankingController {
  constructor(private readonly core_banking_adapter: CoreBankingAdapter) {}

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
  getOverview(@Param('customer_id') customer_id: string) {
    return this.core_banking_adapter.getCustomerProfile(customer_id);
  }

  @Get('customers/:customer_id/transactions')
  getTransactions(
    @Param('customer_id') customer_id: string,
    @Query() transactions_query: ListTransactionsQueryDto,
  ) {
    return this.core_banking_adapter.getTransactions(
      customer_id,
      transactions_query.account_id,
      transactions_query.hours,
    );
  }

  @Get('customers/:customer_id/fee_history')
  getFeeHistory(
    @Param('customer_id') customer_id: string,
    @Query() fee_history_query: FeeHistoryQueryDto,
  ) {
    return this.core_banking_adapter.getFeeHistory(
      customer_id,
      fee_history_query.account_id,
    );
  }

  @Get('customers/:customer_id/income_summary')
  getIncomeSummary(@Param('customer_id') customer_id: string) {
    return this.core_banking_adapter.getIncomeSummary(customer_id);
  }

  @Get('customers/:customer_id/loans/:account_id')
  getLoanDetails(
    @Param('customer_id') customer_id: string,
    @Param('account_id') account_id: string,
  ) {
    return this.core_banking_adapter.getLoanDetails(customer_id, account_id);
  }

  @Get('customers/:customer_id/held_payments')
  getHeldPayments(@Param('customer_id') customer_id: string) {
    return this.core_banking_adapter.getHeldPayments(customer_id);
  }
}
