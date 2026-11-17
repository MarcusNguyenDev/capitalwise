import type { ActionCode, PolicyDefinition, RiskClass } from "./case.type";
import type { IdentityLevel, RiskLevel } from "./call.type";

export type StaffStatus = "AVAILABLE" | "BUSY" | "ON_BREAK" | "OFFLINE";
export type StaffRole = "FRONTLINE" | "HARDSHIP_SPECIALIST" | "FRAUD_SPECIALIST" | "TEAM_LEADER";

/** Row of engine.v_workforce. */
export interface StaffMember {
  staff_id: string;
  name: string;
  role: StaffRole;
  skills: string[];
  status: StaffStatus;
  max_concurrent_supervision: number;
  supervised_call_count: number;
  assigned_case_count: number;
}

export interface AiAgent {
  agent_id: string;
  display_name: string;
  model: string;
  prompt_version: string;
  status: "ONLINE" | "PAUSED";
  max_concurrent_calls: number;
  active_call_count: number;
}

export interface Workforce {
  staff: StaffMember[];
  ai_agents: AiAgent[];
}

export interface SkillQueue {
  skill: string;
  waiting_case_count: number;
  available_staff_count: number;
  expected_wait_minutes: number;
}

export interface RecentRoute {
  case_number: string;
  call_id: string | null;
  customer_name: string;
  action_code: ActionCode;
  tier: number;
  status: string;
  required_skill: string | null;
  routing_rule: string | null;
  assigned_staff_name: string | null;
  created_at: string;
}

export interface RoutingOverview {
  queues: SkillQueue[];
  recent_routes: RecentRoute[];
}

export interface Policy {
  policy_id: string;
  action_code: ActionCode;
  version: number;
  is_active: boolean;
  definition: PolicyDefinition;
  created_at: string;
  approved_by: string;
}

export interface RegisteredAction {
  action_code: ActionCode;
  description: string;
  risk_class: RiskClass;
  reversible: boolean;
  required_evidence: string[];
  required_skill: string | null;
  /** The identity level the caller must reach before the AI may propose this action. */
  required_identity_level?: IdentityLevel;
  active_policy: Policy | null;
  policy_history: Policy[];
}

export interface PromptVersion {
  version: string;
  created_at: string;
  content: string;
  change_note: string;
  is_active: boolean;
}

export interface AutonomyStat {
  action_code: ActionCode;
  decided_cases: number;
  agreement_count: number;
  edited_count: number;
  agreement_pct: number;
  avg_minutes_to_decision: number;
  headline: string;
  is_eligible: boolean;
}

export interface AutonomyProposal {
  proposal_id: number;
  action_code: ActionCode;
  matched_rule_id: string | null;
  title: string;
  agreement_pct: number;
  decided_cases: number;
  proposed_by: string;
  proposed_by_name: string;
  status: "PENDING_SIGN_OFF" | "SIGNED_OFF" | "DECLINED";
  created_at: string;
  signed_off_by: string | null;
  signed_off_by_name?: string | null;
  signed_off_at: string | null;
  /** Set once a policy owner published the policy version that carries the promotion. */
  published_policy_id?: string | null;
}

export interface AutonomyOverview {
  stats: AutonomyStat[];
  proposals: AutonomyProposal[];
}

export interface DashboardKpis {
  live_calls: number;
  handled_by_ai: number;
  needing_attention: number;
  with_humans: number;
  avg_ai_response_ms: number | null;
  cases_auto_resolved_today: number;
  staff_available: number;
  calls_today: number;
}

export interface Escalation {
  escalation_key: string;
  kind: "CASE" | "CALL";
  case_number: string | null;
  call_id: string | null;
  customer_name: string | null;
  action_code: ActionCode | null;
  tier: number | null;
  reason: string | null;
  risk_level: RiskLevel | null;
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  waiting_seconds: number;
  created_at: string;
}

export interface JourneyStep {
  label: string;
  detail: string;
  duration_seconds: number;
  measured_metric?: string;
  is_measured?: boolean;
  /** An alternative ending (a human joins); not counted in the journey total. */
  is_optional_path?: boolean;
}

export interface Journey {
  title: string;
  steps: JourneyStep[];
  total_seconds: number;
  outcome: string;
}

export interface JourneyComparison {
  legacy_journey: Journey;
  ai_journey: Journey;
  measured: {
    sample_call_count: number;
    avg_response_ms: number | null;
    avg_time_to_identity_ms: number | null;
    avg_time_to_resolution_ms: number | null;
    avg_time_to_human_ms: number | null;
    avg_cost_usd: number | null;
  };
}

export interface DemoConfig {
  bank_name: string;
  is_demo_mode: boolean;
}

export interface Caller {
  customer_id: string;
  full_name: string;
  first_name: string;
  mobile_phone: string;
  age: number;
}

/** How the customer likes to hear from the bank; the AI can change these on the call. */
export interface CustomerPreferences {
  paper_statements: boolean;
  sms_alerts: boolean;
  large_print_letters: boolean;
}

export interface CustomerOverview {
  customer_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  mobile_phone: string;
  email: string;
  suburb: string;
  state: string;
  customer_since: string;
  age: number;
  tenure_years: number;
  has_care_flag: boolean;
  flags: { flag_id: string; flag_type: string; note: string; created_at: string }[];
  accounts: {
    account_id: string;
    product_code: string;
    product_name: string;
    category: string;
    nickname: string;
    status: string;
    role: string;
    current_balance: number;
    available_balance: number;
    daily_transfer_limit: number;
  }[];
  cards: { card_id: string; account_id: string; card_type: string; last4: string; status: string }[];
  preferences?: CustomerPreferences | null;
  recent_contacts: { contact_id: string; created_at: string; channel: string; event_type: string; summary: string }[];
  devices: { device_id: string; device_name: string; platform: string; first_seen_at: string; is_trusted: boolean }[];
}
