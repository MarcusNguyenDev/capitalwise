import { CallMetrics } from './call_metrics.type';

export type CallChannel = 'BROWSER' | 'PHONE' | 'SIMULATED';
export type CallStatus =
  'AI_ACTIVE' | 'NEEDS_ATTENTION' | 'HUMAN_ACTIVE' | 'ENDED';
export type CallSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'DISTRESSED';
export type CallRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Row of engine.calls.
export interface CallRow {
  call_id: string;
  caller_number: string;
  customer_id: string | null;
  customer_name: string | null;
  channel: CallChannel;
  status: CallStatus;
  handled_by_agent_id: string | null;
  assigned_staff_id: string | null;
  identity_verified: boolean;
  verified_at: Date | null;
  intent: string | null;
  sentiment: CallSentiment;
  risk_level: CallRiskLevel;
  attention_reason: string | null;
  started_at: Date;
  ended_at: Date | null;
  ai_summary: string | null;
  metrics: CallMetrics;
}

// The columns of engine.calls a service may change after the call started.
export type CallChanges = Partial<
  Pick<
    CallRow,
    | 'status'
    | 'assigned_staff_id'
    | 'identity_verified'
    | 'verified_at'
    | 'intent'
    | 'sentiment'
    | 'risk_level'
    | 'attention_reason'
    | 'ended_at'
    | 'ai_summary'
    | 'metrics'
  >
>;
