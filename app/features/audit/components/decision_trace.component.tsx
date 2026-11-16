"use client";

import { formatCodeLabel, formatDateTime, formatFactValue } from "@/shared/format/format_values.util";
import { listCustomerQuotes } from "@/shared/format/list_customer_quotes.util";
import { formatConfidence } from "@/shared/policy/describe_policy.util";
import { ROUTE_PHRASES } from "@/shared/policy/policy_wording.constant";
import { RecommendationChip } from "@/shared/policy/recommendation_chip.component";
import { useStaffName } from "@/shared/staff/use_staff_name.hook";
import type { DecisionExplanation } from "@/shared/types/case.type";
import { Chip, TierChip } from "@/shared/ui/chip.component";
import { LabelledValue } from "@/shared/ui/surface.component";

import { CustomerExplanationPanel } from "./customer_explanation_panel.component";
import { ExplainedRuleCard } from "./explained_rule_card.component";
import { ToolCallCard } from "./tool_call_card.component";
import { TraceStep } from "./trace_step.component";

type ExplanationPart = { explanation: DecisionExplanation };

function CustomerSaid({ explanation }: ExplanationPart) {
  const customer_quotes = listCustomerQuotes(explanation.customer_said.statement, explanation.customer_said.quotes);
  if (customer_quotes.length === 0) {
    return <p className="text-ink-faint">No statement was recorded for this case.</p>;
  }
  return (
    <div className="space-y-2">
      {customer_quotes.map((customer_quote) => (
        <blockquote key={customer_quote} className="border-l-4 border-accent pl-4 text-lg italic">
          “{customer_quote}”
        </blockquote>
      ))}
    </div>
  );
}

function ToolCalls({ explanation }: ExplanationPart) {
  if (explanation.tool_calls.length === 0) {
    return <p className="text-ink-faint">No tool calls were recorded on this case&apos;s call.</p>;
  }
  return (
    <div className="space-y-3">
      {explanation.tool_calls.map((tool_call) => (
        <ToolCallCard key={tool_call.seq} {...tool_call} />
      ))}
    </div>
  );
}

