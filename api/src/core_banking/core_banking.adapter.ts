import { Injectable } from '@nestjs/common';

import { TransactionClient } from '../database/types/transaction_client.type';
import {
  DEFAULT_TRANSACTION_WINDOW_HOURS,
  HELD_PAYMENT_NOTE,
  LIMIT_RAISE_LOOKBACK_DAYS,
  RECENT_CONTACT_COUNT,
} from './constants/banking_limits.constant';
import { CoreBankingRepository } from './core_banking.repository';
import { AccountNotFoundError } from './errors/account_not_found.error';
import { AccountNotOwnedError } from './errors/account_not_owned.error';
import { CardNotFoundError } from './errors/card_not_found.error';
import { CustomerNotFoundError } from './errors/customer_not_found.error';
import { FeeAlreadyRefundedError } from './errors/fee_already_refunded.error';
import { HeldPaymentNotFoundError } from './errors/held_payment_not_found.error';
import { LoanNotFoundError } from './errors/loan_not_found.error';
import { TransactionNotFoundError } from './errors/transaction_not_found.error';
import {
  CallerSummary,
  CardRecord,
  CustomerOverview,
  FeeHistoryEntry,
  HardshipArrangement,
  HeldPayment,
  HeldPaymentRiskProfile,
  IncomeRolling,
  LastCardTransaction,
  LoanRecord,
  NewContactEntry,
  NewHardshipArrangement,
  TransactionRecord,
} from './types/bank_records.type';

const TEMP_LOCKED_STATUS = 'TEMP_LOCKED';
const PRIMARY_ACCOUNT_CATEGORY = 'TRANSACTION';

// The single seam to the bank's systems. Nothing outside this module reads or
// writes schema `bank`; a real core banking API would plug in here.
@Injectable()
export class CoreBankingAdapter {
  constructor(
    private readonly core_banking_repository: CoreBankingRepository,
  ) {}

  listCallers(): Promise<CallerSummary[]> {
    return this.core_banking_repository.selectCallers();
  }

  async lookupCustomerByMobile(mobile_phone: string) {
    const overview = await this.core_banking_repository.selectOverviewByMobile(
      this.normaliseMobilePhone(mobile_phone),
    );
    return {
      matched: overview !== null,
      customer_id: overview?.customer_id ?? null,
      first_name: overview?.first_name ?? null,
      full_name: overview?.full_name ?? null,
    };
  }

  findCustomerOverview(customer_id: string): Promise<CustomerOverview | null> {
    return this.core_banking_repository.selectOverview(customer_id);
  }

  async getCustomerOverview(customer_id: string): Promise<CustomerOverview> {
    const overview = await this.findCustomerOverview(customer_id);
    if (!overview) {
      throw new CustomerNotFoundError(customer_id);
    }
    return overview;
  }

  async getCustomerProfile(customer_id: string) {
    const overview = await this.getCustomerOverview(customer_id);
    const [recent_contacts, devices] = await Promise.all([
      this.core_banking_repository.selectRecentContacts(
        customer_id,
        RECENT_CONTACT_COUNT,
      ),
      this.core_banking_repository.selectDevices(customer_id),
    ]);
    return { ...overview, recent_contacts, devices };
  }

  isAccountHolder(customer_id: string, account_id: string): Promise<boolean> {
    return this.core_banking_repository.isAccountHolder(
      customer_id,
      account_id,
    );
  }

  async assertAccountOwned(
    customer_id: string,
    account_id: string,
  ): Promise<void> {
    if (!(await this.isAccountHolder(customer_id, account_id))) {
      throw new AccountNotOwnedError(account_id);
    }
  }

  async getTransactions(
    customer_id: string,
    requested_account_id?: string,
    window_hours: number = DEFAULT_TRANSACTION_WINDOW_HOURS,
  ) {
    const overview = await this.getCustomerOverview(customer_id);
    const account_id =
      requested_account_id ?? this.pickEverydayAccountId(overview);
    await this.assertAccountOwned(customer_id, account_id);
    const transactions = await this.core_banking_repository.selectTransactions(
      account_id,
      window_hours,
    );
    return { account_id, transactions };
  }

