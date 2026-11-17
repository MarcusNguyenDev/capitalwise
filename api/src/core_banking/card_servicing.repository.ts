import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { CardRecord } from './types/bank_records.type';
import {
  AddressProfile,
  CardOrder,
  IssuedCard,
  NewCardOrder,
} from './types/servicing_records.type';

const NEW_CARD_STATUS = 'INACTIVE';
const NEW_CARD_VALID_YEARS = 4;

// Cards, card orders and addresses in schema `bank`.
@Injectable()
export class CardServicingRepository {
  constructor(private readonly database: DatabaseService) {}

  async selectAddressProfile(
    customer_id: string,
  ): Promise<AddressProfile | null> {
    const profile_rows = await this.database.query<AddressProfile>(
      `SELECT customer_id, street_address, suburb, postcode, email, address_updated_at,
              (EXTRACT(EPOCH FROM (now() - address_updated_at)) / 86400)::int AS address_age_days
       FROM bank.customers
       WHERE customer_id = $1`,
      [customer_id],
    );
    return profile_rows[0] ?? null;
  }

  async countReplacementsInLast12Months(customer_id: string): Promise<number> {
    const count_rows = await this.database.query<{ order_count: number }>(
      `SELECT COUNT(*)::int AS order_count
       FROM bank.card_orders
       WHERE customer_id = $1 AND created_at > now() - interval '12 months'`,
      [customer_id],
    );
    return count_rows[0].order_count;
  }

  async selectCardForUpdate(
    transaction: TransactionClient,
    card_id: string,
  ): Promise<CardRecord | null> {
    const card_rows = await transaction.query<CardRecord>(
      `SELECT card_id, account_id, customer_id, card_type, last4, status
       FROM bank.cards WHERE card_id = $1 FOR UPDATE`,
      [card_id],
    );
    return card_rows[0] ?? null;
  }

  // A new card on the same account, INACTIVE until the customer activates it.
  // Its last four digits are derived from the sequence (mock data).
  async insertReplacementCard(
    transaction: TransactionClient,
    old_card: CardRecord,
  ): Promise<IssuedCard> {
    const card_rows = await transaction.query<IssuedCard>(
      `WITH next_card AS (SELECT nextval('bank.card_seq') AS card_number)
       INSERT INTO bank.cards (card_id, account_id, customer_id, card_type, last4, status, expires_on)
       SELECT 'CRD-' || next_card.card_number, $1, $2, $3,
              lpad(((next_card.card_number * 7919) % 10000)::text, 4, '0'), $4,
              (current_date + make_interval(years => $5::int))::date
       FROM next_card
       RETURNING card_id, last4, status`,
      [
        old_card.account_id,
        old_card.customer_id,
        old_card.card_type,
        NEW_CARD_STATUS,
        NEW_CARD_VALID_YEARS,
      ],
    );
    return card_rows[0];
  }

  async insertCardOrder(
    transaction: TransactionClient,
    new_card_order: NewCardOrder,
  ): Promise<CardOrder> {
    const order_rows = await transaction.query<CardOrder>(
      `INSERT INTO bank.card_orders (customer_id, replaces_card_id, new_card_id, delivery_suburb, expected_by, case_number)
       VALUES ($1, $2, $3, $4, $5::date, $6)
       RETURNING *`,
      [
        new_card_order.customer_id,
        new_card_order.replaces_card_id,
        new_card_order.new_card_id,
        new_card_order.delivery_suburb,
        new_card_order.expected_by,
        new_card_order.case_number,
      ],
    );
    return order_rows[0];
  }
}
