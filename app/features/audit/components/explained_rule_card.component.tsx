import { describeRuleOutcome } from "@/shared/policy/describe_policy.util";
import { RuleConditionTable } from "@/shared/policy/rule_condition_table.component";
import type { ExplainedRule } from "@/shared/types/case.type";
import { Chip } from "@/shared/ui/chip.component";

export function ExplainedRuleCard({ rule }: { rule: ExplainedRule }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${rule.is_matched ? "border-2 border-accent bg-accent-soft/40" : "border-line bg-white"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-lg font-bold">{rule.rule_id}</span>
        {rule.is_matched ? <Chip tone="accent">Matched: this rule decided</Chip> : <Chip>Did not match</Chip>}
        {rule.is_default ? <Chip>Fallback rule</Chip> : null}
        <span className="text-ink-soft">
          Outcome: {describeRuleOutcome(rule)}. {rule.reason}
        </span>
      </div>
      <div className="mt-2">
        <RuleConditionTable conditions={rule.conditions} />
      </div>
    </div>
  );
}
