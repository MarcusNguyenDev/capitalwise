import { formatFactValue } from "@/shared/format/format_values.util";
import type { PolicyCondition, PolicyRoute, Recommendation } from "@/shared/types/case.type";

import { FACT_LABELS, OPERATOR_SYMBOLS, ROUTE_PHRASES } from "./policy_wording.constant";

export function describeFact(fact: string): string {
  return FACT_LABELS[fact] ?? fact.replaceAll("_", " ");
}

export function describeOperator(operator: string): string {
  return OPERATOR_SYMBOLS[operator] ?? operator;
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** "refunds in last 12 months = 0" */
export function describeCondition(condition: PolicyCondition): string {
  return `${describeFact(condition.fact)} ${describeOperator(condition.op)} ${formatFactValue(condition.value)}`;
}

/** "send for approval, recommend APPROVE (92%)" */
export function describeRuleOutcome(rule_outcome: { route: PolicyRoute; recommend: Recommendation; confidence: number }): string {
  const route_phrase = ROUTE_PHRASES[rule_outcome.route];
  if (rule_outcome.route !== "APPROVE") {
    return `${route_phrase} (${formatConfidence(rule_outcome.confidence)})`;
  }
  return `${route_phrase}, recommend ${rule_outcome.recommend} (${formatConfidence(rule_outcome.confidence)})`;
}
