// What the bank knows that only the customer should also know. Used inside
// the api to check answers; never returned by any endpoint.
export interface IdentityCandidate {
  customer_id: string;
  first_name: string;
  last_name: string;
  // YYYY-MM-DD
  date_of_birth: string;
  postcode: string;
}

export interface IdentityKnowledge extends IdentityCandidate {
  last_income: { amount: number; txn_type: string } | null;
  recent_card_merchants: string[];
  card_last_fours: string[];
  loan_repayment_amounts: number[];
}