  async getFeeHistory(customer_id: string, account_id?: string) {
    await this.getCustomerOverview(customer_id);
    if (account_id) {
      await this.assertAccountOwned(customer_id, account_id);
    }
    const [fee_entries, refunds_last_12m] = await Promise.all([
      this.core_banking_repository.selectFees(customer_id, account_id ?? null),
      this.core_banking_repository.countRefundsInLast12Months(customer_id),
    ]);
    const fees = fee_entries.map((fee_entry) => ({
      txn_id: fee_entry.txn_id,
      account_id: fee_entry.account_id,
      charged_at: fee_entry.charged_at,
      fee_amount: fee_entry.fee_amount,
      description: fee_entry.description,
      fee_cause: fee_entry.fee_cause,
      is_refunded: fee_entry.is_refunded,
    }));
    return { fees, refunds_last_12m };
  }

  findIncomeRolling(customer_id: string): Promise<IncomeRolling | null> {
    return this.core_banking_repository.selectIncomeRolling(customer_id);
  }

  async getIncomeSummary(customer_id: string) {
    await this.getCustomerOverview(customer_id);
    const [income_rolling, monthly] = await Promise.all([
      this.findIncomeRolling(customer_id),
      this.core_banking_repository.selectIncomeMonthly(customer_id),
    ]);
    return {
      recent_30d_income: income_rolling?.recent_30d_income ?? 0,
      baseline_30d_income: income_rolling?.baseline_30d_income ?? 0,
      income_drop_pct: income_rolling?.income_drop_pct ?? 0,
      last_salary_at: income_rolling?.last_salary_at ?? null,
      monthly,
    };
  }

  listLoanAccountIds(customer_id: string): Promise<string[]> {
    return this.core_banking_repository.selectLoanAccountIds(customer_id);
  }

  async getLoan(account_id: string): Promise<LoanRecord> {
    const loan = await this.core_banking_repository.selectLoan(account_id);
    if (!loan) {
      throw new LoanNotFoundError(account_id);
    }
    return loan;
  }

  async getLoanDetails(customer_id: string, account_id: string) {
    await this.getCustomerOverview(customer_id);
    await this.assertAccountOwned(customer_id, account_id);
    const loan = await this.getLoan(account_id);
    const arrangements =
      await this.core_banking_repository.selectArrangements(account_id);
    return { ...loan, arrangements };
  }

  listHeldPayments(customer_id: string): Promise<HeldPayment[]> {
    return this.core_banking_repository.selectHeldPayments(customer_id);
  }

  // Goes to the model, so it deliberately leaves out risk_score and hold_reason.
  async getHeldPayments(customer_id: string) {
    await this.getCustomerOverview(customer_id);
    const held_payments = await this.listHeldPayments(customer_id);
    return {
      held_payments: held_payments.map((held_payment) => ({
        ...held_payment,
        note: HELD_PAYMENT_NOTE,
      })),
    };
  }

  findHeldPaymentRiskProfile(
    txn_id: string,
  ): Promise<HeldPaymentRiskProfile | null> {
    return this.core_banking_repository.selectHeldPaymentRiskProfile(txn_id);
  }

  wasDailyLimitRaisedRecently(customer_id: string): Promise<boolean> {
    return this.core_banking_repository.hasRecentContactEvent(
      customer_id,
      'DAILY_LIMIT_CHANGED',
      LIMIT_RAISE_LOOKBACK_DAYS,
    );
  }

  hasRecentHardshipEnquiry(customer_id: string): Promise<boolean> {
    return this.core_banking_repository.hasRecentHardshipEnquiry(customer_id);
  }

  async getCard(card_id: string): Promise<CardRecord> {
    const card = await this.core_banking_repository.selectCard(card_id);
    if (!card) {
      throw new CardNotFoundError(card_id);
    }
    return card;
  }

  findLastCardTransaction(
    card_id: string,
  ): Promise<LastCardTransaction | null> {
    return this.core_banking_repository.selectLastCardTransaction(card_id);
  }