function FactTable({ explanation }: ExplanationPart) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="text-sm uppercase tracking-wide text-ink-faint">
          <th className="py-1.5 font-semibold">Fact</th>
          <th className="py-1.5 font-semibold">Value</th>
          <th className="py-1.5 font-semibold">Source view</th>
        </tr>
      </thead>
      <tbody>
        {explanation.facts.map((fact_row) => (
          <tr key={fact_row.fact} className="border-t border-line">
            <td className="py-1.5 pr-4 font-medium">{fact_row.label}</td>
            <td className="py-1.5 pr-4 font-mono text-[0.95rem] font-semibold">{formatFactValue(fact_row.value)}</td>
            <td className="py-1.5 font-mono text-sm text-ink-soft">{fact_row.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RouteOutcome({ explanation }: ExplanationPart) {
  const { outcome } = explanation;
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <TierChip tier={outcome.tier} />
        <RecommendationChip recommendation={outcome.recommendation} confidence={outcome.confidence} />
        <span className="text-lg">
          Policy rule <span className="font-mono font-bold text-accent">{outcome.matched_rule_id}</span> said:{" "}
          <span className="font-semibold">{ROUTE_PHRASES[outcome.route] ?? outcome.route}</span> with {formatConfidence(outcome.confidence)} confidence.
        </span>
      </div>
      <p className="mt-2 text-lg text-ink-soft">{outcome.reason}</p>
      {explanation.case.routing_rule ? (
        <p className="mt-2 text-ink-soft">
          Routing: {explanation.case.routing_rule}
          {explanation.case.assigned_staff_name ? ` (${explanation.case.assigned_staff_name})` : ""}
        </p>
      ) : null}
    </div>
  );
}

function VersionGrid({ explanation }: ExplanationPart) {
  const { versions } = explanation;
  const policy_approver_name = useStaffName(versions.policy_approved_by);
  return (
    <div className="grid grid-cols-4 gap-6 rounded-xl border border-line px-5 py-4">
      <LabelledValue label="Model">
        <span className="font-mono font-semibold">{versions.model}</span>
      </LabelledValue>
      <LabelledValue label="Prompt version">
        <span className="font-mono font-semibold">{versions.prompt_version}</span>
      </LabelledValue>
      <LabelledValue label="Policy version">
        <span className="font-mono font-semibold">
          {versions.policy_id} · v{versions.policy_version}
        </span>
      </LabelledValue>
      <LabelledValue label="Policy approved by">
        <span className="font-semibold">{policy_approver_name}</span>
      </LabelledValue>
    </div>
  );
}

function SupervisorInterventions({ explanation }: ExplanationPart) {
  if (explanation.interventions.length === 0) {
    return <p className="text-ink-faint">No supervisor instructions or takeovers on this call.</p>;
  }
  return (
    <ul className="space-y-2">
      {explanation.interventions.map((intervention) => (
        <li key={intervention.intervention_id} className="flex items-baseline gap-3 rounded-xl border border-line px-4 py-2.5">
          <Chip tone="warning">{formatCodeLabel(intervention.type)}</Chip>
          <span className="font-semibold">{intervention.staff_name}</span>
          <span className="flex-1">{intervention.text ? `“${intervention.text}”` : ""}</span>
          <span className="text-sm text-ink-faint">{formatDateTime(intervention.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function HumanDecision({ explanation }: ExplanationPart) {
  const { human_decision } = explanation;
  if (!human_decision) {
    const is_auto_executed = explanation.case.status === "AUTO_EXECUTED";
    return (
      <p className="rounded-xl border border-dashed border-line px-5 py-4 text-lg text-ink-soft">
        {is_auto_executed
          ? "No human decision was needed. Policy allowed this low-risk, reversible action to run automatically."
          : "Waiting for a human decision. Nothing has been executed."}
      </p>
    );
  }
  const is_rejected = human_decision.decision === "REJECTED";
  return (
    <div className={`rounded-xl border-2 px-5 py-4 ${is_rejected ? "border-accent bg-accent-soft" : "border-positive bg-positive-soft"}`}>
      <p className={`text-2xl font-black ${is_rejected ? "text-accent" : "text-positive"}`}>{formatCodeLabel(human_decision.decision)}</p>
      <p className="mt-1 text-lg">
        {human_decision.decided_by_name ?? human_decision.decided_by} ({formatCodeLabel(human_decision.decided_by_role)}) ·{" "}
        {human_decision.reason_label ?? formatCodeLabel(human_decision.reason_code)} · {formatDateTime(human_decision.decided_at)}
      </p>
    </div>
  );
}

function AuditTrail({ explanation }: ExplanationPart) {
  return (
    <ol className="rounded-xl border border-line">
      {explanation.audit_trail.map((audit_event) => (
        <li key={audit_event.event_id} className="grid grid-cols-[4.5rem_10rem_14rem_1fr] gap-3 border-t border-line px-4 py-2 first:border-t-0">
          <span className="font-mono text-sm text-ink-faint">#{audit_event.event_id}</span>
          <span className="text-ink-soft">{formatDateTime(audit_event.occurred_at)}</span>
          <span className="font-semibold">{audit_event.actor_name ?? audit_event.actor_id ?? formatCodeLabel(audit_event.actor_type)}</span>
          <span className="font-mono">{audit_event.event_type}</span>
        </li>
      ))}
    </ol>
  );
}

/** The whole decision, step by step, from the customer's words to the human sign-off. */
export function DecisionTrace({ explanation }: ExplanationPart) {
  const engine_case = explanation.case;
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-ink-soft">{engine_case.case_number}</p>
          <h2 className="text-3xl font-bold">
            {engine_case.customer_name}: {formatCodeLabel(engine_case.action_code).toLowerCase()}
          </h2>
          <p className="text-lg text-ink-soft">{engine_case.summary}</p>
        </div>
        <Chip tone="dark" className="px-4 py-1.5 text-base">
          {formatCodeLabel(engine_case.status)}
        </Chip>
      </div>
      <CustomerExplanationPanel customer_explanation={explanation.customer_explanation} />
      <ol>
        <TraceStep step_number={1} title="What the customer said">
          <CustomerSaid explanation={explanation} />
        </TraceStep>
        <TraceStep step_number={2} title="What the AI looked up" description="Every tool call is validated on the server. The AI never supplies the facts itself.">
          <ToolCalls explanation={explanation} />
        </TraceStep>
        <TraceStep step_number={3} title="The facts, and where each came from" description="Computed from the bank's records when the AI proposed the action.">
          <FactTable explanation={explanation} />
        </TraceStep>
        <TraceStep step_number={4} title="Policy rules, checked in order" description="Deterministic rules decide. The first rule whose conditions all pass wins.">
          <div className="space-y-3">
            {explanation.rules.map((rule) => (
              <ExplainedRuleCard key={rule.rule_id} rule={rule} />
            ))}
          </div>
        </TraceStep>
        <TraceStep step_number={5} title="Route and recommendation">
          <RouteOutcome explanation={explanation} />
        </TraceStep>
        <TraceStep step_number={6} title="Model, prompt and policy versions">
          <VersionGrid explanation={explanation} />
        </TraceStep>
        <TraceStep step_number={7} title="Supervisor instructions and takeovers" description="Instructions shape how the AI speaks. They cannot bypass policy.">
          <SupervisorInterventions explanation={explanation} />
        </TraceStep>
        <TraceStep step_number={8} title="The human decision">
          <HumanDecision explanation={explanation} />
        </TraceStep>
        <TraceStep step_number={9} title="Audit trail for this case" is_last>
          <AuditTrail explanation={explanation} />
        </TraceStep>
      </ol>
    </div>
  );
}
