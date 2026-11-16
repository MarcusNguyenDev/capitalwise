import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import {
  HARDSHIP_ENQUIRY_LOOKBACK_DAYS,
  INCOME_MONTH_COUNT,
  MAX_TRANSACTIONS_RETURNED,
} from './constants/banking_limits.constant';
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
  NewFeeRefund,
  NewHardshipArrangement,
  TransactionRecord,
} from './types/bank_records.type';

// All SQL against schema `bank` lives in this file and nowhere else.
@Injectable()
export class CoreBankingRepository {
  constructor(private readonly database: DatabaseService) {}

  selectCallers(): Promise<CallerSummary[]> {
    return this.database.query<CallerSummary>(
      `SELECT customer_id, full_name, first_name, mobile_phone, age
       FROM bank.v_customer_overview
       ORDER BY customer_id`,
    );
  }

  async selectOverviewByMobile(
    mobile_phone: string,
  ): Promise<CustomerOverview | null> {
    const overview_rows = await this.database.query<CustomerOverview>(
      `SELECT * FROM bank.v_customer_overview WHERE mobile_phone = $1`,
      [mobile_phone],
    );
    return overview_rows[0] ?? null;
  }

  async selectOverview(customer_id: string): Promise<CustomerOverview | null> {
    const overview_rows = await this.database.query<CustomerOverview>(
      `SELECT * FROM bank.v_customer_overview WHERE customer_id = $1`,
      [customer_id],
    );
    return overview_rows[0] ?? null;
  }

