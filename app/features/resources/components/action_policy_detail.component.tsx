import { ArrowLeft } from "lucide-react";

import { formatCodeLabel } from "@/shared/format/format_values.util";
import { describeFact } from "@/shared/policy/describe_policy.util";
import { describeAction, formatActionLabel } from "@/shared/status/format_action_label.util";
import { IDENTITY_REQUIREMENT_DESCRIPTIONS, IDENTITY_REQUIREMENT_LABELS } from "@/shared/status/status_wording.constant";
import type { RegisteredAction } from "@/shared/types/resources.type";
import { Badge } from "@/shared/ui/badge.component";
import { Card } from "@/shared/ui/card.component";
import { Disclosure } from "@/shared/ui/disclosure.component";
import { IconButton } from "@/shared/ui/icon_button.component";
import { LabelledValue } from "@/shared/ui/labelled_value.component";

import { RISK_CLASS_TONES } from "../constants/resources_view.constant";
import { PolicyVersionCard } from "./policy_version_card.component";

/** One action the AI may propose: its risk, the evidence it needs, and the versioned rules that decide it. */
export function ActionPolicyDetail({ registered_action, onClose }: { registered_action: RegisteredAction; onClose: () => void }) {
  const earlier_policies = registered_action.policy_history.filter((policy) => policy.policy_id !== registered_action.active_policy?.policy_id || policy.version !== registered_action.active_policy?.version);
  return (
    <article aria-label={formatActionLabel(registered_action.action_code)} className="flex min-h-0 flex-1 animate-fade-in flex-col">
      <header className="flex items-start gap-4 border-b border-line bg-white px-5 py-3.5">
        <IconButton label="Back to the list" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onClose} className="lg:hidden" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{formatActionLabel(registered_action.action_code)}</h2>
            <Badge tone={RISK_CLASS_TONES[registered_action.risk_class] ?? "neutral"}>{formatCodeLabel(registered_action.risk_class)} risk</Badge>
            <Badge tone={registered_action.reversible ? "positive" : "attention"}>{registered_action.reversible ? "Reversible" : "Not reversible"}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">{describeAction(registered_action.action_code, registered_action.description)}</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-5">
          <Card>
            <dl className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
              <LabelledValue label="Evidence the AI must gather">
                <span className="flex flex-wrap gap-1.5">
                  {registered_action.required_evidence.map((evidence_fact) => (
                    <Badge key={evidence_fact}>{describeFact(evidence_fact)}</Badge>
                  ))}
                </span>
              </LabelledValue>
              {registered_action.required_identity_level === undefined ? null : (
                <LabelledValue label="Identity needed">
                  <span className="font-medium">{IDENTITY_REQUIREMENT_LABELS[registered_action.required_identity_level]}</span>
                  <span className="block max-w-56 text-ink-soft">{IDENTITY_REQUIREMENT_DESCRIPTIONS[registered_action.required_identity_level]}</span>
                </LabelledValue>
              )}
              <LabelledValue label="Skill needed to review">{formatCodeLabel(registered_action.required_skill)}</LabelledValue>
            </dl>
          </Card>
          <section aria-label="Active policy" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">
              Active policy <span className="font-normal text-ink-soft">· rules are checked in order and the first match decides</span>
            </h3>
            {registered_action.active_policy ? (
              <PolicyVersionCard policy={registered_action.active_policy} />
            ) : (
              <p className="text-sm text-ink-faint">No active policy. Every request is escalated.</p>
            )}
          </section>
          {earlier_policies.length > 0 ? (
            <Disclosure summary="Version history" meta={`${earlier_policies.length} earlier ${earlier_policies.length === 1 ? "version" : "versions"}`}>
              <div className="flex flex-col gap-3">
                {earlier_policies.map((policy) => (
                  <PolicyVersionCard key={`${policy.policy_id}:${policy.version}`} policy={policy} />
                ))}
              </div>
            </Disclosure>
          ) : null}
        </div>
      </div>
    </article>
  );
}
