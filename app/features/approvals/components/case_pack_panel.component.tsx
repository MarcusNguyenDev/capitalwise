"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { fetchCasePack } from "@/shared/api_client/engine_api.client";
import { formatCodeLabel, formatCurrency, formatFactValue } from "@/shared/format/format_values.util";
import { listCustomerQuotes } from "@/shared/format/list_customer_quotes.util";
import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { useKeyboardShortcut } from "@/shared/keyboard/use_keyboard_shortcut.hook";
import { CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { RuleConditionTable } from "@/shared/policy/rule_condition_table.component";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { CaseDecision, CaseDecisionResult, CasePack, EngineCase } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";
import { Card } from "@/shared/ui/card.component";
import { Disclosure } from "@/shared/ui/disclosure.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { LabelledValue } from "@/shared/ui/labelled_value.component";
import { SkeletonDetail } from "@/shared/ui/skeleton.component";

import { AWAITING_DECISION_STATUSES } from "../constants/approval_queue.constant";
import { EDITABLE_ACTION_CODES } from "../constants/editable_params.constant";
import { useCaseDecision } from "../hooks/use_case_decision.hook";
import { CaseOutcome } from "./case_outcome.component";
import { CasePackHeader } from "./case_pack_header.component";
import { DecisionBar } from "./decision_bar.component";
import { DecisionDialog } from "./decision_dialog.component";
import { EvidenceTable } from "./evidence_table.component";
import { HardshipDeadline } from "./hardship_deadline.component";
import { RecommendationSummary } from "./recommendation_summary.component";
import { TranscriptExcerpt } from "./transcript_excerpt.component";

interface CasePackPanelProps {
  case_number: string;
  execution_result: Record<string, unknown> | null;
  onDecided: (decision_result: CaseDecisionResult) => void;
  onClose: () => void;
  /** Offered once this case is decided, so the reviewer moves straight on. */
  onOpenNext: (() => void) | null;
}

function CustomerNeed({ engine_case }: { engine_case: EngineCase }) {
  const customer_quotes = listCustomerQuotes(engine_case.customer_statement, engine_case.soft_signals?.quotes);
  const param_entries = Object.entries(engine_case.params);
  return (
    <Card title="What the customer needs">
      <p className="text-sm leading-relaxed">{engine_case.summary}</p>
      {customer_quotes.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {customer_quotes.map((customer_quote) => (
            <blockquote key={customer_quote} className="border-l-2 border-line-strong pl-3 text-sm italic text-ink-soft">
              “{customer_quote}”
            </blockquote>
          ))}
        </div>
      ) : null}
      {param_entries.length > 0 ? (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-3">
          {param_entries.map(([param_name, param_value]) => (
            <LabelledValue key={param_name} label={`Proposed ${formatCodeLabel(param_name).toLowerCase()}`}>
              <span className="font-semibold">{param_name === "amount" ? formatCurrency(Number(param_value)) : formatFactValue(param_value)}</span>
            </LabelledValue>
          ))}
        </dl>
      ) : null}
    </Card>
  );
}

function CasePackBody({ case_pack, execution_result, onDecided, onClose, onOpenNext }: { case_pack: CasePack } & Omit<CasePackPanelProps, "case_number">) {
  const current_time_ms = useCurrentTime();
  const { current_staff } = useCurrentStaff();
  const [chosen_decision, setChosenDecision] = useState<CaseDecision | null>(null);
  const engine_case = case_pack.case;
  const { is_submitting, submitDecision } = useCaseDecision(engine_case.case_number, (decision_result) => {
    setChosenDecision(null);
    onDecided(decision_result);
  });
  const is_awaiting_decision = AWAITING_DECISION_STATUSES.includes(engine_case.status);
  const can_edit = EDITABLE_ACTION_CODES.includes(engine_case.action_code);
  const matched_rule = case_pack.rules.find((rule) => rule.is_matched);
  const staff_name = current_staff?.name ?? "the signed-in staff member";

  useKeyboardShortcut("a", () => setChosenDecision("APPROVED"), { is_enabled: is_awaiting_decision });
  useKeyboardShortcut("e", () => setChosenDecision("EDITED_AND_APPROVED"), { is_enabled: is_awaiting_decision && can_edit });
  useKeyboardShortcut("r", () => setChosenDecision("REJECTED"), { is_enabled: is_awaiting_decision });
  useKeyboardShortcut("Escape", onClose);

  return (
    <article aria-label={`Case pack for ${engine_case.customer_name}`} className="flex min-h-0 flex-1 animate-fade-in flex-col">
      <CasePackHeader engine_case={engine_case} current_time_ms={current_time_ms} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-5">
          {is_awaiting_decision ? null : <CaseOutcome case_pack={case_pack} execution_result={execution_result} />}
          {engine_case.response_due_on ? <HardshipDeadline response_due_on={engine_case.response_due_on} current_time_ms={current_time_ms} /> : null}
          <RecommendationSummary engine_case={engine_case} />
          <CustomerNeed engine_case={engine_case} />
          <Card title="Evidence" description="Every fact was computed from the bank's records, not taken from the AI.">
            <EvidenceTable evidence={case_pack.evidence} />
          </Card>
          <Disclosure summary={`How rule ${engine_case.matched_rule_id} decided`} meta={`${matched_rule?.conditions.length ?? 0} conditions`}>
            <RuleConditionTable conditions={matched_rule?.conditions ?? []} />
          </Disclosure>
          <Disclosure summary="Transcript excerpt" meta={`${case_pack.transcript_excerpt.length} lines`}>
            <TranscriptExcerpt transcript_turns={case_pack.transcript_excerpt} />
          </Disclosure>
        </div>
      </div>
      {is_awaiting_decision ? <DecisionBar staff_name={staff_name} can_edit={can_edit} onChoose={setChosenDecision} /> : null}
      {!is_awaiting_decision && onOpenNext ? (
        <div className="flex justify-end border-t border-line bg-white px-5 py-3">
          <Button variant="primary" icon={<ArrowRight className="size-4" aria-hidden />} onClick={onOpenNext}>
            Next case
          </Button>
        </div>
      ) : null}
      {chosen_decision ? (
        <DecisionDialog
          key={chosen_decision}
          case_pack={case_pack}
          decision={chosen_decision}
          staff_name={staff_name}
          is_submitting={is_submitting}
          onClose={() => setChosenDecision(null)}
          onSubmit={(decision_input) => void submitDecision(decision_input)}
        />
      ) : null}
    </article>
  );
}

/** Everything needed to decide one case, with the decision bar always in reach. */
export function CasePackPanel({ case_number, execution_result, onDecided, onClose, onOpenNext }: CasePackPanelProps) {
  const case_pack_query = useLiveQuery(() => fetchCasePack(case_number), CASE_EVENTS, case_number);

  if (case_pack_query.data) {
    return <CasePackBody case_pack={case_pack_query.data} execution_result={execution_result} onDecided={onDecided} onClose={onClose} onOpenNext={onOpenNext} />;
  }
  return case_pack_query.error_message ? (
    <ErrorState className="m-6" title="Could not load the case pack" message={case_pack_query.error_message} onRetry={case_pack_query.reload} />
  ) : (
    <SkeletonDetail label="Loading the case pack" />
  );
}
