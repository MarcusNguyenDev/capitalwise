export type PolicyOperator =
  'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains_any';

export type PolicyRoute = 'AUTO' | 'APPROVE' | 'ESCALATE';
export type PolicyRecommendation = 'APPROVE' | 'DECLINE' | 'ESCALATE';

export interface PolicyCondition {
  fact: string;
  op: PolicyOperator;
  value: unknown;
}

export interface PolicyOutcome {
  id: string;
  route: PolicyRoute;
  recommend: PolicyRecommendation;
  confidence: number;
  reason: string;
  proposal?: Record<string, unknown>;
  // Routes this outcome to a skill other than the action's own (e.g. CARE).
  skill?: string;
}

export interface PolicyRule extends PolicyOutcome {
  when: PolicyCondition[];
}

export interface PolicyDefinition {
  rules: PolicyRule[];
  default: PolicyOutcome;
}

export type PolicyFacts = Record<string, unknown>;
