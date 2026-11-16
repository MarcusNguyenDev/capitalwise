"use client";

import { useCallback, useMemo, useState } from "react";

import { fetchApprovalInbox, fetchBatchGroups } from "@/shared/api_client/engine_api.client";
import { CASE_EVENTS, LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveEvent } from "@/shared/live/use_live_event.hook";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { EngineCase } from "@/shared/types/case.type";

import { AWAITING_DECISION_STATUSES, OUTCOME_VISIBLE_MS } from "../constants/approval_queue.constant";
import { sortApprovalQueue } from "../utils/sort_approval_queue.util";

export interface DecidedOutcome {
  decided_case: EngineCase;
  execution_result: Record<string, unknown> | null;
}

function mergeOutcome(current_outcomes: DecidedOutcome[], new_outcome: DecidedOutcome): DecidedOutcome[] {
  const case_number = new_outcome.decided_case.case_number;
  const existing_outcome = current_outcomes.find((outcome) => outcome.decided_case.case_number === case_number);
  const merged_outcome = {
    decided_case: { ...existing_outcome?.decided_case, ...new_outcome.decided_case },
    execution_result: new_outcome.execution_result ?? existing_outcome?.execution_result ?? null,
  };
  return [merged_outcome, ...current_outcomes.filter((outcome) => outcome.decided_case.case_number !== case_number)];
}

/**
 * The approval inbox and batch groups, kept live, plus the cases decided in
 * the last few seconds so the reviewer sees what happened to them.
 */
export function useApprovalQueue() {
  const inbox_query = useLiveQuery(fetchApprovalInbox, CASE_EVENTS);
  const batch_groups_query = useLiveQuery(fetchBatchGroups, CASE_EVENTS);
  const [decided_outcomes, setDecidedOutcomes] = useState<DecidedOutcome[]>([]);
  const reloadInbox = inbox_query.reload;
  const reloadBatchGroups = batch_groups_query.reload;

  const showOutcomeBriefly = useCallback((outcome: DecidedOutcome) => {
    const case_number = outcome.decided_case.case_number;
    setDecidedOutcomes((current_outcomes) => mergeOutcome(current_outcomes, outcome));
    setTimeout(
      () => setDecidedOutcomes((current_outcomes) => current_outcomes.filter((each) => each.decided_case.case_number !== case_number)),
      OUTCOME_VISIBLE_MS,
    );
  }, []);

  /** Called after this reviewer decides, so the queue updates even before the live event arrives. */
  const recordOutcome = useCallback(
    (outcome: DecidedOutcome) => {
      showOutcomeBriefly(outcome);
      reloadInbox();
      reloadBatchGroups();
    },
    [showOutcomeBriefly, reloadInbox, reloadBatchGroups],
  );

  useLiveEvent<EngineCase>(LIVE_EVENT.CASE_UPDATED, (updated_case) => {
    if (updated_case.decision && !AWAITING_DECISION_STATUSES.includes(updated_case.status)) {
      showOutcomeBriefly({ decided_case: updated_case, execution_result: null });
    }
  });

  const queued_cases = useMemo(() => {
    const decided_case_numbers = new Set(decided_outcomes.map((outcome) => outcome.decided_case.case_number));
    return sortApprovalQueue((inbox_query.data ?? []).filter((queued_case) => !decided_case_numbers.has(queued_case.case_number)));
  }, [inbox_query.data, decided_outcomes]);

  return {
    queued_cases,
    decided_outcomes,
    batch_groups: batch_groups_query.data ?? [],
    is_loading: inbox_query.is_loading,
    error_message: inbox_query.error_message,
    recordOutcome,
  };
}
