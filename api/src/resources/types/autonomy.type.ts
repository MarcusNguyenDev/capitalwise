export interface AutonomyStats {
  action_code: string;
  decided_cases: number;
  agreement_count: number;
  edited_count: number;
  agreement_pct: number;
  avg_minutes_to_decision: number;
  reversible: boolean;
  action_description: string;
}

export interface AutonomyProposal {
  proposal_id: number;
  action_code: string;
  matched_rule_id: string | null;
  title: string;
  agreement_pct: number;
  decided_cases: number;
  proposed_by: string;
  status: string;
  created_at: Date;
  signed_off_by: string | null;
  signed_off_at: Date | null;
  proposed_by_name?: string | null;
  signed_off_by_name?: string | null;
}

export interface NewAutonomyProposal {
  action_code: string;
  matched_rule_id: string | null;
  title: string;
  agreement_pct: number;
  decided_cases: number;
  proposed_by: string;
}
