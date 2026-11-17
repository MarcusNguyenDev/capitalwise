import { Injectable } from '@nestjs/common';

import { CoreBankingAdapter } from '../../core_banking/core_banking.adapter';
import { CustomerServicingAdapter } from '../../core_banking/customer_servicing.adapter';
import { DisputableTransaction } from '../../core_banking/types/servicing_records.type';
import { DISPUTE_REASONS } from '../constants/action_code.constant';
import { DisputeAlreadyLodgedError } from '../errors/dispute_already_lodged.error';
import { TransactionNotDisputableError } from '../errors/transaction_not_disputable.error';
import { TransactionNotOwnedError } from '../errors/transaction_not_owned.error';
import { BuiltFacts, FactRequest } from '../types/fact_request.type';
import {
  readStringParam,
  requireEnumParam,
  requireStringParam,
} from '../utils/action_params.util';

const DISPUTABLE_TXN_TYPES = ['PURCHASE', 'DIRECT_DEBIT'];
const DISPUTABLE_STATUSES = ['POSTED', 'PENDING'];

// Facts for RAISE_DISPUTE. Whether a charge really is a duplicate comes from
// the ledger (same merchant and amount, both posted, within 30 minutes), not
// from what the caller or the model says.
@Injectable()
export class DisputeFactsBuilder {
  constructor(
    private readonly core_banking_adapter: CoreBankingAdapter,
    private readonly customer_servicing_adapter: CustomerServicingAdapter,
  ) {}

  async buildDisputeFacts(fact_request: FactRequest): Promise<BuiltFacts> {
    const { action_code, params } = fact_request;
    const txn_id = requireStringParam(action_code, params, 'txn_id');
    const reason = requireEnumParam(
      action_code,
      params,
      'reason',
      DISPUTE_REASONS,
    );
    const disputed =
      await this.customer_servicing_adapter.getDisputableTransaction(txn_id);
    await this.assertDisputable(fact_request.customer_id, disputed);
    const duplicate_txn_id =
      await this.customer_servicing_adapter.findDuplicateTransactionId(
        disputed,
      );
    const txn_amount = Math.abs(disputed.amount);
    return {
      facts: {
        txn_id,
        txn_amount,
        txn_status: disputed.status,
        merchant: disputed.merchant,
        dispute_reason: reason,
        is_duplicate_confirmed: duplicate_txn_id !== null,
        duplicate_of_txn_id: duplicate_txn_id,
        scam_coaching_signals: fact_request.soft_signals.scam_coaching_signals,
      },
      resolved_params: {
        txn_id,
        account_id: disputed.account_id,
        reason,
        details: readStringParam(params, 'details'),
        amount: txn_amount,
        merchant: disputed.merchant ?? disputed.description,
      },
    };
  }

  private async assertDisputable(
    customer_id: string,
    disputed: DisputableTransaction,
  ): Promise<void> {
    const is_callers_transaction =
      await this.core_banking_adapter.isAccountHolder(
        customer_id,
        disputed.account_id,
      );
    if (!is_callers_transaction) {
      throw new TransactionNotOwnedError(disputed.txn_id);
    }
    const is_disputable =
      disputed.amount < 0 &&
      DISPUTABLE_TXN_TYPES.includes(disputed.txn_type) &&
      DISPUTABLE_STATUSES.includes(disputed.status);
    if (!is_disputable) {
      throw new TransactionNotDisputableError(disputed.txn_id);
    }
    const open_dispute_id =
      await this.customer_servicing_adapter.findOpenDisputeId(disputed.txn_id);
    if (open_dispute_id) {
      throw new DisputeAlreadyLodgedError(disputed.txn_id, open_dispute_id);
    }
  }
}
