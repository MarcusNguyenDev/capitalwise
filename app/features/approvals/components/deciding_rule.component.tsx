import { formatConfidence } from "@/shared/policy/describe_policy.util";
import { RECOMMENDATION_TONES } from "@/shared/policy/policy_wording.constant";
import { RuleConditionTable } from "@/shared/policy/rule_condition_table.component";
import type { EngineCase, ExplainedRule } from "@/shared/types/case.type";
import { Chip } from "@/shared/ui/chip.component";

const RECOMMENDATION_TEXT_CLASS_NAMES = { positive: "text-positive", accent: "text-accent", warning: "text-warning" };
const RECOMMENDATION_BAR_CLASS_NAMES = { positive: "bg-positive", accent: "bg-accent", warning: "bg-warning" };

/** The recommendation and the deterministic rule that produced it, with each condition's actual value. */
export function DecidingRule({ engine_case, rules }: { engine_case: EngineCase; rules: ExplainedRule[] }) {
  const matched_rule = rules.find((rule) => rule.is_matched);
  const recommendation_tone = RECOMMENDATION_TONES[engine_case.recommendation] ?? "warning";
  return (
    <div>
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Recommendation</p>
          <p className={`text-3xl font-black ${RECOMMENDATION_TEXT_CLASS_NAMES[recommendation_tone]}`}>{engine_case.recommendation}</p>
        </div>
        <div className="w-64">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Confidence</span>
            <span className="text-xl font-bold tabular-nums">{formatConfidence(engine_case.confidence)}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${RECOMMENDATION_BAR_CLASS_NAMES[recommendation_tone]}`}
              style={{ width: formatConfidence(engine_case.confidence) }}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xl font-bold">
            AI proposed, policy <span className="font-mono text-accent">{engine_case.matched_rule_id}</span> decided
          </p>
          <Chip tone="dark">
            {engine_case.policy_id} · v{engine_case.policy_version}
          </Chip>
        </div>
        <p className="mt-1 text-lg text-ink-soft">{engine_case.route_reason}</p>
        <div className="mt-3">
          <RuleConditionTable conditions={matched_rule?.conditions ?? []} />
        </div>
      </div>
    </div>
  );
}
