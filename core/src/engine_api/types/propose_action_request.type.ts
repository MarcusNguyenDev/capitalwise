export interface SoftSignals {
  vulnerability_signals?: string[];
  scam_coaching_signals?: string[];
  fraud_signals?: string[];
  quotes?: string[];
}

export interface ProposeActionRequest {
  call_id: string;
  action_code: string;
  params: Record<string, unknown>;
  summary: string;
  customer_statement?: string;
  soft_signals?: SoftSignals;
}

export interface FlagConcernRequest {
  call_id: string;
  type: 'SCAM_COACHING' | 'VULNERABILITY';
  quotes: string[];
  signals?: string[];
}
