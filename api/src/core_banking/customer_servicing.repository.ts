import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import {
  AccountProfile,
  CustomerPreferences,
  DisputableTransaction,
  Dispute,
  NewDispute,
  NewPaymentArrangement,
  NewStatementRequest,
  PaymentArrangement,
  PreferenceChanges,
  StatementRequest,
} from './types/servicing_records.type';

// A charge is a duplicate of another when the same merchant took the same
// amount from the same account within 30 minutes and both are posted.
const DUPLICATE_WINDOW_MINUTES = 30;

// Preferences, statements, payment arrangements and disputes in schema `bank`.
@Injectable()
export class CustomerServicingRepository {
  constructor(private readonly database: DatabaseService) {}

  async selectPreferences(
    customer_id: string,
  ): Promise<CustomerPreferences | null> {
    const preference_rows = await this.database.query<CustomerPreferences>(
      `SELECT paper_statements, sms_alerts, large_print_letters
       FROM bank.customer_preferences WHERE customer_id = $1`,
      [customer_id],
    );
    return preference_rows[0] ?? null;
  }

  async upsertPreferences(
    transaction: TransactionClient,
    customer_id: string,
    preference_changes: PreferenceChanges,
  ): Promise<CustomerPreferences> {
    const preference_rows = await transaction.query<CustomerPreferences>(
      `INSERT INTO bank.customer_preferences (customer_id, paper_statements, sms_alerts, large_print_letters, updated_at)
       VALUES ($1, COALESCE($2, false), COALESCE($3, true), COALESCE($4, false), now())
       ON CONFLICT (customer_id) DO UPDATE
       SET paper_statements = COALESCE($2, bank.customer_preferences.paper_statements),
           sms_alerts = COALESCE($3, bank.customer_preferences.sms_alerts),
           large_print_letters = COALESCE($4, bank.customer_preferences.large_print_letters),
           updated_at = now()
       RETURNING paper_statements, sms_alerts, large_print_letters`,
      [
        customer_id,
        preference_changes.paper_statements ?? null,
        preference_changes.sms_alerts ?? null,
        preference_changes.large_print_letters ?? null,
      ],
    );
    return preference_rows[0];
  }

  async selectAccountProfile(
    account_id: string,
  ): Promise<AccountProfile | null> {
    const account_rows = await this.database.query<AccountProfile>(
      `SELECT account.account_id, account.nickname, product.category, account.status
       FROM bank.accounts AS account
       JOIN bank.products AS product ON product.product_code = account.product_code
       WHERE account.account_id = $1`,
      [account_id],
    );
    return account_rows[0] ?? null;
  }

  async insertStatementRequest(
    transaction: TransactionClient,
    new_request: NewStatementRequest,
  ): Promise<StatementRequest> {
    const request_rows = await transaction.query<StatementRequest>(
      `INSERT INTO bank.statement_requests (customer_id, account_id, months, delivery, delivery_to, is_large_print, expected_by, case_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8)
       RETURNING *`,
      [
        new_request.customer_id,
        new_request.account_id,
        new_request.months,
        new_request.delivery,
        new_request.delivery_to,
        new_request.is_large_print,
        new_request.expected_by,
        new_request.case_number,
      ],
    );
    return request_rows[0];
  }

  async insertPaymentArrangement(
    transaction: TransactionClient,
    new_arrangement: NewPaymentArrangement,
  ): Promise<PaymentArrangement> {
    const arrangement_rows = await transaction.query<PaymentArrangement>(
      `INSERT INTO bank.payment_arrangements (account_id, customer_id, weeks, weekly_amount, start_on, end_on, case_number)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)
       RETURNING *`,
      [
        new_arrangement.account_id,
        new_arrangement.customer_id,
        new_arrangement.weeks,
        new_arrangement.weekly_amount,
        new_arrangement.start_on,
        new_arrangement.end_on,
        new_arrangement.case_number,
      ],
    );
    return arrangement_rows[0];
  }

  async selectDisputableTransaction(
    txn_id: string,
  ): Promise<DisputableTransaction | null> {
    const transaction_rows = await this.database.query<DisputableTransaction>(
      `SELECT txn_id, account_id, status, txn_type, amount, merchant, description, created_at
       FROM bank.transactions WHERE txn_id = $1`,
      [txn_id],
    );
    return transaction_rows[0] ?? null;
  }

  async selectDuplicateTransactionId(
    disputed: DisputableTransaction,
  ): Promise<string | null> {
    const duplicate_rows = await this.database.query<{ txn_id: string }>(
      `SELECT other.txn_id
       FROM bank.transactions AS disputed
       JOIN bank.transactions AS other
         ON other.account_id = disputed.account_id
        AND other.txn_id <> disputed.txn_id
        AND other.merchant = disputed.merchant
        AND other.amount = disputed.amount
        AND other.status = 'POSTED'
        AND abs(EXTRACT(EPOCH FROM (other.created_at - disputed.created_at))) <= $2 * 60
        -- Once one of the pair is disputed, the other is the genuine charge.
        AND NOT EXISTS (SELECT 1 FROM bank.disputes AS dispute WHERE dispute.txn_id = other.txn_id)
       WHERE disputed.txn_id = $1 AND disputed.status = 'POSTED' AND disputed.merchant IS NOT NULL
       ORDER BY other.created_at
       LIMIT 1`,
      [disputed.txn_id, DUPLICATE_WINDOW_MINUTES],
    );
    return duplicate_rows[0]?.txn_id ?? null;
  }

  async selectOpenDisputeId(txn_id: string): Promise<string | null> {
    const dispute_rows = await this.database.query<{ dispute_id: string }>(
      `SELECT dispute_id FROM bank.disputes WHERE txn_id = $1 AND status = 'LODGED'`,
      [txn_id],
    );
    return dispute_rows[0]?.dispute_id ?? null;
  }

  async insertDispute(
    transaction: TransactionClient,
    new_dispute: NewDispute,
  ): Promise<Dispute> {
    const dispute_rows = await transaction.query<Dispute>(
      `INSERT INTO bank.disputes (txn_id, account_id, customer_id, reason, details, amount, expected_by, case_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8)
       RETURNING *`,
      [
        new_dispute.txn_id,
        new_dispute.account_id,
        new_dispute.customer_id,
        new_dispute.reason,
        new_dispute.details,
        new_dispute.amount,
        new_dispute.expected_by,
        new_dispute.case_number,
      ],
    );
    return dispute_rows[0];
  }

  // Append-only ledger: the provisional credit is a new row reversing the
  // disputed charge.
  async insertDisputeCredit(
    transaction: TransactionClient,
    dispute: Dispute,
    merchant: string | null,
  ): Promise<string> {
    const credit_rows = await transaction.query<{ txn_id: string }>(
      `INSERT INTO bank.transactions (account_id, created_at, posted_at, status, txn_type, channel, amount, description, merchant, reverses_txn_id)
       VALUES ($1, now(), now(), 'POSTED', 'DISPUTE_CREDIT', 'INTERNAL', $2, $3, $4, $5)
       RETURNING txn_id`,
      [
        dispute.account_id,
        dispute.amount,
        `Provisional credit, dispute ${dispute.dispute_id}`,
        merchant,
        dispute.txn_id,
      ],
    );
    await transaction.query(
      `UPDATE bank.disputes SET provisional_credit_txn_id = $2 WHERE dispute_id = $1`,
      [dispute.dispute_id, credit_rows[0].txn_id],
    );
    return credit_rows[0].txn_id;
  }
}
