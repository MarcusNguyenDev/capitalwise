"use client";

import { FileSearch } from "lucide-react";
import { useState } from "react";

import { fetchCases, fetchDecisionExplanation } from "@/shared/api_client/engine_api.client";
import { useListNavigation } from "@/shared/keyboard/use_list_navigation.hook";
import { CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { useQueryParam } from "@/shared/navigation/use_query_param.hook";
import { formatActionLabel } from "@/shared/status/format_action_label.util";
import type { EngineCase } from "@/shared/types/case.type";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { PageHeader } from "@/shared/ui/page_header.component";
import { SkeletonDetail, SkeletonList } from "@/shared/ui/skeleton.component";
import { SplitView } from "@/shared/ui/split_view.component";

import { EXPLAINER_CASE_LIMIT } from "../constants/audit_view.constant";
import { DecisionCaseList } from "./decision_case_list.component";
import { DecisionTrace } from "./decision_trace.component";

const DECISION_LIST_ELEMENT_ID = "decision_case_list";

function matchesSearch(engine_case: EngineCase, search_text: string): boolean {
  const searchable_text = `${engine_case.case_number} ${engine_case.customer_name} ${formatActionLabel(engine_case.action_code)} ${engine_case.matched_rule_id}`;
  return searchable_text.toLowerCase().includes(search_text.trim().toLowerCase());
}

function ExplanationPanel({ case_number, onClose }: { case_number: string; onClose: () => void }) {
  const explanation_query = useLiveQuery(() => fetchDecisionExplanation(case_number), CASE_EVENTS, case_number);
  if (explanation_query.data) {
    return <DecisionTrace explanation={explanation_query.data} onClose={onClose} />;
  }
  return explanation_query.error_message ? (
    <ErrorState className="m-6" title="Could not build the explanation" message={explanation_query.error_message} onRetry={explanation_query.reload} />
  ) : (
    <SkeletonDetail label="Building the explanation" />
  );
}

/** Decisions: pick any case and see why it happened and who approved it. `?q=` starts with a search. */
export function DecisionsWorkspace() {
  const cases_query = useLiveQuery(() => fetchCases({ limit: EXPLAINER_CASE_LIMIT }), CASE_EVENTS);
  const [selected_case_number, setSelectedCaseNumber] = useQueryParam("case");
  const [initial_search] = useQueryParam("q");
  const [search_text, setSearchText] = useState(initial_search ?? "");
  const matching_cases = (cases_query.data ?? []).filter((engine_case) => matchesSearch(engine_case, search_text));
  const shown_case_number = selected_case_number ?? matching_cases[0]?.case_number ?? null;
  const list_navigation = useListNavigation({
    item_ids: matching_cases.map((engine_case) => engine_case.case_number),
    selected_id: shown_case_number,
    onOpen: setSelectedCaseNumber,
    list_element_id: DECISION_LIST_ELEMENT_ID,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Decisions" description="Why each case was decided the way it was: what the AI knew, which rule decided, and who approved it." />
      <SplitView
        list_label="Cases"
        has_selection={selected_case_number !== null}
        list={
          cases_query.error_message ? (
            <ErrorState className="m-3" title="Could not load cases" message={cases_query.error_message} onRetry={cases_query.reload} />
          ) : cases_query.is_loading ? (
            <SkeletonList label="Loading cases" />
          ) : (
            <DecisionCaseList
              cases={matching_cases}
              list_element_id={DECISION_LIST_ELEMENT_ID}
              search_text={search_text}
              selected_case_number={shown_case_number}
              highlighted_case_number={list_navigation.highlighted_id}
              onSearch={setSearchText}
              onOpen={setSelectedCaseNumber}
            />
          )
        }
        detail={
          shown_case_number ? (
            <ExplanationPanel key={shown_case_number} case_number={shown_case_number} onClose={() => setSelectedCaseNumber(null)} />
          ) : (
            <EmptyState className="flex-1" icon={<FileSearch aria-hidden />} title="Pick a case to see how it was decided" />
          )
        }
      />
    </div>
  );
}
