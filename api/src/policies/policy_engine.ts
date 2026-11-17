import {
  PolicyCondition,
  PolicyDefinition,
  PolicyFacts,
  PolicyOutcome,
  PolicyRule,
} from './types/policy_definition.type';
import {
  ConditionEvaluation,
  PolicyEvaluation,
  RuleExplanation,
} from './types/policy_evaluation.type';

// The policy engine is deliberately pure: no I/O, no clock, no randomness.
// The same policy and the same facts always give the same decision.

type NumberComparison = (actual: number, expected: number) => boolean;

const NUMBER_COMPARISONS: Record<string, NumberComparison> = {
  gt: (actual, expected) => actual > expected,
  gte: (actual, expected) => actual >= expected,
  lt: (actual, expected) => actual < expected,
  lte: (actual, expected) => actual <= expected,
};

function isMissing(fact_value: unknown): boolean {
  return fact_value === undefined || fact_value === null;
}

function isComparableNumber(candidate: unknown): candidate is number {
  return typeof candidate === 'number' && Number.isFinite(candidate);
}

function passesCondition(condition: PolicyCondition, actual: unknown): boolean {
  // A missing fact fails the condition: absence of evidence never approves.
  if (isMissing(actual)) {
    return false;
  }
  const expected = condition.value;
  if (condition.op === 'eq') {
    return actual === expected;
  }
  if (condition.op === 'in') {
    return Array.isArray(expected) && expected.includes(actual);
  }
  if (condition.op === 'contains_any') {
    return (
      Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.some((actual_item) => expected.includes(actual_item))
    );
  }
  const compareNumbers = NUMBER_COMPARISONS[condition.op];
  return (
    compareNumbers !== undefined &&
    isComparableNumber(actual) &&
    isComparableNumber(expected) &&
    compareNumbers(actual, expected)
  );
}

function evaluateCondition(
  rule_id: string,
  condition: PolicyCondition,
  facts: PolicyFacts,
): ConditionEvaluation {
  const fact_value = facts[condition.fact];
  return {
    rule_id,
    fact: condition.fact,
    op: condition.op,
    expected: condition.value,
    actual: isMissing(fact_value) ? null : fact_value,
    passed: passesCondition(condition, fact_value),
  };
}

function evaluateRule(
  rule: PolicyRule,
  facts: PolicyFacts,
): ConditionEvaluation[] {
  return (rule.when ?? []).map((condition) =>
    evaluateCondition(rule.id, condition, facts),
  );
}

function hasAllConditionsPassed(conditions: ConditionEvaluation[]): boolean {
  return conditions.every((condition) => condition.passed);
}

function buildEvaluation(
  outcome: PolicyOutcome,
  conditions_evaluated: ConditionEvaluation[],
): PolicyEvaluation {
  return {
    route: outcome.route,
    recommend: outcome.recommend,
    confidence: outcome.confidence,
    matched_rule_id: outcome.id,
    reason: outcome.reason,
    ...(outcome.proposal ? { proposal: outcome.proposal } : {}),
    ...(outcome.skill ? { skill: outcome.skill } : {}),
    conditions_evaluated,
  };
}

// Ordered rules, first match wins; a rule matches when ALL its conditions pass.
// Rules after the matched one are not evaluated.
export function evaluatePolicy(
  policy_definition: PolicyDefinition,
  facts: PolicyFacts,
): PolicyEvaluation {
  const conditions_evaluated: ConditionEvaluation[] = [];
  for (const rule of policy_definition.rules ?? []) {
    const rule_conditions = evaluateRule(rule, facts);
    conditions_evaluated.push(...rule_conditions);
    if (hasAllConditionsPassed(rule_conditions)) {
      return buildEvaluation(rule, conditions_evaluated);
    }
  }
  return buildEvaluation(policy_definition.default, conditions_evaluated);
}

function explainOutcome(
  outcome: PolicyOutcome,
  explanation_flags: Pick<
    RuleExplanation,
    'is_matched' | 'is_default' | 'conditions'
  >,
): RuleExplanation {
  return {
    rule_id: outcome.id,
    is_matched: explanation_flags.is_matched,
    is_default: explanation_flags.is_default,
    route: outcome.route,
    recommend: outcome.recommend,
    confidence: outcome.confidence,
    reason: outcome.reason,
    ...(outcome.skill ? { skill: outcome.skill } : {}),
    conditions: explanation_flags.conditions,
  };
}

// Evaluates EVERY rule (for the decision explainer), flagging the one that
// decided. A later rule whose conditions also pass is not "matched".
export function explainPolicy(
  policy_definition: PolicyDefinition,
  facts: PolicyFacts,
): RuleExplanation[] {
  const matched_rule_id = evaluatePolicy(
    policy_definition,
    facts,
  ).matched_rule_id;
  const rule_explanations = (policy_definition.rules ?? []).map((rule) =>
    explainOutcome(rule, {
      is_matched: rule.id === matched_rule_id,
      is_default: false,
      conditions: evaluateRule(rule, facts),
    }),
  );
  const default_explanation = explainOutcome(policy_definition.default, {
    is_matched: policy_definition.default.id === matched_rule_id,
    is_default: true,
    conditions: [],
  });
  return [...rule_explanations, default_explanation];
}
