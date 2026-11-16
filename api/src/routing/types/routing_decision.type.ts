import { StaffMember } from './staff_member.type';

export interface RoutingRequest {
  action_code: string;
  tier: number;
  required_skill: string | null;
}

export interface RoutingDecision {
  required_skill: string | null;
  routing_rule: string;
  assigned_staff: StaffMember | null;
  priority: number;
  sla_minutes: number | null;
  expected_wait_minutes: number | null;
  expected_timing: string;
  response_due_on: string | null;
}

export interface TimingRequest {
  action_code: string;
  tier: number;
  expected_wait_minutes: number | null;
  response_due_on: string | null;
}
