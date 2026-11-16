import { formatCodeLabel, formatFactValue } from "@/shared/format/format_values.util";
import { describeCondition, describeRuleOutcome } from "@/shared/policy/describe_policy.util";
import type { PolicyRule } from "@/shared/types/case.type";

function Keyword({ word }: { word: string }) {
  return <span className="font-bold text-accent">{word} </span>;
}

function describeProposal(proposal: Record<string, unknown>): string {
  return Object.entries(proposal)
    .map(([term_name, term_value]) => `${formatCodeLabel(term_name).toLowerCase()} ${formatFactValue(term_value)}`)
    .join(", ");
}

/** One policy rule as a readable sentence: IF conditions THEN route and recommendation. */
export function PolicyRuleSentence({ rule, is_default = false }: { rule: PolicyRule; is_default?: boolean }) {
  const conditions = rule.when ?? [];
  return (
    <li className="grid grid-cols-[7.5rem_1fr] gap-3 border-t border-line py-2.5 first:border-t-0">
      <span className="font-mono font-bold">{rule.id}</span>
      <div>
        <p className="text-lg leading-snug">
          {is_default || conditions.length === 0 ? (
            <Keyword word="OTHERWISE" />
          ) : (
            conditions.map((condition, condition_index) => (
              <span key={`${condition.fact}:${condition.op}`}>
                <Keyword word={condition_index === 0 ? "IF" : "AND"} />
                {describeCondition(condition)}{" "}
              </span>
            ))
          )}
          {is_default || conditions.length === 0 ? null : <Keyword word="THEN" />}
          <span className="font-semibold">{describeRuleOutcome(rule)}</span>
        </p>
        <p className="text-ink-soft">
          {rule.reason.replace(/\.$/, "")}.{rule.proposal ? ` Proposes: ${describeProposal(rule.proposal)}.` : ""}
        </p>
      </div>
    </li>
  );
}
