import type { PolicyRoute } from "@/shared/types/case.type";

export const OPERATOR_SYMBOLS: Record<string, string> = {
  eq: "=",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  in: "is one of",
  contains_any: "includes any of",
};

/** Plain-English names for the facts policies test. Unlisted facts fall back to their code. */
export const FACT_LABELS: Record<string, string> = {
  identity_verified: "identity verified",
  identity_level: "identity",
  card_belongs_to_caller: "card belongs to caller",
  has_care_flag: "customer has a care flag",
  refunds_last_12m: "refunds in last 12 months",
  tenure_years: "tenure years",
  fee_amount: "fee amount",
  vulnerability_signals: "vulnerability signals",
  scam_coaching_signals: "scam coaching signals",
  fraud_signals: "fraud signals",
  income_drop_pct: "income drop %",
  repayment_due_in_days: "days until next repayment",
  days_in_arrears: "days in arrears",
  device_trusted: "device trusted",
  payee_name_check: "payee name check",
  card_status: "card status",
  address_age_days: "days since the address changed",
  replacements_last_12m: "replacement cards in last 12 months",
  dispute_reason: "dispute reason",
  txn_amount: "transaction amount",
  is_duplicate_confirmed: "duplicate confirmed by the bank's records",
  arrangement_weeks: "weeks of reduced payments",
  request_type: "request type",
};

/** The identity fact policies test; its conditions read as "identity confirmed to level 2". */
export const IDENTITY_LEVEL_FACT = "identity_level";

/** Route AUTO with recommend DECLINE: policy says no on the call, nothing is carried out. */
export const AUTO_DECLINE_PHRASE = "decline on the spot";

export const ROUTE_PHRASES: Record<PolicyRoute, string> = {
  AUTO: "run automatically",
  APPROVE: "send for approval",
  ESCALATE: "escalate to a human specialist",
};
