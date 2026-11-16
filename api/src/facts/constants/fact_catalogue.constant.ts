export interface FactDescriptor {
  label: string;
  source: string;
}

const AI_SOFT_SIGNAL_SOURCE = 'AI soft signal (call transcript)';

// Every fact a policy can reference, with where it comes from. Used for the
// evidence table in the case pack and the decision explainer.
export const FACT_CATALOGUE: Record<string, FactDescriptor> = {
  identity_verified: {
    label: 'Identity verified by app push',
    source: 'engine.calls',
  },
  has_care_flag: {
    label: 'Care flag on the customer',
    source: 'bank.v_customer_overview',
  },
  card_belongs_to_caller: {
    label: 'Card belongs to the caller',
    source: 'bank.cards',
  },
  card_last4: { label: 'Card ending', source: 'bank.cards' },
  card_status: {
    label: 'Card status before the request',
    source: 'bank.cards',
  },
  fee_txn_id: { label: 'Fee transaction', source: 'bank.v_fee_history' },
  fee_amount: { label: 'Fee amount', source: 'bank.v_fee_history' },
  fee_cause: { label: 'Fee type', source: 'bank.v_fee_history' },
  fee_charged_at: { label: 'Fee charged at', source: 'bank.v_fee_history' },
  fee_already_refunded: {
    label: 'Fee already refunded',
    source: 'bank.v_fee_history',
  },
  refunds_last_12m: {
    label: 'Fee refunds in the last 12 months',
    source: 'bank.v_fee_history',
  },
  tenure_years: {
    label: 'Years as a customer',
    source: 'bank.v_customer_overview',
  },
  vulnerability_signals: {
    label: 'Vulnerability signals heard on the call',
    source: AI_SOFT_SIGNAL_SOURCE,
  },
  income_drop_pct: {
    label: 'Income drop (last 30 days vs the 90 days before)',
    source: 'bank.v_income_rolling',
  },
  recent_30d_income: {
    label: 'Income in the last 30 days',
    source: 'bank.v_income_rolling',
  },
  baseline_30d_income: {
    label: 'Average 30-day income before that',
    source: 'bank.v_income_rolling',
  },
  repayment_due_in_days: {
    label: 'Days until the next repayment',
    source: 'bank.loans',
  },
  days_in_arrears: { label: 'Days in arrears', source: 'bank.loans' },
  repayment_amount: { label: 'Repayment amount', source: 'bank.loans' },
  offset_balance: { label: 'Offset account balance', source: 'bank.accounts' },
  recent_hardship_enquiry: {
    label: 'Asked about missed repayments in the last 30 days',
    source: 'bank.contact_history',
  },
  customer_statement: {
    label: "Customer's own words",
    source: 'Call transcript (customer statement)',
  },
  held_amount: { label: 'Held payment amount', source: 'bank.transactions' },
  payee_name: { label: 'Payee name entered', source: 'bank.payees' },
  payee_name_check: { label: 'Payee name check', source: 'bank.payees' },
  payee_name_check_returned: {
    label: 'Name the receiving bank returned',
    source: 'bank.payees',
  },
  payee_age_hours: {
    label: 'Hours since the payee was added',
    source: 'bank.payees',
  },
  device_trusted: {
    label: 'Payment made from a trusted device',
    source: 'bank.devices',
  },
  device_age_minutes: {
    label: 'Minutes since the device was first seen',
    source: 'bank.devices',
  },
  declined_then_retry: {
    label: 'Declined payment to the same payee in the 2 hours before',
    source: 'bank.transactions',
  },
  limit_raised_recently: {
    label: 'Daily transfer limit raised in the last 7 days',
    source: 'bank.contact_history',
  },
  risk_score: { label: 'Fraud risk score', source: 'bank.transactions' },
  customer_age: { label: 'Customer age', source: 'bank.v_customer_overview' },
  scam_coaching_signals: {
    label: 'Scam coaching signals heard on the call',
    source: AI_SOFT_SIGNAL_SOURCE,
  },
  reason: {
    label: 'Why a person is needed',
    source: 'AI soft signal (call transcript)',
  },
};

const UNKNOWN_FACT_SOURCE = 'engine.cases.facts';

export function describeFact(fact: string): FactDescriptor {
  return (
    FACT_CATALOGUE[fact] ?? {
      label: fact.replace(/_/g, ' '),
      source: UNKNOWN_FACT_SOURCE,
    }
  );
}
