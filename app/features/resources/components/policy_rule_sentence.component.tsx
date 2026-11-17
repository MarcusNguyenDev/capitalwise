import { formatCodeLabel, formatFactValue } from "@/shared/format/format_values.util";
import { describeCondition, describeRuleOutcome } from "@/shared/policy/describe_policy.util";
import type { PolicyRule } from "@/shared/types/case.type";

function Keyword({ word }: { word: string }) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{word} </span>;
}

function describeProposal(proposal: Record<string, unknown>): string {
  return Object.entries(proposal)
    .map(([term_name, term_value]) => `${formatCodeLabel(term_name).toLowerCase()} ${formatFactValue(term_value)}`)
    .join(", ");
}

/** One policy rule as a readable sentence: IF conditions THEN outcome. */
export function PolicyRuleSentence({ rule, is_default = false }: { rule: PolicyRule; is_default?: boolean }) {
  const conditions = rule.when ?? [];
  const is_fallback = is_default || conditions.length === 0;
  return (
    <li className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
      <span className="font-mono text-xs font-semibold">{rule.id}</span>
      <div>
        <p className="leading-relaxed">
          {is_fallback ? (
            <Keyword word="Otherwise" />
          ) : (
            conditions.map((condition, condition_index) => (
              <span key={`${condition.fact}:${condition.op}`}>
                <Keyword word={condition_index === 0 ? "If" : "and"} />
                {describeCondition(condition)}{" "}
              </span>
            ))
          )}
          {is_fallback ? null : <Keyword word="then" />}
          <span className="font-semibold">{describeRuleOutcome(rule)}</span>
          {rule.skill ? <span className="text-ink-soft"> · to the {formatCodeLabel(rule.skill).toLowerCase()} team</span> : null}
        </p>
        <p className="text-ink-soft">
          {rule.reason.replace(/\.$/, "")}.{rule.proposal ? ` Proposes: ${describeProposal(rule.proposal)}.` : ""}
        </p>
      </div>
    </li>
  );
}
