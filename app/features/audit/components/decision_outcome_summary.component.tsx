"use client";

import { formatCodeLabel, formatDateTime } from "@/shared/format/format_values.util";
import { useStaffName } from "@/shared/staff/use_staff_name.hook";
import { RecommendationBadge } from "@/shared/status/recommendation_badge.component";
import { TierBadge } from "@/shared/status/tier_badge.component";
import type { DecisionExplanation } from "@/shared/types/case.type";
import { LabelledValue } from "@/shared/ui/labelled_value.component";

function describeHumanDecision(explanation: DecisionExplanation): { headline: string; detail: string } {
  const { human_decision } = explanation;
  if (human_decision) {
    return {
      headline: `${formatCodeLabel(human_decision.decision)} by ${human_decision.decided_by_name ?? human_decision.decided_by ?? "staff"}`,
      detail: `${formatCodeLabel(human_decision.decided_by_role)} · ${human_decision.reason_label ?? formatCodeLabel(human_decision.reason_code)} · ${formatDateTime(human_decision.decided_at)}`,
    };
  }
  if (explanation.case.status === "AUTO_EXECUTED") {
    return { headline: "No person needed", detail: "Policy let this run automatically on the call." };
  }
  if (explanation.case.status === "AUTO_DECLINED") {
    return { headline: "No person needed", detail: "Policy declined this on the call. Nothing was carried out; the customer was offered a specialist review." };
  }
  return { headline: "Waiting for a decision", detail: "Nothing has been carried out yet." };
}

/** The answer first: what was decided, by which rule, who signed it off, and with which versions. */
export function DecisionOutcomeSummary({ explanation }: { explanation: DecisionExplanation }) {
  const { outcome, versions } = explanation;
  const policy_approver_name = useStaffName(versions.policy_approved_by);
  const human_decision = describeHumanDecision(explanation);

  return (
    <section aria-label="Decision summary" className="grid gap-x-8 gap-y-4 rounded-lg border border-line bg-white p-5 shadow-card md:grid-cols-3">
      <div className="md:col-span-3">
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier={outcome.tier} />
          <RecommendationBadge recommendation={outcome.recommendation} confidence={outcome.confidence} />
        </div>
        <p className="mt-2 text-sm">
          Policy rule <span className="font-mono text-xs font-semibold">{outcome.matched_rule_id}</span> decided: {outcome.reason}
        </p>
        {explanation.case.routing_rule ? (
          <p className="mt-1 text-sm text-ink-soft">
            Routed by “{explanation.case.routing_rule}”{explanation.case.assigned_staff_name ? ` to ${explanation.case.assigned_staff_name}` : ""}.
          </p>
        ) : null}
      </div>
      <dl className="contents">
        <LabelledValue label="Who decided">
          <span className="font-semibold">{human_decision.headline}</span>
          <span className="block text-ink-soft">{human_decision.detail}</span>
        </LabelledValue>
        <LabelledValue label="Model and prompt">
          <span className="font-mono text-xs">{versions.model}</span>
          <span className="block text-ink-soft">Prompt {versions.prompt_version}</span>
        </LabelledValue>
        <LabelledValue label="Policy version">
          <span className="font-mono text-xs">
            {versions.policy_id} v{versions.policy_version}
          </span>
          <span className="block text-ink-soft">Approved by {policy_approver_name}</span>
        </LabelledValue>
      </dl>
    </section>
  );
}
