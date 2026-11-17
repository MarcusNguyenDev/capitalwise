import { formatFactValue } from "@/shared/format/format_values.util";
import type { FactValue, PolicyCondition, PolicyRoute, Recommendation } from "@/shared/types/case.type";

import { AUTO_DECLINE_PHRASE, FACT_LABELS, IDENTITY_LEVEL_FACT, OPERATOR_SYMBOLS, ROUTE_PHRASES } from "./policy_wording.constant";

export function describeFact(fact: string): string {
  return FACT_LABELS[fact] ?? fact.replaceAll("_", " ");
}

export function describeOperator(operator: string): string {
  return OPERATOR_SYMBOLS[operator] ?? operator;
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** An identity level test in words: gte 2 -> "confirmed to level 2", lt 2 -> "not yet confirmed to level 2". */
function describeIdentityLevelTest(operator: string, level: number): string {
  switch (operator) {
    case "gte":
      return level <= 0 ? "any level" : `confirmed to level ${level}`;
    case "gt":
      return `confirmed to level ${level + 1}`;
    case "lt":
      return level <= 1 ? "not yet confirmed" : `not yet confirmed to level ${level}`;
    case "lte":
      return level <= 0 ? "not yet confirmed" : `not yet confirmed to level ${level + 1}`;
    case "eq":
      return level <= 0 ? "not yet confirmed" : `confirmed to exactly level ${level}`;
    default:
      return `${describeOperator(operator)} ${level}`;
  }
}

/** What a condition expects, without the fact's name: "≥ 2", or "confirmed to level 2" for the identity level. */
export function describeExpectation(condition: { fact: string; op: string; value: FactValue }): string {
  if (condition.fact === IDENTITY_LEVEL_FACT && typeof condition.value === "number") {
    return describeIdentityLevelTest(condition.op, condition.value);
  }
  return `${describeOperator(condition.op)} ${formatFactValue(condition.value)}`;
}

/** A fact's actual value: "level 2" (or "not confirmed") for the identity level, the formatted value otherwise. */
export function describeActualValue(fact: string, actual: FactValue | undefined): string {
  if (fact === IDENTITY_LEVEL_FACT && typeof actual === "number") {
    return actual <= 0 ? "Not confirmed" : `Level ${actual}`;
  }
  return formatFactValue(actual);
}

/** "refunds in last 12 months = 0", "identity confirmed to level 2" */
export function describeCondition(condition: PolicyCondition): string {
  return `${describeFact(condition.fact)} ${describeExpectation(condition)}`;
}

/** "send for approval, recommend approve (92%)", "decline on the spot (95%)" */
export function describeRuleOutcome(rule_outcome: { route: PolicyRoute; recommend: Recommendation; confidence: number }): string {
  const confidence_text = formatConfidence(rule_outcome.confidence);
  if (rule_outcome.route === "AUTO" && rule_outcome.recommend === "DECLINE") {
    return `${AUTO_DECLINE_PHRASE} (${confidence_text})`;
  }
  const route_phrase = ROUTE_PHRASES[rule_outcome.route];
  if (rule_outcome.route !== "APPROVE") {
    return `${route_phrase} (${confidence_text})`;
  }
  return `${route_phrase}, recommend ${rule_outcome.recommend.toLowerCase()} (${confidence_text})`;
}
