"use client";

import { useState } from "react";

import { fetchCases, fetchDecisionExplanation } from "@/shared/api_client/engine_api.client";
import { CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/surface.component";

import { EXPLAINER_CASE_LIMIT } from "../constants/audit_view.constant";

import { CasePicker } from "./case_picker.component";
import { DecisionTrace } from "./decision_trace.component";

function ExplanationPanel({ case_number }: { case_number: string }) {
  const explanation_query = useLiveQuery(() => fetchDecisionExplanation(case_number), CASE_EVENTS, case_number);
  if (explanation_query.data) {
    return <DecisionTrace explanation={explanation_query.data} />;
  }
  return explanation_query.error_message ? <ErrorState message={explanation_query.error_message} /> : <LoadingState label="Building the explanation" />;
}

export function DecisionExplainer() {
  const cases_query = useLiveQuery(() => fetchCases({ limit: EXPLAINER_CASE_LIMIT }), CASE_EVENTS);
  const [chosen_case_number, setChosenCaseNumber] = useState<string | null>(null);
  const selected_case_number = chosen_case_number ?? cases_query.data?.[0]?.case_number ?? null;

  return (
    <div className="grid grid-cols-[26rem_1fr] items-start gap-8">
      <aside className="sticky top-24">
        {cases_query.error_message ? <ErrorState message={cases_query.error_message} /> : null}
        {cases_query.is_loading ? <LoadingState label="Loading cases" /> : null}
        <CasePicker cases={cases_query.data ?? []} selected_case_number={selected_case_number} onSelect={setChosenCaseNumber} />
      </aside>
      {selected_case_number ? (
        <ExplanationPanel key={selected_case_number} case_number={selected_case_number} />
      ) : (
        <EmptyState title="Pick a case to see how it was decided" />
      )}
    </div>
  );
}
