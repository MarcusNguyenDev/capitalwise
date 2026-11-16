import { formatCodeLabel } from "@/shared/format/format_values.util";
import type { RegisteredAction } from "@/shared/types/resources.type";
import { Chip } from "@/shared/ui/chip.component";
import { Card, LabelledValue } from "@/shared/ui/surface.component";

import { RISK_CLASS_TONES } from "../constants/resources_view.constant";

import { PolicyVersionCard } from "./policy_version_card.component";

export function RegisteredActionCard({ registered_action }: { registered_action: RegisteredAction }) {
  const earlier_policies = registered_action.policy_history.filter(
    (policy) => policy.policy_id !== registered_action.active_policy?.policy_id,
  );
  return (
    <Card>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="text-2xl font-bold">{formatCodeLabel(registered_action.action_code)}</h3>
          <p className="text-lg text-ink-soft">{registered_action.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Chip tone={RISK_CLASS_TONES[registered_action.risk_class] ?? "neutral"}>{formatCodeLabel(registered_action.risk_class)} risk</Chip>
          <Chip tone={registered_action.reversible ? "positive" : "accent"}>{registered_action.reversible ? "Reversible" : "Not reversible"}</Chip>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-8">
        <LabelledValue label="Required evidence">
          <span className="flex flex-wrap gap-1.5">
            {registered_action.required_evidence.map((evidence_fact) => (
              <span key={evidence_fact} className="rounded-md border border-line px-2 py-0.5 font-mono text-sm">
                {evidence_fact}
              </span>
            ))}
          </span>
        </LabelledValue>
        <LabelledValue label="Skill needed to review">
          <span className="font-semibold">{formatCodeLabel(registered_action.required_skill)}</span>
        </LabelledValue>
      </div>
      <div className="mt-5">
        {registered_action.active_policy ? (
          <PolicyVersionCard policy={registered_action.active_policy} />
        ) : (
          <p className="text-ink-faint">No active policy. Every request is escalated.</p>
        )}
      </div>
      {earlier_policies.length > 0 ? (
        <details className="mt-4">
          <summary className="font-semibold text-ink-soft">
            Version history ({earlier_policies.length} earlier {earlier_policies.length === 1 ? "version" : "versions"})
          </summary>
          <div className="mt-3 space-y-3">
            {earlier_policies.map((policy) => (
              <PolicyVersionCard key={policy.policy_id} policy={policy} />
            ))}
          </div>
        </details>
      ) : null}
    </Card>
  );
}
