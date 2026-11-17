import { describeRuleOutcome } from "@/shared/policy/describe_policy.util";
import { RuleConditionTable } from "@/shared/policy/rule_condition_table.component";
import type { ExplainedRule } from "@/shared/types/case.type";
import { Badge } from "@/shared/ui/badge.component";
import { Disclosure } from "@/shared/ui/disclosure.component";

/** One rule in the order policy checked it. The rule that decided is open; the others are a click away. */
export function ExplainedRuleCard({ rule }: { rule: ExplainedRule }) {
  return (
    <Disclosure
      is_open_by_default={rule.is_matched}
      className={rule.is_matched ? "border-ink/40" : undefined}
      summary={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{rule.rule_id}</span>
          {rule.is_matched ? <Badge tone="strong">Decided this case</Badge> : <Badge>Did not match</Badge>}
          {rule.is_default ? <Badge>Fallback</Badge> : null}
        </span>
      }
      meta={<span className="hidden md:inline">{describeRuleOutcome(rule)}</span>}
    >
      <p className="mb-2 text-sm text-ink-soft">{rule.reason}</p>
      <RuleConditionTable conditions={rule.conditions} />
    </Disclosure>
  );
}
