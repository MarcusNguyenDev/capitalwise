import { CallMetrics } from './call_metrics.type';

export type CallChannel = 'BROWSER' | 'PHONE' | 'SIMULATED';
export type CallStatus =
  'AI_ACTIVE' | 'NEEDS_ATTENTION' | 'HUMAN_ACTIVE' | 'ENDED';
export type CallSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'DISTRESSED';
export type CallRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
// 0 = not confirmed, 1 = name + date of birth + postcode, 2 = level 1 plus a
// question about the customer's own recent activity.
export type IdentityLevel = 0 | 1 | 2;
export type IdentityMethod = 'KNOWLEDGE' | 'APP_PUSH';

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
  // Kept for older readers: true once identity_level >= 1.
  identity_verified: boolean;
  identity_level: IdentityLevel;
  identity_method: IdentityMethod | null;
  is_identity_locked: boolean;
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
    | 'customer_id'
    | 'customer_name'
    | 'assigned_staff_id'
    | 'identity_verified'
    | 'identity_level'
    | 'identity_method'
    | 'is_identity_locked'
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
