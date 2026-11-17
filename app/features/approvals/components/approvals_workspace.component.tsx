"use client";

import { ClipboardCheck } from "lucide-react";
import { useState } from "react";

import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { useListNavigation } from "@/shared/keyboard/use_list_navigation.hook";
import { useQueryParam } from "@/shared/navigation/use_query_param.hook";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { BatchApproveResult, BatchGroup, CaseDecisionResult } from "@/shared/types/case.type";
import { Badge } from "@/shared/ui/badge.component";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { PageHeader } from "@/shared/ui/page_header.component";
import { SegmentedControl } from "@/shared/ui/segmented_control.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";
import { SplitView } from "@/shared/ui/split_view.component";

import { useApprovalQueue } from "../hooks/use_approval_queue.hook";
import { ApprovalListItem } from "./approval_list_item.component";
import { BatchApproveDialog } from "./batch_approve_dialog.component";
import { BatchGroupCallout } from "./batch_group_callout.component";
import { CasePackPanel } from "./case_pack_panel.component";
import { DecidedListItem } from "./decided_list_item.component";

const APPROVAL_LIST_ELEMENT_ID = "approval_queue";

type QueueView = "all" | "mine";

/** Approvals: the cases waiting for a decision on the left, the open case pack on the right. */
export function ApprovalsWorkspace() {
  const { current_staff, current_staff_id } = useCurrentStaff();
  const { queued_cases, decided_outcomes, batch_groups, is_loading, error_message, recordOutcome } = useApprovalQueue();
  const [selected_case_number, setSelectedCaseNumber] = useQueryParam("case");
  const [view_param, setViewParam] = useQueryParam("view");
  const [reviewed_batch_group, setReviewedBatchGroup] = useState<BatchGroup | null>(null);
  const [execution_results, setExecutionResults] = useState<Record<string, Record<string, unknown> | null>>({});
  const current_time_ms = useCurrentTime();
  const queue_view: QueueView = view_param === "mine" ? "mine" : "all";
  const my_cases = queued_cases.filter((queued_case) => queued_case.assigned_staff_id === current_staff_id);
  const visible_cases = queue_view === "mine" ? my_cases : queued_cases;
  const shown_case_number = selected_case_number ?? visible_cases[0]?.case_number ?? null;
  const list_navigation = useListNavigation({
    item_ids: visible_cases.map((visible_case) => visible_case.case_number),
    selected_id: shown_case_number,
    onOpen: setSelectedCaseNumber,
    list_element_id: APPROVAL_LIST_ELEMENT_ID,
  });
  const next_case_number = visible_cases.find((visible_case) => visible_case.case_number !== shown_case_number)?.case_number ?? null;

  const rememberExecutionResult = (case_number: string, execution_result: Record<string, unknown> | null) =>
    setExecutionResults((current_results) => ({ ...current_results, [case_number]: execution_result }));

  const recordDecision = (decision_result: CaseDecisionResult) => {
    setSelectedCaseNumber(decision_result.case.case_number);
    rememberExecutionResult(decision_result.case.case_number, decision_result.execution_result);
    recordOutcome({ decided_case: decision_result.case, execution_result: decision_result.execution_result });
  };

  const recordBatchApproval = (batch_result: BatchApproveResult) => {
    for (const approved_case of batch_result.approved) {
      const queued_case = queued_cases.find((each_case) => each_case.case_number === approved_case.case_number);
      rememberExecutionResult(approved_case.case_number, approved_case.execution_result);
      if (queued_case) {
        recordOutcome({
          decided_case: { ...queued_case, status: "EXECUTED", decision: "APPROVED", decided_by_name: current_staff?.name },
          execution_result: approved_case.execution_result,
        });
      }
    }
    setSelectedCaseNumber(null);
    setReviewedBatchGroup(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Approvals"
        meta={<Badge tone={queued_cases.length > 0 ? "info" : "neutral"}>{queued_cases.length} waiting</Badge>}
        actions={
          <SegmentedControl<QueueView>
            label="Show"
            value={queue_view}
            onChange={(next_view) => setViewParam(next_view === "all" ? null : next_view)}
            options={[
              { value: "all", label: `All (${queued_cases.length})` },
              { value: "mine", label: `Assigned to me (${my_cases.length})` },
            ]}
          />
        }
      />
      <SplitView
        list_label="Approval queue"
        has_selection={selected_case_number !== null}
        list={
          <div className="min-h-0 flex-1 overflow-y-auto">
            {batch_groups.map((batch_group) => (
              <BatchGroupCallout key={batch_group.group_key} batch_group={batch_group} onReview={setReviewedBatchGroup} />
            ))}
            {error_message ? <ErrorState className="m-3" title="Could not load the queue" message={error_message} /> : null}
            {is_loading ? <SkeletonList label="Loading the queue" /> : null}
            {!is_loading && visible_cases.length === 0 && decided_outcomes.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck aria-hidden />}
                title={queue_view === "mine" ? "Nothing is assigned to you" : "Nothing is waiting for approval"}
                description="New cases appear here the moment the AI proposes them, with their evidence and the rule that routed them."
              />
            ) : null}
            <ul id={APPROVAL_LIST_ELEMENT_ID}>
              {decided_outcomes.map((outcome) => (
                <DecidedListItem
                  key={outcome.decided_case.case_number}
                  outcome={outcome}
                  is_selected={outcome.decided_case.case_number === shown_case_number}
                  onOpen={setSelectedCaseNumber}
                />
              ))}
              {visible_cases.map((visible_case) => (
                <ApprovalListItem
                  key={visible_case.case_number}
                  queued_case={visible_case}
                  is_selected={visible_case.case_number === shown_case_number}
                  is_highlighted={visible_case.case_number === list_navigation.highlighted_id}
                  current_time_ms={current_time_ms}
                  onOpen={setSelectedCaseNumber}
                />
              ))}
            </ul>
          </div>
        }
        detail={
          shown_case_number ? (
            <CasePackPanel
              key={shown_case_number}
              case_number={shown_case_number}
              execution_result={execution_results[shown_case_number] ?? null}
              onDecided={recordDecision}
              onClose={() => setSelectedCaseNumber(null)}
              onOpenNext={next_case_number ? () => setSelectedCaseNumber(next_case_number) : null}
            />
          ) : (
            <EmptyState className="flex-1" icon={<ClipboardCheck aria-hidden />} title="You're all caught up" description="Pick a case on the left to see its case pack." />
          )
        }
      />
      <BatchApproveDialog batch_group={reviewed_batch_group} onClose={() => setReviewedBatchGroup(null)} onApproved={recordBatchApproval} />
    </div>
  );
}
