import type { CallTurn, Intervention } from "./call.type";

export type ActionCode = "LOCK_CARD" | "REFUND_FEE" | "HARDSHIP_REQUEST" | "RELEASE_HELD_PAYMENT" | "HUMAN_CALLBACK";
export type CaseStatus =
  | "AUTO_EXECUTED"
  | "PENDING_APPROVAL"
  | "ESCALATED"
  | "APPROVED"
  | "EDITED_AND_APPROVED"
  | "REJECTED"
  | "EXECUTED";
export type Recommendation = "APPROVE" | "DECLINE" | "ESCALATE";
export type PolicyRoute = "AUTO" | "APPROVE" | "ESCALATE";
export type CaseDecision = "APPROVED" | "EDITED_AND_APPROVED" | "REJECTED";
export type RiskClass = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FactValue = string | number | boolean | null | string[];

export interface SoftSignals {
  vulnerability_signals?: string[];
  scam_coaching_signals?: string[];
  quotes?: string[];
}

export interface PolicyCondition {
  fact: string;
  op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains_any";
  value: FactValue;
}

export interface PolicyRule {
  id: string;
  when?: PolicyCondition[];
  route: PolicyRoute;
  recommend: Recommendation;
  confidence: number;
  reason: string;
  proposal?: Record<string, unknown>;
}

export interface PolicyDefinition {
  rules: PolicyRule[];
  default: PolicyRule;
}

/** Row of engine.v_decision_explanations (also the shape of engine.v_approval_inbox rows, minus a few columns). */
export interface EngineCase {
  case_number: string;
  call_id: string | null;
  customer_id: string;
  customer_name: string;
  action_code: ActionCode;
  action_description: string;
  risk_class: RiskClass;
  reversible?: boolean;
  required_evidence?: string[];
  params: Record<string, unknown>;
  tier: 1 | 2 | 3;
  status: CaseStatus;
  priority?: number;
  summary: string;
  customer_statement: string | null;
  facts: Record<string, FactValue>;
  soft_signals: SoftSignals;
  recommendation: Recommendation;
  confidence: number;
  policy_id: string;
  policy_version: number;
  policy_definition?: PolicyDefinition;
  policy_approved_by?: string;
  matched_rule_id: string;
  route_reason: string;
  required_skill: string | null;
  routing_rule: string | null;
  model: string;
  prompt_version: string;
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  sla_due_at: string | null;
  response_due_on: string | null;
  decision?: CaseDecision | null;
  decision_reason_code?: string | null;
  decided_by?: string | null;
  decided_by_name?: string | null;
  decided_by_role?: string | null;
  decided_at?: string | null;
  created_at: string;
  has_care_flag?: boolean;
  waiting_seconds?: number;
}

export interface EvidenceRow {
  fact: string;
  label: string;
  value: FactValue;
  source: string;
  is_required?: boolean;
}

export interface EvaluatedCondition {
  rule_id?: string;
  fact: string;
  op: string;
  expected: FactValue;
  actual: FactValue | undefined;
  passed: boolean;
}

export interface ExplainedRule {
  rule_id: string;
  is_matched: boolean;
  is_default: boolean;
  route: PolicyRoute;
  recommend: Recommendation;
  confidence: number;
  reason: string;
  conditions: EvaluatedCondition[];
}

export interface ReasonCode {
  code: string;
  label: string;
}

export interface CustomerNotification {
  notification_id: string;
  customer_id: string;
  call_id: string | null;
  case_number: string | null;
  channel: "APP_PUSH" | "SMS";
  kind: "IDENTITY_CHECK" | "CASE_UPDATE";
  body: string;
  status: "SENT" | "APPROVED" | "DENIED" | "EXPIRED";
  created_at: string;
  responded_at: string | null;
}

export interface CasePack {
  case: EngineCase;
  evidence: EvidenceRow[];
  rules: ExplainedRule[];
  transcript_excerpt: CallTurn[];
  notifications: CustomerNotification[];
  reason_codes: { approve: ReasonCode[]; reject: ReasonCode[] };
}

export interface BatchGroup {
  group_key: string;
  action_code: ActionCode;
  recommendation: Recommendation;
  matched_rule_id: string;
  route_reason: string;
  case_count: number;
  total_amount: number;
  label: string;
  cases: { case_number: string; customer_name: string; amount: number; summary: string; created_at: string }[];
}

export interface CaseDecisionRequest {
  staff_id: string;
  decision: CaseDecision;
  reason_code: string;
  edited_params?: Record<string, unknown>;
}

export interface CaseDecisionResult {
  case: EngineCase;
  is_executed: boolean;
  execution_result: Record<string, unknown> | null;
}

export interface BatchApproveResult {
  approved: { case_number: string; execution_result: Record<string, unknown> | null }[];
  failed: { case_number: string; message: string }[];
}

export interface AuditEvent {
  event_id: number;
  occurred_at: string;
  actor_type: "AI" | "STAFF" | "SYSTEM" | "CUSTOMER";
  actor_id: string | null;
  actor_name: string | null;
  event_type: string;
  call_id: string | null;
  case_number: string | null;
  detail: Record<string, unknown>;
}

export interface AuditEventPage {
  events: AuditEvent[];
  total_count: number;
  event_types: string[];
}

export interface AuditEventFilter {
  actor_type?: string;
  actor_id?: string;
  event_type?: string;
  call_id?: string;
  case_number?: string;
  search?: string;
  limit?: number;
  before_event_id?: number;
}

export interface TamperTestResult {
  attempted_sql: string;
  is_rejected: boolean;
  database_error: string | null;
}

export interface DecisionExplanation {
  case: EngineCase;
  customer_said: { statement: string | null; quotes: string[] };
  tool_calls: Pick<CallTurn, "seq" | "tool_name" | "tool_args" | "tool_result" | "latency_ms" | "created_at">[];
  facts: EvidenceRow[];
  rules: ExplainedRule[];
  outcome: {
    route: PolicyRoute;
    tier: 1 | 2 | 3;
    recommendation: Recommendation;
    confidence: number;
    matched_rule_id: string;
    reason: string;
  };
  versions: {
    model: string;
    prompt_version: string;
    policy_id: string;
    policy_version: number;
    policy_approved_by: string;
  };
  interventions: Intervention[];
  human_decision: {
    decision: CaseDecision;
    reason_code: string | null;
    reason_label: string | null;
    decided_by: string | null;
    decided_by_name: string | null;
    decided_by_role: string | null;
    decided_at: string | null;
  } | null;
  audit_trail: AuditEvent[];
  customer_explanation: string;
}

export interface EndedCallSummary {
  call_id: string;
  customer_name: string | null;
  intent: string | null;
  channel: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  turn_count: number;
}

export interface CallTimelineEvent {
  offset_ms: number;
  kind: "TURN" | "TOOL" | "INTERVENTION";
  speaker?: string;
  text?: string | null;
  tool_name?: string | null;
  tool_args?: Record<string, unknown> | null;
  tool_result?: Record<string, unknown> | null;
  intervention_type?: string;
  staff_name?: string;
  created_at: string;
}

export interface CallTimeline {
  call: EndedCallSummary & Record<string, unknown>;
  events: CallTimelineEvent[];
}
