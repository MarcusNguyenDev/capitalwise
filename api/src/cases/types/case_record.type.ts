import { PolicyDefinition } from '../../policies/types/policy_definition.type';

// A row of engine.cases.
export interface CaseRecord {
  case_number: string;
  call_id: string | null;
  customer_id: string;
  customer_name: string;
  action_code: string;
  params: Record<string, unknown>;
  tier: number;
  status: string;
  priority: number;
  summary: string;
  customer_statement: string | null;
  facts: Record<string, unknown>;
  soft_signals: Record<string, unknown>;
  recommendation: string;
  confidence: number;
  policy_id: string;
  policy_version: number;
  matched_rule_id: string;
  route_reason: string;
  required_skill: string | null;
  routing_rule: string | null;
  model: string;
  prompt_version: string;
  assigned_staff_id: string | null;
  sla_due_at: Date | null;
  response_due_on: string | null;
  decision: string | null;
  decision_reason_code: string | null;
  decided_by: string | null;
  decided_at: Date | null;
  created_at: Date;
}

// A row of engine.v_decision_explanations: the case plus registry, policy and
// staff names. This is the shape every case endpoint and live event returns.
export interface CaseExplanationRow extends CaseRecord {
  action_description: string;
  risk_class: string;
  reversible: boolean;
  required_evidence: string[];
  policy_definition: PolicyDefinition;
  policy_approved_by: string;
  assigned_staff_name: string | null;
  decided_by_name: string | null;
  decided_by_role: string | null;
}
