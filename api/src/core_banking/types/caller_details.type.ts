// Demo only: what the customer would know about themselves, shown on the
// simulated phone so a presenter can answer the identity questions.
export interface CallerContact {
  mobile_phone: string;
  street_address: string;
  suburb: string;
  state: string;
  last_income_at: Date | null;
}

export interface CallerDetails {
  customer_id: string;
  full_name: string;
  // YYYY-MM-DD
  date_of_birth: string;
  mobile_phone: string;
  street_address: string;
  suburb: string;
  state: string;
  postcode: string;
  last_income: {
    amount: number;
    kind: 'SALARY' | 'GOVT_BENEFIT';
    posted_at: string | null;
  } | null;
  recent_card_merchants: string[];
  card_last_fours: string[];
  loan_repayment_amounts: number[];
}
