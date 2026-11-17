import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { CallerContact } from './types/caller_details.type';
import {
  IdentityCandidate,
  IdentityKnowledge,
} from './types/identity_knowledge.type';

const CANDIDATE_COLUMNS = `customer_id, first_name, last_name, date_of_birth, postcode`;

// What the bank knows that only the customer should also know. These values
// stay inside the api: they are compared with answers, and returned only by
// the demo-only caller details endpoint (DEMO_MODE=true).
@Injectable()
export class IdentityKnowledgeRepository {
  constructor(private readonly database: DatabaseService) {}

  selectCandidates(
    date_of_birth: string,
    postcode: string,
  ): Promise<IdentityCandidate[]> {
    return this.database.query<IdentityCandidate>(
      `SELECT ${CANDIDATE_COLUMNS} FROM bank.customers
       WHERE date_of_birth = $1::date AND postcode = $2
       ORDER BY customer_id`,
      [date_of_birth, postcode],
    );
  }

  async selectCandidate(
    customer_id: string,
  ): Promise<IdentityCandidate | null> {
    const candidate_rows = await this.database.query<IdentityCandidate>(
      `SELECT ${CANDIDATE_COLUMNS} FROM bank.customers WHERE customer_id = $1`,
      [customer_id],
    );
    return candidate_rows[0] ?? null;
  }

  async selectLastIncome(
    customer_id: string,
  ): Promise<IdentityKnowledge['last_income']> {
    const income_rows = await this.database.query<{
      amount: number;
      txn_type: string;
    }>(
      `SELECT txn.amount, txn.txn_type
       FROM bank.transactions AS txn
       JOIN bank.account_holders AS holder ON holder.account_id = txn.account_id
       WHERE holder.customer_id = $1
         AND txn.status = 'POSTED'
         AND txn.txn_type IN ('SALARY', 'GOVT_BENEFIT')
       ORDER BY txn.posted_at DESC, txn.txn_id DESC
       LIMIT 1`,
      [customer_id],
    );
    return income_rows[0] ?? null;
  }

  async selectRecentCardMerchants(
    customer_id: string,
    day_count: number,
  ): Promise<string[]> {
    const merchant_rows = await this.database.query<{ merchant: string }>(
      `SELECT DISTINCT txn.merchant
       FROM bank.transactions AS txn
       JOIN bank.cards AS card ON card.card_id = txn.card_id
       WHERE card.customer_id = $1
         AND txn.txn_type = 'PURCHASE'
         AND txn.status IN ('POSTED', 'PENDING')
         AND txn.merchant IS NOT NULL
         AND txn.created_at > now() - make_interval(days => $2::int)
       ORDER BY txn.merchant`,
      [customer_id, day_count],
    );
    return merchant_rows.map((merchant_row) => merchant_row.merchant);
  }

  async selectCallerContact(
    customer_id: string,
  ): Promise<CallerContact | null> {
    const contact_rows = await this.database.query<CallerContact>(
      `SELECT customer.mobile_phone, customer.street_address, customer.suburb,
              customer.state,
              (SELECT max(txn.posted_at)
               FROM bank.transactions AS txn
               JOIN bank.account_holders AS holder ON holder.account_id = txn.account_id
               WHERE holder.customer_id = customer.customer_id
                 AND txn.status = 'POSTED'
                 AND txn.txn_type IN ('SALARY', 'GOVT_BENEFIT')) AS last_income_at
       FROM bank.customers AS customer
       WHERE customer.customer_id = $1`,
      [customer_id],
    );
    return contact_rows[0] ?? null;
  }

  async selectCardLastFours(customer_id: string): Promise<string[]> {
    const card_rows = await this.database.query<{ last4: string }>(
      `SELECT DISTINCT last4 FROM bank.cards WHERE customer_id = $1 ORDER BY last4`,
      [customer_id],
    );
    return card_rows.map((card_row) => card_row.last4);
  }

  async selectLoanRepaymentAmounts(customer_id: string): Promise<number[]> {
    const loan_rows = await this.database.query<{ repayment_amount: number }>(
      `SELECT loan.repayment_amount
       FROM bank.loans AS loan
       JOIN bank.account_holders AS holder ON holder.account_id = loan.account_id
       WHERE holder.customer_id = $1
       ORDER BY loan.account_id`,
      [customer_id],
    );
    return loan_rows.map((loan_row) => loan_row.repayment_amount);
  }
}
