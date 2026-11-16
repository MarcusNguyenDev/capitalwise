import { CallRecord } from '../../call_records/types/call_record.type';
import { PolicyFacts } from '../../policies/types/policy_definition.type';
import { SoftSignals } from './soft_signals.type';

export interface FactRequest {
  action_code: string;
  call: CallRecord;
  customer_id: string;
  params: Record<string, unknown>;
  customer_statement: string | null;
  soft_signals: SoftSignals;
}

export interface BuiltFacts {
  facts: PolicyFacts;
  // The model's params with every id resolved and checked against the bank.
  resolved_params: Record<string, unknown>;
}
