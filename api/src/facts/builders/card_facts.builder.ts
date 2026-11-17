import { Injectable } from '@nestjs/common';

import { CardServicingAdapter } from '../../core_banking/card_servicing.adapter';
import { CoreBankingAdapter } from '../../core_banking/core_banking.adapter';
import {
  ACTION_CODES,
  LOST_STOLEN_REASONS,
} from '../constants/action_code.constant';
import { CardNotOwnedError } from '../errors/card_not_owned.error';
import { BuiltFacts, FactRequest } from '../types/fact_request.type';
import {
  requireEnumParam,
  requireStringParam,
} from '../utils/action_params.util';

// Facts for LOCK_CARD, REPORT_LOST_STOLEN, UNLOCK_CARD, REPLACE_CARD and
// ACTIVATE_CARD. A card id the model got wrong is rejected (CARD_NOT_OWNED),
// never turned into an escalation.
@Injectable()
export class CardFactsBuilder {
  constructor(
    private readonly core_banking_adapter: CoreBankingAdapter,
    private readonly card_servicing_adapter: CardServicingAdapter,
  ) {}

  async buildCardFacts(fact_request: FactRequest): Promise<BuiltFacts> {
    const { action_code, params } = fact_request;
    const card_id = requireStringParam(action_code, params, 'card_id');
    const card = await this.core_banking_adapter.getCard(card_id);
    if (card.customer_id !== fact_request.customer_id) {
      throw new CardNotOwnedError(card_id);
    }
    const card_facts = {
      card_belongs_to_caller: true,
      card_last4: card.last4,
      card_status: card.status,
      card_type: card.card_type,
    };
    switch (action_code) {
      case ACTION_CODES.REPORT_LOST_STOLEN:
        return this.addReportReason(fact_request, card_facts, card_id);
      case ACTION_CODES.UNLOCK_CARD:
        return {
          facts: {
            ...card_facts,
            scam_coaching_signals:
              fact_request.soft_signals.scam_coaching_signals,
          },
          resolved_params: { card_id },
        };
      case ACTION_CODES.REPLACE_CARD:
        return this.addReplacementFacts(fact_request, card_facts, card_id);
      default:
        return { facts: card_facts, resolved_params: { card_id } };
    }
  }

  private addReportReason(
    fact_request: FactRequest,
    card_facts: Record<string, unknown>,
    card_id: string,
  ): BuiltFacts {
    const reason = requireEnumParam(
      fact_request.action_code,
      fact_request.params,
      'reason',
      LOST_STOLEN_REASONS,
    );
    return {
      facts: { ...card_facts, report_reason: reason },
      resolved_params: { card_id, reason },
    };
  }

  private async addReplacementFacts(
    fact_request: FactRequest,
    card_facts: Record<string, unknown>,
    card_id: string,
  ): Promise<BuiltFacts> {
    const [address_profile, replacements_last_12m] = await Promise.all([
      this.card_servicing_adapter.getAddressProfile(fact_request.customer_id),
      this.card_servicing_adapter.countReplacementsInLast12Months(
        fact_request.customer_id,
      ),
    ]);
    return {
      facts: {
        ...card_facts,
        address_age_days: address_profile.address_age_days,
        delivery_suburb: address_profile.suburb,
        replacements_last_12m,
        scam_coaching_signals: fact_request.soft_signals.scam_coaching_signals,
      },
      resolved_params: { card_id },
    };
  }
}
