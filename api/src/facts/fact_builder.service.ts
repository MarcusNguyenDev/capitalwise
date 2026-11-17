import { Injectable } from '@nestjs/common';

import { CoreBankingAdapter } from '../core_banking/core_banking.adapter';
import { FeeAlreadyRefundedError } from '../core_banking/errors/fee_already_refunded.error';
import { HeldPaymentNotFoundError } from '../core_banking/errors/held_payment_not_found.error';
import { CustomerOverview } from '../core_banking/types/bank_records.type';
import { PolicyFacts } from '../policies/types/policy_definition.type';
import { CardFactsBuilder } from './builders/card_facts.builder';
import { DisputeFactsBuilder } from './builders/dispute_facts.builder';
import { ServicingFactsBuilder } from './builders/servicing_facts.builder';
import {
  ACTION_CODES,
  ACTION_SOFT_SIGNAL_FACTS,
  ARRANGEMENT_TYPES,
  CARD_ACTION_CODES,
  MAX_ARRANGEMENT_MONTHS,
  UNKNOWN_CUSTOMER_ID,
} from './constants/action_code.constant';
import { AmountMismatchError } from './errors/amount_mismatch.error';
import { FeeNotOwnedError } from './errors/fee_not_owned.error';
import { HeldPaymentNotOwnedError } from './errors/held_payment_not_owned.error';
import { LoanSelectionRequiredError } from './errors/loan_selection_required.error';
import { NotAFeeError } from './errors/not_a_fee.error';
import { BuiltFacts, FactRequest } from './types/fact_request.type';
import { SoftSignals } from './types/soft_signals.type';
import {
  readStringParam,
  requireStringParam,
} from './utils/action_params.util';

const AMOUNT_TOLERANCE = 0.005;
const FEE_TXN_TYPE = 'FEE';
const HELD_STATUS = 'HELD';
const IDENTITY_VERIFIED_LEVEL = 1;
const SERVICING_ACTION_CODES: string[] = [
  ACTION_CODES.REQUEST_STATEMENT,
  ACTION_CODES.UPDATE_PREFERENCES,
  ACTION_CODES.PAYMENT_ARRANGEMENT,
  ACTION_CODES.SERVICE_REQUEST,
];

// Computes every fact a policy references, deterministically, from the bank's
// records. The model's params only say WHAT the request is about; they are
// checked against the database and never trusted as facts.
@Injectable()
export class FactBuilderService {
  constructor(
    private readonly core_banking_adapter: CoreBankingAdapter,
    private readonly card_facts_builder: CardFactsBuilder,
    private readonly dispute_facts_builder: DisputeFactsBuilder,
    private readonly servicing_facts_builder: ServicingFactsBuilder,
  ) {}

  // Every policy gets identity_level (from engine.identity_attempts) and
  // identity_verified (level 1 or more) as well as the action's own facts.
  async buildFacts(fact_request: FactRequest): Promise<BuiltFacts> {
    const overview = await this.findOverview(fact_request.customer_id);
    const action_facts = await this.buildActionFacts(fact_request, overview);
    const common_facts: PolicyFacts = {
      identity_level: fact_request.identity_level,
      identity_verified: fact_request.identity_level >= IDENTITY_VERIFIED_LEVEL,
      has_care_flag: overview?.has_care_flag ?? false,
    };
    return {
      facts: { ...common_facts, ...action_facts.facts },
      resolved_params: action_facts.resolved_params,
    };
  }

  // Re-applies soft signals to stored facts when a concern is flagged later
  // in the call. Hard facts are left exactly as they were computed.
  applySoftSignals(
    action_code: string,
    facts: PolicyFacts,
    soft_signals: SoftSignals,
  ): PolicyFacts {
    const soft_signal_facts = ACTION_SOFT_SIGNAL_FACTS[action_code] ?? [];
    const updated_facts = { ...facts };
    for (const soft_signal_fact of soft_signal_facts) {
      updated_facts[soft_signal_fact] = soft_signals[soft_signal_fact];
    }
    return updated_facts;
  }

  private findOverview(customer_id: string): Promise<CustomerOverview | null> {
    if (customer_id === UNKNOWN_CUSTOMER_ID) {
      return Promise.resolve(null);
    }
    return this.core_banking_adapter.getCustomerOverview(customer_id);
  }

