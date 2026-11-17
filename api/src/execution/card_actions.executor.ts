import { Injectable } from '@nestjs/common';

import {
  CARD_STATUSES,
  CardServicingAdapter,
} from '../core_banking/card_servicing.adapter';
import { CoreBankingAdapter } from '../core_banking/core_banking.adapter';
import { TransactionClient } from '../database/types/transaction_client.type';
import { ACTION_CODES } from '../facts/constants/action_code.constant';
import {
  addBusinessDays,
  getBankToday,
} from '../shared_kernel/utils/bank_calendar.util';
import { CARD_DELIVERY_BUSINESS_DAYS } from './constants/execution_defaults.constant';
import { CardStatusConflictError } from './errors/card_status_conflict.error';
import {
  ExecutionOutcome,
  ExecutionRequest,
} from './types/execution_request.type';

const REQUIRED_STARTING_STATUS: Record<string, string | undefined> = {
  [ACTION_CODES.UNLOCK_CARD]: CARD_STATUSES.TEMP_LOCKED,
  [ACTION_CODES.ACTIVATE_CARD]: CARD_STATUSES.INACTIVE,
};

const TARGET_STATUS: Record<string, string> = {
  [ACTION_CODES.LOCK_CARD]: CARD_STATUSES.TEMP_LOCKED,
  [ACTION_CODES.UNLOCK_CARD]: CARD_STATUSES.ACTIVE,
  [ACTION_CODES.ACTIVATE_CARD]: CARD_STATUSES.ACTIVE,
};

const CONTACT_EVENTS: Record<string, [string, (last4: string) => string]> = {
  [ACTION_CODES.LOCK_CARD]: [
    'CARD_LOCKED',
    (last4) => `Card ending ${last4} temporarily locked over the phone.`,
  ],
  [ACTION_CODES.UNLOCK_CARD]: [
    'CARD_UNLOCKED',
    (last4) => `Card ending ${last4} unlocked over the phone.`,
  ],
  [ACTION_CODES.ACTIVATE_CARD]: [
    'CARD_ACTIVATED',
    (last4) => `New card ending ${last4} activated over the phone.`,
  ],
};

// LOCK_CARD, REPORT_LOST_STOLEN, UNLOCK_CARD, ACTIVATE_CARD and REPLACE_CARD.
@Injectable()
export class CardActionsExecutor {
  constructor(
    private readonly core_banking_adapter: CoreBankingAdapter,
    private readonly card_servicing_adapter: CardServicingAdapter,
  ) {}

  runCardAction(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    switch (execution_request.action_code) {
      case ACTION_CODES.REPORT_LOST_STOLEN:
        return this.blockLostOrStolenCard(transaction, execution_request);
      case ACTION_CODES.REPLACE_CARD:
        return this.replaceCard(transaction, execution_request);
      default:
        return this.changeCardStatus(transaction, execution_request);
    }
  }

  private async changeCardStatus(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const { action_code } = execution_request;
    const card_id = String(execution_request.params.card_id);
    const required_status = REQUIRED_STARTING_STATUS[action_code];
    if (required_status) {
      const card = await this.core_banking_adapter.getCard(card_id);
      if (card.status !== required_status) {
        throw new CardStatusConflictError(card_id, card.status, action_code);
      }
    }
    const status_change = await this.card_servicing_adapter.changeCardStatus(
      transaction,
      card_id,
      TARGET_STATUS[action_code],
    );
    const [contact_event_type, describeContact] = CONTACT_EVENTS[action_code];
    return {
      result: status_change,
      contact_event_type,
      contact_summary: describeContact(status_change.card_last4),
    };
  }

  private async blockLostOrStolenCard(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const is_stolen = execution_request.params.reason === 'STOLEN';
    const status_change = await this.card_servicing_adapter.changeCardStatus(
      transaction,
      String(execution_request.params.card_id),
      is_stolen ? CARD_STATUSES.BLOCKED_STOLEN : CARD_STATUSES.BLOCKED_LOST,
    );
    return {
      result: {
        ...status_change,
        reason: is_stolen ? 'STOLEN' : 'LOST',
      },
      contact_event_type: 'CARD_REPORTED_LOST_STOLEN',
      contact_summary: `Card ending ${status_change.card_last4} reported ${is_stolen ? 'stolen' : 'lost'} and blocked permanently.`,
    };
  }

  private async replaceCard(
    transaction: TransactionClient,
    execution_request: ExecutionRequest,
  ): Promise<ExecutionOutcome> {
    const replacement = await this.card_servicing_adapter.replaceCard(
      transaction,
      {
        card_id: String(execution_request.params.card_id),
        case_number: execution_request.case_number,
        expected_by: addBusinessDays(
          getBankToday(),
          CARD_DELIVERY_BUSINESS_DAYS,
        ),
      },
    );
    return {
      result: replacement,
      contact_event_type: 'CARD_REPLACEMENT_ORDERED',
      contact_summary: `Replacement for card ending ${replacement.old_card_last4} ordered (new card ending ${replacement.new_card_last4}), posted to ${replacement.delivery_suburb}, due by ${replacement.expected_by}. Old card blocked.`,
    };
  }
}
