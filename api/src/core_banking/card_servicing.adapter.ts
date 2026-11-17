import { Injectable } from '@nestjs/common';

import { TransactionClient } from '../database/types/transaction_client.type';
import { CardServicingRepository } from './card_servicing.repository';
import { CoreBankingRepository } from './core_banking.repository';
import { CardNotFoundError } from './errors/card_not_found.error';
import { CustomerNotFoundError } from './errors/customer_not_found.error';
import { CardRecord } from './types/bank_records.type';
import { AddressProfile } from './types/servicing_records.type';

export const CARD_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  TEMP_LOCKED: 'TEMP_LOCKED',
  BLOCKED_LOST: 'BLOCKED_LOST',
  BLOCKED_STOLEN: 'BLOCKED_STOLEN',
  CANCELLED: 'CANCELLED',
} as const;

// A card that can still be used (or will be, once activated) is cancelled
// when it is replaced. Lost and stolen cards are already blocked for good.
const STILL_USABLE_STATUSES: string[] = [
  CARD_STATUSES.ACTIVE,
  CARD_STATUSES.INACTIVE,
  CARD_STATUSES.TEMP_LOCKED,
];

export interface CardReplacementRequest {
  card_id: string;
  case_number: string;
  expected_by: string;
}

// Card servicing through the bank's systems: block, unlock, activate and
// replace. Part of the core banking seam.
@Injectable()
export class CardServicingAdapter {
  constructor(
    private readonly core_banking_repository: CoreBankingRepository,
    private readonly card_servicing_repository: CardServicingRepository,
  ) {}

  async getAddressProfile(customer_id: string): Promise<AddressProfile> {
    const address_profile =
      await this.card_servicing_repository.selectAddressProfile(customer_id);
    if (!address_profile) {
      throw new CustomerNotFoundError(customer_id);
    }
    return address_profile;
  }

  countReplacementsInLast12Months(customer_id: string): Promise<number> {
    return this.card_servicing_repository.countReplacementsInLast12Months(
      customer_id,
    );
  }

  async changeCardStatus(
    transaction: TransactionClient,
    card_id: string,
    card_status: string,
  ) {
    const card = await this.lockCard(transaction, card_id);
    await this.core_banking_repository.updateCardStatus(
      transaction,
      card_id,
      card_status,
    );
    const last_transaction =
      await this.core_banking_repository.selectLastCardTransaction(card_id);
    return {
      card_id,
      card_type: card.card_type,
      card_last4: card.last4,
      previous_status: card.status,
      card_status,
      last_transaction,
    };
  }

  // The old card is cancelled if it could still be used, a new INACTIVE card
  // is issued on the same account, and it is posted to the address on file.
  async replaceCard(
    transaction: TransactionClient,
    replacement_request: CardReplacementRequest,
  ) {
    const old_card = await this.lockCard(
      transaction,
      replacement_request.card_id,
    );
    const old_card_status = STILL_USABLE_STATUSES.includes(old_card.status)
      ? CARD_STATUSES.CANCELLED
      : old_card.status;
    if (old_card_status !== old_card.status) {
      await this.core_banking_repository.updateCardStatus(
        transaction,
        old_card.card_id,
        old_card_status,
      );
    }
    const new_card = await this.card_servicing_repository.insertReplacementCard(
      transaction,
      old_card,
    );
    const address_profile = await this.getAddressProfile(old_card.customer_id);
    const card_order = await this.card_servicing_repository.insertCardOrder(
      transaction,
      {
        customer_id: old_card.customer_id,
        replaces_card_id: old_card.card_id,
        new_card_id: new_card.card_id,
        delivery_suburb: address_profile.suburb,
        expected_by: replacement_request.expected_by,
        case_number: replacement_request.case_number,
      },
    );
    return {
      order_id: card_order.order_id,
      replaces_card_id: old_card.card_id,
      old_card_last4: old_card.last4,
      old_card_status,
      new_card_id: new_card.card_id,
      new_card_last4: new_card.last4,
      new_card_status: new_card.status,
      delivery_suburb: card_order.delivery_suburb,
      expected_by: replacement_request.expected_by,
    };
  }

  private async lockCard(
    transaction: TransactionClient,
    card_id: string,
  ): Promise<CardRecord> {
    const card = await this.card_servicing_repository.selectCardForUpdate(
      transaction,
      card_id,
    );
    if (!card) {
      throw new CardNotFoundError(card_id);
    }
    return card;
  }
}