  selectRecentContacts(customer_id: string, contact_count: number) {
    return this.database.query(
      `SELECT contact_id, created_at, channel, event_type, summary
       FROM bank.contact_history
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [customer_id, contact_count],
    );
  }

  selectDevices(customer_id: string) {
    return this.database.query(
      `SELECT device_id, device_name, platform, first_seen_at, is_trusted
       FROM bank.devices
       WHERE customer_id = $1
       ORDER BY first_seen_at`,
      [customer_id],
    );
  }

  async isAccountHolder(
    customer_id: string,
    account_id: string,
  ): Promise<boolean> {
    const holder_rows = await this.database.query(
      `SELECT 1 FROM bank.account_holders WHERE customer_id = $1 AND account_id = $2`,
      [customer_id, account_id],
    );
    return holder_rows.length > 0;
  }

  selectTransactions(account_id: string, window_hours: number) {
    return this.database.query(
      `SELECT txn.txn_id, txn.created_at, txn.status, txn.txn_type, txn.channel, txn.amount,
              txn.description, txn.merchant, card.last4 AS card_last4
       FROM bank.transactions AS txn
       LEFT JOIN bank.cards AS card ON card.card_id = txn.card_id
       WHERE txn.account_id = $1 AND txn.created_at > now() - make_interval(hours => $2::int)
       ORDER BY txn.created_at DESC
       LIMIT $3`,
      [account_id, window_hours, MAX_TRANSACTIONS_RETURNED],
    );
  }

  async selectTransaction(txn_id: string): Promise<TransactionRecord | null> {
    const transaction_rows = await this.database.query<TransactionRecord>(
      `SELECT txn_id, account_id, status, txn_type, amount, description, created_at
       FROM bank.transactions
       WHERE txn_id = $1`,
      [txn_id],
    );
    return transaction_rows[0] ?? null;
  }

  selectFees(
    customer_id: string,
    account_id: string | null,
  ): Promise<FeeHistoryEntry[]> {
    return this.database.query<FeeHistoryEntry>(
      `SELECT txn_id, account_id, charged_at, fee_amount, description, fee_cause, is_refunded, refunds_last_12m
       FROM bank.v_fee_history
       WHERE customer_id = $1
         AND ($2::text IS NULL OR account_id = $2)
         AND charged_at > now() - interval '13 months'
       ORDER BY charged_at DESC`,
      [customer_id, account_id],
    );
  }

  async selectFee(
    customer_id: string,
    fee_txn_id: string,
  ): Promise<FeeHistoryEntry | null> {
    const fee_rows = await this.database.query<FeeHistoryEntry>(
      `SELECT txn_id, account_id, charged_at, fee_amount, description, fee_cause, is_refunded, refunds_last_12m
       FROM bank.v_fee_history
       WHERE customer_id = $1 AND txn_id = $2`,
      [customer_id, fee_txn_id],
    );
    return fee_rows[0] ?? null;
  }

  async countRefundsInLast12Months(customer_id: string): Promise<number> {
    const count_rows = await this.database.query<{ refund_count: number }>(
      `SELECT COUNT(*)::int AS refund_count
       FROM bank.transactions AS refund
       JOIN bank.account_holders AS holder ON holder.account_id = refund.account_id
       WHERE holder.customer_id = $1
         AND refund.txn_type = 'FEE_REFUND'
         AND refund.status = 'POSTED'
         AND refund.created_at > now() - interval '12 months'`,
      [customer_id],
    );
    return count_rows[0].refund_count;
  }

  async selectIncomeRolling(
    customer_id: string,
  ): Promise<IncomeRolling | null> {
    const income_rows = await this.database.query<IncomeRolling>(
      `SELECT recent_30d_income, baseline_30d_income, income_drop_pct, last_salary_at
       FROM bank.v_income_rolling
       WHERE customer_id = $1`,
      [customer_id],
    );
    return income_rows[0] ?? null;
  }

  selectIncomeMonthly(customer_id: string) {
    return this.database.query(
      `SELECT income_month, salary_income, government_income, total_income
       FROM (
         SELECT income_month, salary_income, government_income, total_income
         FROM bank.v_income_monthly
         WHERE customer_id = $1
         ORDER BY income_month DESC
         LIMIT $2
       ) AS latest_months
       ORDER BY income_month`,
      [customer_id, INCOME_MONTH_COUNT],
    );
  }

  async selectLoan(account_id: string): Promise<LoanRecord | null> {
    const loan_rows = await this.database.query<LoanRecord>(
      `SELECT loan.account_id, account.nickname, account.current_balance, loan.repayment_type, loan.interest_rate,
              loan.repayment_amount, loan.repayment_frequency, loan.next_repayment_due,
              (loan.next_repayment_due - current_date)::int AS repayment_due_in_days,
              loan.arrears_amount, loan.days_in_arrears, loan.offset_account_id,
              offset_account.current_balance AS offset_balance
       FROM bank.loans AS loan
       JOIN bank.accounts AS account ON account.account_id = loan.account_id
       LEFT JOIN bank.accounts AS offset_account ON offset_account.account_id = loan.offset_account_id
       WHERE loan.account_id = $1`,
      [account_id],
    );
    return loan_rows[0] ?? null;
  }

  async selectLoanAccountIds(customer_id: string): Promise<string[]> {
    const loan_rows = await this.database.query<{ account_id: string }>(
      `SELECT loan.account_id
       FROM bank.loans AS loan
       JOIN bank.account_holders AS holder ON holder.account_id = loan.account_id
       WHERE holder.customer_id = $1
       ORDER BY loan.account_id`,
      [customer_id],
    );
    return loan_rows.map((loan_row) => loan_row.account_id);
  }

  selectArrangements(account_id: string): Promise<HardshipArrangement[]> {
    return this.database.query<HardshipArrangement>(
      `SELECT * FROM bank.hardship_arrangements WHERE account_id = $1 ORDER BY notice_received_on DESC, arrangement_id DESC`,
      [account_id],
    );
  }

  selectHeldPayments(customer_id: string): Promise<HeldPayment[]> {
    return this.database.query<HeldPayment>(
      `SELECT txn.txn_id, txn.account_id, -txn.amount AS amount, txn.created_at, payee.name AS payee_name, txn.status
       FROM bank.transactions AS txn
       JOIN bank.account_holders AS holder ON holder.account_id = txn.account_id
       LEFT JOIN bank.payees AS payee ON payee.payee_id = txn.payee_id
       WHERE holder.customer_id = $1 AND txn.status = 'HELD'
       ORDER BY txn.created_at DESC`,
      [customer_id],
    );
  }

  async selectHeldPaymentRiskProfile(
    txn_id: string,
  ): Promise<HeldPaymentRiskProfile | null> {
    const profile_rows = await this.database.query<HeldPaymentRiskProfile>(
      `SELECT txn.txn_id, txn.account_id, txn.status, -txn.amount AS held_amount, txn.risk_score,
              payee.name AS payee_name, payee.name_check AS payee_name_check,
              payee.name_check_returned AS payee_name_check_returned,
              round((EXTRACT(EPOCH FROM (now() - payee.created_at)) / 3600)::numeric, 1) AS payee_age_hours,
              device.is_trusted AS device_trusted,
              (EXTRACT(EPOCH FROM (now() - device.first_seen_at)) / 60)::int AS device_age_minutes,
              EXISTS (
                SELECT 1 FROM bank.transactions AS declined
                WHERE declined.payee_id = txn.payee_id
                  AND declined.status = 'DECLINED'
                  AND declined.created_at BETWEEN txn.created_at - interval '2 hours' AND txn.created_at
              ) AS declined_then_retry
       FROM bank.transactions AS txn
       LEFT JOIN bank.payees AS payee ON payee.payee_id = txn.payee_id
       LEFT JOIN bank.devices AS device ON device.device_id = txn.device_id
       WHERE txn.txn_id = $1`,
      [txn_id],
    );
    return profile_rows[0] ?? null;
  }

  async hasRecentContactEvent(
    customer_id: string,
    event_type: string,
    lookback_days: number,
  ): Promise<boolean> {
    const contact_rows = await this.database.query(
      `SELECT 1 FROM bank.contact_history
       WHERE customer_id = $1 AND event_type = $2 AND created_at > now() - make_interval(days => $3::int)
       LIMIT 1`,
      [customer_id, event_type, lookback_days],
    );
    return contact_rows.length > 0;
  }

  async hasRecentHardshipEnquiry(customer_id: string): Promise<boolean> {
    const contact_rows = await this.database.query(
      `SELECT 1 FROM bank.contact_history
       WHERE customer_id = $1
         AND event_type = 'ENQUIRY'
         AND (summary ILIKE '%hardship%' OR summary ILIKE '%repayment%')
         AND created_at > now() - make_interval(days => $2::int)
       LIMIT 1`,
      [customer_id, HARDSHIP_ENQUIRY_LOOKBACK_DAYS],
    );
    return contact_rows.length > 0;
  }

  async selectCard(card_id: string): Promise<CardRecord | null> {
    const card_rows = await this.database.query<CardRecord>(
      `SELECT card_id, account_id, customer_id, card_type, last4, status FROM bank.cards WHERE card_id = $1`,
      [card_id],
    );
    return card_rows[0] ?? null;
  }

  async selectLastCardTransaction(
    card_id: string,
  ): Promise<LastCardTransaction | null> {
    const transaction_rows = await this.database.query<LastCardTransaction>(
      `SELECT merchant, abs(amount) AS amount, created_at, status
       FROM bank.transactions
       WHERE card_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [card_id],
    );
    return transaction_rows[0] ?? null;
  }