  private buildActionFacts(
    fact_request: FactRequest,
    overview: CustomerOverview | null,
  ): Promise<BuiltFacts> {
    if (CARD_ACTION_CODES.includes(fact_request.action_code)) {
      return this.card_facts_builder.buildCardFacts(fact_request);
    }
    if (SERVICING_ACTION_CODES.includes(fact_request.action_code)) {
      return this.servicing_facts_builder.buildServicingFacts(fact_request);
    }
    switch (fact_request.action_code) {
      case ACTION_CODES.RAISE_DISPUTE:
        return this.dispute_facts_builder.buildDisputeFacts(fact_request);
      case ACTION_CODES.REFUND_FEE:
        return this.buildRefundFeeFacts(fact_request, overview);
      case ACTION_CODES.HARDSHIP_REQUEST:
        return this.buildHardshipFacts(fact_request);
      case ACTION_CODES.RELEASE_HELD_PAYMENT:
        return this.buildHeldPaymentFacts(fact_request, overview);
      default:
        return Promise.resolve(this.buildHumanCallbackFacts(fact_request));
    }
  }

  private async buildRefundFeeFacts(
    fact_request: FactRequest,
    overview: CustomerOverview | null,
  ): Promise<BuiltFacts> {
    const fee_txn_id = requireStringParam(
      fact_request.action_code,
      fact_request.params,
      'fee_txn_id',
    );
    const fee_transaction =
      await this.core_banking_adapter.getTransaction(fee_txn_id);
    if (fee_transaction.txn_type !== FEE_TXN_TYPE) {
      throw new NotAFeeError(fee_txn_id);
    }
    const fee = await this.core_banking_adapter.findFeeForCustomer(
      fact_request.customer_id,
      fee_txn_id,
    );
    if (!fee) {
      throw new FeeNotOwnedError(fee_txn_id);
    }
    if (fee.is_refunded) {
      throw new FeeAlreadyRefundedError(fee_txn_id);
    }
    this.assertAmountMatches(
      fact_request.params.amount,
      fee_txn_id,
      fee.fee_amount,
    );
    return {
      facts: {
        fee_txn_id,
        fee_amount: fee.fee_amount,
        fee_cause: fee.fee_cause,
        fee_charged_at: fee.charged_at,
        fee_already_refunded: fee.is_refunded,
        refunds_last_12m: fee.refunds_last_12m,
        tenure_years: overview?.tenure_years ?? null,
        vulnerability_signals: fact_request.soft_signals.vulnerability_signals,
      },
      resolved_params: {
        fee_txn_id,
        account_id: fee.account_id,
        amount: fee.fee_amount,
      },
    };
  }

  private async buildHardshipFacts(
    fact_request: FactRequest,
  ): Promise<BuiltFacts> {
    const customer_id = fact_request.customer_id;
    const account_id = await this.resolveLoanAccountId(fact_request);
    const [loan, income_rolling, has_recent_hardship_enquiry] =
      await Promise.all([
        this.core_banking_adapter.getLoan(account_id),
        this.core_banking_adapter.findIncomeRolling(customer_id),
        this.core_banking_adapter.hasRecentHardshipEnquiry(customer_id),
      ]);
    return {
      facts: {
        income_drop_pct: income_rolling?.income_drop_pct ?? null,
        recent_30d_income: income_rolling?.recent_30d_income ?? null,
        baseline_30d_income: income_rolling?.baseline_30d_income ?? null,
        repayment_due_in_days: loan.repayment_due_in_days,
        days_in_arrears: loan.days_in_arrears,
        repayment_amount: loan.repayment_amount,
        offset_balance: loan.offset_balance,
        recent_hardship_enquiry: has_recent_hardship_enquiry,
        customer_statement: fact_request.customer_statement,
      },
      resolved_params: {
        account_id,
        ...this.pickRequestedArrangement(fact_request.params),
      },
    };
  }

