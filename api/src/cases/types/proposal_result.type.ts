export interface ProposalResult {
  case_number: string;
  action_code: string;
  tier: number;
  route: string;
  status: string;
  recommendation: string;
  confidence: number;
  matched_rule_id: string;
  reason: string;
  policy_id: string;
  policy_version: number;
  required_skill: string | null;
  routing_rule: string | null;
  handled_by: { staff_id: string; name: string; role: string } | null;
  expected_timing: string;
  expected_wait_minutes: number | null;
  response_due_on: string | null;
  is_executed: boolean;
  execution_result: Record<string, unknown> | null;
  // One plain sentence the AI can safely say to the caller.
  customer_message: string;
}

export interface ConcernResult extends ProposalResult {
  risk_level: 'HIGH';
  concern_type: string;
}
