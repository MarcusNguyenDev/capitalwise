"use client";

import { fetchCasePack } from "@/shared/api_client/engine_api.client";
import { formatCodeLabel, formatCurrency, formatFactValue } from "@/shared/format/format_values.util";
import { listCustomerQuotes } from "@/shared/format/list_customer_quotes.util";
import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { CaseDecisionResult, CasePack, EngineCase } from "@/shared/types/case.type";
import { CareFlagChip, Chip, TierChip } from "@/shared/ui/chip.component";
import { Card, ErrorState, LabelledValue, LoadingState, SectionHeading } from "@/shared/ui/surface.component";

import { AWAITING_DECISION_STATUSES } from "../constants/approval_queue.constant";

import { CaseOutcome } from "./case_outcome.component";
import { DecidingRule } from "./deciding_rule.component";
import { DecisionControls } from "./decision_controls.component";
import { EvidenceTable } from "./evidence_table.component";
import { HardshipDeadline } from "./hardship_deadline.component";
import { SlaCountdown } from "./sla_countdown.component";
import { TranscriptExcerpt } from "./transcript_excerpt.component";

interface CasePackPanelProps {
  case_number: string;
  execution_result: Record<string, unknown> | null;
  onDecided: (decision_result: CaseDecisionResult) => void;
}

function CasePackHeader({ engine_case, current_time_ms }: { engine_case: EngineCase; current_time_ms: number | null }) {
  const is_awaiting_decision = AWAITING_DECISION_STATUSES.includes(engine_case.status);
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <p className="font-mono text-ink-soft">{engine_case.case_number}</p>
        <h2 className="text-3xl font-bold">{engine_case.customer_name}</h2>
        <p className="text-lg text-ink-soft">{engine_case.action_description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TierChip tier={engine_case.tier} />
          <Chip>{formatCodeLabel(engine_case.risk_class)} risk action</Chip>
          {engine_case.has_care_flag || engine_case.facts.has_care_flag === true ? <CareFlagChip /> : null}
        </div>
      </div>
      <div className="shrink-0 space-y-1 text-right">
        {is_awaiting_decision ? <SlaCountdown sla_due_at={engine_case.sla_due_at} current_time_ms={current_time_ms} /> : null}
        <p className="text-ink-soft">
          Routed to <span className="font-semibold text-ink">{engine_case.assigned_staff_name ?? "the team queue"}</span>
        </p>
        {engine_case.routing_rule ? <p className="max-w-xs text-sm text-ink-faint">{engine_case.routing_rule}</p> : null}
      </div>
    </div>
  );
}

function CustomerWords({ engine_case }: { engine_case: EngineCase }) {
  const customer_quotes = listCustomerQuotes(engine_case.customer_statement, engine_case.soft_signals?.quotes);
  if (customer_quotes.length === 0) {
    return <p className="text-ink-faint">No statement was recorded.</p>;
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

function RequestedTerms({ params }: { params: Record<string, unknown> }) {
  const param_entries = Object.entries(params);
  if (param_entries.length === 0) {
    return null;
  }
  return (
    <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-4">
      {param_entries.map(([param_name, param_value]) => (
        <LabelledValue key={param_name} label={formatCodeLabel(param_name)}>
          <span className="font-mono font-semibold">{param_name === "amount" ? formatCurrency(Number(param_value)) : formatFactValue(param_value)}</span>
        </LabelledValue>
      ))}
    </div>
  );
}

function CasePackBody({ case_pack, execution_result, onDecided }: { case_pack: CasePack } & Omit<CasePackPanelProps, "case_number">) {
  const current_time_ms = useCurrentTime();
  const engine_case = case_pack.case;
  const is_awaiting_decision = AWAITING_DECISION_STATUSES.includes(engine_case.status);
  return (
    <div className="animate-fade-in space-y-5">
      <CasePackHeader engine_case={engine_case} current_time_ms={current_time_ms} />
      {is_awaiting_decision ? (
        <DecisionControls case_pack={case_pack} onDecided={onDecided} />
      ) : (
        <CaseOutcome case_pack={case_pack} execution_result={execution_result} />
      )}
      {engine_case.response_due_on ? <HardshipDeadline response_due_on={engine_case.response_due_on} current_time_ms={current_time_ms} /> : null}
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <SectionHeading title="AI summary" />
          <p className="text-lg">{engine_case.summary}</p>
          <RequestedTerms params={engine_case.params} />
        </Card>
        <Card>
          <SectionHeading title="In the customer's own words" />
          <CustomerWords engine_case={engine_case} />
        </Card>
      </div>
      <Card>
        <DecidingRule engine_case={engine_case} rules={case_pack.rules} />
      </Card>
      <Card>
        <SectionHeading title="Evidence" description="Every fact was computed from the bank's records, not taken from the AI." />
        <EvidenceTable evidence={case_pack.evidence} />
      </Card>
      <Card>
        <SectionHeading title="Transcript excerpt" />
        <TranscriptExcerpt transcript_turns={case_pack.transcript_excerpt} />
      </Card>
    </div>
  );
}

export function CasePackPanel({ case_number, execution_result, onDecided }: CasePackPanelProps) {
  const case_pack_query = useLiveQuery(() => fetchCasePack(case_number), CASE_EVENTS, case_number);

  if (case_pack_query.data) {
    return <CasePackBody case_pack={case_pack_query.data} execution_result={execution_result} onDecided={onDecided} />;
  }
  return case_pack_query.error_message ? <ErrorState message={case_pack_query.error_message} /> : <LoadingState label="Loading case pack" />;
}