  async getTransaction(txn_id: string): Promise<TransactionRecord> {
    const transaction_record =
      await this.core_banking_repository.selectTransaction(txn_id);
    if (!transaction_record) {
      throw new TransactionNotFoundError(txn_id);
    }
    return transaction_record;
  }

  findFeeForCustomer(
    customer_id: string,
    fee_txn_id: string,
  ): Promise<FeeHistoryEntry | null> {
    return this.core_banking_repository.selectFee(customer_id, fee_txn_id);
  }

  async lockCard(transaction: TransactionClient, card_id: string) {
    const card = await this.getCard(card_id);
    await this.core_banking_repository.updateCardStatus(
      transaction,
      card_id,
      TEMP_LOCKED_STATUS,
    );
    const last_transaction = await this.findLastCardTransaction(card_id);
    return {
      card_id,
      card_last4: card.last4,
      card_status: TEMP_LOCKED_STATUS,
      last_transaction,
    };
  }

  // Append-only ledger: a refund is a new FEE_REFUND row pointing at the fee.
  async refundFee(
    transaction: TransactionClient,
    refund_request: { fee_txn_id: string; amount: number },
  ) {
    const fee_transaction = await this.getTransaction(
      refund_request.fee_txn_id,
    );
    const is_already_refunded =
      await this.core_banking_repository.isFeeRefunded(
        transaction,
        refund_request.fee_txn_id,
      );
    if (is_already_refunded) {
      throw new FeeAlreadyRefundedError(refund_request.fee_txn_id);
    }
    const refund_txn_id = await this.core_banking_repository.insertFeeRefund(
      transaction,
      {
        fee_txn_id: fee_transaction.txn_id,
        account_id: fee_transaction.account_id,
        amount: refund_request.amount,
        description: `${fee_transaction.description} refund`,
      },
    );
    await this.core_banking_repository.recalculateBalances(transaction);
    return {
      refund_txn_id,
      fee_txn_id: fee_transaction.txn_id,
      fee_description: fee_transaction.description,
      account_id: fee_transaction.account_id,
      account_nickname: fee_transaction.account_nickname,
      amount: refund_request.amount,
    };
  }

  recordHardshipArrangement(
    transaction: TransactionClient,
    new_arrangement: NewHardshipArrangement,
  ): Promise<HardshipArrangement> {
    return this.core_banking_repository.insertHardshipArrangement(
      transaction,
      new_arrangement,
    );
  }

  async releaseHeldPayment(transaction: TransactionClient, txn_id: string) {
    const held_transaction = await this.getTransaction(txn_id);
    const is_released = await this.core_banking_repository.postHeldTransaction(
      transaction,
      txn_id,
    );
    if (!is_released) {
      throw new HeldPaymentNotFoundError(`${txn_id} is no longer on hold.`);
    }
    await this.core_banking_repository.recalculateBalances(transaction);
    return {
      txn_id,
      account_id: held_transaction.account_id,
      amount: Math.abs(held_transaction.amount),
      status: 'POSTED',
    };
  }

  recordContact(
    transaction: TransactionClient,
    new_contact: NewContactEntry,
  ): Promise<void> {
    return this.core_banking_repository.insertContact(transaction, new_contact);
  }

  // A `+` in a query string arrives as a space unless it was URL-encoded.
  private normaliseMobilePhone(mobile_phone: string): string {
    const trimmed_mobile_phone = mobile_phone.trim();
    return trimmed_mobile_phone.startsWith('+')
      ? trimmed_mobile_phone
      : `+${trimmed_mobile_phone}`;
  }

  private pickEverydayAccountId(overview: CustomerOverview): string {
    const everyday_account =
      overview.accounts.find(
        (account) => account.category === PRIMARY_ACCOUNT_CATEGORY,
      ) ?? overview.accounts[0];
    if (!everyday_account) {
      throw new AccountNotFoundError(overview.customer_id);
    }
    return everyday_account.account_id;
  }
}
