// What the caller can be told happened:
//   DONE            executed now (AUTO_EXECUTED, or EXECUTED after approval)
//   DECLINED        AUTO_DECLINED by policy, or REJECTED by staff
//   WITH_SPECIALIST escalated to a specialist (Tier 3)
//   PENDING_REVIEW  waiting for a staff decision (Tier 2)
export type ProposalOutcome =
  'DONE' | 'DECLINED' | 'WITH_SPECIALIST' | 'PENDING_REVIEW';

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
  outcome: ProposalOutcome;
  // One plain sentence the AI can say to the caller, with the concrete
  // outcome. It never promises more than the case record shows.
  customer_message: string;
}

export interface ConcernResult extends ProposalResult {
  risk_level: 'HIGH';
  concern_type: string;
}
