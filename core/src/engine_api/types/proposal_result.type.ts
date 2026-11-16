export interface ProposalHandler {
  staff_id: string;
  name: string;
  role: string;
}

export interface ProposalResult {
  case_number: string;
  action_code: string;
  tier: number;
  route: 'AUTO' | 'APPROVE' | 'ESCALATE';
  status: string;
  recommendation: string;
  confidence: number;
  matched_rule_id: string;
  reason: string;
  policy_id: string;
  policy_version: number;
  required_skill: string | null;
  routing_rule: string | null;
  handled_by: ProposalHandler | null;
  expected_timing: string;
  expected_wait_minutes: number | null;
  response_due_on: string | null;
  is_executed: boolean;
  execution_result: Record<string, unknown> | null;
  customer_message: string;
}

export interface ConcernResult extends ProposalResult {
  risk_level: 'HIGH';
  concern_type: 'SCAM_COACHING' | 'VULNERABILITY';
}
