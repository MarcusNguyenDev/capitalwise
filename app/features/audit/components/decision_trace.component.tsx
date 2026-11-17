"use client";

import { ArrowLeft, ScrollText } from "lucide-react";
import Link from "next/link";

import { EvidenceTable } from "@/features/approvals/components/evidence_table.component";
import { formatCodeLabel, formatDateTime } from "@/shared/format/format_values.util";
import { listCustomerQuotes } from "@/shared/format/list_customer_quotes.util";
import { CaseStatusBadge } from "@/shared/status/case_status_badge.component";
import type { DecisionExplanation } from "@/shared/types/case.type";
import { Badge } from "@/shared/ui/badge.component";
import { Card } from "@/shared/ui/card.component";
import { Disclosure } from "@/shared/ui/disclosure.component";
import { IconButton } from "@/shared/ui/icon_button.component";

import { CustomerExplanationDialog } from "./customer_explanation_dialog.component";
import { DecisionOutcomeSummary } from "./decision_outcome_summary.component";
import { ExplainedRuleCard } from "./explained_rule_card.component";
import { TraceToolCall } from "./trace_tool_call.component";

type ExplanationPart = { explanation: DecisionExplanation };

function CustomerSaid({ explanation }: ExplanationPart) {
  const customer_quotes = listCustomerQuotes(explanation.customer_said.statement, explanation.customer_said.quotes);
  if (customer_quotes.length === 0) {
    return <p className="text-sm text-ink-faint">No statement was recorded for this case.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {customer_quotes.map((customer_quote) => (
        <blockquote key={customer_quote} className="border-l-2 border-line-strong pl-3 text-sm italic text-ink-soft">
          “{customer_quote}”
        </blockquote>
      ))}
    </div>
  );
}

function SupervisorInterventions({ explanation }: ExplanationPart) {
  if (explanation.interventions.length === 0) {
    return <p className="text-sm text-ink-faint">No supervisor instructions or takeovers on this call.</p>;
  }
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {explanation.interventions.map((intervention) => (
        <li key={intervention.intervention_id} className="flex flex-wrap items-baseline gap-2">
          <Badge tone="attention">{formatCodeLabel(intervention.type)}</Badge>
          <span className="font-medium">{intervention.staff_name}</span>
          <span className="min-w-0 flex-1">{intervention.text ? `“${intervention.text}”` : ""}</span>
          <span className="text-xs text-ink-faint">{formatDateTime(intervention.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function CaseAuditTrail({ explanation }: ExplanationPart) {
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col text-sm">
        {explanation.audit_trail.map((audit_event) => (
          <li key={audit_event.event_id} className="grid grid-cols-[8.5rem_minmax(0,12rem)_1fr] gap-3 border-b border-line py-1.5 last:border-b-0">
            <span className="tabular-nums text-ink-soft">{formatDateTime(audit_event.occurred_at)}</span>
            <span className="truncate">{audit_event.actor_name ?? audit_event.actor_id ?? formatCodeLabel(audit_event.actor_type)}</span>
            <span>{formatCodeLabel(audit_event.event_type)}</span>
          </li>
        ))}
      </ol>
      <Link href={`/audit?case=${explanation.case.case_number}`} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-info hover:underline">
        <ScrollText className="size-4" aria-hidden />
        Open in the audit log
      </Link>
    </div>
  );
}

/** Why a case was decided the way it was: the answer first, then the steps behind it, technical detail collapsed. */
export function DecisionTrace({ explanation, onClose }: ExplanationPart & { onClose: () => void }) {
  const engine_case = explanation.case;
  return (
    <article aria-label={`Decision for ${engine_case.customer_name}`} className="flex min-h-0 flex-1 animate-fade-in flex-col">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line bg-white px-5 py-3.5">
        <IconButton label="Back to the list" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onClose} className="lg:hidden" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {engine_case.customer_name}: {formatCodeLabel(engine_case.action_code).toLowerCase()}
            </h2>
            <CaseStatusBadge status={engine_case.status} />
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            {engine_case.summary} <span className="font-mono text-xs text-ink-faint">{engine_case.case_number}</span>
          </p>
        </div>
        <CustomerExplanationDialog customer_explanation={explanation.customer_explanation} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-5">
          <DecisionOutcomeSummary explanation={explanation} />
          <Card title="What the customer said">
            <CustomerSaid explanation={explanation} />
          </Card>
          <Card title="The facts, and where each came from" description="Computed from the bank's records when the AI proposed the action.">
            <EvidenceTable evidence={explanation.facts} caption="Facts" />
          </Card>
          <section aria-label="Policy rules" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">
              Policy rules, checked in order <span className="font-normal text-ink-soft">· the first rule whose conditions are all met decides</span>
            </h3>
            {explanation.rules.map((rule) => (
              <ExplainedRuleCard key={rule.rule_id} rule={rule} />
            ))}
          </section>
          <Disclosure summary="What the AI looked up" meta={`${explanation.tool_calls.length} system checks`}>
            {explanation.tool_calls.length === 0 ? (
              <p className="text-sm text-ink-faint">No system checks were recorded on this case&apos;s call.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink-soft">Every check is validated on the server. The AI never supplies the facts itself.</p>
                {explanation.tool_calls.map((tool_call) => (
                  <TraceToolCall key={tool_call.seq} {...tool_call} />
                ))}
              </div>
            )}
          </Disclosure>
          <Disclosure summary="Supervisor instructions and takeovers" meta={`${explanation.interventions.length}`}>
            <SupervisorInterventions explanation={explanation} />
          </Disclosure>
          <Disclosure summary="Audit trail for this case" meta={`${explanation.audit_trail.length} records`}>
            <CaseAuditTrail explanation={explanation} />
          </Disclosure>
        </div>
      </div>
    </article>
  );
}