  async updateCardStatus(
    transaction: TransactionClient,
    card_id: string,
    card_status: string,
  ): Promise<void> {
    await transaction.query(
      `UPDATE bank.cards SET status = $2 WHERE card_id = $1`,
      [card_id, card_status],
    );
  }

  async isFeeRefunded(
    transaction: TransactionClient,
    fee_txn_id: string,
  ): Promise<boolean> {
    const refund_rows = await transaction.query(
      `SELECT 1 FROM bank.transactions WHERE reverses_txn_id = $1`,
      [fee_txn_id],
    );
    return refund_rows.length > 0;
  }

  async insertFeeRefund(
    transaction: TransactionClient,
    new_fee_refund: NewFeeRefund,
  ): Promise<string> {
    const refund_rows = await transaction.query<{ txn_id: string }>(
      `INSERT INTO bank.transactions (account_id, created_at, posted_at, status, txn_type, channel, amount, description, reverses_txn_id)
       VALUES ($1, now(), now(), 'POSTED', 'FEE_REFUND', 'INTERNAL', $2, $3, $4)
       RETURNING txn_id`,
      [
        new_fee_refund.account_id,
        new_fee_refund.amount,
        new_fee_refund.description,
        new_fee_refund.fee_txn_id,
      ],
    );
    return refund_rows[0].txn_id;
  }

  async insertHardshipArrangement(
    transaction: TransactionClient,
    new_arrangement: NewHardshipArrangement,
  ): Promise<HardshipArrangement> {
    // The arrangement starts at the next repayment due date (never in the past).
    const arrangement_rows = await transaction.query<HardshipArrangement>(
      `INSERT INTO bank.hardship_arrangements
         (account_id, customer_id, notice_received_on, notice_channel, arrangement_type, start_on, end_on, status, case_number)
       SELECT $1, $2, current_date, 'PHONE', $3, first_day.start_on,
              (first_day.start_on + make_interval(months => $4::int))::date, 'APPROVED', $5
       FROM (
         SELECT GREATEST(
           COALESCE((SELECT next_repayment_due FROM bank.loans WHERE account_id = $1), current_date),
           current_date
         ) AS start_on
       ) AS first_day
       RETURNING *`,
      [
        new_arrangement.account_id,
        new_arrangement.customer_id,
        new_arrangement.arrangement_type,
        new_arrangement.months,
        new_arrangement.case_number,
      ],
    );
    return arrangement_rows[0];
  }

  async postHeldTransaction(
    transaction: TransactionClient,
    txn_id: string,
  ): Promise<boolean> {
    const posted_rows = await transaction.query(
      `UPDATE bank.transactions SET status = 'POSTED', posted_at = now()
       WHERE txn_id = $1 AND status = 'HELD'
       RETURNING txn_id`,
      [txn_id],
    );
    return posted_rows.length > 0;
  }

  async recalculateBalances(transaction: TransactionClient): Promise<void> {
    await transaction.query(`SELECT bank.recalculate_balances()`);
  }

  async insertContact(
    transaction: TransactionClient,
    new_contact: NewContactEntry,
  ): Promise<void> {
    await transaction.query(
      `INSERT INTO bank.contact_history (customer_id, channel, event_type, summary)
       SELECT $1, 'PHONE', $2, $3
       WHERE EXISTS (SELECT 1 FROM bank.customers WHERE customer_id = $1)`,
      [new_contact.customer_id, new_contact.event_type, new_contact.summary],
    );
  }
}
