import { CustomerOverview } from '../types/bank_records.type';

export interface ReducedCustomerOverview {
  customer_id: string;
  first_name: string;
  identity_level: number;
  is_reduced_view: true;
  accounts: {
    account_id: string;
    nickname: string;
    category: string;
    product_name: string;
  }[];
  cards: {
    card_id: string;
    card_type: string;
    status: string;
    account_nickname: string | null;
  }[];
}

// What the AI may see about a caller confirmed only to level 1: enough to
// lock or report a card and order a statement, nothing that answers a level 2
// question (no balances, no card digits, no transactions, no contacts).
export function reduceCustomerOverview(
  overview: CustomerOverview,
  identity_level: number,
): ReducedCustomerOverview {
  const nicknames_by_account = new Map(
    overview.accounts.map((account) => [account.account_id, account.nickname]),
  );
  return {
    customer_id: overview.customer_id,
    first_name: overview.first_name,
    identity_level,
    is_reduced_view: true,
    accounts: overview.accounts.map((account) => ({
      account_id: account.account_id,
      nickname: account.nickname,
      category: account.category,
      product_name: account.product_name,
    })),
    cards: overview.cards.map((card) => ({
      card_id: String(card.card_id),
      card_type: String(card.card_type),
      status: String(card.status),
      account_nickname:
        nicknames_by_account.get(String(card.account_id)) ?? null,
    })),
  };
}
