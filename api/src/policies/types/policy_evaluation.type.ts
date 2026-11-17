import {
  PolicyOperator,
  PolicyRecommendation,
  PolicyRoute,
} from './policy_definition.type';

export interface ConditionEvaluation {
  rule_id: string;
  fact: string;
  op: PolicyOperator;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface PolicyEvaluation {
  route: PolicyRoute;
  recommend: PolicyRecommendation;
  confidence: number;
  matched_rule_id: string;
  reason: string;
  proposal?: Record<string, unknown>;
  skill?: string;
  conditions_evaluated: ConditionEvaluation[];
}

export interface RuleExplanation {
  rule_id: string;
  is_matched: boolean;
  is_default: boolean;
  route: PolicyRoute;
  recommend: PolicyRecommendation;
  confidence: number;
  reason: string;
  skill?: string;
  conditions: ConditionEvaluation[];
}
