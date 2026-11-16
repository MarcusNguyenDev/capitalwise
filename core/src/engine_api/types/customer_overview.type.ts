export interface OverviewAccount {
  account_id: string;
  nickname: string;
  category: string;
  current_balance: number;
  available_balance: number;
  [extra_field: string]: unknown;
}

export interface OverviewCard {
  card_id: string;
  card_type: string;
  last4: string;
  status: string;
  [extra_field: string]: unknown;
}

export interface CustomerOverview {
  customer_id: string;
  first_name: string;
  tenure_years: number;
  has_care_flag: boolean;
  accounts: OverviewAccount[];
  cards: OverviewCard[];
  [extra_field: string]: unknown;
}
