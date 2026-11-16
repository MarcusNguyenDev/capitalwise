export interface CustomerOverview {
  customer_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  mobile_phone: string;
  email: string;
  suburb: string;
  state: string;
  customer_since: string;
  age: number;
  tenure_years: number;
  flags: Record<string, unknown>[];
  has_care_flag: boolean;
  accounts: CustomerAccountSummary[];
  cards: Record<string, unknown>[];
}

export interface CustomerAccountSummary {
  account_id: string;
  product_code: string;
  product_name: string;
  category: string;
  nickname: string;
  status: string;
  role: string;
  current_balance: number;
  available_balance: number;
  daily_transfer_limit: number;
}

export interface CallerSummary {
  customer_id: string;
  full_name: string;
  first_name: string;
  mobile_phone: string;
  age: number;
}

export interface CardRecord {
  card_id: string;
  account_id: string;
  customer_id: string;
  card_type: string;
  last4: string;
  status: string;
}

export interface LastCardTransaction {
  merchant: string | null;
  amount: number;
  created_at: Date;
  status: string;
}

export interface TransactionRecord {
  txn_id: string;
  account_id: string;
  status: string;
  txn_type: string;
  amount: number;
  description: string;
  created_at: Date;
}

export interface FeeHistoryEntry {
  txn_id: string;
  account_id: string;
  charged_at: Date;
  fee_amount: number;
  description: string;
  fee_cause: string;
  is_refunded: boolean;
  refunds_last_12m: number;
}

export interface IncomeRolling {
  recent_30d_income: number;
  baseline_30d_income: number;
  income_drop_pct: number;
  last_salary_at: Date | null;
}

export interface LoanRecord {
  account_id: string;
  nickname: string;
  current_balance: number;
  repayment_type: string;
  interest_rate: number;
  repayment_amount: number;
  repayment_frequency: string;
  next_repayment_due: string;
  repayment_due_in_days: number;
  arrears_amount: number;
  days_in_arrears: number;
  offset_account_id: string | null;
  offset_balance: number | null;
}

export interface HardshipArrangement {
  arrangement_id: string;
  account_id: string;
  customer_id: string;
  notice_received_on: string;
  notice_channel: string;
  response_due_on: string;
  arrangement_type: string;
  start_on: string;
  end_on: string;
  status: string;
  case_number: string | null;
}

export interface HeldPayment {
  txn_id: string;
  account_id: string;
  amount: number;
  created_at: Date;
  payee_name: string | null;
  status: string;
}

// Everything the fraud policy needs about one held payment. Never sent to the
// model: risk_score and hold_reason stay inside the decision pipeline.
export interface HeldPaymentRiskProfile {
  txn_id: string;
  account_id: string;
  status: string;
  held_amount: number;
  risk_score: number | null;
  payee_name: string | null;
  payee_name_check: string | null;
  payee_name_check_returned: string | null;
  payee_age_hours: number | null;
  device_trusted: boolean | null;
  device_age_minutes: number | null;
  declined_then_retry: boolean;
}

export interface NewFeeRefund {
  fee_txn_id: string;
  account_id: string;
  amount: number;
  description: string;
}

export interface NewHardshipArrangement {
  account_id: string;
  customer_id: string;
  arrangement_type: string;
  months: number;
  case_number: string;
}

export interface NewContactEntry {
  customer_id: string;
  event_type: string;
  summary: string;
}
