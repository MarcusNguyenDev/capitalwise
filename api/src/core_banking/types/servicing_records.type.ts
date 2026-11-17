export interface AddressProfile {
  customer_id: string;
  street_address: string;
  suburb: string;
  postcode: string;
  email: string;
  address_updated_at: Date;
  address_age_days: number;
}

export interface NewCardOrder {
  customer_id: string;
  replaces_card_id: string;
  new_card_id: string;
  delivery_suburb: string;
  expected_by: string;
  case_number: string;
}

export interface CardOrder extends NewCardOrder {
  order_id: string;
  status: string;
  created_at: Date;
}

export interface IssuedCard {
  card_id: string;
  last4: string;
  status: string;
}

export interface CustomerPreferences {
  paper_statements: boolean;
  sms_alerts: boolean;
  large_print_letters: boolean;
}

export type PreferenceChanges = Partial<CustomerPreferences>;

export interface AccountProfile {
  account_id: string;
  nickname: string;
  category: string;
  status: string;
}

export interface NewStatementRequest {
  customer_id: string;
  account_id: string;
  months: number;
  delivery: 'POST' | 'EMAIL';
  delivery_to: string;
  is_large_print: boolean;
  expected_by: string;
  case_number: string;
}

export interface StatementRequest extends NewStatementRequest {
  request_id: string;
  status: string;
  created_at: Date;
}

export interface NewPaymentArrangement {
  account_id: string;
  customer_id: string;
  weeks: number;
  weekly_amount: number | null;
  start_on: string;
  end_on: string;
  case_number: string;
}

export interface PaymentArrangement extends NewPaymentArrangement {
  arrangement_id: string;
  status: string;
  late_fees_paused: boolean;
  created_at: Date;
}

export interface DisputableTransaction {
  txn_id: string;
  account_id: string;
  status: string;
  txn_type: string;
  amount: number;
  merchant: string | null;
  description: string;
  created_at: Date;
}

export interface NewDispute {
  txn_id: string;
  account_id: string;
  customer_id: string;
  reason: string;
  details: string | null;
  amount: number;
  expected_by: string;
  case_number: string;
}

export interface Dispute extends NewDispute {
  dispute_id: string;
  status: string;
  provisional_credit_txn_id: string | null;
  created_at: Date;
}
