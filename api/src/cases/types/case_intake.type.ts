import { CallRecord } from '../../call_records/types/call_record.type';
import { SoftSignals } from '../../facts/types/soft_signals.type';
import { PolicyDecision } from '../../policies/policies.service';
import { ActionType } from '../../policies/types/policy_registry.type';
import { RoutingDecision } from '../../routing/types/routing_decision.type';

export interface Caller {
  customer_id: string;
  customer_name: string;
}

export interface CaseIntake {
  call: CallRecord;
  caller: Caller;
  // From engine.identity_attempts at the time of the request.
  identity_level: number;
  action_type: ActionType;
  params: Record<string, unknown>;
  summary: string;
  customer_statement: string | null;
  soft_signals: SoftSignals;
  // Set when a concern or the model asks for a specific kind of specialist.
  required_skill_override: string | null;
}

export interface CaseDraft {
  intake: CaseIntake;
  params: Record<string, unknown>;
  facts: Record<string, unknown>;
  policy_decision: PolicyDecision;
  routing_decision: RoutingDecision;
  tier: number;
  status: string;
}

export interface CaseReevaluation {
  case_number: string;
  call_id: string | null;
  action_code: string;
  facts: Record<string, unknown>;
  soft_signals: SoftSignals;
  policy_decision: PolicyDecision;
  routing_decision: RoutingDecision;
  tier: number;
}
