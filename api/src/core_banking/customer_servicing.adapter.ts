import { Injectable } from '@nestjs/common';

import { TransactionClient } from '../database/types/transaction_client.type';
import { CoreBankingRepository } from './core_banking.repository';
import { CustomerServicingRepository } from './customer_servicing.repository';
import { TransactionNotFoundError } from './errors/transaction_not_found.error';
import {
  AccountProfile,
  CustomerPreferences,
  DisputableTransaction,
  NewDispute,
  NewPaymentArrangement,
  NewStatementRequest,
  PreferenceChanges,
} from './types/servicing_records.type';

export const DEFAULT_PREFERENCES: CustomerPreferences = {
  paper_statements: false,
  sms_alerts: true,
  large_print_letters: false,
};

// Statements, preferences, payment arrangements and disputes through the
// bank's systems. Part of the core banking seam.
@Injectable()
export class CustomerServicingAdapter {
  constructor(
    private readonly core_banking_repository: CoreBankingRepository,
    private readonly customer_servicing_repository: CustomerServicingRepository,
  ) {}

  async getPreferences(customer_id: string): Promise<CustomerPreferences> {
    return (
      (await this.customer_servicing_repository.selectPreferences(
        customer_id,
      )) ?? DEFAULT_PREFERENCES
    );
  }

  updatePreferences(
    transaction: TransactionClient,
    customer_id: string,
    preference_changes: PreferenceChanges,
  ): Promise<CustomerPreferences> {
    return this.customer_servicing_repository.upsertPreferences(
      transaction,
      customer_id,
      preference_changes,
    );
  }

  findAccountProfile(account_id: string): Promise<AccountProfile | null> {
    return this.customer_servicing_repository.selectAccountProfile(account_id);
  }

  requestStatement(
    transaction: TransactionClient,
    new_request: NewStatementRequest,
  ) {
    return this.customer_servicing_repository.insertStatementRequest(
      transaction,
      new_request,
    );
  }

  setUpPaymentArrangement(
    transaction: TransactionClient,
    new_arrangement: NewPaymentArrangement,
  ) {
    return this.customer_servicing_repository.insertPaymentArrangement(
      transaction,
      new_arrangement,
    );
  }

  async getDisputableTransaction(
    txn_id: string,
  ): Promise<DisputableTransaction> {
    const disputable_transaction =
      await this.customer_servicing_repository.selectDisputableTransaction(
        txn_id,
      );
    if (!disputable_transaction) {
      throw new TransactionNotFoundError(txn_id);
    }
    return disputable_transaction;
  }

  findDuplicateTransactionId(
    disputed: DisputableTransaction,
  ): Promise<string | null> {
    return this.customer_servicing_repository.selectDuplicateTransactionId(
      disputed,
    );
  }

  findOpenDisputeId(txn_id: string): Promise<string | null> {
    return this.customer_servicing_repository.selectOpenDisputeId(txn_id);
  }

  // A provisional credit is a new DISPUTE_CREDIT ledger row; money moved, so
  // the balances are recalculated.
  async lodgeDispute(
    transaction: TransactionClient,
    dispute_request: {
      new_dispute: NewDispute;
      has_provisional_credit: boolean;
      merchant: string | null;
    },
  ) {
    const dispute = await this.customer_servicing_repository.insertDispute(
      transaction,
      dispute_request.new_dispute,
    );
    const provisional_credit_txn_id = dispute_request.has_provisional_credit
      ? await this.customer_servicing_repository.insertDisputeCredit(
          transaction,
          dispute,
          dispute_request.merchant,
        )
      : null;
    if (provisional_credit_txn_id) {
      await this.core_banking_repository.recalculateBalances(transaction);
    }
    return {
      dispute_id: dispute.dispute_id,
      txn_id: dispute.txn_id,
      account_id: dispute.account_id,
      reason: dispute.reason,
      amount: dispute.amount,
      status: dispute.status,
      merchant: dispute_request.merchant,
      provisional_credit_txn_id,
      provisional_credit_amount: provisional_credit_txn_id
        ? dispute.amount
        : null,
      expected_by: dispute_request.new_dispute.expected_by,
    };
  }
}
