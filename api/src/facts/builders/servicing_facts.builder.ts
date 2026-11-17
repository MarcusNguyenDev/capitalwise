import { Injectable } from '@nestjs/common';

import { CoreBankingAdapter } from '../../core_banking/core_banking.adapter';
import { CustomerServicingAdapter } from '../../core_banking/customer_servicing.adapter';
import { AccountProfile } from '../../core_banking/types/servicing_records.type';
import {
  ACTION_CODES,
  MAX_PAYMENT_ARRANGEMENT_WEEKS,
  MAX_STATEMENT_MONTHS,
  PREFERENCE_NAMES,
  STATEMENT_DELIVERIES,
} from '../constants/action_code.constant';
import { AccountNotEligibleError } from '../errors/account_not_eligible.error';
import { MissingActionParamError } from '../errors/missing_action_param.error';
import { BuiltFacts, FactRequest } from '../types/fact_request.type';
import {
  readBooleanParam,
  readPositiveAmountParam,
  readStringParam,
  requireEnumParam,
  requireIntegerParam,
  requireStringParam,
} from '../utils/action_params.util';

const ARRANGEMENT_ACCOUNT_CATEGORIES = ['HOME_LOAN', 'CREDIT_CARD'];
const HOME_LOAN_CATEGORY = 'HOME_LOAN';

// Facts for REQUEST_STATEMENT, UPDATE_PREFERENCES, PAYMENT_ARRANGEMENT and
// SERVICE_REQUEST.
@Injectable()
export class ServicingFactsBuilder {
  constructor(
    private readonly core_banking_adapter: CoreBankingAdapter,
    private readonly customer_servicing_adapter: CustomerServicingAdapter,
  ) {}

  buildServicingFacts(fact_request: FactRequest): Promise<BuiltFacts> {
    switch (fact_request.action_code) {
      case ACTION_CODES.REQUEST_STATEMENT:
        return this.buildStatementFacts(fact_request);
      case ACTION_CODES.UPDATE_PREFERENCES:
        return this.buildPreferenceFacts(fact_request);
      case ACTION_CODES.PAYMENT_ARRANGEMENT:
        return this.buildArrangementFacts(fact_request);
      default:
        return Promise.resolve(this.buildServiceRequestFacts(fact_request));
    }
  }

  private async buildStatementFacts(
    fact_request: FactRequest,
  ): Promise<BuiltFacts> {
    const { action_code, params } = fact_request;
    const account = await this.getOwnedAccount(fact_request);
    const months = requireIntegerParam(action_code, params, {
      param_name: 'months',
      min: 1,
      max: MAX_STATEMENT_MONTHS,
    });
    const delivery = requireEnumParam(
      action_code,
      params,
      'delivery',
      STATEMENT_DELIVERIES,
    );
    const preferences = await this.customer_servicing_adapter.getPreferences(
      fact_request.customer_id,
    );
    return {
      facts: {
        account_id: account.account_id,
        account_nickname: account.nickname,
        statement_months: months,
        statement_delivery: delivery,
        is_large_print: preferences.large_print_letters,
      },
      resolved_params: { account_id: account.account_id, months, delivery },
    };
  }

  private async buildPreferenceFacts(
    fact_request: FactRequest,
  ): Promise<BuiltFacts> {
    const requested_preferences: Record<string, boolean> = {};
    for (const preference_name of PREFERENCE_NAMES) {
      const requested_value = readBooleanParam(
        fact_request.action_code,
        fact_request.params,
        preference_name,
      );
      if (requested_value !== null) {
        requested_preferences[preference_name] = requested_value;
      }
    }
    if (Object.keys(requested_preferences).length === 0) {
      throw new MissingActionParamError(
        fact_request.action_code,
        PREFERENCE_NAMES.join(', or '),
      );
    }
    const current_preferences =
      await this.customer_servicing_adapter.getPreferences(
        fact_request.customer_id,
      );
    return {
      facts: { requested_preferences, current_preferences },
      resolved_params: requested_preferences,
    };
  }

  private async buildArrangementFacts(
    fact_request: FactRequest,
  ): Promise<BuiltFacts> {
    const { action_code, params } = fact_request;
    const account = await this.getOwnedAccount(fact_request);
    if (!ARRANGEMENT_ACCOUNT_CATEGORIES.includes(account.category)) {
      throw new AccountNotEligibleError(
        account.account_id,
        'a payment arrangement is for a home loan or credit card account',
      );
    }
    const weeks = requireIntegerParam(action_code, params, {
      param_name: 'weeks',
      min: 1,
      max: MAX_PAYMENT_ARRANGEMENT_WEEKS,
    });
    const weekly_amount = readPositiveAmountParam(
      action_code,
      params,
      'amount',
    );
    // Only loans carry arrears in the bank's records. For a card the fact is
    // missing, so the AUTO rule cannot match and a specialist decides.
    const days_in_arrears =
      account.category === HOME_LOAN_CATEGORY
        ? (await this.core_banking_adapter.getLoan(account.account_id))
            .days_in_arrears
        : null;
    return {
      facts: {
        account_id: account.account_id,
        account_category: account.category,
        account_nickname: account.nickname,
        arrangement_weeks: weeks,
        weekly_amount,
        days_in_arrears,
        vulnerability_signals: fact_request.soft_signals.vulnerability_signals,
      },
      resolved_params: { account_id: account.account_id, weeks, weekly_amount },
    };
  }

  private buildServiceRequestFacts(fact_request: FactRequest): BuiltFacts {
    const request_type = requireStringParam(
      fact_request.action_code,
      fact_request.params,
      'request_type',
    )
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    const details = readStringParam(fact_request.params, 'details');
    return {
      facts: { request_type, request_details: details },
      resolved_params: { request_type, details },
    };
  }

  private async getOwnedAccount(
    fact_request: FactRequest,
  ): Promise<AccountProfile> {
    const account_id = requireStringParam(
      fact_request.action_code,
      fact_request.params,
      'account_id',
    );
    await this.core_banking_adapter.assertAccountOwned(
      fact_request.customer_id,
      account_id,
    );
    const account =
      await this.customer_servicing_adapter.findAccountProfile(account_id);
    if (!account) {
      throw new AccountNotEligibleError(
        account_id,
        'the account was not found',
      );
    }
    return account;
  }
}
