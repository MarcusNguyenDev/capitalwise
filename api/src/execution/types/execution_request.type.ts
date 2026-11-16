import { StaffMember } from '../../routing/types/staff_member.type';

export interface ExecutionRequest {
  case_number: string;
  call_id: string | null;
  action_code: string;
  customer_id: string;
  params: Record<string, unknown>;
  // The staff member whose approval triggered this; null for Tier 1 (auto).
  decided_by: StaffMember | null;
}

export type ExecutionResult = Record<string, unknown>;

export interface ExecutionOutcome {
  result: ExecutionResult;
  contact_event_type: string;
  contact_summary: string;
}
