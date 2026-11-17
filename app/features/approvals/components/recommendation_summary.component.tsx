import { Scale } from "lucide-react";

import { formatConfidence } from "@/shared/policy/describe_policy.util";
import { RECOMMENDATION_LABELS } from "@/shared/status/status_wording.constant";
import type { EngineCase } from "@/shared/types/case.type";

/** The answer first: what policy recommends, how sure, and which rule decided it. */
export function RecommendationSummary({ engine_case }: { engine_case: EngineCase }) {
  return (
    <section aria-label="Recommendation" className="flex gap-3 rounded-lg border border-line bg-white px-4 py-3 shadow-card">
      <Scale className="mt-0.5 size-5 shrink-0 text-ink-faint" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {RECOMMENDATION_LABELS[engine_case.recommendation]} <span className="font-normal text-ink-soft">· {formatConfidence(engine_case.confidence)} confidence</span>
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          The AI proposed this; policy rule <span className="font-mono text-xs font-semibold text-ink">{engine_case.matched_rule_id}</span> (
          {engine_case.policy_id} v{engine_case.policy_version}) decided it: {engine_case.route_reason}
        </p>
      </div>
    </section>
  );
}