  private async buildHeldPaymentFacts(
    fact_request: FactRequest,
    overview: CustomerOverview | null,
  ): Promise<BuiltFacts> {
    const customer_id = fact_request.customer_id;
    const txn_id = await this.resolveHeldPaymentId(fact_request);
    const risk_profile =
      await this.core_banking_adapter.findHeldPaymentRiskProfile(txn_id);
    if (!risk_profile || risk_profile.status !== HELD_STATUS) {
      throw new HeldPaymentNotFoundError(`${txn_id} is not on hold.`);
    }
    const is_account_holder = await this.core_banking_adapter.isAccountHolder(
      customer_id,
      risk_profile.account_id,
    );
    if (!is_account_holder) {
      throw new HeldPaymentNotOwnedError(txn_id);
    }
    return {
      facts: {
        held_amount: risk_profile.held_amount,
        payee_name: risk_profile.payee_name,
        payee_name_check: risk_profile.payee_name_check,
        payee_name_check_returned: risk_profile.payee_name_check_returned,
        payee_age_hours: risk_profile.payee_age_hours,
        device_trusted: risk_profile.device_trusted,
        device_age_minutes: risk_profile.device_age_minutes,
        declined_then_retry: risk_profile.declined_then_retry,
        limit_raised_recently:
          await this.core_banking_adapter.wasDailyLimitRaisedRecently(
            customer_id,
          ),
        risk_score: risk_profile.risk_score,
        customer_age: overview?.age ?? null,
        scam_coaching_signals: fact_request.soft_signals.scam_coaching_signals,
      },
      resolved_params: {
        txn_id,
        account_id: risk_profile.account_id,
        amount: risk_profile.held_amount,
      },
    };
  }

  private buildHumanCallbackFacts(fact_request: FactRequest): BuiltFacts {
    const reason = readStringParam(fact_request.params, 'reason');
    const required_skill = readStringParam(
      fact_request.params,
      'required_skill',
    );
    return {
      facts: { reason: reason ?? 'The caller asked to speak with a person.' },
      resolved_params: {
        reason: reason ?? 'The caller asked to speak with a person.',
        ...(required_skill ? { required_skill } : {}),
      },
    };
  }

  private async resolveLoanAccountId(
    fact_request: FactRequest,
  ): Promise<string> {
    const requested_account_id = readStringParam(
      fact_request.params,
      'account_id',
    );
    if (requested_account_id) {
      await this.core_banking_adapter.assertAccountOwned(
        fact_request.customer_id,
        requested_account_id,
      );
      return requested_account_id;
    }
    const loan_account_ids = await this.core_banking_adapter.listLoanAccountIds(
      fact_request.customer_id,
    );
    if (loan_account_ids.length !== 1) {
      throw new LoanSelectionRequiredError(loan_account_ids.length);
    }
    return loan_account_ids[0];
  }

  private async resolveHeldPaymentId(
    fact_request: FactRequest,
  ): Promise<string> {
    const requested_txn_id = readStringParam(fact_request.params, 'txn_id');
    if (requested_txn_id) {
      return requested_txn_id;
    }
    const held_payments = await this.core_banking_adapter.listHeldPayments(
      fact_request.customer_id,
    );
    if (held_payments.length !== 1) {
      throw new HeldPaymentNotFoundError(
        held_payments.length === 0
          ? 'the caller has no payment on hold.'
          : 'the caller has more than one payment on hold, pass the txn_id.',
      );
    }
    return held_payments[0].txn_id;
  }

  // Only well-formed arrangement terms are kept; anything else falls back to
  // the proposal on the matched policy rule.
  private pickRequestedArrangement(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const requested_arrangement: Record<string, unknown> = {};
    if (
      typeof params.arrangement_type === 'string' &&
      ARRANGEMENT_TYPES.includes(params.arrangement_type)
    ) {
      requested_arrangement.arrangement_type = params.arrangement_type;
    }
    if (
      Number.isInteger(params.months) &&
      (params.months as number) >= 1 &&
      (params.months as number) <= MAX_ARRANGEMENT_MONTHS
    ) {
      requested_arrangement.months = params.months;
    }
    return requested_arrangement;
  }

  private assertAmountMatches(
    claimed_amount: unknown,
    fee_txn_id: string,
    fee_amount: number,
  ): void {
    if (claimed_amount === undefined || claimed_amount === null) {
      return;
    }
    const is_matching =
      typeof claimed_amount === 'number' &&
      Math.abs(Math.abs(claimed_amount) - fee_amount) < AMOUNT_TOLERANCE;
    if (!is_matching) {
      throw new AmountMismatchError(fee_txn_id, fee_amount);
    }
  }
}
